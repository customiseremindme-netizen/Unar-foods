"use server";

import { redirect } from "next/navigation";
import type { RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { completeTwoStep, endAllSessions, startSession } from "@/lib/auth/accounts";
import { verifyPassword } from "@/lib/auth/password";
import { getPendingTwoStepUser, getSessionUser, staffNeedsTwoStepSetup } from "@/lib/auth/session";
import { newRecoveryCodes, newTotpSecret, normalizeRecoveryCode, otpauthUri, verifyTotp } from "@/lib/auth/totp";
import { upiQrSvg } from "@/lib/payments/upi";
import { getAllSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { sha256Hex } from "@/lib/security/tokens";
import { isSafeInternalPath } from "@/lib/validation/common";
import { logError } from "@/lib/monitoring";
import type { FormState } from "./engagement";

type TwoStepRow = { totp_secret: string | null; totp_pending_secret: string | null; totp_enabled_at: string | null; totp_last_step: number | null; recovery_codes: unknown; password_hash: string };

async function loadTwoStep(userId: string): Promise<TwoStepRow | null> {
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT totp_secret, totp_pending_secret, totp_enabled_at, totp_last_step, recovery_codes, password_hash FROM auth_users WHERE id = ?",
    [userId],
  );
  return (rows[0] as TwoStepRow | undefined) ?? null;
}

const recoveryHashes = (raw: unknown): string[] => {
  const list = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
};

/**
 * Checks an authenticator code (or a one-time recovery code) for a user and
 * records it so the same code can't be used twice. Returns what matched.
 */
async function checkSecondFactor(userId: string, input: string): Promise<"code" | "recovery" | null> {
  const row = await loadTwoStep(userId);
  if (!row?.totp_secret || !row.totp_enabled_at) return null;
  const pool = await getReadyPool();
  const step = verifyTotp(row.totp_secret, input, row.totp_last_step === null ? null : Number(row.totp_last_step));
  if (step !== null) {
    // Only one sign-in per code, even if two requests race.
    const [res] = await pool.query<import("mysql2/promise").ResultSetHeader>(
      "UPDATE auth_users SET totp_last_step = ? WHERE id = ? AND (totp_last_step IS NULL OR totp_last_step < ?)",
      [step, userId, step],
    );
    return res.affectedRows === 1 ? "code" : null;
  }
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length !== 12) return null;
  const hashes = recoveryHashes(row.recovery_codes);
  const hash = sha256Hex(normalized);
  if (!hashes.includes(hash)) return null;
  const remaining = hashes.filter((h) => h !== hash);
  const [res] = await pool.query<import("mysql2/promise").ResultSetHeader>(
    "UPDATE auth_users SET recovery_codes = ? WHERE id = ? AND JSON_CONTAINS(recovery_codes, JSON_QUOTE(?))",
    [JSON.stringify(remaining), userId, hash],
  );
  return res.affectedRows === 1 ? "recovery" : null;
}

/** Second step of signing in: the 6-digit code from the authenticator app (or a recovery code). */
export async function verifyTwoStepAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getPendingTwoStepUser();
  if (!user) return { ok: false, message: "Your sign-in has expired. Please sign in again." };
  const ip = await getClientIp();
  if (!(await checkRateLimit("twoStep", user.id)) || !(await checkRateLimit("twoStep", `ip:${ip}`))) {
    return { ok: false, message: "Too many attempts. Please wait 10 minutes and try again." };
  }
  const code = String(formData.get("code") ?? "").slice(0, 40);
  let matched: "code" | "recovery" | null = null;
  try {
    matched = await checkSecondFactor(user.id, code);
  } catch (error) {
    logError("auth.two_step", error);
  }
  if (!matched) return { ok: false, message: "That code didn't work. Check the time on your phone and use the newest code." };
  await completeTwoStep();
  const next = String(formData.get("next") ?? "");
  redirect(next && isSafeInternalPath(next) && !next.startsWith("/auth") ? next : "/account");
}

export type TwoStepSetup = { ok: boolean; message?: string; secret?: string; qrSvg?: string; recoveryCodes?: string[] };

/** Starts setting up two-step sign-in: a new secret, shown as a QR code for the authenticator app. */
export async function beginTwoStepSetupAction(): Promise<TwoStepSetup> {
  const user = await getSessionUser();
  if (!user?.email) return { ok: false, message: "Please sign in again." };
  if (!(await checkRateLimit("securityChange", user.id))) return { ok: false, message: "Please wait a few minutes and try again." };
  // Already on: it can only be replaced after switching it off (which needs the password and a code).
  if ((await loadTwoStep(user.id))?.totp_enabled_at) return { ok: false, message: "Two-step sign-in is already on." };
  const secret = newTotpSecret();
  const pool = await getReadyPool();
  await pool.query("UPDATE auth_users SET totp_pending_secret = ? WHERE id = ?", [secret, user.id]);
  const { store } = await getAllSettings();
  const qrSvg = await upiQrSvg(otpauthUri({ secret, account: user.email, issuer: store.name || "UNAR" }));
  return { ok: true, secret, qrSvg };
}

/** Finishes setup with the first code from the app; returns one-time recovery codes (shown once). */
export async function confirmTwoStepSetupAction(code: string): Promise<TwoStepSetup> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!(await checkRateLimit("twoStep", user.id))) return { ok: false, message: "Too many attempts. Please wait 10 minutes." };
  const row = await loadTwoStep(user.id);
  if (row?.totp_enabled_at) return { ok: false, message: "Two-step sign-in is already on." };
  if (!row?.totp_pending_secret) return { ok: false, message: "Start the setup again." };
  const step = verifyTotp(row.totp_pending_secret, code, null);
  if (step === null) return { ok: false, message: "That code didn't match. Make sure you scanned the newest QR code and try the current code." };
  const codes = newRecoveryCodes();
  const pool = await getReadyPool();
  await pool.query(
    "UPDATE auth_users SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled_at = UTC_TIMESTAMP(3), totp_last_step = ?, recovery_codes = ? WHERE id = ?",
    [step, JSON.stringify(codes.map((c) => sha256Hex(normalizeRecoveryCode(c)))), user.id],
  );
  // This browser has just proved the second step; other sessions must sign in again.
  await endAllSessions(user.id);
  await startSession(user.id, { twoStepDone: true });
  return { ok: true, recoveryCodes: codes };
}

/** New set of recovery codes (the old ones stop working). Needs a current code. */
export async function newRecoveryCodesAction(code: string): Promise<TwoStepSetup> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!(await checkRateLimit("twoStep", user.id))) return { ok: false, message: "Too many attempts. Please wait 10 minutes." };
  if ((await checkSecondFactor(user.id, code)) !== "code") return { ok: false, message: "Enter the current code from your authenticator app." };
  const codes = newRecoveryCodes();
  const pool = await getReadyPool();
  await pool.query("UPDATE auth_users SET recovery_codes = ? WHERE id = ?", [JSON.stringify(codes.map((c) => sha256Hex(normalizeRecoveryCode(c)))), user.id]);
  return { ok: true, recoveryCodes: codes };
}

/** Turns two-step sign-in off (needs the password and a current code; not allowed for staff when it is required). */
export async function disableTwoStepAction(password: string, code: string): Promise<{ ok: boolean; message: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!(await checkRateLimit("twoStep", user.id))) return { ok: false, message: "Too many attempts. Please wait 10 minutes." };
  const pool = await getReadyPool();
  const [staff] = await pool.query<RowDataPacket[]>("SELECT 1 FROM staff_members WHERE user_id = ?", [user.id]);
  const { security } = await getAllSettings();
  if (staff.length && security.require_staff_two_step) {
    return { ok: false, message: "Two-step sign-in is required for staff (Settings → Security), so it can't be switched off." };
  }
  const row = await loadTwoStep(user.id);
  if (!row || !(await verifyPassword(password, row.password_hash))) return { ok: false, message: "That password isn't right." };
  if (!(await checkSecondFactor(user.id, code))) return { ok: false, message: "Enter the current code from your authenticator app (or a recovery code)." };
  await pool.query("UPDATE auth_users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL, recovery_codes = NULL WHERE id = ?", [user.id]);
  return { ok: true, message: "Two-step sign-in is off." };
}

/** Signs this account out on every other phone and computer. */
export async function signOutEverywhereAction(): Promise<{ ok: boolean; message: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!(await checkRateLimit("securityChange", user.id))) return { ok: false, message: "Please wait a few minutes and try again." };
  await endAllSessions(user.id);
  await startSession(user.id, { twoStepDone: true });
  return { ok: true, message: "Signed out everywhere else. This browser stays signed in." };
}

/** For the security page: does this account use two-step, how many recovery codes are left, is it required. */
export async function twoStepStatus(): Promise<{ enabled: boolean; recoveryLeft: number; required: boolean; staffRule: boolean }> {
  const user = await getSessionUser();
  if (!user) return { enabled: false, recoveryLeft: 0, required: false, staffRule: false };
  const row = await loadTwoStep(user.id);
  const pool = await getReadyPool();
  const [staff] = await pool.query<RowDataPacket[]>("SELECT 1 FROM staff_members WHERE user_id = ?", [user.id]);
  const { security } = await getAllSettings();
  return {
    enabled: !!row?.totp_enabled_at,
    recoveryLeft: recoveryHashes(row?.recovery_codes).length,
    required: await staffNeedsTwoStepSetup(),
    // Staff can't switch it off while the shop requires it.
    staffRule: staff.length > 0 && security.require_staff_two_step,
  };
}

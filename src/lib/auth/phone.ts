import "server-only";
import { randomInt, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getReadyPool } from "@/lib/db/install";
import { getWhatsAppEnv } from "@/lib/env";
import { sendWhatsAppTemplate, whatsappNumber } from "@/lib/notifications/whatsapp";
import { getAllSettings } from "@/lib/settings";
import { randomToken, sha256Hex } from "@/lib/security/tokens";
import { normalizeIndianPhone } from "@/lib/validation/common";

/**
 * "Sign in with mobile number": a 6-digit code sent on WhatsApp (Meta's
 * WhatsApp Cloud API, an approved "Authentication" template). Codes last
 * 10 minutes, allow 5 tries, work once, and only their hash is stored.
 */
export type PhonePurpose = "login" | "link";
const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const now = () => new Date();
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000);
const codeHash = (id: string, code: string) => sha256Hex(`${id}:${code}`);

/** 10-digit Indian mobile number, or null. */
export function cleanPhone(input: string): string | null {
  const digits = normalizeIndianPhone(String(input ?? ""));
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function maskPhone(phone: string): string {
  return `+91 ${phone.slice(0, 2)}••••••${phone.slice(-2)}`;
}

/** Mobile sign-in is offered only when WhatsApp is connected and a sign-in template is set. */
export async function phoneSignInAvailable(): Promise<boolean> {
  if (!getWhatsAppEnv()) return false;
  const { notifications } = await getAllSettings();
  return notifications.whatsapp_enabled && !!notifications.whatsapp_tpl_login_code;
}

/** Creates a new code (older unused ones for this number and purpose stop working) and sends it. */
export async function sendPhoneCode(phone: string, purpose: PhonePurpose, userId: string | null = null): Promise<{ ok: boolean; error?: string }> {
  const { notifications } = await getAllSettings();
  const to = whatsappNumber(phone);
  if (!to || !notifications.whatsapp_tpl_login_code) return { ok: false, error: "Mobile sign-in isn't available right now." };
  const pool = await getReadyPool();
  const id = sha256Hex(randomToken(24));
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await pool.query("UPDATE phone_codes SET used_at = ? WHERE phone = ? AND purpose = ? AND used_at IS NULL", [now(), phone, purpose]);
  await pool.query("INSERT INTO phone_codes (id, phone, purpose, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    phone,
    purpose,
    userId,
    codeHash(id, code),
    inMinutes(CODE_MINUTES),
  ]);
  const result = await sendWhatsAppTemplate({ to, template: notifications.whatsapp_tpl_login_code, language: notifications.whatsapp_language, params: [code], buttonParam: code });
  if (result.status !== "sent") return { ok: false, error: "We couldn't send the code on WhatsApp. Please check the number is on WhatsApp, or sign in with email." };
  return { ok: true };
}

/** Checks a code; true once (it is used up). Wrong tries count towards the limit. */
export async function verifyPhoneCode(phone: string, purpose: PhonePurpose, code: string, userId: string | null = null): Promise<boolean> {
  const clean = String(code ?? "").replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, code_hash, attempts, user_id FROM phone_codes WHERE phone = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    [phone, purpose, now()],
  );
  const row = rows[0];
  if (!row || Number(row.attempts) >= MAX_ATTEMPTS) return false;
  if (purpose === "link" && row.user_id !== userId) return false;
  const expected = Buffer.from(String(row.code_hash));
  const given = Buffer.from(codeHash(String(row.id), clean));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await pool.query("UPDATE phone_codes SET attempts = attempts + 1 WHERE id = ?", [row.id]);
    return false;
  }
  const [res] = await pool.query<ResultSetHeader>("UPDATE phone_codes SET used_at = ? WHERE id = ? AND used_at IS NULL", [now(), row.id]);
  return res.affectedRows === 1;
}

/** After a correct sign-in code for a number with no account: a short-lived proof for the "your details" step. */
export async function issueSignupProof(phone: string): Promise<string> {
  const pool = await getReadyPool();
  const token = randomToken(32);
  await pool.query("INSERT INTO phone_codes (id, phone, purpose, code_hash, expires_at) VALUES (?, ?, 'signup_proof', ?, ?)", [sha256Hex(token), phone, sha256Hex(`proof:${token}`), inMinutes(15)]);
  return token;
}

/** Uses up a signup proof and returns its number, or null. */
export async function consumeSignupProof(token: string): Promise<string | null> {
  if (!token) return null;
  const pool = await getReadyPool();
  const id = sha256Hex(token);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT phone FROM phone_codes WHERE id = ? AND purpose = 'signup_proof' AND used_at IS NULL AND expires_at > ?", [id, now()]);
  if (!rows[0]) return null;
  const [res] = await pool.query<ResultSetHeader>("UPDATE phone_codes SET used_at = ? WHERE id = ? AND used_at IS NULL", [now(), id]);
  return res.affectedRows === 1 ? String(rows[0].phone) : null;
}

/** Peeks at a signup proof without using it (to show the number on the details step). */
export async function peekSignupProof(token: string): Promise<string | null> {
  if (!token) return null;
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT phone FROM phone_codes WHERE id = ? AND purpose = 'signup_proof' AND used_at IS NULL AND expires_at > ?", [sha256Hex(token), now()]);
  return rows[0] ? String(rows[0].phone) : null;
}

export async function findUserByPhone(phone: string): Promise<string | null> {
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM auth_users WHERE phone = ? AND phone_verified_at IS NOT NULL", [phone]);
  return rows[0] ? String(rows[0].id) : null;
}

/** Links a proved number to an account. False when another account already uses it. */
export async function setUserPhone(userId: string, phone: string | null): Promise<boolean> {
  const pool = await getReadyPool();
  try {
    await pool.query("UPDATE auth_users SET phone = ?, phone_verified_at = ? WHERE id = ?", [phone, phone ? now() : null, userId]);
    if (phone) await pool.query("UPDATE profiles SET phone = COALESCE(NULLIF(phone, ''), ?) WHERE id = ?", [phone, userId]);
    return true;
  } catch (error) {
    if ((error as { errno?: number }).errno === 1062) return false;
    throw error;
  }
}

export async function getUserPhone(userId: string): Promise<string | null> {
  const pool = await getReadyPool();
  const [rows] = await pool.query<RowDataPacket[]>("SELECT phone FROM auth_users WHERE id = ? AND phone_verified_at IS NOT NULL", [userId]);
  return rows[0]?.phone ? String(rows[0].phone) : null;
}

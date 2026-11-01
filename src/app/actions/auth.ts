"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  authenticate,
  confirmEmail,
  consumeToken,
  cookieIsSecure,
  createUser,
  EmailTakenError,
  endAllSessions,
  endSession,
  findUserByEmail,
  issueToken,
  replaceUnconfirmedSignup,
  setPassword,
  startSession,
  type TokenPurpose,
} from "@/lib/auth/accounts";
import { verifyPassword } from "@/lib/auth/password";
import { getSessionUser } from "@/lib/auth/session";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getReadyPool } from "@/lib/db/install";
import { sendEmail } from "@/lib/email/send";
import { renderActionEmail } from "@/lib/email/templates";
import { getEmailEnv } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";
import { getRequestSiteUrl } from "@/lib/site-url";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { emailSchema, isSafeInternalPath, nameSchema, passwordSchema, toFieldErrors } from "@/lib/validation/common";
import { resolveCart } from "@/lib/commerce/cart";
import { logError } from "@/lib/monitoring";
import type { FormState } from "./engagement";

function safeNext(value: FormDataEntryValue | null, fallback = "/account"): string {
  const next = typeof value === "string" ? value : "";
  return next && isSafeInternalPath(next) && !next.startsWith("/auth") ? next : fallback;
}

/** Short-lived proof (httpOnly cookie) that this browser just opened a password-reset link. */
const RESET_COOKIE = "unar_reset";

/** Emails a one-time link (account confirmation or password reset). */
async function sendAccountLink(input: { userId: string; email: string; name?: string | null; purpose: "verify_email" | "reset_password"; next?: string }) {
  const verify = input.purpose === "verify_email";
  const token = await issueToken(input.userId, input.purpose, verify ? 24 * 60 : 60);
  const site = await getRequestSiteUrl();
  const params = new URLSearchParams({ token, type: verify ? "signup" : "recovery" });
  if (input.next && input.next !== "/account") params.set("next", input.next);
  const { store } = await getPublicSettings();
  const email = renderActionEmail({
    siteUrl: site,
    storeName: store.name,
    heading: verify ? "Confirm your email" : "Reset your password",
    greetingName: input.name,
    paragraphs: verify
      ? [`Thanks for creating an account with ${store.name}. Please confirm your email address to finish setting it up.`]
      : ["We received a request to reset the password for your account. Use the button below to choose a new password."],
    buttonLabel: verify ? "Confirm my email" : "Choose a new password",
    buttonUrl: `${site}/auth/confirm?${params.toString()}`,
    footnote: verify
      ? "This link works for 24 hours. If you didn't create an account, you can ignore this email."
      : "This link works for 1 hour and can be used once. If you didn't ask for this, you can ignore this email — your password stays the same.",
  });
  const result = await sendEmail({
    to: input.email,
    subject: verify ? `Confirm your ${store.name} account` : `Reset your ${store.name} password`,
    html: email.html,
    text: email.text,
    fromName: store.name,
  });
  if (result.status !== "sent") logError("auth.email", new Error(result.error ?? result.status));
  return result.status === "sent";
}

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(200) });

const text = (v: FormDataEntryValue | null, max = 254) => (typeof v === "string" ? v.slice(0, max) : "");

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData.get("email")) };
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error), values };
  const ip = await getClientIp();
  if (!(await checkRateLimit("login", `${ip}:${parsed.data.email}`)) || !(await checkRateLimit("loginAccount", parsed.data.email))) {
    return { ok: false, message: "Too many sign-in attempts. Please wait a while and try again.", values };
  }
  if (!isDatabaseConfigured()) return { ok: false, message: "Sign-in is not available yet — the shop's database is still being connected.", values };
  let result;
  try {
    result = await authenticate(parsed.data.email, parsed.data.password);
  } catch (error) {
    logError("auth.signin", error);
    return { ok: false, message: "Sign-in is temporarily unavailable. Please try again in a minute.", values };
  }
  if (!result.ok) {
    if (result.reason === "email_not_confirmed") {
      // The right password proves it's them: send a fresh confirmation link (or, if the shop
      // has no email set up, there is nothing to confirm with — activate the account).
      if (!getEmailEnv()) {
        await confirmEmail(result.userId);
      } else {
        if (await checkRateLimit("confirmResend", parsed.data.email)) {
          await sendAccountLink({ userId: result.userId, email: parsed.data.email, purpose: "verify_email", next: safeNext(formData.get("next")) }).catch((e) =>
            logError("auth.resend", e),
          );
        }
        return {
          ok: false,
          message: "Please confirm your email address first. We've sent you a new confirmation link — check your inbox (and spam folder).",
          values,
        };
      }
    } else {
      return { ok: false, message: "Incorrect email or password.", values };
    }
  }
  const userId = result.userId;
  await startSession(userId);
  // Merge the guest cart into the customer's cart.
  await resolveCart({ create: false, userId }).catch((e) => logError("auth.merge_cart", e));
  redirect(safeNext(formData.get("next")));
}

const registerSchema = z
  .object({
    full_name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    marketing: z.boolean(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

const REGISTERED_MESSAGE = "Almost done! We've sent a confirmation link to your email. Open it to activate your account.";

/**
 * Creates a customer account.
 * - Email set up (SMTP or Resend): the account is activated by the emailed link.
 * - No email set up: the account works straight away and the customer is signed in.
 */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { full_name: text(formData.get("full_name"), 120), email: text(formData.get("email")), marketing: formData.get("marketing") === "on" ? "on" : "" };
  // Hidden field only bots fill in: pretend it worked.
  if (text(formData.get("website"))) return { ok: true, message: REGISTERED_MESSAGE };
  const parsed = registerSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    marketing: formData.get("marketing") === "on",
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error), values };
  if (!(await checkRateLimit("signup", await getClientIp()))) {
    return { ok: false, message: "Too many sign-ups from this network. Please try again later.", values };
  }
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "Accounts are not available yet — the shop's database is still being connected. You can still contact us.", values };
  }
  const emailOn = !!getEmailEnv();
  const next = safeNext(formData.get("next"));
  const input = { email: parsed.data.email, password: parsed.data.password, fullName: parsed.data.full_name, marketingConsent: parsed.data.marketing };
  let userId: string;
  try {
    userId = await createUser({ ...input, confirmed: !emailOn });
  } catch (error) {
    if (!(error instanceof EmailTakenError)) {
      logError("auth.signup", error);
      return { ok: false, message: "We couldn't create your account. Please try again.", values };
    }
    const existing = await findUserByEmail(parsed.data.email).catch(() => null);
    if (existing && !existing.email_confirmed_at) {
      // Never confirmed: this sign-up replaces the earlier one (see replaceUnconfirmedSignup).
      const replaced = await replaceUnconfirmedSignup({ userId: existing.id, ...input, confirm: !emailOn }).catch((e) => {
        logError("auth.signup_replace", e);
        return false;
      });
      if (!replaced) return { ok: false, message: "We couldn't create your account. Please try again.", values };
      userId = existing.id;
    } else if (emailOn) {
      // Same answer whether or not the email already exists (prevents account discovery).
      return { ok: true, message: REGISTERED_MESSAGE };
    } else {
      return {
        ok: false,
        message: "An account with this email already exists. Please sign in instead.",
        errors: { email: "This email already has an account" },
        values,
      };
    }
  }
  if (!emailOn) {
    await startSession(userId);
    await resolveCart({ create: false, userId }).catch((e) => logError("auth.merge_cart", e));
    redirect(next);
  }
  const sent = await sendAccountLink({ userId, email: parsed.data.email, name: parsed.data.full_name, purpose: "verify_email", next });
  if (!sent) {
    return {
      ok: false,
      message: "Your account was created, but we couldn't send the confirmation email. Try signing in later — we'll send a new link then.",
      values,
    };
  }
  return { ok: true, message: REGISTERED_MESSAGE };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = { email: text(formData.get("email")) };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: null, errors: { email: "Enter a valid email address" }, values };
  if (!(await checkRateLimit("passwordReset", await getClientIp()))) {
    return { ok: false, message: "Too many requests. Please try again later." };
  }
  if (!isDatabaseConfigured() || !getEmailEnv()) {
    return { ok: false, message: "Password reset by email isn't available yet. Please contact us for help.", values };
  }
  try {
    const user = await findUserByEmail(parsed.data);
    if (user) await sendAccountLink({ userId: user.id, email: user.email, purpose: "reset_password" });
  } catch (error) {
    logError("auth.reset", error);
  }
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password." };
}

const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

/**
 * Sets a new password. Allowed when the browser just opened a password-reset
 * link, or — when changing it from the profile page — with the current password.
 */
export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Your session has ended. Please sign in again, or request a new reset link." };
  const jar = await cookies();
  try {
    const pool = await getReadyPool();
    const [rows] = await pool.query<import("mysql2/promise").RowDataPacket[]>("SELECT password_hash FROM auth_users WHERE id = ?", [user.id]);
    const currentHash = rows[0]?.password_hash as string | undefined;
    const resetToken = jar.get(RESET_COOKIE)?.value ?? "";
    let allowed = false;
    if (resetToken) {
      const owner = await consumeToken(resetToken, "reset_session");
      allowed = owner === user.id;
    }
    if (!allowed) {
      const current = formData.get("current");
      if (typeof current !== "string" || !current) {
        return { ok: false, message: null, errors: { current: "Enter your current password" } };
      }
      if (!(await verifyPassword(current, currentHash))) {
        return { ok: false, message: null, errors: { current: "That isn't your current password" } };
      }
    }
    if (await verifyPassword(parsed.data.password, currentHash)) {
      return { ok: false, message: "Please choose a password you haven't used before." };
    }
    await setPassword(user.id, parsed.data.password);
    // Sign out everywhere else, keep this browser signed in.
    await endAllSessions(user.id);
    await startSession(user.id);
    jar.delete(RESET_COOKIE);
  } catch (error) {
    logError("auth.update_password", error);
    return { ok: false, message: "We couldn't update your password. Please try again." };
  }
  return { ok: true, message: "Your password has been updated." };
}

export async function signOutAction() {
  await endSession();
  redirect("/");
}

/**
 * Finishes an emailed link after the person presses the button on
 * /auth/confirm (a button, not the link itself, so email security scanners
 * that open links can't use it up).
 */
export async function confirmLinkAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const type = String(formData.get("type") ?? "");
  const nextParam = String(formData.get("next") ?? "");
  const purpose: TokenPurpose | null = type === "signup" ? "verify_email" : type === "recovery" ? "reset_password" : null;
  let userId: string | null = null;
  if (purpose && isDatabaseConfigured()) {
    try {
      userId = await consumeToken(token, purpose);
      if (userId) {
        await confirmEmail(userId); // a reset link also proves the email address
        await startSession(userId);
        if (purpose === "reset_password") {
          const proof = await issueToken(userId, "reset_session", 30);
          (await cookies()).set(RESET_COOKIE, proof, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 60, secure: await cookieIsSecure() });
        }
      }
    } catch (error) {
      logError("auth.confirm", error);
      userId = null;
    }
  }
  if (!userId) redirect("/login?error=link");
  if (purpose === "reset_password") redirect("/reset-password");
  redirect(nextParam && isSafeInternalPath(nextParam) && !nextParam.startsWith("/auth") ? nextParam : "/account");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createUser, EmailTakenError, findUserByEmail, startSession } from "@/lib/auth/accounts";
import {
  cleanPhone,
  consumeSignupProof,
  findUserByPhone,
  issueSignupProof,
  maskPhone,
  phoneSignInAvailable,
  sendPhoneCode,
  setUserPhone,
  verifyPhoneCode,
} from "@/lib/auth/phone";
import { getSessionUser } from "@/lib/auth/session";
import { resolveCart } from "@/lib/commerce/cart";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { randomToken } from "@/lib/security/tokens";
import { emailSchema, isSafeInternalPath, nameSchema } from "@/lib/validation/common";
import { logError } from "@/lib/monitoring";

export type PhoneStepResult = { ok: boolean; message: string | null; step?: "code" | "details"; masked?: string };

const PROOF_COOKIE = "unar_phone_signup";
const safeNext = (next: string) => (next && isSafeInternalPath(next) ? next : "/account");

async function cookieSecure() {
  return process.env.NODE_ENV === "production" && process.env.UNAR_ALLOW_TEST_OVERRIDES !== "1";
}

/** Step 1: send a 6-digit code on WhatsApp to this number. */
export async function requestPhoneLoginCodeAction(phoneInput: string): Promise<PhoneStepResult> {
  if (!(await phoneSignInAvailable())) return { ok: false, message: "Mobile sign-in isn't available right now. Please sign in with email." };
  const phone = cleanPhone(phoneInput);
  if (!phone) return { ok: false, message: "Enter a valid 10-digit Indian mobile number." };
  const ip = await getClientIp();
  if (!(await checkRateLimit("phoneCodeIp", ip)) || !(await checkRateLimit("phoneCodePhone", phone))) {
    return { ok: false, message: "Too many codes requested. Please wait 15 minutes and try again." };
  }
  try {
    const sent = await sendPhoneCode(phone, "login");
    if (!sent.ok) return { ok: false, message: sent.error ?? "We couldn't send the code." };
  } catch (error) {
    logError("auth.phone_code", error);
    return { ok: false, message: "We couldn't send the code. Please try again." };
  }
  return { ok: true, message: null, step: "code", masked: maskPhone(phone) };
}

/** Step 2: check the code. Signs in, or asks a new customer for their name and email. */
export async function verifyPhoneLoginCodeAction(phoneInput: string, code: string, next: string): Promise<PhoneStepResult> {
  const phone = cleanPhone(phoneInput);
  if (!phone) return { ok: false, message: "Enter a valid 10-digit Indian mobile number." };
  if (!(await checkRateLimit("phoneCodeVerify", `${await getClientIp()}:${phone}`))) {
    return { ok: false, message: "Too many tries. Please wait 15 minutes and ask for a new code." };
  }
  if (!(await verifyPhoneCode(phone, "login", code))) {
    return { ok: false, message: "That code didn't work. Check the latest WhatsApp message, or ask for a new code." };
  }
  const userId = await findUserByPhone(phone);
  if (!userId) {
    const token = await issueSignupProof(phone);
    (await cookies()).set(PROOF_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: await cookieSecure(), path: "/", maxAge: 15 * 60 });
    return { ok: true, message: null, step: "details", masked: maskPhone(phone) };
  }
  const { needsTwoStep } = await startSession(userId);
  await resolveCart({ create: false }).catch(() => undefined);
  if (needsTwoStep) redirect(`/login/two-step?next=${encodeURIComponent(safeNext(next))}`);
  redirect(safeNext(next));
}

/** Step 3 (new customers only): name and email, then the account is created and signed in. */
export async function completePhoneSignupAction(input: { full_name: string; email: string; next: string }): Promise<PhoneStepResult & { errors?: Record<string, string> }> {
  const name = nameSchema.safeParse(input.full_name);
  const email = emailSchema.safeParse(input.email);
  const errors: Record<string, string> = {};
  if (!name.success) errors.full_name = name.error.issues[0]?.message ?? "Enter your name";
  if (!email.success) errors.email = email.error.issues[0]?.message ?? "Enter a valid email";
  if (!name.success || !email.success) return { ok: false, message: "Please check the highlighted fields.", errors };

  const store = await cookies();
  const token = store.get(PROOF_COOKIE)?.value ?? "";
  if (await findUserByEmail(email.data)) {
    return {
      ok: false,
      message: "An account already uses this email. Sign in with your email (or Google), then add your mobile number in Account → Security.",
      errors: { email: "Already has an account" },
    };
  }
  const phone = await consumeSignupProof(token);
  if (!phone) return { ok: false, message: "This step timed out. Please start again and ask for a new code." };
  let userId: string;
  try {
    // The email isn't proved yet; its real owner can still claim it later (that removes this number).
    userId = await createUser({ email: email.data, password: randomToken(32), fullName: name.data, confirmed: false });
  } catch (error) {
    if (error instanceof EmailTakenError) return { ok: false, message: "An account already uses this email.", errors: { email: "Already has an account" } };
    logError("auth.phone_signup", error);
    return { ok: false, message: "We couldn't create your account. Please try again." };
  }
  if (!(await setUserPhone(userId, phone))) return { ok: false, message: "This mobile number is already linked to another account." };
  store.delete(PROOF_COOKIE);
  await startSession(userId);
  await resolveCart({ create: false }).catch(() => undefined);
  redirect(safeNext(input.next));
}

// ---------------------------------------------------------------------------
// Account → Security: link a mobile number to an existing account
// ---------------------------------------------------------------------------
export async function requestLinkPhoneCodeAction(phoneInput: string): Promise<PhoneStepResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!(await phoneSignInAvailable())) return { ok: false, message: "Mobile sign-in isn't available right now." };
  const phone = cleanPhone(phoneInput);
  if (!phone) return { ok: false, message: "Enter a valid 10-digit Indian mobile number." };
  const owner = await findUserByPhone(phone);
  if (owner && owner !== user.id) return { ok: false, message: "This mobile number is already linked to another account." };
  if (!(await checkRateLimit("phoneCodeIp", await getClientIp())) || !(await checkRateLimit("phoneCodePhone", phone))) {
    return { ok: false, message: "Too many codes requested. Please wait 15 minutes and try again." };
  }
  const sent = await sendPhoneCode(phone, "link", user.id).catch((error) => {
    logError("auth.phone_link_code", error);
    return { ok: false, error: "We couldn't send the code." };
  });
  if (!sent.ok) return { ok: false, message: sent.error ?? "We couldn't send the code." };
  return { ok: true, message: null, step: "code", masked: maskPhone(phone) };
}

export async function confirmLinkPhoneAction(phoneInput: string, code: string): Promise<PhoneStepResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const phone = cleanPhone(phoneInput);
  if (!phone) return { ok: false, message: "Enter a valid 10-digit Indian mobile number." };
  if (!(await checkRateLimit("phoneCodeVerify", `${await getClientIp()}:${phone}`))) return { ok: false, message: "Too many tries. Please wait 15 minutes." };
  if (!(await verifyPhoneCode(phone, "link", code, user.id))) return { ok: false, message: "That code didn't work. Check the latest WhatsApp message, or ask for a new code." };
  if (!(await setUserPhone(user.id, phone))) return { ok: false, message: "This mobile number is already linked to another account." };
  return { ok: true, message: `You can now sign in with ${maskPhone(phone)}.` };
}

export async function removeLinkedPhoneAction(): Promise<PhoneStepResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  await setUserPhone(user.id, null);
  return { ok: true, message: "Mobile number sign-in is off for your account." };
}

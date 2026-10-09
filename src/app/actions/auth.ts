"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "Enter your password").max(200) });

export async function signInAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  const ip = await getClientIp();
  if (!(await checkRateLimit("login", `${ip}:${parsed.data.email}`))) {
    return { ok: false, message: "Too many sign-in attempts. Please wait 10 minutes and try again." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Sign-in is not available yet." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, message: "Please confirm your email address first — check your inbox for the link we sent." };
    }
    return { ok: false, message: "Incorrect email or password." };
  }
  // Merge the guest cart into the customer's cart.
  await resolveCart({ create: false }).catch((e) => logError("auth.merge_cart", e));
  redirect(safeNext(formData.get("next")));
}

const registerSchema = z
  .object({
    full_name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    marketing: z.boolean(),
    website: z.string().max(0).optional(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    marketing: formData.get("marketing") === "on",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  if (parsed.data.website) return { ok: true, message: "Check your email to confirm your account." };
  if (!(await checkRateLimit("signup", await getClientIp()))) {
    return { ok: false, message: "Too many sign-ups from this network. Please try again later." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Accounts are not available yet." };
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${await getRequestSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "weak_password") return { ok: false, message: "Please choose a stronger password.", errors: { password: error.message } };
    logError("auth.signup", error);
    return { ok: false, message: "We couldn't create your account. Please try again." };
  }
  if (data.user && parsed.data.marketing) {
    // Stored on the profile; actual newsletter subscription needs explicit opt-in on the newsletter form.
    await supabase.from("profiles").update({ marketing_consent: true }).eq("id", data.user.id);
  }
  if (data.session) redirect(next);
  // Same message whether or not the email already exists (prevents account discovery).
  return { ok: true, message: "Almost done! We've sent a confirmation link to your email. Open it to activate your account." };
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { ok: false, message: null, errors: { email: "Enter a valid email address" } };
  if (!(await checkRateLimit("passwordReset", await getClientIp()))) {
    return { ok: false, message: "Too many requests. Please try again later." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Password reset is not available yet." };
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await getRequestSiteUrl()}/auth/callback?next=/reset-password`,
  });
  if (error) logError("auth.reset", error);
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password." };
}

const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function updatePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, message: "Not available." };
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, message: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      message: error.code === "same_password" ? "Please choose a password you haven't used before." : "We couldn't update your password. Please try again.",
    };
  }
  return { ok: true, message: "Your password has been updated." };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/");
}

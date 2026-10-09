"use server";

import { z } from "zod";
import { getServiceDb } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { getAllSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { randomToken } from "@/lib/security/tokens";
import { emailSchema, nameSchema, toFieldErrors, type FieldErrors } from "@/lib/validation/common";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/templates";
import { logError } from "@/lib/monitoring";

export type FormState = { ok: boolean; message: string | null; errors?: FieldErrors };

const flag = (v: FormDataEntryValue | null) => v === "on" || v === "true";

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------
const newsletterSchema = z.object({
  email: emailSchema,
  consent: z.literal(true, { error: "Please tick the box to confirm you want to receive emails" }),
  website: z.string().max(0).optional(),
  source: z.string().max(40).optional(),
});

export async function subscribeNewsletterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newsletterSchema.safeParse({
    email: formData.get("email"),
    consent: flag(formData.get("consent")),
    website: formData.get("website") ?? "",
    source: formData.get("source") ?? "website",
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  // Honeypot filled → silently pretend success to the bot.
  if (parsed.data.website) return { ok: true, message: "Thank you for subscribing!" };
  if (!(await checkRateLimit("newsletter", await getClientIp()))) {
    return { ok: false, message: "Too many attempts. Please try again later." };
  }
  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "Sign-ups are not available right now. Please try again later." };
  const settings = await getAllSettings();
  if (!settings.newsletter.enabled) return { ok: false, message: "Newsletter sign-ups are currently closed." };

  const { data: existing } = await admin.from("subscribers").select("id, status").eq("email", parsed.data.email).maybeSingle();
  if (existing?.status === "subscribed") return { ok: true, message: "You're already subscribed — thank you!" };

  const record = {
    email: parsed.data.email,
    status: "subscribed",
    consent_text: settings.newsletter.consent_text,
    consent_at: new Date().toISOString(),
    source: parsed.data.source ?? "website",
    unsubscribed_at: null,
  };
  const { error } = existing
    ? await admin.from("subscribers").update(record).eq("id", existing.id)
    : await admin.from("subscribers").insert({ ...record, unsubscribe_token: randomToken(24) });
  if (error) {
    logError("newsletter.subscribe", error);
    return { ok: false, message: "We couldn't sign you up. Please try again." };
  }
  return { ok: true, message: "Thank you for subscribing! You can unsubscribe at any time." };
}

export async function unsubscribeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { ok: false, message: "This unsubscribe link is not valid." };
  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "Please try again later." };
  const { data, error } = await admin
    .from("subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "This unsubscribe link is not valid or has already been used." };
  return { ok: true, message: "You have been unsubscribed. You won't receive marketing emails from us." };
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------
const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((v) => v || undefined)
    .refine((v) => !v || /^[+\d\s-]{8,20}$/.test(v), "Enter a valid phone number"),
  subject: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => v || undefined),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(4000, "Please keep your message under 4000 characters"),
  website: z.string().max(0).optional(),
});

export async function submitContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  if (parsed.data.website) return { ok: true, message: "Thank you! We've received your message." };
  if (!(await checkRateLimit("contact", await getClientIp()))) {
    return { ok: false, message: "You've sent several messages recently. Please try again later or email us directly." };
  }
  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "Our contact form is not available right now. Please email us directly." };

  const { error } = await admin.from("contact_messages").insert({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    subject: parsed.data.subject ?? null,
    message: parsed.data.message,
  });
  if (error) {
    logError("contact.insert", error);
    return { ok: false, message: "We couldn't send your message. Please try again or email us directly." };
  }

  const settings = await getAllSettings();
  if (settings.notifications.admin_recipients.length > 0) {
    const d = parsed.data;
    await sendEmail({
      to: settings.notifications.admin_recipients,
      subject: `New website message from ${d.name}${d.subject ? `: ${d.subject}` : ""}`,
      replyTo: d.email,
      fromName: settings.notifications.from_name,
      html: `<p><strong>${escapeHtml(d.name)}</strong> (${escapeHtml(d.email)}${d.phone ? `, ${escapeHtml(d.phone)}` : ""}) wrote:</p><p style="white-space:pre-wrap">${escapeHtml(d.message)}</p>`,
      text: `${d.name} (${d.email}${d.phone ? `, ${d.phone}` : ""}) wrote:\n\n${d.message}`,
    });
  }
  return { ok: true, message: "Thank you! We've received your message and will reply by email." };
}

// ---------------------------------------------------------------------------
// Product reviews (moderated before they appear)
// ---------------------------------------------------------------------------
const reviewSchema = z.object({
  product_id: z.uuid(),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  title: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined),
  body: z.string().trim().min(10, "Please write at least 10 characters").max(2000, "Please keep your review under 2000 characters"),
  author_name: nameSchema.max(60, "Use 60 characters or fewer"),
  website: z.string().max(0).optional(),
});

export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please sign in to write a review." };

  const parsed = reviewSchema.safeParse({
    product_id: formData.get("product_id"),
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    body: formData.get("body"),
    author_name: formData.get("author_name"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, message: null, errors: toFieldErrors(parsed.error) };
  if (parsed.data.website) return { ok: true, message: "Thank you! Your review will appear once it has been checked." };
  if (!(await checkRateLimit("review", user.id))) return { ok: false, message: "Please wait a while before posting another review." };

  const admin = getServiceDb();
  if (!admin) return { ok: false, message: "Reviews are not available right now." };
  const settings = await getAllSettings();
  if (!settings.reviews.enabled) return { ok: false, message: "Reviews are currently closed." };

  const { data: product } = await admin
    .from("products")
    .select("id, status")
    .eq("id", parsed.data.product_id)
    .maybeSingle();
  if (!product || product.status !== "published") return { ok: false, message: "This product is not available for reviews." };

  // Verified purchase: the customer has a paid order containing this product.
  const { data: purchases } = await admin
    .from("order_items")
    .select("id, orders!inner(user_id, payment_status, status)")
    .eq("product_id", product.id)
    .eq("orders.user_id", user.id)
    .in("orders.payment_status", ["paid", "cod_collected", "partially_refunded"])
    .limit(1);
  const verified = (purchases ?? []).length > 0;
  if (settings.reviews.require_verified_purchase && !verified) {
    return { ok: false, message: "Only customers who have bought this product can review it." };
  }

  const { error } = await admin.from("reviews").insert({
    product_id: product.id,
    user_id: user.id,
    rating: parsed.data.rating,
    title: parsed.data.title ?? null,
    body: parsed.data.body,
    author_name: parsed.data.author_name,
    is_verified_purchase: verified,
    status: "pending",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You have already reviewed this product. Thank you!" };
    logError("review.insert", error);
    return { ok: false, message: "We couldn't save your review. Please try again." };
  }
  return { ok: true, message: "Thank you! Your review will appear once it has been checked." };
}

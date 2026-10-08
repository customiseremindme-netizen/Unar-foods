import "server-only";
import { getEmailEnv } from "@/lib/env";
import { logError } from "@/lib/monitoring";

export type SendResult = { status: "sent" | "skipped" | "failed"; id?: string; error?: string };

/**
 * Sends an email through Resend (https://resend.com). If email is not
 * configured yet, nothing is sent and the result is "skipped" — the admin
 * dashboard shows this honestly in the notification log.
 */
export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  fromName?: string;
}): Promise<SendResult> {
  const env = getEmailEnv();
  if (!env) return { status: "skipped", error: "Email provider not configured" };

  const from = input.fromName && !env.from.includes("<") ? `${input.fromName} <${env.from}>` : env.from;
  try {
    const res = await fetch(`${env.apiBaseUrl}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo || undefined,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { status: "failed", error: body.message ?? `HTTP ${res.status}` };
    return { status: "sent", id: body.id };
  } catch (error) {
    logError("email.send", error);
    return { status: "failed", error: error instanceof Error ? error.message : "Unknown error" };
  }
}

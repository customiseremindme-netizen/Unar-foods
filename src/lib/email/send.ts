import "server-only";
import { createTransport } from "nodemailer";
import { getEmailEnv, type SmtpEnv } from "@/lib/env";
import { logError } from "@/lib/monitoring";

export type SendResult = { status: "sent" | "skipped" | "failed"; id?: string; error?: string };

type Message = { from: string; to: string[]; subject: string; html: string; text: string; replyTo?: string };

async function sendViaSmtp(smtp: SmtpEnv, message: Message): Promise<SendResult> {
  const transport = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    requireTLS: smtp.port === 587,
    auth: { user: smtp.user, pass: smtp.password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    const info = await transport.sendMail({ ...message, replyTo: message.replyTo || undefined });
    return { status: "sent", id: info.messageId };
  } finally {
    transport.close();
  }
}

/**
 * Sends an email through Resend (https://resend.com) or an SMTP mailbox
 * (e.g. Hostinger Email). If email is not configured yet, nothing is sent
 * and the result is "skipped" — the admin dashboard shows this honestly in
 * the notification log.
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
  const to = Array.isArray(input.to) ? input.to : [input.to];
  if (env.provider === "smtp") {
    try {
      return await sendViaSmtp(env.smtp, { from, to, subject: input.subject, html: input.html, text: input.text, replyTo: input.replyTo });
    } catch (error) {
      logError("email.smtp", error);
      return { status: "failed", error: error instanceof Error ? error.message.slice(0, 200) : "SMTP error" };
    }
  }
  try {
    const res = await fetch(`${env.apiBaseUrl}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
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

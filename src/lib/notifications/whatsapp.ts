import "server-only";
import { getWhatsAppEnv } from "@/lib/env";

/** "9876543210" → "919876543210" (India). Returns null for anything that isn't a 10-digit mobile number. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : null;
}

/**
 * Sends an approved WhatsApp template message through Meta's WhatsApp Cloud
 * API. Business-initiated WhatsApp messages must use templates Meta has
 * approved; the body's {{1}}, {{2}}, {{3}} are filled with `params` in order.
 */
export async function sendWhatsAppTemplate(input: { to: string; template: string; language: string; params: string[]; buttonParam?: string }): Promise<{ status: "sent" | "failed" | "skipped"; id?: string; error?: string }> {
  const env = getWhatsAppEnv();
  if (!env) return { status: "skipped", error: "WhatsApp is not connected" };
  try {
    const res = await fetch(`${env.apiBaseUrl}/${env.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: input.to,
        type: "template",
        template: {
          name: input.template,
          language: { code: input.language },
          components: [
            ...(input.params.length ? [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text: text.slice(0, 200) })) }] : []),
            // Sign-in code templates ("Authentication") carry the code in their copy-code button too.
            ...(input.buttonParam ? [{ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: input.buttonParam }] }] : []),
          ],
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) return { status: "failed", error: (body.error?.message ?? `HTTP ${res.status}`).slice(0, 300) };
    return { status: "sent", id: body.messages?.[0]?.id };
  } catch (error) {
    return { status: "failed", error: (error as Error).message.slice(0, 300) };
  }
}

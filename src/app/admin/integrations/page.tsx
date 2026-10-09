import type { ReactNode } from "react";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRequestSiteUrl } from "@/lib/site-url";
import { getCronSecret, getEmailEnv, getRazorpayEnv, getConfiguredSiteUrl, getShiprocketEnv, getSupabaseEnv, getSupabaseSecretKey, maskSecret } from "@/lib/env";
import { formatDateTime } from "@/lib/utils";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { IntegrationTests } from "@/components/admin/integration-tests";
import { Badge } from "@/components/ui/misc";

export const metadata = { title: "Integrations" };

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-line/70 py-2 text-[0.85rem] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-[0.8rem]">{value}</span>
    </div>
  );
}

function Status({ ok, okText = "Connected", noText = "Not set up" }: { ok: boolean; okText?: string; noText?: string }) {
  return ok ? <Badge tone="success">{okText}</Badge> : <Badge tone="banana">{noText}</Badge>;
}

export default async function IntegrationsPage() {
  await requireStaffPage("settings.write");
  const supabase = (await createSupabaseServerClient())!;
  const razorpay = getRazorpayEnv();
  const email = getEmailEnv();
  const shiprocket = getShiprocketEnv();
  const supabaseEnv = getSupabaseEnv();
  const site = await getRequestSiteUrl();
  const siteConfigured = !!getConfiguredSiteUrl();
  const [{ data: webhooks }, { data: notifications }] = await Promise.all([
    supabase.from("webhook_events").select("id, provider, event_type, status, error, received_at").order("received_at", { ascending: false }).limit(15),
    supabase.from("notification_log").select("id, template, recipient, channel, status, error, created_at").order("created_at", { ascending: false }).limit(15),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connections to payment, email and shipping services. Secret keys are stored in your hosting settings (Hostinger or Vercel environment variables) — never here and never in the code. Only the last 4 characters are shown."
      />
      {!siteConfigured ? (
        <Notice tone="warning">
          NEXT_PUBLIC_SITE_URL is not set, so the site is using the address you are on now ({site}). Once your own domain is connected, set NEXT_PUBLIC_SITE_URL to it and redeploy, so email links and search engines always use your real address.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Razorpay (online payments)" actions={<Status ok={!!razorpay} />}>
          <Row label="Mode" value={razorpay ? (razorpay.mode === "live" ? <Badge tone="forest">Live — real money</Badge> : <Badge tone="banana">Test mode</Badge>) : "—"} />
          <Row label="Key ID" value={razorpay ? `${razorpay.keyId.slice(0, 12)}…${razorpay.keyId.slice(-4)}` : "not set"} />
          <Row label="Key secret" value={maskSecret(razorpay?.keySecret)} />
          <Row label="Webhook secret" value={razorpay?.webhookSecret ? maskSecret(razorpay.webhookSecret) : <span className="text-danger">not set</span>} />
          <Row label="Webhook URL to paste in Razorpay" value={`${site}/api/webhooks/razorpay`} />
          <p className="mt-3 text-[0.78rem] text-muted">Webhook events to tick: payment.authorized, payment.captured, payment.failed, order.paid, refund.processed, refund.failed.</p>
        </Card>

        <Card title="Email (order emails)" actions={<Status ok={!!email} />}>
          <Row label="Sent through" value={email ? (email.provider === "resend" ? "Resend" : `SMTP · ${email.smtp.host}:${email.smtp.port}`) : "not set"} />
          <Row label="Sender address" value={email?.from ?? "not set"} />
          <Row label={email?.provider === "smtp" ? "Mailbox password" : "API key"} value={maskSecret(email ? (email.provider === "resend" ? email.resendApiKey : email.smtp.password) : null)} />
          <p className="mt-3 text-[0.78rem] text-muted">
            Use Resend, or your Hostinger email (SMTP). Without email, orders still work — customers see their order on screen, but no emails are sent.
          </p>
        </Card>

        <Card title="Shiprocket (optional)" actions={<Status ok={!!shiprocket} noText="Not used" />}>
          <Row label="Login email" value={shiprocket ? shiprocket.email.replace(/^(.).*(@.*)$/, "$1•••$2") : "not set"} />
          <Row label="Password" value={maskSecret(shiprocket?.password)} />
          <p className="mt-3 text-[0.78rem] text-muted">Use a separate Shiprocket API user (Shiprocket → Settings → API), not your main login.</p>
        </Card>

        <Card title="Database & scheduled jobs" actions={<Status ok={!!supabaseEnv && !!getSupabaseSecretKey()} />}>
          <Row label="Supabase project" value={supabaseEnv ? new URL(supabaseEnv.url).host : "not set"} />
          <Row label="Server key" value={maskSecret(getSupabaseSecretKey())} />
          <Row label="Cron secret (payment check job)" value={getCronSecret() ? maskSecret(getCronSecret()) : <span className="text-danger">not set</span>} />
        </Card>
      </div>

      <IntegrationTests emailReady={!!email} shiprocketReady={!!shiprocket} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent payment webhooks" description="Messages Razorpay sent to your site.">
          {!webhooks?.length ? (
            <p className="text-[0.85rem] text-muted">None received yet.</p>
          ) : (
            <ul className="divide-y divide-line/70 text-[0.82rem]">
              {webhooks.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone={w.status === "processed" ? "success" : w.status === "failed" ? "danger" : "muted"}>{w.status}</Badge>
                  <span className="font-mono">{w.event_type}</span>
                  <span className="ml-auto text-muted">{formatDateTime(w.received_at)}</span>
                  {w.error ? <span className="w-full text-danger">{w.error}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent emails" description="Order emails and whether they were sent.">
          {!notifications?.length ? (
            <p className="text-[0.85rem] text-muted">No emails yet.</p>
          ) : (
            <ul className="divide-y divide-line/70 text-[0.82rem]">
              {notifications.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Badge tone={n.status === "sent" ? "success" : n.status === "failed" ? "danger" : "muted"}>{n.status}</Badge>
                  <span>{n.template.replace(/_/g, " ")}</span>
                  <span className="text-muted">→ {n.recipient}</span>
                  <span className="ml-auto text-muted">{formatDateTime(n.created_at)}</span>
                  {n.error ? <span className="w-full text-muted">{n.error}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

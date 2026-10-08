"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { check, runAdminAction, UserFacingError, type ActionResult } from "@/lib/admin/action";
import { logAdminAction } from "@/lib/audit";
import { revalidateStorefront } from "@/lib/cache";
import { PUBLIC_SETTINGS, settingsSchemas, type SettingsKey } from "@/lib/settings/schema";
import { STAFF_ROLES, ROLE_LABELS } from "@/lib/auth/permissions";
import { emailSchema } from "@/lib/validation/common";
import { requireAdminSupabase } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { testShiprocketConnection } from "@/lib/shipping/shiprocket";
import { getSetting } from "@/lib/settings";

const SETTING_KEYS = Object.keys(settingsSchemas) as [SettingsKey, ...SettingsKey[]];
const TEMPLATE_KEYS = ["order_placed", "payment_confirmed", "order_shipped", "order_delivered", "order_cancelled", "refund_issued"];

/**
 * Saves one settings group (e.g. "store", "seo", "checkout"). Values are
 * validated against the same schema the website uses to read them.
 */
export async function saveSettingAction(key: SettingsKey, value: unknown): Promise<ActionResult> {
  const permission = key === "shipping" ? "shipping.write" : "settings.write";
  return runAdminAction(permission, async ({ supabase, user }) => {
    z.enum(SETTING_KEYS).parse(key);
    const schema = settingsSchemas[key] as unknown as z.ZodType;
    const parsed = schema.parse(value) as Record<string, unknown>;
    if (key === "notifications") {
      const templates = (parsed.templates ?? {}) as Record<string, unknown>;
      for (const t of Object.keys(templates)) if (!TEMPLATE_KEYS.includes(t)) delete templates[t];
    }
    if (key === "checkout" && !parsed.online_payments_enabled && !parsed.cod_enabled) {
      throw new UserFacingError("Keep at least one payment method switched on, or turn on maintenance mode instead.");
    }
    check(
      await supabase
        .from("settings")
        .upsert({ key, value: parsed as never, is_public: PUBLIC_SETTINGS.includes(key), updated_by: user.id, updated_at: new Date().toISOString() }),
    );
    await logAdminAction({ action: "settings.save", entityType: "settings", entityId: key, summary: `Updated ${key.replace(/_/g, " ")} settings` });
    revalidateStorefront();
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Settings saved." };
  });
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------
const roleSchema = z.enum(STAFF_ROLES);

export async function addStaffAction(formData: FormData): Promise<ActionResult> {
  return runAdminAction("staff.manage", async ({ supabase, user }) => {
    const { email, role } = z.object({ email: emailSchema, role: roleSchema }).parse({ email: formData.get("email"), role: formData.get("role") });
    const admin = requireAdminSupabase();
    const { data: profile } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) throw new UserFacingError("No account uses that email. Ask the person to create an account on the website first (Sign in → Create an account) and confirm their email.");
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id);
    if (!authUser?.user?.email_confirmed_at) throw new UserFacingError("That person hasn't confirmed their email yet. Ask them to click the link in their confirmation email.");
    const { data: existing } = await supabase.from("staff_members").select("role").eq("user_id", profile.id).maybeSingle();
    if (existing) throw new UserFacingError(`That person is already staff (${ROLE_LABELS[existing.role as keyof typeof ROLE_LABELS]}). Change their role in the list instead.`);
    check(await supabase.from("staff_members").insert({ user_id: profile.id, role, created_by: user.id }));
    await logAdminAction({ action: "staff.add", entityType: "staff", entityId: profile.id, summary: `Gave ${email} ${ROLE_LABELS[role]} access` });
    revalidatePath("/admin/staff");
    return { ok: true, message: `${email} now has ${ROLE_LABELS[role]} access. They will see the dashboard next time they sign in.` };
  });
}

export async function changeStaffRoleAction(userId: string, role: string): Promise<ActionResult> {
  return runAdminAction("staff.manage", async ({ supabase, user }) => {
    z.uuid().parse(userId);
    const newRole = roleSchema.parse(role);
    if (userId === user.id) throw new UserFacingError("You can't change your own role. Ask another owner.");
    const { error } = await supabase.from("staff_members").update({ role: newRole }).eq("user_id", userId);
    if (error) throw new UserFacingError(error.message.includes("LAST_OWNER") ? "The store must keep at least one owner." : "Could not change the role.");
    await logAdminAction({ action: "staff.role", entityType: "staff", entityId: userId, summary: `Changed a staff role to ${ROLE_LABELS[newRole]}` });
    revalidatePath("/admin/staff");
    return { ok: true, message: "Role updated." };
  });
}

export async function removeStaffAction(userId: string): Promise<ActionResult> {
  return runAdminAction("staff.manage", async ({ supabase, user }) => {
    z.uuid().parse(userId);
    if (userId === user.id) throw new UserFacingError("You can't remove yourself. Ask another owner.");
    const { error } = await supabase.from("staff_members").delete().eq("user_id", userId);
    if (error) throw new UserFacingError(error.message.includes("LAST_OWNER") ? "The store must keep at least one owner." : "Could not remove access.");
    await logAdminAction({ action: "staff.remove", entityType: "staff", entityId: userId, summary: "Removed a staff member's dashboard access" });
    revalidatePath("/admin/staff");
    return { ok: true, message: "Dashboard access removed. Their customer account still works." };
  });
}

// ---------------------------------------------------------------------------
// Integration checks
// ---------------------------------------------------------------------------
export async function sendTestEmailAction(): Promise<ActionResult> {
  return runAdminAction("settings.write", async ({ user }) => {
    if (!user.email) throw new UserFacingError("Your account has no email address.");
    const notifications = await getSetting("notifications");
    const result = await sendEmail({
      to: user.email,
      subject: "UNAR test email",
      text: "This is a test email from your UNAR website. If you can read this, order emails are working.",
      html: "<p>This is a test email from your UNAR website.</p><p>If you can read this, order emails are working.</p>",
      fromName: notifications.from_name,
      replyTo: notifications.reply_to || undefined,
    });
    await logAdminAction({ action: "integrations.test_email", entityType: "integration", entityId: "email", summary: `Test email: ${result.status}` });
    if (result.status === "sent") return { ok: true, message: `Test email sent to ${user.email}. Check your inbox (and spam folder).` };
    if (result.status === "skipped") throw new UserFacingError("Email is not set up yet (RESEND_API_KEY and EMAIL_FROM are missing in Vercel).");
    throw new UserFacingError(`The email provider refused the message: ${result.error ?? "unknown error"}. Check that your sending domain is verified in Resend.`);
  });
}

export async function testShiprocketAction(): Promise<ActionResult> {
  return runAdminAction("settings.write", async () => {
    const result = await testShiprocketConnection();
    await logAdminAction({ action: "integrations.test_shiprocket", entityType: "integration", entityId: "shiprocket", summary: `Shiprocket test: ${result.ok ? "ok" : "failed"}` });
    if (!result.ok) throw new UserFacingError(result.message);
    return { ok: true, message: result.message };
  });
}

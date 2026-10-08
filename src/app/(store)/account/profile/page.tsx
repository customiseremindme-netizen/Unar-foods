import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/account/profile-form";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase!.from("profiles").select("full_name, phone, marketing_consent").eq("id", user.id).maybeSingle();
  return (
    <div className="space-y-12">
      <section>
        <h1 className="mb-8 text-[2.2rem]">Profile</h1>
        <ProfileForm
          profile={{
            full_name: data?.full_name ?? "",
            phone: data?.phone ?? "",
            marketing_consent: data?.marketing_consent ?? false,
            email: user.email ?? "",
          }}
        />
      </section>
      <section className="max-w-md">
        <h2 className="mb-6 text-[1.6rem]">Change password</h2>
        <div className="rounded-[1.75rem] border border-line bg-paper p-6">
          <ResetPasswordForm />
        </div>
      </section>
    </div>
  );
}

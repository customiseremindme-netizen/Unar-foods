import { requireUser } from "@/lib/auth/session";
import { twoStepStatus } from "@/app/actions/security";
import { SecuritySettings } from "@/components/auth/two-step";
import { LinkPhoneCard } from "@/components/auth/phone-login";
import { getUserPhone, maskPhone, phoneSignInAvailable } from "@/lib/auth/phone";

export default async function SecurityPage() {
  const user = await requireUser("/account/security");
  const status = await twoStepStatus();
  const [phoneOn, linked] = await Promise.all([phoneSignInAvailable(), getUserPhone(user.id)]);
  return (
    <div>
      <h1 className="mb-8 text-[2.2rem]">Security</h1>
      {phoneOn || linked ? (
        <div className="mb-8">
          <LinkPhoneCard linked={linked ? maskPhone(linked) : null} />
        </div>
      ) : null}
      <SecuritySettings
        enabled={status.enabled} recoveryLeft={status.recoveryLeft} mustSetUp={status.required || status.staffRule}
        email={user.email ?? ""}
        isStaff={status.isStaff}
      />
    </div>
  );
}

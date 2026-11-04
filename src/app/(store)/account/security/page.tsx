import { requireUser } from "@/lib/auth/session";
import { twoStepStatus } from "@/app/actions/security";
import { SecuritySettings } from "@/components/auth/two-step";

export default async function SecurityPage() {
  await requireUser("/account/security");
  const status = await twoStepStatus();
  return (
    <div>
      <h1 className="mb-8 text-[2.2rem]">Security</h1>
      <SecuritySettings enabled={status.enabled} recoveryLeft={status.recoveryLeft} mustSetUp={status.required || status.staffRule} />
    </div>
  );
}

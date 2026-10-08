import Link from "next/link";
import { getStaffAccess } from "@/lib/auth/session";

export default async function NoAccessPage() {
  const access = await getStaffAccess();
  return (
    <main className="grid min-h-[60vh] place-items-center p-8 text-center">
      <div className="max-w-md">
        <h1 className="text-[2rem]">{access ? "You don't have access to this page" : "This area is for UNAR staff"}</h1>
        <p className="mt-3 text-muted">
          {access
            ? "Your role doesn't include this section. Ask the store owner if you need access."
            : "Your account doesn't have dashboard access. If you are the owner, follow the “Make yourself the owner” step in the setup guide."}
        </p>
        <div className="mt-6 flex justify-center gap-4 text-[0.9rem]">
          {access ? (
            <Link href="/admin" className="font-semibold text-forest underline">
              Back to dashboard
            </Link>
          ) : null}
          <Link href="/" className="font-semibold text-forest underline">
            Go to the store
          </Link>
        </div>
      </div>
    </main>
  );
}

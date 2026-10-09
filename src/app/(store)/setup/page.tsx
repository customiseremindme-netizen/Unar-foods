import type { Metadata } from "next";
import { ownerExists } from "@/app/actions/setup";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetupOwnerForm } from "@/components/auth/auth-forms";
import { ButtonLink } from "@/components/ui/button";
import { isDatabaseConfigured } from "@/lib/db/client";
import { getSetupKey } from "@/lib/env";

export const metadata: Metadata = { title: "Store setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 text-[0.92rem] text-ink">{children}</ol>;
}

/** One-time page that creates the owner account (see docs/SETUP_GUIDE.md). */
export default async function SetupPage() {
  if (!isDatabaseConfigured()) {
    return (
      <AuthShell title="Connect the database" description="The website can't find its database settings yet.">
        <Steps>
          <li>In Hostinger, open Websites → your site → Databases and create a MySQL database (note the name, user and password).</li>
          <li>
            In your Node.js app&apos;s Environment variables add <code>DB_HOST</code> (usually <code>localhost</code>), <code>DB_PORT</code> (
            <code>3306</code>), <code>DB_NAME</code>, <code>DB_USER</code> and <code>DB_PASSWORD</code>.
          </li>
          <li>Redeploy, then open this page again.</li>
        </Steps>
      </AuthShell>
    );
  }
  const exists = await ownerExists();
  if (exists === null) {
    return (
      <AuthShell title="Can't reach the database" description="The database settings are there, but the website couldn't connect.">
        <Steps>
          <li>Check DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD in Hostinger (they must match the database you created).</li>
          <li>Redeploy, then reload this page.</li>
          <li>
            Open <code>/api/health</code> on your site for a short diagnosis.
          </li>
        </Steps>
      </AuthShell>
    );
  }
  if (exists) {
    return (
      <AuthShell title="Your store is set up" description="The owner account already exists.">
        <ButtonLink href="/login?next=/admin" className="w-full">
          Sign in to the dashboard
        </ButtonLink>
      </AuthShell>
    );
  }
  if (!getSetupKey()) {
    return (
      <AuthShell title="One more setting" description="To create the owner account safely, add a setup key first.">
        <Steps>
          <li>
            In Hostinger → your Node.js app → Environment variables, add <code>SETUP_KEY</code> with a long secret phrase you choose (at least 12
            characters). Keep it private.
          </li>
          <li>Redeploy, then reload this page.</li>
        </Steps>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Create the owner account" description="This account controls the dashboard. It can only be created once.">
      <SetupOwnerForm />
    </AuthShell>
  );
}

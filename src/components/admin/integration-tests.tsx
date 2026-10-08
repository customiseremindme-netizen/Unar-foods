"use client";

import { sendTestEmailAction, testShiprocketAction } from "@/app/admin/_actions/settings";
import { ActionButton } from "./forms";
import { Card } from "./ui";

export function IntegrationTests({ emailReady, shiprocketReady }: { emailReady: boolean; shiprocketReady: boolean }) {
  return (
    <Card title="Check connections" description="Safe tests — nothing is charged or shipped.">
      <div className="flex flex-wrap gap-2">
        <ActionButton size="sm" variant="secondary" disabled={!emailReady} action={() => sendTestEmailAction()}>
          Send me a test email
        </ActionButton>
        <ActionButton size="sm" variant="secondary" disabled={!shiprocketReady} action={() => testShiprocketAction()}>
          Test Shiprocket login
        </ActionButton>
      </div>
    </Card>
  );
}

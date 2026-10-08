"use client";

import { deleteSubscriberAction, unsubscribeSubscriberAction } from "@/app/admin/_actions/marketing";
import { ActionButton } from "./forms";

export function SubscriberActions({ id, subscribed }: { id: string; subscribed: boolean }) {
  return (
    <span className="inline-flex gap-1">
      {subscribed ? (
        <ActionButton size="sm" variant="ghost" action={() => unsubscribeSubscriberAction(id)} confirm="Unsubscribe this person?">
          Unsubscribe
        </ActionButton>
      ) : null}
      <ActionButton size="sm" variant="ghost" className="text-danger" action={() => deleteSubscriberAction(id)} confirm="Delete this email address permanently (for a data-removal request)?">
        Delete
      </ActionButton>
    </span>
  );
}

"use client";

import { useState } from "react";
import { deleteMessageAction, deleteReviewAction, replyToReviewAction, setMessageStatusAction, setReviewStatusAction } from "@/app/admin/_actions/store-ops";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { ActionButton, AdminForm } from "./forms";

export function MessageActions({ id, status }: { id: string; status: "new" | "read" | "archived" }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {status === "new" ? (
        <ActionButton size="sm" variant="secondary" action={() => setMessageStatusAction(id, "read")}>
          Mark as read
        </ActionButton>
      ) : null}
      {status !== "archived" ? (
        <ActionButton size="sm" variant="ghost" action={() => setMessageStatusAction(id, "archived")} successMessage="Archived.">
          Archive
        </ActionButton>
      ) : (
        <ActionButton size="sm" variant="ghost" action={() => setMessageStatusAction(id, "read")} successMessage="Moved to inbox.">
          Move to inbox
        </ActionButton>
      )}
      <ActionButton size="sm" variant="ghost" className="text-danger" action={() => deleteMessageAction(id)} confirm="Delete this message permanently?">
        Delete
      </ActionButton>
    </div>
  );
}

export function ReviewModeration({ id, status, reply }: { id: string; status: "pending" | "approved" | "rejected" | "spam"; reply: string }) {
  const [replying, setReplying] = useState(false);
  return (
    <div className="mt-4 border-t border-line pt-4">
      {reply && !replying ? (
        <div className="mb-3 rounded-xl bg-sage-soft/60 p-3 text-[0.86rem]">
          <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-muted">Your public reply</span>
          {reply}
        </div>
      ) : null}
      {replying ? (
        <AdminForm action={replyToReviewAction} onSuccess={() => setReplying(false)} className="mb-3 grid gap-2">
          <input type="hidden" name="id" value={id} />
          <label htmlFor={`reply-${id}`} className="text-[0.8rem] font-semibold">
            Public reply (shown under the review)
          </label>
          <Textarea id={`reply-${id}`} name="reply" rows={3} maxLength={1000} defaultValue={reply} />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Save reply
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>
              Cancel
            </Button>
          </div>
        </AdminForm>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {status !== "approved" ? (
          <ActionButton size="sm" action={() => setReviewStatusAction(id, "approved")}>
            Approve
          </ActionButton>
        ) : (
          <ActionButton size="sm" variant="secondary" action={() => setReviewStatusAction(id, "pending")} successMessage="Hidden from the website.">
            Hide
          </ActionButton>
        )}
        {status !== "rejected" ? (
          <ActionButton size="sm" variant="secondary" action={() => setReviewStatusAction(id, "rejected")}>
            Reject
          </ActionButton>
        ) : null}
        {status !== "spam" ? (
          <ActionButton size="sm" variant="ghost" action={() => setReviewStatusAction(id, "spam")}>
            Spam
          </ActionButton>
        ) : null}
        {!replying ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(true)}>
            {reply ? "Edit reply" : "Reply"}
          </Button>
        ) : null}
        <ActionButton size="sm" variant="ghost" className="text-danger" action={() => deleteReviewAction(id)} confirm="Delete this review permanently?">
          Delete
        </ActionButton>
      </div>
    </div>
  );
}

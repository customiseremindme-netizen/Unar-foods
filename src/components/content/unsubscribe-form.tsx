"use client";

import { useActionState } from "react";
import { unsubscribeAction, type FormState } from "@/app/actions/engagement";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";

const initial: FormState = { ok: false, message: null };

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribeAction, initial);
  if (state.message) return <FormMessage tone={state.ok ? "success" : "error"}>{state.message}</FormMessage>;
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <Button type="submit" loading={pending}>
        Unsubscribe me
      </Button>
    </form>
  );
}

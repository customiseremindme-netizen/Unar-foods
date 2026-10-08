"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/admin/action";

/** Runs an admin server action with a pending state, toasts and a page refresh. */
export function useAdminAction() {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  function run<T>(fn: () => Promise<ActionResult<T>>, options: { refresh?: boolean; successMessage?: string } = {}) {
    return new Promise<ActionResult<T>>((resolve) => {
      startTransition(async () => {
        try {
          const result = await fn();
          if (result.ok) {
            const msg = options.successMessage ?? result.message;
            if (msg) notify(msg, "success");
            if (options.refresh !== false) router.refresh();
          } else {
            notify(result.message ?? "Please check the form.", "error");
          }
          resolve(result);
        } catch {
          notify("Connection problem. Please try again.", "error");
          resolve({ ok: false, message: "Connection problem." });
        }
      });
    });
  }

  return { run, pending };
}

const ErrorsContext = createContext<Record<string, string>>({});
export function useFieldError(name: string) {
  return useContext(ErrorsContext)[name];
}

/** A form that submits FormData to an admin server action. */
export function AdminForm({
  action,
  children,
  className,
  onSuccess,
  resetOnSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult<unknown>>;
  children: ReactNode;
  className?: string;
  onSuccess?: (result: ActionResult<unknown>) => void;
  resetOnSuccess?: boolean;
}) {
  const { run } = useAdminAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <ErrorsContext.Provider value={errors}>
      <form
        className={className}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const result = await run(() => action(new FormData(form)));
          setErrors(result.errors ?? {});
          if (result.ok) {
            if (resetOnSuccess) form.reset();
            onSuccess?.(result);
          }
        }}
      >
        {children}
      </form>
    </ErrorsContext.Provider>
  );
}

/** Submit button that shows a spinner while its form's action is running. */
export function ActionButton({
  action,
  confirm,
  children,
  successMessage,
  ...props
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: string;
  successMessage?: string;
}) {
  const { run, pending } = useAdminAction();
  return (
    <Button
      type="button"
      loading={pending}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        await run(action, { successMessage });
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

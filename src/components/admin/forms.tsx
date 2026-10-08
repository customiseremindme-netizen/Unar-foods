"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
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

/** Save bar pinned to the bottom of long editors (products, settings, content). */
export function StickySaveBar({ dirty, children }: { dirty: boolean; children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur lg:left-64">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3 px-4 py-3 sm:px-6">
        <p className="mr-auto text-[0.82rem] text-muted" aria-live="polite">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        {children}
      </div>
    </div>
  );
}

/** Warns before leaving the page with unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
}

import type { ReactNode } from "react";
import { LeafSprig } from "@/components/brand/botanical";

export function AuthShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="paper relative overflow-hidden">
      <LeafSprig className="absolute -left-4 top-16 hidden h-72 w-44 text-sage lg:block" />
      <LeafSprig className="absolute -right-6 bottom-6 hidden h-60 w-40 rotate-180 text-sage/70 lg:block" />
      <div className="container-site relative flex justify-center py-14 lg:py-20">
        <div className="w-full max-w-md rounded-[2rem] border border-line bg-paper p-7 shadow-soft sm:p-10">
          <h1 className="text-[2rem]">{title}</h1>
          {description ? <p className="mt-2 text-[0.92rem] text-muted">{description}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}

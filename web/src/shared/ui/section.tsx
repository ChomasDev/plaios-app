import type { ReactNode } from "react";

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return <section className="grid gap-3 border-t py-6 first:border-t-0 first:pt-0 sm:grid-cols-[10rem_1fr]">
    <div>
      <h2 className="text-sm font-medium">{title}</h2>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
    <div className="min-w-0">{children}</div>
  </section>;
}

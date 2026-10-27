import { cn } from "@plaios/microfrontend";
import type { ReactNode } from "react";

export function Page({ title, intro, aside, wide, children }: { title: ReactNode; intro?: ReactNode; aside?: ReactNode; wide?: boolean; children?: ReactNode }) {
  return <div className={cn("mx-auto w-full px-6 py-8", wide ? "max-w-6xl" : "max-w-3xl")}>
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-medium tracking-tight">{title}</h1>
        {intro ? <p className="mt-1.5 text-sm text-muted-foreground">{intro}</p> : null}
      </div>
      {aside}
    </header>
    {children}
  </div>;
}

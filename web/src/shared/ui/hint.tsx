import type { ReactNode } from "react";

/** Quiet one-liner for loading and empty states. */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-muted-foreground">{children}</p>;
}

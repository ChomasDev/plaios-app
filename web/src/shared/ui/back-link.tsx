import { ArrowLeft } from "lucide-react";

export function BackLink({ href, label }: { href: string; label: string }) {
  return <a href={href} className="group -ml-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
    <ArrowLeft className="icon-nudge-left size-4" />{label}
  </a>;
}

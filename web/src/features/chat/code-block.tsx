import { cn } from "@plaios/microfrontend";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

const FOLDED_LINES = 14;

/** Code with its language, a copy button, and long snippets folded until asked. */
export function CodeBlock({ code, language, className }: { code: string; language?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const lines = code.split("\n").length;
  const folded = lines > FOLDED_LINES && !unfolded;
  const copy = () => void navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1_500); });
  return <div className={cn("group/code relative my-3 overflow-hidden rounded-xl border bg-muted/40", className)}>
    <div className="flex items-center justify-between border-b px-3 py-1 text-[11px] text-muted-foreground">
      <span className="font-mono">{language || "text"}</span>
      <button type="button" onClick={copy} aria-label="Copy code" className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted hover:text-foreground">
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? "Copied" : "Copy"}
      </button>
    </div>
    <pre className={cn("overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-6", folded && "max-h-72 overflow-y-hidden")}>{code}</pre>
    {lines > FOLDED_LINES ? <button
      type="button"
      onClick={() => setUnfolded(!unfolded)}
      className={cn("w-full py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground", folded ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/80 to-transparent pt-8" : "border-t")}
    >{folded ? `Show all ${lines} lines` : "Fold"}</button> : null}
  </div>;
}

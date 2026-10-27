import { Composer } from "./composer.js";

/** Bottom bar; the gradient lets the conversation fade out under it instead of being cut. */
export function ComposerDock({ busy, onSend }: { busy: boolean; onSend(text: string): void }) {
  return <div className="relative shrink-0 px-6 pb-6">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background to-transparent" />
    <div className="mx-auto max-w-4xl"><Composer busy={busy} onSend={onSend} /></div>
  </div>;
}

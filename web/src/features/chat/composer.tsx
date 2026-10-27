import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, LoaderCircle } from "lucide-react";
import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import { SNAPPY } from "../../shared/motion.js";

/** The input box. It stays mounted for the whole session, so focus and draft never jump. */
export function Composer({ busy, onSend }: { busy: boolean; onSend(text: string): void }) {
  const [draft, setDraft] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const text = draft.trim();
  useLayoutEffect(() => autosize(textarea.current), [draft]);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!text || busy) return;
    setDraft("");
    onSend(text);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };
  return <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border bg-card p-2 pl-4 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/25 focus-within:shadow-md">
    <textarea
      ref={textarea}
      autoFocus
      rows={1}
      value={draft}
      placeholder="Ask anything, or tell the agent what to do"
      aria-label="Message"
      className="max-h-48 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
    />
    <SendButton busy={busy} disabled={!text || busy} />
  </form>;
}

function SendButton({ busy, disabled }: { busy: boolean; disabled: boolean }) {
  return <motion.button
    type="submit"
    disabled={disabled}
    aria-label={busy ? "Answering" : "Send"}
    whileTap={disabled ? undefined : { scale: 0.9 }}
    animate={{ opacity: disabled && !busy ? 0.3 : 1 }}
    className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-foreground text-background"
  >
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={busy ? "busy" : "send"} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={SNAPPY}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="icon-nudge-up size-4" />}
      </motion.span>
    </AnimatePresence>
  </motion.button>;
}

/** Grows the textarea with its content, up to its max height. */
function autosize(element: HTMLTextAreaElement | null): void {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}

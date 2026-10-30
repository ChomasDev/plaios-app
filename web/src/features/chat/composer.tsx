import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@plaios/microfrontend";
import { ArrowUp, LoaderCircle, Paperclip, Upload } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";

import { uploadFile } from "../../shared/api.js";
import { SNAPPY } from "../../shared/motion.js";
import type { ChatAttachmentDto } from "../../shared/types.js";
import { IMAGE_TYPES, PendingFiles, type PendingFile } from "./attachments.js";

/** The input box. It stays mounted for the whole session, so focus and draft never jump. Files upload as soon as they are picked, pasted or dropped. */
export function Composer({ busy, onSend }: { busy: boolean; onSend(text: string, attachments: ChatAttachmentDto[]): void }) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const text = draft.trim();
  const uploading = files.some((file) => !file.attachment && !file.error);
  const ready = files.flatMap((file) => file.attachment ? [file.attachment] : []);
  useLayoutEffect(() => autosize(textarea.current), [draft]);

  const add = (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const preview = IMAGE_TYPES.has(file.type) ? URL.createObjectURL(file) : undefined;
      setFiles((current) => [...current, { key, name: file.name, size: file.size, type: file.type, preview }]);
      uploadFile(file)
        .then((attachment) => setFiles((current) => current.map((item) => item.key === key ? { ...item, attachment } : item)))
        .catch((error: unknown) => setFiles((current) => current.map((item) => item.key === key ? { ...item, error: error instanceof Error ? error.message : String(error) } : item)));
    }
  };
  const remove = (key: string) => setFiles((current) => {
    const gone = current.find((file) => file.key === key);
    if (gone?.preview) URL.revokeObjectURL(gone.preview);
    return current.filter((file) => file.key !== key);
  });
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if ((!text && ready.length === 0) || busy || uploading) return;
    setDraft("");
    for (const file of files) if (file.preview) URL.revokeObjectURL(file.preview);
    setFiles([]);
    onSend(text, ready);
  };
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (event.clipboardData.files.length === 0) return;
    event.preventDefault();
    add(event.clipboardData.files);
  };
  // Files dropped anywhere on the page attach here, as in T3 Code.
  const addRef = useRef(add);
  addRef.current = add;
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const onEnter = (event: DragEvent) => { if (!hasFiles(event)) return; event.preventDefault(); depth += 1; setDragging(true); };
    const onOver = (event: DragEvent) => { if (hasFiles(event)) event.preventDefault(); };
    const onLeave = (event: DragEvent) => { if (!hasFiles(event)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false); };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      if (event.dataTransfer?.files.length) addRef.current(event.dataTransfer.files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };
  return <>
  <AnimatePresence>
    {dragging ? <motion.div
      key="drop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/70 p-6 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-foreground/30 px-16 py-12 text-center">
        <Upload className="size-6 text-muted-foreground" />
        <p className="text-base font-medium">Drop files to attach</p>
        <p className="text-sm text-muted-foreground">Images go to the model as images; other files by path, short text inline.</p>
      </div>
    </motion.div> : null}
  </AnimatePresence>
  <form
    onSubmit={submit}
    className={cn("rounded-2xl border bg-card p-2 pl-3 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/25 focus-within:shadow-md", dragging && "border-foreground/40")}
  >
    <div className="pl-1"><PendingFiles files={files} onRemove={remove} /></div>
    <div className="flex items-end gap-2">
    <input ref={picker} type="file" multiple hidden onChange={(event) => { if (event.target.files) add(event.target.files); event.target.value = ""; }} />
    <button type="button" onClick={() => picker.current?.click()} aria-label="Attach files" title="Attach files or images (you can also paste or drop them)" className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Paperclip className="size-4" /></button>
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
      onPaste={onPaste}
    />
    <SendButton busy={busy || uploading} disabled={(!text && ready.length === 0) || busy || uploading} />
    </div>
  </form>
  </>;
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

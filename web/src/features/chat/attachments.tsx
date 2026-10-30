import { cn } from "@plaios/microfrontend";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, LoaderCircle, X } from "lucide-react";

import { uploadUrl } from "../../shared/api.js";
import type { ChatAttachmentDto } from "../../shared/types.js";

export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** A file picked in the composer: its local preview while it uploads, then what the host stored. */
export interface PendingFile { key: string; name: string; size: number; type: string; preview?: string; attachment?: ChatAttachmentDto; error?: string }

/** Thumbnails and file chips above the composer's text, each removable, each showing its upload state. */
export function PendingFiles({ files, onRemove }: { files: PendingFile[]; onRemove(key: string): void }) {
  return <AnimatePresence initial={false}>
    {files.length ? <motion.ul key="files" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-wrap gap-2 overflow-hidden pt-1 pb-2" aria-label="Attachments">
      <AnimatePresence initial={false}>
        {files.map((file) => <motion.li key={file.key} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="group relative">
          {file.preview
            ? <img src={file.preview} alt={file.name} className={cn("size-16 rounded-xl border object-cover", !file.attachment && "opacity-60")} />
            : <FileChip name={file.name} size={file.size} className={cn(!file.attachment && "opacity-60", file.error && "border-destructive text-destructive")} />}
          {!file.attachment && !file.error ? <LoaderCircle aria-label="Uploading" className="absolute inset-0 m-auto size-4 animate-spin" /> : null}
          <button type="button" onClick={() => onRemove(file.key)} aria-label={`Remove ${file.name}`} title={file.error} className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"><X className="size-3" /></button>
        </motion.li>)}
      </AnimatePresence>
    </motion.ul> : null}
  </AnimatePresence>;
}

/** The files a question was sent with: images as thumbnails that open full size, other files as download chips. */
export function SentAttachments({ attachments }: { attachments: ChatAttachmentDto[] }) {
  return <div className="ml-auto flex max-w-[85%] flex-wrap justify-end gap-2">
    {attachments.map((file) => IMAGE_TYPES.has(file.mediaType)
      ? <a key={file.id} href={uploadUrl(file.id)} target="_blank" rel="noreferrer" title={file.name}><img src={uploadUrl(file.id)} alt={file.name} loading="lazy" className="max-h-48 max-w-64 rounded-2xl border object-cover transition-opacity hover:opacity-90" /></a>
      : <a key={file.id} href={uploadUrl(file.id)} download={file.name}><FileChip name={file.name} size={file.size} className="transition-colors hover:bg-muted" /></a>)}
  </div>;
}

function FileChip({ name, size, className }: { name: string; size: number; className?: string }) {
  return <span className={cn("flex h-16 max-w-56 items-center gap-2.5 rounded-xl border bg-card px-3", className)}>
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><FileText className="size-4" /></span>
    <span className="min-w-0">
      <span className="block truncate text-sm">{name}</span>
      <span className="block text-xs text-muted-foreground">{formatSize(size)}</span>
    </span>
  </span>;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

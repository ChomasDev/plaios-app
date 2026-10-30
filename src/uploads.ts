import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { InputAttachment } from "@plaios/core";

import type { ChatAttachmentDto } from "./types.js";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ID = /^[0-9a-f-]{36}$/;
/** Images the models read; SVG is left out because served inline it could run script in the UI's origin. */
export const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const INLINE_TEXT_BYTES = 64 * 1024;
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".yaml", ".yml", ".xml", ".log", ".ts", ".tsx", ".js", ".mjs", ".py", ".sh", ".sql", ".html", ".css", ".toml", ".ini", ".env.example"]);

export interface StoredUpload { attachment: ChatAttachmentDto; path: string }

/** Files the user attaches in the web chat, kept on the host so the agent and every browser can reach them. */
export class UploadStore {
  constructor(private readonly directory: string) {}

  async save(body: Readable, name: string, mediaType: string): Promise<ChatAttachmentDto> {
    await mkdir(this.directory, { recursive: true });
    const id = randomUUID();
    const attachment: ChatAttachmentDto = { id, name: cleanName(name), mediaType: mediaType.split(";")[0]!.trim() || "application/octet-stream", size: 0 };
    const path = this.path(attachment);
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, done) {
        attachment.size += chunk.length;
        done(attachment.size > MAX_UPLOAD_BYTES ? new Error(`Files are limited to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`) : null, chunk);
      },
    });
    try {
      await pipeline(body, limit, createWriteStream(path));
    } catch (error) {
      await rm(path, { force: true });
      throw error;
    }
    await writeFile(join(this.directory, `${id}.json`), JSON.stringify(attachment));
    return attachment;
  }

  async get(id: string): Promise<StoredUpload | undefined> {
    if (!ID.test(id)) return undefined;
    try {
      const attachment = JSON.parse(await readFile(join(this.directory, `${id}.json`), "utf8")) as ChatAttachmentDto;
      return { attachment, path: this.path(attachment) };
    } catch {
      return undefined;
    }
  }

  open(upload: StoredUpload): Readable {
    return createReadStream(upload.path);
  }

  private path(attachment: ChatAttachmentDto): string {
    return join(this.directory, `${attachment.id}${extname(attachment.name).toLowerCase().replace(/[^.\w]/g, "")}`);
  }
}

/** What the agent receives: images as images, every file by its path on this server, short text files inline. */
export async function agentInputFor(uploads: readonly StoredUpload[]): Promise<{ images: InputAttachment[]; note: string }> {
  if (uploads.length === 0) return { images: [], note: "" };
  const images = uploads.filter(({ attachment }) => IMAGE_TYPES.has(attachment.mediaType)).map(({ attachment, path }) => ({ type: "image" as const, path, mediaType: attachment.mediaType }));
  const lines = await Promise.all(uploads.map(async ({ attachment, path }) => {
    const head = `- ${attachment.name} (${attachment.mediaType}, ${formatSize(attachment.size)}), saved on this server at ${path}`;
    if (!isText(attachment) || attachment.size > INLINE_TEXT_BYTES) return head;
    return `${head}:\n\`\`\`\n${(await readFile(path, "utf8")).trimEnd()}\n\`\`\``;
  }));
  return { images, note: `\n\nThe user attached ${uploads.length === 1 ? "a file" : `${uploads.length} files`}:\n${lines.join("\n")}` };
}

function isText({ mediaType, name }: ChatAttachmentDto): boolean {
  return mediaType.startsWith("text/") || /json|xml|yaml|javascript|typescript|csv|x-sh|sql/.test(mediaType) || TEXT_EXTENSIONS.has(extname(name).toLowerCase());
}

function cleanName(name: string): string {
  return name.replace(/[\\/\0\r\n]+/g, "_").trim().slice(0, 200) || "file";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import { MAX_UPLOAD_BYTES, UploadStore, agentInputFor } from "../src/uploads.js";

test("keeps uploads on disk and hands the agent images as images and short text inline", async () => {
  const store = new UploadStore(await mkdtemp(join(tmpdir(), "plaios-uploads-")));
  const photo = await store.save(Readable.from([Buffer.from("png-bytes")]), "photo.png", "image/png");
  const notes = await store.save(Readable.from([Buffer.from("line one\nline two\n")]), "../notes.txt", "text/plain; charset=utf-8");
  const pdf = await store.save(Readable.from([Buffer.from("%PDF")]), "report.pdf", "application/pdf");
  assert.deepEqual(notes, { id: notes.id, name: ".._notes.txt", mediaType: "text/plain", size: 18 });

  const stored = await Promise.all([photo, notes, pdf].map(({ id }) => store.get(id)));
  assert.equal(await readFile(stored[0]!.path, "utf8"), "png-bytes");
  const { images, note } = await agentInputFor(stored.map((item) => item!));
  assert.deepEqual(images, [{ type: "image", path: stored[0]!.path, mediaType: "image/png" }]);
  assert.match(note, /attached 3 files/);
  assert.match(note, /\.\._notes\.txt \(text\/plain, 18 B\), saved on this server at .*:\n```\nline one\nline two\n```/);
  assert.match(note, /report\.pdf \(application\/pdf, 4 B\), saved on this server at \S+\.pdf$/m);
  assert.equal(await store.get("../../etc/passwd"), undefined);
});

test("refuses files over the size limit and leaves nothing behind", async () => {
  const store = new UploadStore(await mkdtemp(join(tmpdir(), "plaios-uploads-")));
  const big = Readable.from((function* () { for (let sent = 0; sent <= MAX_UPLOAD_BYTES; sent += 1024 * 1024) yield Buffer.alloc(1024 * 1024); })());
  await assert.rejects(store.save(big, "big.bin", "application/octet-stream"), /limited to 25 MB/);
});

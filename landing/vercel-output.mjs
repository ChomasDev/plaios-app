// Packs the built landing as Vercel prebuilt output, so `vercel deploy --prebuilt` uploads static files
// and Vercel never installs or builds this repo (its workspace:* deps only resolve inside the PLAIOS workspace).
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const site = fileURLToPath(new URL("../dist/landing/", import.meta.url));
const output = fileURLToPath(new URL("../.vercel/output/", import.meta.url));
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(site, `${output}static`, { recursive: true });
await writeFile(`${output}config.json`, `${JSON.stringify({ version: 3 }, null, 2)}\n`);
console.log("packed .vercel/output for vercel deploy --prebuilt");

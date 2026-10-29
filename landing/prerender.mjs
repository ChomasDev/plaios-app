// Bakes the rendered page into index.html so crawlers and no-JS readers get the full content.
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/landing/", import.meta.url));
const ssr = fileURLToPath(new URL("../dist/landing-ssr/", import.meta.url));
const { render } = await import(`${ssr}server.js`);
const page = await readFile(`${dist}index.html`, "utf8");
if (!page.includes('<div id="root"></div>')) throw new Error("landing index.html has no empty #root");
await writeFile(`${dist}index.html`, page.replace('<div id="root"></div>', `<div id="root">${render()}</div>`));
await rm(ssr, { recursive: true, force: true });
console.log("prerendered dist/landing/index.html");

// Bakes the rendered pages into their HTML so crawlers and no-JS readers get the full content.
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/landing/", import.meta.url));
const ssr = fileURLToPath(new URL("../dist/landing-ssr/", import.meta.url));
const { render, renderDocs } = await import(`${ssr}server.js`);
for (const [file, html] of [["index.html", render], ["docs/index.html", renderDocs]]) {
  const page = await readFile(`${dist}${file}`, "utf8");
  if (!page.includes('<div id="root"></div>')) throw new Error(`landing ${file} has no empty #root`);
  await writeFile(`${dist}${file}`, page.replace('<div id="root"></div>', `<div id="root">${html()}</div>`));
  console.log(`prerendered dist/landing/${file}`);
}
await rm(ssr, { recursive: true, force: true });

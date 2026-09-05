import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("dist/rate-preview");
let html = await readFile(path.join(root, "index.html"), "utf8");
async function asset(relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(`${root}${path.sep}`)) throw new Error("Asset path escaped the preview output directory");
  return readFile(absolute, "utf8");
}
for (const match of [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gu)]) {
  const javascript = (await asset(match[1])).replace(/<\/script/giu, "<\\/script");
  html = html.replace(match[0], () => `<script type="module">${javascript}</script>`);
}
for (const match of [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/gu)]) {
  const css = (await asset(match[1])).replace(/<\/style/giu, "<\\/style");
  html = html.replace(match[0], () => `<style>${css}</style>`);
}
if (/<(?:script|link)\b[^>]*(?:src|href)="[^"#]/u.test(html)) throw new Error("The standalone file still references an external script or stylesheet");
await writeFile("dist/tuberbot-rate-studio.html", html, "utf8");
console.log("Created self-contained dist/tuberbot-rate-studio.html (no network dependencies)");

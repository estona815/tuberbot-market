import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const source = process.env.REVIEW_SOURCE_REVISION ?? "4cb8779df5679e731dff686b3e8ff3fb53ae8a9b";
if (!/^[a-f0-9]{40}$/u.test(source)) throw new Error("Pinned source revision required");
export default defineConfig({
  root: here("."), base: "./", publicDir: false,
  plugins: [react()],
  define: { "process.env.REVIEW_SOURCE_REVISION": JSON.stringify(source) },
  resolve: { alias: [
    { find: "next/link", replacement: here("./browser-link.tsx") },
    { find: "next/image", replacement: here("./browser-image.tsx") },
    { find: "next/navigation", replacement: here("./browser-navigation.ts") },
    { find: "../src/lib/site-pages", replacement: here("./site-pages.ts") },
    { find: "@/lib/server/release-status", replacement: here("./release-status.ts") },
    { find: "@", replacement: here("../src") },
  ] },
  build: { outDir: here("../dist/public-review"), emptyOutDir: true, cssCodeSplit: false, sourcemap: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});

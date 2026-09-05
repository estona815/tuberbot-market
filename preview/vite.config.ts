import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL("../dist/rate-preview", import.meta.url)),
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
  },
});

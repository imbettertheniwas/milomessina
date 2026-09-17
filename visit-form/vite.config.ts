import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
export default defineConfig({
  base: "/hqvisitform/",
  plugins: [react()],
  resolve: {alias: {"@": fileURLToPath(new URL(".", import.meta.url))}},
  build: {outDir: "../hqvisitform", emptyOutDir: true, sourcemap: false}
});

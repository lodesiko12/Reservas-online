import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  envDir: resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@reservas/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [resolve(__dirname, "../..")] },
  },
});

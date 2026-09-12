import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// El widget se sirve como app independiente y se embebe vía <iframe>.
export default defineConfig({
  plugins: [react()],
  // Lee las variables VITE_* del .env en la raíz del monorepo.
  envDir: resolve(__dirname, "../.."),
  resolve: {
    alias: {
      "@reservas/shared": resolve(__dirname, "../../packages/shared/src/index.ts"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    fs: { allow: [resolve(__dirname, "../..")] },
  },
});

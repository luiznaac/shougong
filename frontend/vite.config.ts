import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The app is served under `/shougong/` behind the unified dashboard reverse proxy,
// but runs at `/` in local dev. Override with VITE_BASE if needed.
//
// `loadEnv(mode, cwd, "")` is what makes `.env` reach this file: Vite does not inject
// `.env` into `process.env`, so reading it directly silently ignored the file.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE ?? (mode === "production" ? "/shougong/" : "/"),
    plugins: [react(), tailwindcss()],
    server: {
      // Strict on purpose: a taken dev port fails loudly instead of auto-incrementing, so the
      // served URL cannot drift from the assigned frontend-dev port.
      port: Number(env.FRONTEND_DEV_PORT ?? 8133),
      strictPort: true,
      proxy: {
        // Dev-only: forward API calls to the shougong backend to dodge CORS.
        "/api": {
          target: env.VITE_API_TARGET ?? "http://localhost:8130",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
  };
});

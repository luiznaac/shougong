import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The app is served under `/shougong/` behind the unified dashboard reverse proxy,
// but runs at `/` in local dev. Override with VITE_BASE if needed.
export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === "production" ? "/shougong/" : "/"),
  plugins: [react(), tailwindcss()],
  server: {
    port: 5273,
    proxy: {
      // Dev-only: forward API calls to the shougong backend to dodge CORS.
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies API calls to the RAGent backend (port 5000).
const BACKEND_TARGET = process.env.VITE_BACKEND_URL || "http://localhost:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
      "/health": {
        target: BACKEND_TARGET,
        changeOrigin: true,
      },
    },
  },
});
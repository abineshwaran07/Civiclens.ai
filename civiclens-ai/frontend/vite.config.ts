import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In development the React app runs on :5173 and proxies /api to the FastAPI server on :8000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `npm run build` writes straight into the backend, which serves it (single-container deploy).
  build: { outDir: "../backend/app/static", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
});

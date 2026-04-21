import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy:
// - 前端走相对路径 /api/v1/...
// - 本地 dev 时通过 Vite 代理转发到后端（默认后端 http://127.0.0.1:17890）
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:17890",
        changeOrigin: true
      }
    }
  }
});

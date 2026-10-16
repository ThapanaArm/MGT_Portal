import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// พอร์ตของ backend ตอนพัฒนา (ดู src/Api/MGT.Portal.Api/Properties/launchSettings.json)
const API_TARGET = process.env.API_TARGET ?? "http://localhost:5038";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    // หน้าเว็บเรียก /api/... แล้ว Vite ส่งต่อให้ backend → origin เดียวกัน ไม่ต้องตั้ง CORS
    proxy: { "/api": { target: API_TARGET, changeOrigin: true } },
  },
  build: {
    // ให้ Portal.Api เสิร์ฟหน้าเว็บที่ build แล้วจาก wwwroot ของมันเอง
    outDir: path.resolve(__dirname, "../Api/MGT.Portal.Api/wwwroot"),
    emptyOutDir: true,
  },
});

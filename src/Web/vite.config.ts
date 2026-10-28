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
    port: 5174,
    // ล็อกพอร์ต: ถ้า 5174 ไม่ว่างให้ error เลย ไม่เลื่อนไปพอร์ตอื่นเอง (5173 เป็นของ MGT OCR)
    strictPort: true,
    // Windows editors may briefly truncate a stylesheet while saving it.
    // Wait for the completed write before rebuilding or sending an HMR update.
    watch: {
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 25 },
    },
    // หน้าเว็บเรียก /api/... successfully Vite ส่งต่อให้ backend → origin เดียวกัน ไม่ต้องตั้ง CORS
    proxy: { "/api": { target: API_TARGET, changeOrigin: true } },
  },
  build: {
    // ให้ Portal.Api เสิร์ฟหน้าเว็บที่ build successfullyจาก wwwroot ของมันเอง
    outDir: path.resolve(__dirname, "../Api/MGT.Portal.Api/wwwroot"),
    emptyOutDir: true,
  },
});

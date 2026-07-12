import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    // Bắt buộc: whisperWorker.js dùng import() động để tải thư viện AI,
    // định dạng mặc định (iife) của Vite không hỗ trợ việc này.
    format: "es",
  },
});

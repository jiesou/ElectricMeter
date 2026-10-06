import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// 后端地址，默认本机 Bun 服务，可用 VITE_API_TARGET 覆盖
const target = process.env.VITE_API_TARGET ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true, // 监听局域网，手机平板直接访问
    proxy: {
      "/api": { target, changeOrigin: true },
    },
  },
});

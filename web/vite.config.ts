import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  // assistant-ui 的注册表组件用 Tailwind 类
  plugins: [vue(), tailwindcss()],
  // vue-chartjs 和页面各拿一份 chart.js 就注册不上 scale（图全白），强制同一份
  resolve: { dedupe: ["chart.js"] },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8080", changeOrigin: true } },
  },
});

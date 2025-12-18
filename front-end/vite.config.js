import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0", // 允许远程访问
    port: 5173,
    allowedHosts: ["localhost", "127.0.0.1", "host.docker.internal"],
    strictPort: true, // 端口被占用时直接失败
    // 代理配置（如果后端也在本地）
    proxy: {
      "/chains": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        linera: "@linera/client",
      },
      preserveEntrySignatures: "strict",
    },
  },
  optimizeDeps: {
    exclude: ["@linera/client"],
  },
});

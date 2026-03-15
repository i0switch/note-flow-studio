import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-store": ["zustand"]
        }
      }
    }
  },
  server: {
    port: Number(process.env.WEB_PORT ?? "5173"),
    proxy: {
      "/api": {
        target: apiBaseUrl.replace(/\/api$/, ""),
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});

import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "/panel/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  },
  server: {
    proxy: {
      "/api": process.env.VITE_API_TARGET ?? "http://localhost:3010",
      "/auth": process.env.VITE_API_TARGET ?? "http://localhost:3010"
    }
  }
});

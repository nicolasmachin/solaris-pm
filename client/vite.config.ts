import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["app.voltia.com.uy", "localhost", "127.0.0.1"],
    proxy: {
      "/api": "http://localhost:4000",
      "/auth": "http://localhost:4000",
    },
  },
});

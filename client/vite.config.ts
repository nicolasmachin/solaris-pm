import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dentro de Docker el server es "server:4000" (localhost sería el propio
// contenedor del client). Con VITE_API_URL vacío el navegador pide todo al
// 5173 y Vite lo pasa al server: un solo puerto que reenviar por el túnel SSH.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["app.voltia.com.uy", "localhost", "127.0.0.1"],
    proxy: {
      "/api": apiTarget,
      "/auth": apiTarget,
    },
  },
});

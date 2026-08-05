import { useAuthStore } from "../store/auth.store";

// Módulo provisional "Guía de viaje São Paulo": visible SOLO para Nicolás y
// Gabriel. Allowlist por email (case-insensitive). Se incluye el admin de dev
// local para poder previsualizarlo antes de deployar.
const TRAVEL_VIEWERS = new Set([
  "nmachin@voltia.com.uy", // Nicolás
  "gvera@voltia.com.uy", // Gabriel
  "admin@voltiapm.com", // admin de desarrollo local
]);

export function useTravelViewer(): boolean {
  const email = useAuthStore((s) => s.user?.email);
  return !!email && TRAVEL_VIEWERS.has(email.toLowerCase());
}

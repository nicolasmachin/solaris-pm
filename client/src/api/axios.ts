import axios from "axios";
import { toast } from "react-hot-toast";

// Permite que llamadas SECUNDARIAS (badges, contadores, polling de fondo) opten
// por no disparar el logout global ante un 401. Una request principal sigue
// tumbando la sesión como antes; una secundaria solo falla en silencio.
declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean;
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("voltia-token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → clear token and redirect to /login
apiClient.interceptors.response.use(
  (response) => {
    // G.2: si el backend recalculó deadlines (X-Deadline-Recalc header), avisar al usuario.
    const recalcHeader = response.headers?.["x-deadline-recalc"];
    if (recalcHeader && typeof recalcHeader === "string") {
      try {
        const r = JSON.parse(recalcHeader) as { updated?: number; preserved?: number; cleared?: number };
        const u = r.updated ?? 0;
        const p = r.preserved ?? 0;
        const c = r.cleared ?? 0;
        if (u > 0 || c > 0 || p > 0) {
          const parts: string[] = [];
          if (u > 0) parts.push(`${u} actualizado${u === 1 ? "" : "s"}`);
          if (c > 0) parts.push(`${c} eliminado${c === 1 ? "" : "s"}`);
          if (p > 0) parts.push(`${p} preservado${p === 1 ? "" : "s"} (manual)`);
          toast.success(`Deadlines: ${parts.join(", ")}`, { duration: 4000 });
        }
      } catch {
        // noop — header malformado no debe romper el flujo
      }
    }
    return response;
  },
  (error) => {
    const status = error.response?.status as number | undefined;
    const skipAuthRedirect = Boolean(error.config?.skipAuthRedirect);
    const alreadyOnLogin = window.location.pathname === "/login";

    // Solo un 401 de una request PRINCIPAL invalida la sesión. Las secundarias
    // (skipAuthRedirect) fallan en silencio. El guard de pathname evita el loop
    // de re-login (borrar token → redirect → 401 → redirect…).
    if (status === 401 && !skipAuthRedirect && !alreadyOnLogin) {
      localStorage.removeItem("voltia-token");
      localStorage.removeItem("voltia-user");
      localStorage.removeItem("voltia-permissions");
      window.location.href = "/login";
    } else if (status !== undefined && status >= 500) {
      toast.error("Error interno del servidor. Intentá de nuevo en unos momentos.");
    }
    return Promise.reject(error);
  }
);

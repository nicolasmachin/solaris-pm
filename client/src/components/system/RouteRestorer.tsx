import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../../store/auth.store";

// Restaura la última ruta al reabrir la app en el celular.
//
// En iOS, la PWA instalada (standalone) se descarta en segundo plano y, al
// volver, se relanza en la `start_url` del manifest (/dashboard). Eso hace que
// el usuario "pierda el lugar" donde estaba. Acá guardamos la ruta actual y, si
// al arrancar aterrizamos en /dashboard (o la raíz) pero la última ruta era otra
// y reciente, volvemos a ella. Solo actúa UNA vez, en el arranque: nunca
// secuestra una navegación normal del usuario.

const KEY = "voltia-last-route";
const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 h — más viejo que eso, arrancamos limpio.
const START_PATHS = ["/dashboard", "/"];
const NO_RESTORE_PREFIXES = ["/login", "/cambiar-password"];

type Saved = { path: string; ts: number };

function readSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return s && typeof s.path === "string" && typeof s.ts === "number" ? s : null;
  } catch {
    return null;
  }
}

export function RouteRestorer() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);

  // Captura la ruta guardada ANTES de que el efecto de guardado la pise.
  const initial = useRef<Saved | null | undefined>(undefined);
  if (initial.current === undefined) initial.current = readSaved();
  const didRestore = useRef(false);

  // Restaurar una sola vez, al arrancar.
  useEffect(() => {
    if (didRestore.current) return;
    didRestore.current = true;
    if (!token) return; // sin sesión, flujo normal (login).
    if (!START_PATHS.includes(location.pathname)) return; // no arrancamos en el inicio: la URL ya trae el lugar.
    const saved = initial.current;
    if (!saved || Date.now() - saved.ts > MAX_AGE_MS) return;
    if (NO_RESTORE_PREFIXES.some((p) => saved.path.startsWith(p))) return;
    if (saved.path === location.pathname + location.search) return;
    navigate(saved.path, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar la ruta actual en cada navegación y al ocultar/cerrar la app.
  useEffect(() => {
    const path = location.pathname + location.search;
    if (NO_RESTORE_PREFIXES.some((p) => path.startsWith(p))) return;
    const save = () => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ path, ts: Date.now() }));
      } catch {
        /* almacenamiento no disponible: no pasa nada */
      }
    };
    save();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
    };
  }, [location.pathname, location.search]);

  return null;
}

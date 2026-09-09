import { useCallback, useEffect, useState } from "react";

/**
 * Si el sidebar contextual (la lista de clientes al costado) está plegado.
 *
 * Es una sola preferencia para los tres módulos que lo muestran —Proyectos,
 * Ingeniería y Experiencia Solar—: quien lo pliega es porque quiere la pantalla
 * entera, y volver a plegarlo en cada módulo sería pedirle lo mismo tres veces.
 *
 * **Por defecto viene desplegado**: la lista es lo que permite saltar de un
 * cliente a otro sin volver al listado, que es el uso normal.
 */
const KEY = "voltia-sidebar-colapsado";

/** Evento propio: dos pantallas montadas a la vez tienen que quedar sincronizadas. */
const EVENTO = "voltia-sidebar-colapsado-change";

function leer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function useSidebarColapsado(): [boolean, () => void] {
  const [colapsado, setColapsado] = useState(leer);

  useEffect(() => {
    const sync = () => setColapsado(leer());
    window.addEventListener(EVENTO, sync);
    // `storage` cubre el caso de dos pestañas abiertas.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENTO, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const alternar = useCallback(() => {
    const next = !leer();
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // Si el navegador bloquea el storage, el estado vive sólo en memoria.
    }
    window.dispatchEvent(new Event(EVENTO));
    setColapsado(next);
  }, []);

  return [colapsado, alternar];
}

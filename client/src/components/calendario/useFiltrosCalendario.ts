import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../../api/axios";
import { TIPOS_CALENDARIO, type TipoCalendario } from "../../api/agenda.api";

/**
 * Qué tipos muestra el calendario, guardado por usuario.
 *
 * Se apoya en la preferencia `CALENDARIO_FILTROS` (`Setting` de nivel USER), que
 * ya tiene endpoints propios — no hace falta tabla ni ruta nueva.
 *
 * El guardado va con debounce: cada PATCH de preferencias deja una entrada de
 * auditoría, y sin esperar un poco tildar y destildar tres filtros seguidos
 * generaría tres entradas por cada clic.
 */

const CLAVE = "CALENDARIO_FILTROS";
const DEBOUNCE_MS = 800;

/**
 * Versión del formato guardado.
 *
 * Hace falta porque un tipo nuevo tiene que aparecer **prendido** para quien ya
 * había guardado su combinación: si no, el tipo nace invisible y el usuario no
 * tiene forma de saber que existe. Al subir la versión se listan acá los tipos
 * que se agregaron, y las preferencias viejas los adoptan.
 */
const VERSION_FILTROS = 2;
const TIPOS_AGREGADOS_POR_VERSION: Record<number, TipoCalendario[]> = {
  2: ["OTRO"],
};

interface UserSetting {
  key: string;
  value: string;
}

interface Guardado {
  v?: number;
  tipos?: unknown;
}

function soloValidos(arr: unknown): TipoCalendario[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((t): t is TipoCalendario => (TIPOS_CALENDARIO as string[]).includes(t));
}

/** Suma los tipos incorporados después de la versión con la que se guardó. */
function alDia(tipos: TipoCalendario[], desde: number): TipoCalendario[] {
  const resultado = [...tipos];
  for (let v = desde + 1; v <= VERSION_FILTROS; v++) {
    for (const t of TIPOS_AGREGADOS_POR_VERSION[v] ?? []) {
      if (!resultado.includes(t)) resultado.push(t);
    }
  }
  return resultado;
}

function parse(raw: string | undefined): TipoCalendario[] {
  if (!raw) return TIPOS_CALENDARIO;
  try {
    const parsed: unknown = JSON.parse(raw);
    // Formato viejo: el array pelado, sin versión. Es v1.
    const esArrayPelado = Array.isArray(parsed);
    const version = esArrayPelado ? 1 : ((parsed as Guardado)?.v ?? 1);
    const validos = soloValidos(esArrayPelado ? parsed : (parsed as Guardado)?.tipos);

    // Guardado corrupto o vacío: se muestran todos. Un calendario en blanco sin
    // explicación se lee como que la app se rompió.
    if (validos.length === 0) return TIPOS_CALENDARIO;
    return alDia(validos, version);
  } catch {
    return TIPOS_CALENDARIO;
  }
}

function serializar(tipos: TipoCalendario[]): string {
  return JSON.stringify({ v: VERSION_FILTROS, tipos });
}

export function useFiltrosCalendario() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery<UserSetting[]>({
    queryKey: ["user-settings"],
    queryFn: () => apiClient.get<UserSetting[]>("/api/settings/user/me").then((r) => r.data),
  });

  const guardado = settings?.find((s) => s.key === CLAVE)?.value;
  const [tipos, setTipos] = useState<TipoCalendario[]>(TIPOS_CALENDARIO);
  const yaCargo = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Primera carga: adoptar lo guardado. Después manda el estado local, para no
  // pisar lo que el usuario está tocando con una respuesta que llega tarde.
  useEffect(() => {
    if (yaCargo.current || isLoading) return;
    yaCargo.current = true;
    setTipos(parse(guardado));
  }, [guardado, isLoading]);

  const persistir = useCallback(
    (next: TipoCalendario[]) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        apiClient
          .patch("/api/settings/user/me", [{ key: CLAVE, value: serializar(next) }])
          .then(() => qc.invalidateQueries({ queryKey: ["user-settings"] }))
          // Que no se pueda guardar la preferencia no debería interrumpir el
          // trabajo: el filtro ya está aplicado en pantalla.
          .catch(() => undefined);
      }, DEBOUNCE_MS);
    },
    [qc],
  );

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const toggle = useCallback(
    (tipo: TipoCalendario) => {
      setTipos((actuales) => {
        const next = actuales.includes(tipo)
          ? actuales.filter((t) => t !== tipo)
          : [...actuales, tipo];
        // Nunca dejar el calendario vacío: destildar el último vuelve a mostrar todo.
        const final = next.length === 0 ? TIPOS_CALENDARIO : next;
        persistir(final);
        return final;
      });
    },
    [persistir],
  );

  const mostrarTodos = useCallback(() => {
    setTipos(TIPOS_CALENDARIO);
    persistir(TIPOS_CALENDARIO);
  }, [persistir]);

  return {
    tipos,
    muestra: useCallback((t: TipoCalendario) => tipos.includes(t), [tipos]),
    todosVisibles: tipos.length === TIPOS_CALENDARIO.length,
    toggle,
    mostrarTodos,
  };
}

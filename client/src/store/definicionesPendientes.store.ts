import { create } from "zustand";

// Cuando un atajo intenta cerrar el Onboarding (completar todo, cerrar la
// subetapa desde el pipeline o desde "Mis tareas") y el servidor contesta que
// falta definir cómo paga el cliente, en vez de un error suelto se abre un modal
// que pide eso mismo y, al terminar, reintenta la acción original.

export interface DefinicionPendiente {
  codigo: "MODALIDAD_PAGO" | "PLAN_PAGOS" | "PROFORMA" | "NOTA_MODALIDAD";
  mensaje: string;
}

interface Pedido {
  projectId: string;
  faltantes: DefinicionPendiente[];
  reintentar: () => void;
}

interface DefinicionesState {
  pedido: Pedido | null;
  abrir: (p: Pedido) => void;
  cerrar: () => void;
}

export const useDefinicionesPendientes = create<DefinicionesState>((set) => ({
  pedido: null,
  abrir: (pedido) => set({ pedido }),
  cerrar: () => set({ pedido: null }),
}));

/**
 * Para el `onError` de las mutaciones que completan etapas o subetapas: si el
 * error es DEFINICIONES_PENDIENTES abre el modal y devuelve true (quien llama no
 * muestra su toast); si es otro error devuelve false.
 */
export function pedirDefinicionesSiFaltan(err: unknown, reintentar: () => void): boolean {
  // El manejador de errores del servidor aplana `details` en el cuerpo.
  const data = (err as {
    response?: { data?: { code?: string; projectId?: string; faltantes?: DefinicionPendiente[] } };
  })?.response?.data;
  if (data?.code !== "DEFINICIONES_PENDIENTES" || !data.projectId) return false;
  useDefinicionesPendientes.getState().abrir({
    projectId: data.projectId,
    faltantes: data.faltantes ?? [],
    reintentar,
  });
  return true;
}

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createInteraction,
  deleteInteraction,
  patchInteraction,
  type ClienteFicha,
  type InteractionChannel,
} from "../../../api/clientes.api";

// Crear interacción → invalida la ficha (que ya trae las interacciones) para
// que la bitácora se refresque sin un fetch extra.
export function useCreateInteraction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { channel: InteractionChannel; content: string }) =>
      createInteraction(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", projectId] });
    },
  });
}

// Editar interacción CON optimistic update (cambia content + marca updatedAt) y
// rollback en error; reconcilia con el server vía invalidación.
export function useEditInteraction(projectId: string) {
  const qc = useQueryClient();
  const key = ["cliente", projectId];
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      patchInteraction(id, { content }),
    onMutate: async ({ id, content }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ClienteFicha>(key);
      if (prev) {
        qc.setQueryData<ClienteFicha>(key, {
          ...prev,
          interacciones: prev.interacciones.map((i) =>
            i.id === id ? { ...i, content, updatedAt: new Date().toISOString() } : i,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
}

// Borrar interacción SIN optimistic update (espera la respuesta del server para
// evitar parpadeos ante un 403). Tras éxito, refresca la ficha.
export function useDeleteInteraction(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInteraction(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cliente", projectId] });
    },
  });
}

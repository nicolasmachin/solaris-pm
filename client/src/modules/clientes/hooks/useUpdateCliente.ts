import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  patchCliente,
  type ClienteFicha,
  type ClienteListItem,
  type ClientesListResponse,
  type PatchClientePayload,
} from "../../../api/clientes.api";

type Vars = { projectId: string; patch: PatchClientePayload };

// Traduce el patch (nombres de la API) a un parche parcial del ClienteListItem
// para el optimistic update. Solo incluye campos con shape directo; `asesor`
// (objeto {id,nombre}), `direccion` y `fechaVenta` se reconcilian con el item
// real que devuelve el server en onSuccess (replaceRowInCache).
function toDisplayPatch(patch: PatchClientePayload): Partial<ClienteListItem> {
  const d: Partial<ClienteListItem> = {};
  if (patch.mail !== undefined) d.mail = patch.mail;
  if (patch.telefono !== undefined) d.telefono = patch.telefono;
  if (patch.fechaEntrega !== undefined) d.fechaEntrega = patch.fechaEntrega;
  if (patch.nombre !== undefined) d.nombre = patch.nombre;
  if (patch.departamento !== undefined) d.departamento = patch.departamento;
  if (patch.estado !== undefined) d.estado = patch.estado;
  if (patch.potencia !== undefined) d.potenciaKwp = patch.potencia;
  return d;
}

// Aplica un patch parcial sobre la fila projectId en todas las páginas/filtros
// cacheadas del listado.
function patchRowInCache(old: ClientesListResponse | undefined, projectId: string, patch: PatchClientePayload) {
  if (!old) return old;
  const display = toDisplayPatch(patch);
  return {
    ...old,
    items: old.items.map((it) => (it.projectId === projectId ? { ...it, ...display } : it)),
  };
}

function replaceRowInCache(old: ClientesListResponse | undefined, item: ClienteListItem) {
  if (!old) return old;
  return {
    ...old,
    items: old.items.map((it) => (it.projectId === item.projectId ? item : it)),
  };
}

// Edición inline con optimistic update + rollback. Tras éxito reconcilia con el
// ClienteListItem que devuelve el server (recalcula campos derivados) e invalida
// la ficha por si está abierta.
export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, patch }: Vars) => patchCliente(projectId, patch),
    onMutate: async ({ projectId, patch }) => {
      const fichaKey = ["cliente", projectId];
      await qc.cancelQueries({ queryKey: ["clientes"] });
      await qc.cancelQueries({ queryKey: fichaKey });
      // Optimistic en el listado (todas las páginas) y en la ficha (si está abierta).
      const prevList = qc.getQueriesData<ClientesListResponse>({ queryKey: ["clientes"] });
      const prevFicha = qc.getQueryData<ClienteFicha>(fichaKey);
      qc.setQueriesData<ClientesListResponse>({ queryKey: ["clientes"] }, (old) =>
        patchRowInCache(old, projectId, patch),
      );
      if (prevFicha) qc.setQueryData<ClienteFicha>(fichaKey, { ...prevFicha, ...toDisplayPatch(patch) });
      return { prevList, prevFicha };
    },
    onError: (_err, { projectId }, ctx) => {
      ctx?.prevList?.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.prevFicha) qc.setQueryData(["cliente", projectId], ctx.prevFicha);
    },
    onSuccess: (item, { projectId }) => {
      qc.setQueriesData<ClientesListResponse>({ queryKey: ["clientes"] }, (old) =>
        replaceRowInCache(old, item),
      );
      qc.invalidateQueries({ queryKey: ["cliente", projectId] });
    },
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  marcarNovedadVista,
  type ClienteFicha,
  type ClienteListItem,
  type ClientesListResponse,
} from "../../../api/clientes.api";

type Vars = { projectId: string; vista?: boolean };

// "Ya lo vi": apaga el punto de novedad sin registrar un contacto que no existió.
//
// Invalida el Recorrido además del listado y la ficha: el punto se ve en las tres
// pantallas y si una se quedara con el valor viejo, el mismo cliente aparecería
// con novedad en una y sin novedad en otra.
export function useNovedadVista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, vista = true }: Vars) => marcarNovedadVista(projectId, vista),
    onSuccess: (item: ClienteListItem, { projectId, vista = true }) => {
      qc.setQueriesData<ClientesListResponse>({ queryKey: ["clientes"] }, (old) =>
        old
          ? { ...old, items: old.items.map((it) => (it.projectId === projectId ? item : it)) }
          : old,
      );
      qc.setQueryData<ClienteFicha>(["cliente", projectId], (prev) =>
        prev ? { ...prev, hayNovedad: item.hayNovedad, novedadVistaEn: item.novedadVistaEn } : prev,
      );
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente", projectId] });
      qc.invalidateQueries({ queryKey: ["recorrido"] });
      toast.success(vista ? "Novedad marcada como vista" : "Novedad vuelta a marcar");
    },
    onError: () => toast.error("No se pudo actualizar la novedad"),
  });
}

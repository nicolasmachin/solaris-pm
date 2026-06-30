import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { proposalsV2DefaultsApi } from "../api/proposals-v2.api";
import type { ProposalDefaultsResponse, ProposalDefaultsUpdateInput } from "../types/proposals-v2";

const QUERY_KEY = ["proposal-defaults"];

export function useProposalDefaults() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: proposalsV2DefaultsApi.get,
  });
}

export function useUpdateProposalDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProposalDefaultsUpdateInput) => proposalsV2DefaultsApi.update(input),
    onSuccess: (response: ProposalDefaultsResponse) => {
      toast.success("Defaults de propuestas guardados");
      // Sincronizamos la cache con la respuesta (el PUT devuelve el singleton
      // completo) en vez de invalidar: un refetch dispararía la re-inicialización
      // del form y pisaría los inputs de la OTRA sección a medio editar.
      qc.setQueryData(QUERY_KEY, response);
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar");
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { proposalsV2DefaultsApi } from "../api/proposals-v2.api";
import type { ProposalDefaultsUpdateInput } from "../types/proposals-v2";

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
    onSuccess: () => {
      toast.success("Defaults de propuestas guardados");
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar");
    },
  });
}

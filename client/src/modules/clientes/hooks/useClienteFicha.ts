import { useQuery } from "@tanstack/react-query";

import { getClienteFicha } from "../../../api/clientes.api";

export function useClienteFicha(projectId: string | undefined) {
  return useQuery({
    queryKey: ["cliente", projectId],
    queryFn: () => getClienteFicha(projectId as string),
    enabled: !!projectId,
  });
}

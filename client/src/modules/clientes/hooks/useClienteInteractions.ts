import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createInteraction, type InteractionChannel } from "../../../api/clientes.api";

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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import type { PlanGranizo } from "../../api/planGranizo.api";
import { errMsg } from "./estado";

// Mutación sobre un plan que devuelve el plan actualizado: lo deja en la caché
// del detalle y refresca listas, ficha y cobros (el plan toca Finanzas).
export function usePlanMutation<V>(fn: (vars: V) => Promise<PlanGranizo | unknown>, okMsg?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      const plan = res as PlanGranizo | undefined;
      if (plan && typeof plan === "object" && "id" in plan && "periodos" in plan) {
        qc.setQueryData(["plan-granizo", plan.id], plan);
      }
      qc.invalidateQueries({ queryKey: ["plan-granizo"] });
      qc.invalidateQueries({ queryKey: ["plan-granizo-proyecto"] });
      qc.invalidateQueries({ queryKey: ["plan-granizo-list"] });
      qc.invalidateQueries({ queryKey: ["plan-granizo-doc-context"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente"] });
      if (okMsg) toast.success(okMsg);
    },
    onError: (e) => toast.error(errMsg(e, "No se pudo guardar")),
  });
}

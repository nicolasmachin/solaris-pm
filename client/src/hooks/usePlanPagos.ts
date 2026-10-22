// Hook + types del Asistente de Plan de Pagos Previstos.
// Wrap fino sobre la API: query del plan vigente + mutación para crear/reemplazar.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "../api/axios";

export type PlanCuota = {
  id: string;
  descripcion: string; // SIN prefijo [PLAN] (el backend lo strippea)
  monto: number;
  moneda: "USD" | "UYU";
  dueDate: string | null;
  status: "PREVISTO" | "COMPROMETIDO" | "A_PAGAR" | "PARCIALMENTE_PAGADO" | "PAGADO";
  cobrado: boolean;
  // Momento de la obra al que está atada (null = cuota con fecha fija).
  hitoCobro: HitoCobro | null;
};

export type HitoCobro = "SENIA" | "PREVIO_OBRA" | "OBRA_FINALIZADA" | "HABILITACION";

export type GetPlanResponse = {
  hasPlan: boolean;
  presupuestoUsd: number | null;
  totalCobrado: number;
  saldoPendiente: number;
  cuotas: PlanCuota[];
};

export type PostPlanResponse = {
  created: number;
  replaced: number;
  cuotas: PlanCuota[];
};

export type CreatePlanBody = {
  projectId: string;
  cuotas: Array<{
    descripcion: string;
    monto: number;
    hitoCobro?: HitoCobro | null;
    fechaPrevista?: string | null; // yyyy-mm-dd, solo si no tiene hitoCobro
  }>;
};

export function usePlanPagos(projectId: string) {
  return useQuery({
    queryKey: ["plan-pagos", projectId],
    queryFn: async () => {
      const { data } = await apiClient.get<GetPlanResponse>(`/api/finance/plan-pagos/${projectId}`);
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreatePlanPagos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreatePlanBody) => {
      const { data } = await apiClient.post<PostPlanResponse>(`/api/finance/plan-pagos`, body);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["plan-pagos", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["cobros-by-project"] });
      qc.invalidateQueries({ queryKey: ["finance-pending"] });
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
      qc.invalidateQueries({ queryKey: ["finance-movements"] });
    },
  });
}

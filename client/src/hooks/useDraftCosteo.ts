// Costeo de la cotización. Misma mecánica que useDraftCalc: la query está
// keyed por `savedTick` del autosave, así que se refresca sola apenas el
// borrador se guarda. Es lo que hace que al editar un costo el resto de la
// tabla (markup, IVA, precio final, flujo de caja) se recalcule sin botón.

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { proposalsV2BuilderApi } from "../api/proposals-v2-builder.api";
import type { ProposalCosteoResponse, ProposalVariante } from "../types/proposals-v2";

export type CosteoStatus = "loading" | "success" | "error" | "invalid";

export interface UseDraftCosteoResult {
  data: ProposalCosteoResponse | undefined;
  status: CosteoStatus;
  /** Campos que faltan completar para que haya cálculo (status === "invalid"). */
  missing: string[];
  errorMsg: string | null;
}

export function useDraftCosteo(params: {
  leadId: string;
  savedTick: number;
  enabled: boolean;
  variante: ProposalVariante;
}): UseDraftCosteoResult {
  const { leadId, savedTick, enabled, variante } = params;

  const query = useQuery({
    queryKey: ["proposal-draft-costeo", leadId, variante, savedTick],
    queryFn: () => proposalsV2BuilderApi.getDraftCosteo(leadId, variante),
    enabled,
    staleTime: 0,
    retry: false,
    // Mantiene la tabla en pantalla mientras refetchea: sin esto parpadea con
    // cada tecla, porque cada autosave dispara una query nueva.
    placeholderData: (prev) => prev,
  });

  let status: CosteoStatus = "loading";
  let missing: string[] = [];
  let errorMsg: string | null = null;

  if (query.isError) {
    if (axios.isAxiosError(query.error) && query.error.response?.status === 400) {
      const d = query.error.response.data as { message?: string; missing?: string[] } | undefined;
      status = "invalid";
      missing = d?.missing ?? [];
      errorMsg = d?.message ?? "Faltan campos obligatorios";
    } else {
      status = "error";
      errorMsg = "No se pudo calcular el costeo.";
    }
  } else if (query.data) {
    status = "success";
  }

  return { data: query.data, status, missing, errorMsg };
}

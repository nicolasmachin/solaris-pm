// Hook del drawer de debug de calculadora. Query TanStack keyed por `savedTick`
// del autosave: se refresca sola cuando hubo un save exitoso. Solo consulta si
// está habilitada (admin + drawer abierto). Ver DEBUG_CALCULADORA_SPEC.md §5.3.

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { proposalsV2BuilderApi } from "../api/proposals-v2-builder.api";
import type { CalcDebugRow } from "../types/proposals-v2";

export type DraftCalcStatus = "loading" | "success" | "error" | "invalid";

export interface UseDraftCalcResult {
  rows: CalcDebugRow[] | undefined;
  status: DraftCalcStatus;
  missing: string[]; // campos faltantes cuando status === "invalid"
  errorMsg: string | null;
  stale: boolean; // datos previos mostrados porque el autosave está fallando
  refetch: () => void;
}

function parseError(err: unknown): { invalid: boolean; missing: string[]; msg: string } {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as { message?: string; missing?: string[] } | undefined;
    if (status === 400) {
      return { invalid: true, missing: data?.missing ?? [], msg: data?.message ?? "Faltan campos obligatorios" };
    }
    return { invalid: false, missing: [], msg: data?.message ?? "No se pudieron cargar los cálculos." };
  }
  return { invalid: false, missing: [], msg: "No se pudieron cargar los cálculos." };
}

export function useDraftCalc(params: {
  leadId: string;
  savedTick: number;
  enabled: boolean;
  autosaveError: boolean;
}): UseDraftCalcResult {
  const { leadId, savedTick, enabled, autosaveError } = params;

  const query = useQuery({
    queryKey: ["proposal-draft-calc", leadId, savedTick],
    queryFn: () => proposalsV2BuilderApi.getDraftCalc(leadId),
    enabled,
    staleTime: 0,
    retry: false,
    placeholderData: (prev) => prev, // mantiene las filas previas mientras refetchea
  });

  let status: DraftCalcStatus;
  let missing: string[] = [];
  let errorMsg: string | null = null;

  if (query.isError) {
    const parsed = parseError(query.error);
    status = parsed.invalid ? "invalid" : "error";
    missing = parsed.missing;
    errorMsg = parsed.msg;
  } else if (query.data) {
    status = "success";
  } else {
    status = "loading";
  }

  // Autosave fallando + hay datos previos → el cálculo puede estar desactualizado
  // (no hubo save exitoso que dispare el refetch). Se muestran los datos previos.
  const stale = autosaveError && status === "success";

  return {
    rows: query.data,
    status,
    missing,
    errorMsg,
    stale,
    refetch: () => void query.refetch(),
  };
}

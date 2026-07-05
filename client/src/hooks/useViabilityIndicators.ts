import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { proposalsV2BuilderApi } from "../api/proposals-v2-builder.api";
import type { ViabilityResult } from "../types/proposals-v2";

// Indicadores de viabilidad del sub-header del constructor. El cálculo lo hace el
// server; el cliente refetchea al cambiar el savedTick del autosave, con debounce
// 500ms para no spamear en saves rápidos. Si el autosave falla, marca stale.
export function useViabilityIndicators(params: {
  leadId: string;
  savedTick: number;
  enabled: boolean;
  autosaveError: boolean;
}): { data: ViabilityResult | undefined; stale: boolean } {
  const { leadId, savedTick, enabled, autosaveError } = params;

  const [debouncedTick, setDebouncedTick] = useState(savedTick);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedTick(savedTick), 500);
    return () => clearTimeout(t);
  }, [savedTick]);

  const query = useQuery({
    queryKey: ["draft-viability", leadId, debouncedTick],
    queryFn: () => proposalsV2BuilderApi.getDraftViability(leadId),
    enabled,
    staleTime: 0,
    retry: false,
    placeholderData: (prev) => prev,
  });

  return { data: query.data, stale: autosaveError && Boolean(query.data) };
}

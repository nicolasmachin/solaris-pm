import { useQuery } from "@tanstack/react-query";

import { getLeadProposals } from "../api/leads.api";

// Lista unificada de propuestas del lead (viejas + nuevas). La key incluye
// includeDiscarded; invalidar por ["lead-proposals", leadId] refresca ambas.
export function useLeadProposals(leadId: string, includeDiscarded: boolean) {
  return useQuery({
    queryKey: ["lead-proposals", leadId, includeDiscarded],
    queryFn: () => getLeadProposals(leadId, includeDiscarded),
    enabled: Boolean(leadId),
  });
}

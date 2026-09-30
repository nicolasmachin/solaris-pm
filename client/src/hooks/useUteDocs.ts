import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateUteDocs,
  getUteDocsConfig,
  saveUteDocsConfig,
  type UteDocKey,
  type UteDocumentConfig,
} from "../api/uteDocs.api";

// `suministro`: cuenta UTE del proyecto. El 1 (principal) conserva la clave de
// cache de siempre, que comparten otras pantallas.
const configKey = (projectId: string, suministro: number) =>
  suministro === 1 ? ["ute-docs-config", projectId] : ["ute-docs-config", projectId, suministro];

export function useUteDocsConfig(projectId: string, suministro: number = 1) {
  return useQuery({
    queryKey: configKey(projectId, suministro),
    queryFn: () => getUteDocsConfig(projectId, suministro),
    enabled: !!projectId,
  });
}

export function useSaveUteDocsConfig(projectId: string, suministro: number = 1) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<UteDocumentConfig, "id" | "projectId" | "suministro" | "createdAt" | "updatedAt">>) =>
      saveUteDocsConfig(projectId, body, suministro),
    onSuccess: (data) => {
      qc.setQueryData(configKey(projectId, suministro), data);
      qc.invalidateQueries({ queryKey: ["suministros", projectId] });
    },
  });
}

export function useGenerateUteDocs(projectId: string, suministro: number = 1) {
  const qc = useQueryClient();
  return useMutation({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ute-docs-generado", projectId] });
    },
    mutationFn: async ({ docs, filenameHint }: { docs: UteDocKey[]; filenameHint: string }) => {
      const blob = await generateUteDocs(projectId, docs, suministro);
      // Disparar descarga client-side.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `docs_ute_${filenameHint}_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { docsCount: docs.length };
    },
  });
}

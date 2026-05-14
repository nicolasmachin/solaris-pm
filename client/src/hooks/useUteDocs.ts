import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateUteDocs,
  getUteDocsConfig,
  saveUteDocsConfig,
  type UteDocKey,
  type UteDocumentConfig,
} from "../api/uteDocs.api";

export function useUteDocsConfig(projectId: string) {
  return useQuery({
    queryKey: ["ute-docs-config", projectId],
    queryFn: () => getUteDocsConfig(projectId),
    enabled: !!projectId,
  });
}

export function useSaveUteDocsConfig(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<UteDocumentConfig, "id" | "projectId" | "createdAt" | "updatedAt">>) =>
      saveUteDocsConfig(projectId, body),
    onSuccess: (data) => {
      qc.setQueryData(["ute-docs-config", projectId], data);
    },
  });
}

export function useGenerateUteDocs(projectId: string) {
  return useMutation({
    mutationFn: async ({ docs, filenameHint }: { docs: UteDocKey[]; filenameHint: string }) => {
      const blob = await generateUteDocs(projectId, docs);
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

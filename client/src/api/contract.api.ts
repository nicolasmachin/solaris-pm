import axios from "axios";

import { apiClient as api } from "./axios";
import type {
  ContractContext,
  ContractData,
  ContractDraftResponse,
  ContractVersionListItem,
} from "../types/contract";

const P = "/api";

export const contractApi = {
  // GET draft → null si el proyecto no tiene borrador (404).
  getDraft: async (projectId: string): Promise<ContractDraftResponse | null> => {
    try {
      const { data } = await api.get<ContractDraftResponse>(`${P}/projects/${projectId}/contract/draft`);
      return data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) return null;
      throw e;
    }
  },

  getContext: async (projectId: string): Promise<ContractContext> => {
    const { data } = await api.get<ContractContext>(`${P}/projects/${projectId}/contract/context`);
    return data;
  },

  // Autosave: PUT lenient (nunca falla por campos faltantes).
  putDraft: async (projectId: string, data: Partial<ContractData>): Promise<ContractDraftResponse> => {
    const res = await api.put<ContractDraftResponse>(`${P}/projects/${projectId}/contract/draft`, { data });
    return res.data;
  },

  listVersions: async (projectId: string, includeDiscarded: boolean): Promise<ContractVersionListItem[]> => {
    const { data } = await api.get<{ versions: ContractVersionListItem[] }>(
      `${P}/projects/${projectId}/contract/versions`,
      { params: { includeDiscarded: includeDiscarded ? "true" : "false" } },
    );
    return data.versions;
  },

  publishVersion: async (projectId: string): Promise<ContractVersionListItem> => {
    const { data } = await api.post<ContractVersionListItem>(`${P}/projects/${projectId}/contract/versions`, {});
    return data;
  },

  discardVersion: async (id: string, reason?: string): Promise<void> => {
    await api.delete(`${P}/contract/versions/${id}`, { data: reason ? { reason } : {} });
  },

  restoreVersion: async (id: string): Promise<void> => {
    await api.post(`${P}/contract/versions/${id}/restore`, {});
  },

  // Preview del borrador como Blob (auth Bearer → object URL para el iframe).
  getDraftPreviewBlob: async (projectId: string): Promise<Blob> => {
    const { data } = await api.get<Blob>(`${P}/projects/${projectId}/contract/draft/preview.pdf`, {
      responseType: "blob",
    });
    return data;
  },

  // Abre el PDF de una versión en una pestaña nueva (preview inline, auth Bearer).
  openVersionPreview: async (id: string): Promise<void> => {
    const { data } = await api.get<Blob>(`${P}/contract/versions/${id}/preview`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  // Descarga el PDF de una versión (blob + <a download>).
  downloadVersionPdf: async (id: string, filename: string): Promise<void> => {
    const { data } = await api.get<Blob>(`${P}/contract/versions/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

import axios from "axios";

import { apiClient as api } from "./axios";
import type {
  ProformaContext,
  ProformaData,
  ProformaDraftResponse,
  ProformaVersionListItem,
} from "../types/proforma";

const P = "/api";

export const proformaApi = {
  getDraft: async (projectId: string): Promise<ProformaDraftResponse | null> => {
    try {
      const { data } = await api.get<ProformaDraftResponse>(`${P}/projects/${projectId}/proforma/draft`);
      return data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) return null;
      throw e;
    }
  },

  getContext: async (projectId: string): Promise<ProformaContext> => {
    const { data } = await api.get<ProformaContext>(`${P}/projects/${projectId}/proforma/context`);
    return data;
  },

  putDraft: async (projectId: string, data: Partial<ProformaData>): Promise<ProformaDraftResponse> => {
    const res = await api.put<ProformaDraftResponse>(`${P}/projects/${projectId}/proforma/draft`, { data });
    return res.data;
  },

  listVersions: async (projectId: string, includeDiscarded: boolean): Promise<ProformaVersionListItem[]> => {
    const { data } = await api.get<{ versions: ProformaVersionListItem[] }>(
      `${P}/projects/${projectId}/proforma/versions`,
      { params: { includeDiscarded: includeDiscarded ? "true" : "false" } },
    );
    return data.versions;
  },

  publishVersion: async (projectId: string): Promise<ProformaVersionListItem> => {
    const { data } = await api.post<ProformaVersionListItem>(`${P}/projects/${projectId}/proforma/versions`, {});
    return data;
  },

  discardVersion: async (id: string, reason?: string): Promise<void> => {
    await api.delete(`${P}/proforma/versions/${id}`, { data: reason ? { reason } : {} });
  },

  restoreVersion: async (id: string): Promise<void> => {
    await api.post(`${P}/proforma/versions/${id}/restore`, {});
  },

  getDraftPreviewBlob: async (projectId: string): Promise<Blob> => {
    const { data } = await api.get<Blob>(`${P}/projects/${projectId}/proforma/draft/preview.pdf`, {
      responseType: "blob",
    });
    return data;
  },

  openVersionPreview: async (id: string): Promise<void> => {
    const { data } = await api.get<Blob>(`${P}/proforma/versions/${id}/preview`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },

  downloadVersionPdf: async (id: string, filename: string): Promise<void> => {
    const { data } = await api.get<Blob>(`${P}/proforma/versions/${id}/pdf`, { responseType: "blob" });
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

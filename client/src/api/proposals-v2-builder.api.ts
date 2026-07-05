import axios from "axios";

import { apiClient as api } from "./axios";
import type {
  CalcDebugRow,
  MemoriaSingletonValue,
  ProposalDraftData,
  ProposalDraftResponse,
  ProposalVersionDetail,
  ProposalVersionListItem,
  ViabilityResult,
} from "../types/proposals-v2";

const P = "/api/proposals-v2";

export const proposalsV2BuilderApi = {
  // GET draft → null si el lead no tiene borrador (404).
  getDraft: async (leadId: string): Promise<ProposalDraftResponse | null> => {
    try {
      const { data } = await api.get<ProposalDraftResponse>(`${P}/leads/${leadId}/draft`);
      return data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) return null;
      throw e;
    }
  },

  // Autosave: PUT lenient (nunca falla por campos faltantes).
  putDraft: async (leadId: string, data: Partial<ProposalDraftData>): Promise<ProposalDraftResponse> => {
    const res = await api.put<ProposalDraftResponse>(`${P}/leads/${leadId}/draft`, { data });
    return res.data;
  },

  listVersions: async (leadId: string, includeDiscarded: boolean): Promise<ProposalVersionListItem[]> => {
    const { data } = await api.get<{ versions: ProposalVersionListItem[] }>(
      `${P}/leads/${leadId}/versions`,
      { params: { includeDiscarded: includeDiscarded ? "true" : "false" } },
    );
    return data.versions;
  },

  getVersion: async (id: string): Promise<ProposalVersionDetail> => {
    const { data } = await api.get<ProposalVersionDetail>(`${P}/versions/${id}`);
    return data;
  },

  publishVersion: async (leadId: string): Promise<ProposalVersionListItem> => {
    const { data } = await api.post<ProposalVersionListItem>(`${P}/leads/${leadId}/versions`, {});
    return data;
  },

  discardVersion: async (id: string, reason?: string): Promise<void> => {
    await api.delete(`${P}/versions/${id}`, { data: reason ? { reason } : {} });
  },

  restoreVersion: async (id: string): Promise<void> => {
    await api.post(`${P}/versions/${id}/restore`, {});
  },

  // Preview del borrador como Blob (auth Bearer → no se puede usar como src de
  // iframe directo; se baja con el token y se arma un object URL).
  getDraftPreviewBlob: async (leadId: string): Promise<Blob> => {
    const { data } = await api.get<Blob>(`${P}/leads/${leadId}/draft/preview.pdf`, {
      responseType: "blob",
    });
    return data;
  },

  // Viabilidad del borrador (VENTAS:VIEW): ahorro % + espacio para el sub-header.
  getDraftViability: async (leadId: string): Promise<ViabilityResult> => {
    const { data } = await api.get<ViabilityResult>(`${P}/leads/${leadId}/draft/viability`);
    return data;
  },

  // Debug de cálculo del borrador (solo admin): filas ya armadas
  // (label/descripción/unidad/valor/orden). 400 si el borrador no valida strict.
  getDraftCalc: async (leadId: string): Promise<CalcDebugRow[]> => {
    const { data } = await api.get<{ rows: CalcDebugRow[] }>(`${P}/leads/${leadId}/draft/calc`);
    return data.rows;
  },

  // Memoria de cálculo: valores en vivo del singleton (VENTAS:ACCESS_MEMORIA).
  getCalculatorMemoria: async (): Promise<Record<string, MemoriaSingletonValue>> => {
    const { data } = await api.get<{ singletonValues: Record<string, MemoriaSingletonValue> }>(
      `${P}/calculator-memoria`,
    );
    return data.singletonValues;
  },

  // Descarga un PDF de versión (mismo tema de auth: blob + <a download>).
  downloadVersionPdf: async (id: string, kind: "full" | "summary", filename: string): Promise<void> => {
    const { data } = await api.get<Blob>(`${P}/versions/${id}/pdf/${kind}`, { responseType: "blob" });
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

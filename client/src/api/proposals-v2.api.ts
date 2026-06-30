import { apiClient as api } from "./axios";
import type {
  CoverOverlay,
  ProposalDefaultsResponse,
  ProposalDefaultsUpdateInput,
} from "../types/proposals-v2";

export const proposalsV2DefaultsApi = {
  get: async (): Promise<ProposalDefaultsResponse> => {
    const { data } = await api.get<ProposalDefaultsResponse>("/api/proposals-v2/defaults");
    return data;
  },
  update: async (input: ProposalDefaultsUpdateInput): Promise<ProposalDefaultsResponse> => {
    const { data } = await api.put<ProposalDefaultsResponse>("/api/proposals-v2/defaults", input);
    return data;
  },
  // Sube el PDF de tapa (multipart). Solo ADMIN.
  uploadCover: async (file: File): Promise<{ coverPdfAttachmentId: string; uploadedAt: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/api/proposals-v2/defaults/cover", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
  // Trae la tapa actual como Blob (auth Bearer → no se puede usar el endpoint
  // directo como src de un iframe; hay que bajarlo con el token y crear un
  // object URL).
  getCoverBlob: async (): Promise<Blob> => {
    const { data } = await api.get<Blob>("/api/proposals-v2/defaults/cover", {
      responseType: "blob",
    });
    return data;
  },
  // Vista previa de la tapa con el overlay que el admin está probando (datos de
  // ejemplo). Devuelve el PDF como Blob.
  previewCover: async (config: CoverOverlay): Promise<Blob> => {
    const { data } = await api.post<Blob>(
      "/api/proposals-v2/defaults/cover/preview",
      { config },
      { responseType: "blob" },
    );
    return data;
  },
};

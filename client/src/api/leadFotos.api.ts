import { apiClient } from "./axios";

/** Foto del relevamiento de la visita de ventas. */
export interface LeadFoto {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  thumbnailUrl: string;
  fullUrl: string;
  uploadedBy: { id: string; name: string | null } | null;
}

export async function getLeadFotos(leadId: string): Promise<{ fotos: LeadFoto[]; count: number }> {
  const { data } = await apiClient.get<{ fotos: LeadFoto[]; count: number }>(
    `/api/leads/${leadId}/fotos`,
  );
  return data;
}

export async function uploadLeadFoto(leadId: string, blob: Blob, filename: string): Promise<void> {
  const form = new FormData();
  form.append("file", blob, filename);
  await apiClient.post(`/api/leads/${leadId}/fotos`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export async function deleteLeadFoto(leadId: string, fotoId: string): Promise<void> {
  await apiClient.delete(`/api/leads/${leadId}/fotos/${fotoId}`);
}

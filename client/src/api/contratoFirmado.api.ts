import { apiClient } from "./axios";

// Contrato firmado por el cliente: un solo archivo vigente por proyecto.
export interface ContratoFirmado {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: { id: string; name: string | null } | null;
  createdAt: string;
  previewUrl: string;
  downloadUrl: string;
}

export async function getContratoFirmado(projectId: string): Promise<ContratoFirmado | null> {
  const { data } = await apiClient.get<{ contrato: ContratoFirmado | null }>(
    `/api/projects/${projectId}/contrato-firmado`,
  );
  return data.contrato;
}

export async function uploadContratoFirmado(projectId: string, file: File): Promise<ContratoFirmado> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await apiClient.post<{ contrato: ContratoFirmado }>(
    `/api/projects/${projectId}/contrato-firmado`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data.contrato;
}

export async function deleteContratoFirmado(projectId: string): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/contrato-firmado`);
}

// Cliente para la extracción AI desde cédula / factura UTE.
import { apiClient } from "./axios";

export type UteExtractTipo = "cedula" | "factura_ute";

export interface UteExtractedData {
  nombre_cliente: string | null;
  ci_cliente: string | null;
  dir_cliente: string | null;
  calle: string | null;
  num_calle: string | null;
  ciudad: string | null;
  depto: string | null;
  mail_cliente: string | null;
  telefono_cliente: string | null;
  cuenta_ute: string | null;
  caso_ute: string | null;
  oficina_ute: string | null;
  tarifa_ute: string | null;
  pot_contratada: string | null;
  persona_fisica: boolean | null;
}

export interface UteExtractResponse {
  extraido: UteExtractedData;
  archivo_guardado: string;
  tipo: UteExtractTipo;
}

// Borra el archivo cargado (cédula o factura UTE) del storage y limpia la
// ruta en el Project. NO toca los datos del cliente ya confirmados.
export async function uteExtractDelete(
  projectId: string,
  tipo: UteExtractTipo,
): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/ute-extract`, {
    params: { tipo },
  });
}

export async function uteExtract(
  projectId: string,
  tipo: UteExtractTipo,
  file: File,
): Promise<UteExtractResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<UteExtractResponse>(
    `/api/projects/${projectId}/ute-extract`,
    form,
    {
      params: { tipo },
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

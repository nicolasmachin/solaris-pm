import { apiClient } from "./axios";

// Cadencia de contacto por recorrido (E1/E2/E3), en días calendario.
// Config de administración. Alimenta el Panel de operaciones ("Sin comunicación").

export interface RecorridoCadenciaRow {
  recorrido: "E1" | "E2" | "E3";
  /** Días calendario objetivo entre contactos. null si nunca se configuró. */
  diasObjetivo: number | null;
  activo: boolean;
  configured: boolean;
}

export function getRecorridoCadencias(): Promise<RecorridoCadenciaRow[]> {
  return apiClient.get<RecorridoCadenciaRow[]>("/api/admin/recorrido-cadencias").then((r) => r.data);
}

export function putRecorridoCadencia(
  recorrido: string,
  body: { diasObjetivo: number; activo?: boolean },
): Promise<unknown> {
  return apiClient.put(`/api/admin/recorrido-cadencias/${recorrido}`, body).then((r) => r.data);
}

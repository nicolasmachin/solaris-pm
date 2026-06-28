import { apiClient } from "./axios";

// ─── Tipos del módulo Experiencia de Clientes (Ola 1 / MVP) ──────────────────

export type InteractionChannel = "WHATSAPP" | "EMAIL" | "LLAMADA" | "VISITA" | "OTRO";
export type ClienteEstado = "ACTIVO" | "FINALIZADO" | "ARCHIVADO" | "PROSPECTO";
// "Etapa" del CRM = recorrido del cliente en 3 etapas (E1/E2/E3).
export type ClienteRecorrido = "E1" | "E2" | "E3";
export type ClienteSortBy = "nombre" | "fechaEntrega" | "potenciaKwp" | "etapa";
export type SortDir = "asc" | "desc";

// Etapa con dos niveles: recorrido del cliente (E1/E2/E3) + sub-etapa del
// pipeline operativo en curso.
export interface EtapaInfo {
  recorrido: { codigo: ClienteRecorrido; nombreCorto: string; nombreLargo: string };
  pipeline: { stage: string; label: string };
}

export interface ClienteListItem {
  projectId: string;
  nombre: string;
  mail: string | null;
  telefono: string | null;
  departamento: string | null;
  potenciaKwp: number | null;
  fechaEntrega: string | null;
  asesor: { id: string; nombre: string } | null;
  etapa: EtapaInfo | null;
  estado: ClienteEstado;
}

export interface ClienteInteraction {
  id: string;
  channel: InteractionChannel;
  content: string;
  autor: { id: string; nombre: string };
  createdAt: string;
}

export interface ClienteFicha extends ClienteListItem {
  direccion: string | null;
  tramiteUte: { etapa: string; desde: string | null } | null;
  interacciones: ClienteInteraction[];
  proyectoUrl: string;
}

export interface ClientesFilters {
  search?: string;
  estado?: ClienteEstado;
  asesorId?: string;
  departamento?: string;
  etapa?: ClienteRecorrido;
  sortBy?: ClienteSortBy;
  sortDir?: SortDir;
}

export interface ClientesListResponse {
  items: ClienteListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// `undefined` y strings vacíos se descartan para no mandar query params ruidosos.
function cleanParams(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

export async function getClientes(
  filters: ClientesFilters,
  page: number,
  pageSize: number,
): Promise<ClientesListResponse> {
  const { data } = await apiClient.get<ClientesListResponse>("/api/clientes", {
    params: cleanParams({ ...filters, page, pageSize }),
  });
  return data;
}

export async function getClienteFicha(projectId: string): Promise<ClienteFicha> {
  const { data } = await apiClient.get<ClienteFicha>(`/api/clientes/${projectId}`);
  return data;
}

// Edición inline desde el listado: SOLO mail / teléfono / fecha de entrega.
// Devuelve el ClienteListItem actualizado (para refrescar la fila sin refetch).
export interface PatchClientePayload {
  mail?: string | null;
  telefono?: string | null;
  fechaEntrega?: string | null;
}

export async function patchCliente(
  projectId: string,
  body: PatchClientePayload,
): Promise<ClienteListItem> {
  const { data } = await apiClient.patch<ClienteListItem>(`/api/clientes/${projectId}`, body);
  return data;
}

export async function createInteraction(
  projectId: string,
  body: { channel: InteractionChannel; content: string },
): Promise<ClienteInteraction> {
  const { data } = await apiClient.post<ClienteInteraction>(
    `/api/clientes/${projectId}/interacciones`,
    body,
  );
  return data;
}

// Descarga el CSV respetando los filtros activos. Usa el token del interceptor
// vía apiClient (responseType blob) y dispara la descarga en el navegador.
export async function exportClientes(filters: ClientesFilters): Promise<void> {
  const response = await apiClient.get("/api/clientes/export", {
    params: cleanParams(filters),
    responseType: "blob",
  });
  const blob = new Blob([response.data as BlobPart], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const fecha = new Date().toISOString().slice(0, 10);
  a.download = `clientes_voltia_${fecha}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

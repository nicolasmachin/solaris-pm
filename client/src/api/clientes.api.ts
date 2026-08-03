import { apiClient } from "./axios";

// ─── Tipos del módulo Experiencia de Clientes (Ola 1 / MVP) ──────────────────

export type InteractionChannel = "WHATSAPP" | "EMAIL" | "LLAMADA" | "VISITA" | "OTRO";
export type InteractionDirection = "ENTRANTE" | "SALIENTE";
export type InteractionReason = "BIENVENIDA" | "SEGUIMIENTO" | "AVISO_HABILITACION" | "CONSULTA" | "OTRO";
export type ClienteEstado = "ACTIVO" | "FINALIZADO" | "ARCHIVADO" | "PROSPECTO";
// "Etapa" del CRM = recorrido del cliente en 3 etapas (E1/E2/E3).
export type ClienteRecorrido = "E1" | "E2" | "E3";
export type ClienteSortBy = "nombre" | "fechaEntrega" | "potenciaKwp" | "etapa" | "proximoMantenimiento";
export type SortDir = "asc" | "desc";

// Próximo mantenimiento = próximo aniversario de la puesta en marcha. null si el
// cliente aún no está habilitado.
export interface MantenimientoInfo {
  aniosQueCumple: number;
  proximoAniversario: string; // ISO date (YYYY-MM-DD)
  diasRestantes: number;
}

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
  ultimoContactoEn: string | null; // ISO datetime de la última interacción
  avisoHabilitacionPendiente: boolean; // Regla de Oro: UTE finalizó y CX no avisó
  mantenimiento: MantenimientoInfo | null; // próximo aniversario (mantenimiento)
  hasPortalUser: boolean; // ya tiene usuario de portal (Generador) creado/vinculado
}

export interface ClienteInteraction {
  id: string;
  channel: InteractionChannel;
  direction: InteractionDirection | null;
  reason: InteractionReason | null;
  content: string;
  autor: { id: string; nombre: string };
  createdAt: string;
  updatedAt: string;
}

export interface ClienteFicha extends ClienteListItem {
  direccion: string | null;
  fechaVenta: string | null; // ISO date (YYYY-MM-DD) — cierre del lead como ganado
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

export interface TimelineItem {
  id: string;
  source: "sales" | "project" | "client" | "ticket" | "survey";
  kind: "stage_change" | "comment" | "interaction" | "document" | "handoff" | "ticket" | "survey";
  text: string;
  autor: { id: string; nombre: string } | null;
  createdAt: string;
  meta?: {
    channel?: InteractionChannel;
    direction?: InteractionDirection | null;
    reason?: InteractionReason | null;
    [key: string]: unknown;
  };
}

export async function getClienteTimeline(projectId: string): Promise<TimelineItem[]> {
  const { data } = await apiClient.get<TimelineItem[]>(`/api/clientes/${projectId}/timeline`);
  return data;
}

export async function getClienteFicha(projectId: string): Promise<ClienteFicha> {
  const { data } = await apiClient.get<ClienteFicha>(`/api/clientes/${projectId}`);
  return data;
}

// Edición inline desde el listado. Devuelve el ClienteListItem actualizado
// (para refrescar la fila sin refetch).
export interface PatchClientePayload {
  mail?: string | null;
  telefono?: string | null;
  fechaEntrega?: string | null;
  nombre?: string;
  departamento?: string;
  potencia?: number;
  asesor?: string | null; // salespersonId
  estado?: ClienteEstado;
  direccion?: string | null;
  fechaVenta?: string | null;
  etapa?: ClienteRecorrido | null; // override manual E1/E2/E3
}

export async function patchCliente(
  projectId: string,
  body: PatchClientePayload,
): Promise<ClienteListItem> {
  const { data } = await apiClient.patch<ClienteListItem>(`/api/clientes/${projectId}`, body);
  return data;
}

// Borra (lógicamente) un Generador. Desaparece del listado; queda recuperable
// en la base. Requiere permiso EXPERIENCIA_CLIENTES:DELETE.
export async function deleteCliente(projectId: string): Promise<void> {
  await apiClient.delete(`/api/clientes/${projectId}`);
}

// ─── Usuario de portal (Generador) del cliente ───────────────────────────────

export interface CrearPortalUserPayload {
  name: string;
  email: string;
  temporaryPassword: string;
  phone?: string | null;
}

export interface CrearPortalUserResult {
  userId: string;
  name: string;
  email: string;
  linked: boolean; // true → se vinculó un Generador existente; false → recién creado
}

// Crea (o vincula) el usuario de portal del cliente para un proyecto.
// Requiere permiso EXPERIENCIA_CLIENTES:CREATE.
export async function crearPortalUser(
  projectId: string,
  body: CrearPortalUserPayload,
): Promise<CrearPortalUserResult> {
  const { data } = await apiClient.post<CrearPortalUserResult>(
    `/api/clientes/${projectId}/portal-user`,
    body,
  );
  return data;
}

export interface ResetPortalUserResult {
  userId: string;
  name: string;
  email: string;
}

// Resetea la contraseña del usuario de portal del proyecto a una nueva temporal
// (para reenviar el acceso). Requiere permiso EXPERIENCIA_CLIENTES:CREATE.
export async function resetPortalUser(
  projectId: string,
  temporaryPassword: string,
): Promise<ResetPortalUserResult> {
  const { data } = await apiClient.post<ResetPortalUserResult>(
    `/api/clientes/${projectId}/portal-user/reset`,
    { temporaryPassword },
  );
  return data;
}

// ─── Importación CSV ─────────────────────────────────────────────────────────

export interface ImportRowData {
  nombre: string;
  mail: string | null;
  telefono: string | null;
  departamento: string | null;
  potenciaKwp: number | null;
  status: string;
  fechaEntrega: string | null;
  asesorId: string | null;
  asesorNombre: string | null;
  warnings: string[];
  duplicado: boolean;
}

export interface ImportPreviewResponse {
  headersEsperados: string[];
  headersUsables: string[];
  headersIgnorados: string[];
  headersFaltantes: string[];
  rows: ImportRowData[];
  resumen: { total: number; importables: number; duplicados: number; sinNombre: number };
}

export async function importPreview(file: File): Promise<ImportPreviewResponse> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post<ImportPreviewResponse>("/api/clientes/import/preview", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export type ImportConfirmRow = {
  nombre: string;
  mail?: string | null;
  telefono?: string | null;
  departamento?: string | null;
  potenciaKwp?: number | null;
  status?: string;
  fechaEntrega?: string | null;
  asesorId?: string | null;
};

export async function importConfirm(rows: ImportConfirmRow[]): Promise<{ creados: number; errores: string[] }> {
  const { data } = await apiClient.post<{ creados: number; errores: string[] }>("/api/clientes/import/confirm", { rows });
  return data;
}

export async function createInteraction(
  projectId: string,
  body: {
    channel: InteractionChannel;
    content: string;
    direction?: InteractionDirection;
    reason?: InteractionReason;
  },
): Promise<ClienteInteraction> {
  const { data } = await apiClient.post<ClienteInteraction>(
    `/api/clientes/${projectId}/interacciones`,
    body,
  );
  return data;
}

export async function patchInteraction(
  id: string,
  body: { content: string; channel?: InteractionChannel },
): Promise<ClienteInteraction> {
  const { data } = await apiClient.patch<ClienteInteraction>(`/api/clientes/interacciones/${id}`, body);
  return data;
}

export async function deleteInteraction(id: string): Promise<void> {
  await apiClient.delete(`/api/clientes/interacciones/${id}`);
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

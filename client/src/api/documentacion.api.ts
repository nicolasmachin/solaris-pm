import { apiClient } from "./axios";

// Módulo Documentación (intranet): manuales, procedimientos y reglamentos con
// historial de versiones y confirmación de lectura. Las URLs de descarga y de
// vista previa ya vienen con su token (un iframe o un enlace no pueden mandar
// el header Authorization): solo hay que anteponerles el host con fileSrc().

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function fileSrc(url: string) {
  return `${BASE_URL}${url}`;
}

export interface RolRef {
  id: string;
  name: string;
  label: string;
}

export type DocumentoOrigen = "MANUAL_SINCRONIZADO" | "SUBIDO";

export interface VersionItem {
  id: string;
  version: string;
  vigenteDesde: string | null;
  notas: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** null = la publicó el deploy (manual sincronizado). */
  publicadoPor: string | null;
  downloadUrl: string;
  previewUrl: string;
}

export interface DocumentoItem {
  id: string;
  slug: string | null;
  titulo: string;
  descripcion: string | null;
  categoria: string;
  origen: DocumentoOrigen;
  requiereLectura: boolean;
  orden: number;
  activo: boolean;
  totalVersiones: number;
  vigente: VersionItem | null;
  leida: boolean;
  /** Solo para quien gestiona. */
  roles?: RolRef[];
}

export interface LecturaItem {
  userId: string;
  nombre: string;
  rol: string;
  leidoAt: string | null;
}

export interface DocumentoDetalle extends DocumentoItem {
  versiones: VersionItem[];
  /** Solo para quien gestiona y si el documento pide lectura. */
  lecturas?: LecturaItem[];
}

// ─── Consumo ────────────────────────────────────────────────────────────────

export async function listDocumentos() {
  const { data } = await apiClient.get<DocumentoItem[]>("/api/documentacion");
  return data;
}

export async function getPendientesLectura() {
  const { data } = await apiClient.get<{ pendientes: number }>("/api/documentacion/pendientes");
  return data.pendientes;
}

export async function getDocumento(id: string) {
  const { data } = await apiClient.get<DocumentoDetalle>(`/api/documentacion/${id}`);
  return data;
}

export async function confirmarLectura(id: string) {
  const { data } = await apiClient.post<{ versionId: string; version: string }>(`/api/documentacion/${id}/leido`);
  return data;
}

// ─── Gestión ────────────────────────────────────────────────────────────────

export async function listRolesAsignables() {
  const { data } = await apiClient.get<RolRef[]>("/api/documentacion/gestion/roles");
  return data;
}

export interface DatosVersion {
  version: string;
  vigenteDesde?: string;
  notas?: string;
}

export interface DatosNuevoDocumento extends DatosVersion {
  titulo: string;
  descripcion?: string;
  categoria: string;
  requiereLectura: boolean;
  roleIds: string[];
}

function multipart(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

/** Los metadatos van por querystring: el archivo es la única parte multipart. */
export async function createDocumento(file: File, datos: DatosNuevoDocumento) {
  const { data } = await apiClient.post<{ id: string; titulo: string }>("/api/documentacion", multipart(file), {
    params: {
      titulo: datos.titulo,
      descripcion: datos.descripcion || undefined,
      categoria: datos.categoria,
      requiereLectura: datos.requiereLectura ? "true" : "false",
      roleIds: datos.roleIds.join(",") || undefined,
      version: datos.version,
      vigenteDesde: datos.vigenteDesde || undefined,
      notas: datos.notas || undefined,
    },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function uploadVersion(documentoId: string, file: File, datos: DatosVersion) {
  const { data } = await apiClient.post<{ id: string; version: string }>(
    `/api/documentacion/${documentoId}/versiones`,
    multipart(file),
    {
      params: {
        version: datos.version,
        vigenteDesde: datos.vigenteDesde || undefined,
        notas: datos.notas || undefined,
      },
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

export async function updateDocumento(
  id: string,
  body: {
    titulo?: string;
    descripcion?: string | null;
    categoria?: string;
    requiereLectura?: boolean;
    activo?: boolean;
    roleIds?: string[];
  },
) {
  const { data } = await apiClient.patch<{ id: string; titulo: string }>(`/api/documentacion/${id}`, body);
  return data;
}

export async function deleteDocumento(id: string) {
  await apiClient.delete(`/api/documentacion/${id}`);
}

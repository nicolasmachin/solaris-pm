import { apiClient } from "./axios";
import type { EmailTemplateContext } from "./email.api";
import type { UteExtractedData } from "./uteExtract.api";
import type { EnviarSuministroBody } from "./uteSuministro.api";

// Trámites con UTE Comercial: lo que se le pide a UTE Comercial y no es la
// habilitación del generador. Los tipos son los del campo "Trámite" del
// formulario de UTE, más "Otro".

export type UteComercialTipo =
  | "NUEVO_SERVICIO"
  | "AUMENTO"
  | "REDUCCION"
  | "REHABILITACION"
  | "INSTALACION_ENLACE"
  | "PROVISORIO_GENERAL"
  | "PROVISORIO_OBRA"
  | "OTRO";

export type UteComercialEstado = "A_PEDIR" | "PEDIDO" | "OBSERVADO" | "RESUELTO" | "CANCELADO";

export const TIPO_COMERCIAL_ORDER: UteComercialTipo[] = [
  "AUMENTO",
  "NUEVO_SERVICIO",
  "REDUCCION",
  "REHABILITACION",
  "INSTALACION_ENLACE",
  "PROVISORIO_GENERAL",
  "PROVISORIO_OBRA",
  "OTRO",
];

export const TIPO_COMERCIAL_LABEL: Record<UteComercialTipo, string> = {
  NUEVO_SERVICIO: "Nuevo servicio",
  AUMENTO: "Aumento de potencia",
  REDUCCION: "Reducción de potencia",
  REHABILITACION: "Rehabilitación",
  INSTALACION_ENLACE: "Instalación de enlace",
  PROVISORIO_GENERAL: "Provisorio general",
  PROVISORIO_OBRA: "Provisorio de obra",
  OTRO: "Otro",
};

export const ESTADO_COMERCIAL_ORDER: UteComercialEstado[] = [
  "A_PEDIR",
  "PEDIDO",
  "OBSERVADO",
  "RESUELTO",
  "CANCELADO",
];

export const ESTADO_COMERCIAL_LABEL: Record<UteComercialEstado, string> = {
  A_PEDIR: "A pedir",
  PEDIDO: "Pedido",
  OBSERVADO: "Observado",
  RESUELTO: "Resuelto",
  CANCELADO: "Cancelado",
};

export const ESTADO_COMERCIAL_COLORS: Record<UteComercialEstado, { bg: string; text: string }> = {
  A_PEDIR: { bg: "rgba(148,163,184,0.18)", text: "#94a3b8" },
  PEDIDO: { bg: "rgba(167,139,250,0.18)", text: "#a78bfa" },
  OBSERVADO: { bg: "rgba(251,146,60,0.18)", text: "#fb923c" },
  RESUELTO: { bg: "rgba(52,211,153,0.18)", text: "#34d399" },
  CANCELADO: { bg: "rgba(148,163,184,0.12)", text: "#64748b" },
};

/** Color propio de la sección Comercial, para distinguirla de la habilitación. */
export const COMERCIAL_COLOR = "#a78bfa";

export const ESTADOS_COMERCIAL_ABIERTOS: UteComercialEstado[] = ["A_PEDIR", "PEDIDO", "OBSERVADO"];

/** Contacto del CRM: el cliente de un trámite que no tiene proyecto. */
export type UteContacto = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  documento: string | null;
};

export type UteTramiteArchivo = {
  id: string;
  filename: string;
  /** El formulario que se mandó a UTE o la factura de UTE del cliente. */
  clase: "formulario" | "factura";
};

export type UteTramiteComercial = {
  id: string;
  /** Cada trámite es de un proyecto o de un contacto (cliente sin proyecto). */
  projectId: string | null;
  project: { id: string; code: string; clientName: string; locationCity: string } | null;
  contactoId: string | null;
  contacto: UteContacto | null;
  suministro: number;
  tipo: UteComercialTipo;
  detalle: string | null;
  estado: UteComercialEstado;
  caseNumber: string | null;
  notes: string | null;
  solicitadoEl: string | null;
  resueltoEl: string | null;
  emailLogId: string | null;
  fileAttachmentId: string | null;
  createdAt: string;
  updatedAt: string;
  /** Días con UTE: del pedido a hoy, o hasta que se resolvió. */
  dias: number | null;
  archivos: UteTramiteArchivo[];
};

/** Nombre del cliente del trámite, tenga proyecto o no. */
export function clienteDeTramite(t: UteTramiteComercial): string {
  return t.project?.clientName ?? t.contacto?.nombre ?? "(contacto borrado)";
}

export type UteComercialInput = {
  /** Uno de los dos: el proyecto o el contacto. */
  projectId?: string;
  contactoId?: string;
  suministro?: number;
  tipo: UteComercialTipo;
  detalle?: string | null;
  estado?: UteComercialEstado;
  caseNumber?: string | null;
  notes?: string | null;
  solicitadoEl?: string | null;
};

export type UteComercialPatch = Partial<Omit<UteComercialInput, "projectId" | "contactoId">> & {
  resueltoEl?: string | null;
};

export async function getTramitesComerciales(projectId?: string): Promise<UteTramiteComercial[]> {
  const { data } = await apiClient.get("/api/ute-tramites-comerciales", {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}

export async function createTramiteComercial(input: UteComercialInput): Promise<UteTramiteComercial> {
  const { data } = await apiClient.post("/api/ute-tramites-comerciales", input);
  return data;
}

export async function patchTramiteComercial(
  id: string,
  patch: UteComercialPatch,
): Promise<UteTramiteComercial> {
  const { data } = await apiClient.patch(`/api/ute-tramites-comerciales/${id}`, patch);
  return data;
}

export async function deleteTramiteComercial(id: string): Promise<void> {
  await apiClient.delete(`/api/ute-tramites-comerciales/${id}`);
}

/** Descarga un archivo del trámite (el formulario enviado o la factura). */
export async function descargarArchivoTramite(tramiteId: string, archivo: UteTramiteArchivo) {
  const res = await apiClient.get(
    `/api/ute-tramites-comerciales/${tramiteId}/archivos/${archivo.id}`,
    { responseType: "blob" },
  );
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Pedido para un cliente sin proyecto ────────────────────────────────────
// Búsqueda y alta de contactos propias de Trámites UTE: el rol de tramitación
// no tiene permiso sobre el CRM.

export async function buscarContactosUte(q: string): Promise<UteContacto[]> {
  const { data } = await apiClient.get("/api/ute-tramites-comerciales/contactos", {
    params: q.trim() ? { q: q.trim() } : undefined,
  });
  return data;
}

export async function crearContactoUte(input: {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
}): Promise<UteContacto> {
  const { data } = await apiClient.post("/api/ute-tramites-comerciales/contactos", input);
  return data;
}

const baseContacto = (contactoId: string) =>
  `/api/ute-tramites-comerciales/contactos/${contactoId}`;

export async function getContextoSuministroContacto(
  contactoId: string,
): Promise<{ contacto: UteContacto; context: EmailTemplateContext }> {
  const { data } = await apiClient.get(`${baseContacto(contactoId)}/suministro-individual/contexto`);
  return data;
}

export async function previewFormularioContacto(
  contactoId: string,
  context: EmailTemplateContext,
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.post(
    `${baseContacto(contactoId)}/suministro-individual/preview.xlsx`,
    { context },
    { responseType: "blob" },
  );
  const disp = String(res.headers["content-disposition"] ?? "");
  const match = /filename="([^"]+)"/.exec(disp);
  return { blob: res.data as Blob, filename: match?.[1] ?? "formulario-ute.xlsx" };
}

export async function enviarSuministroContacto(
  contactoId: string,
  body: EnviarSuministroBody & { facturaAttachmentId?: string },
): Promise<{ ok: true; emailLogId: string; filename: string; tramiteId: string | null }> {
  const { data } = await apiClient.post(`${baseContacto(contactoId)}/suministro-individual/enviar`, body);
  return data;
}

/** Sube la factura de UTE del cliente y devuelve lo que la IA leyó de ella. */
export async function extraerFacturaContacto(
  contactoId: string,
  file: File,
): Promise<{ extraido: Partial<UteExtractedData>; facturaAttachmentId: string; filename: string }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post(`${baseContacto(contactoId)}/ute-extract`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

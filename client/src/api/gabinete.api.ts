import { apiClient } from "./axios";

export interface GabineteSpecExtra {
  etiqueta: string;
  valor: string;
}

/** Campos editables del gabinete. Espeja `designSchema` en gabinete.routes.ts. */
export interface GabineteForm {
  nombre: string;
  anchoCm: number;
  altoCm: number;
  profundidadCm: number;
  fondoAbierto: boolean;
  pestanaAmure: boolean;
  pestanaAnchoCm: number;
  // Medidas de taller: ninguna opcional. Si el fabricante no especificó algo,
  // vale el default —una decisión tomada— y no un hueco en la lámina.
  //
  // No hay bisagras, cierre, ventilación ni grado IP: el gabinete es todo
  // chapa plegada y se entrega sin herrajes.
  union: string;
  tornillos: string;
  solapeUnionCm: number;
  pasoTornillosCm: number;
  agujeroAmureDiamMm: number;
  agujerosAmureVertical: number;
  agujerosAmureHorizontal: number;
  rebordeTapaCm: number;
  rebordeFrenteCm: number;
  solapeTapaCm: number;
  holguraTapaMm: number;
  material: string;
  espesorMm: number;
  acabado: string;
  toleranciaMm: number;
  cantidad: number;
  notas?: string | null;
  specsExtra: GabineteSpecExtra[];
}

export interface GabineteVersion {
  id: string;
  versionNumber: number;
  label: string | null;
  fileAttachmentId: string | null;
  createdAt: string;
}

export interface Gabinete extends GabineteForm {
  id: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  versionesCount: number;
  ultimaVersion: { id: string; versionNumber: number; createdAt: string; fileAttachmentId: string | null } | null;
}

export interface GabineteDetalle extends Gabinete {
  versiones: GabineteVersion[];
}

export const getGabinetes = (projectId: string) =>
  apiClient.get<Gabinete[]>(`/api/projects/${projectId}/gabinetes`).then((r) => r.data);

export const getGabinete = (id: string) =>
  apiClient.get<GabineteDetalle>(`/api/gabinetes/${id}`).then((r) => r.data);

export const createGabinete = (projectId: string, body: Partial<GabineteForm>) =>
  apiClient.post<Gabinete>(`/api/projects/${projectId}/gabinetes`, body).then((r) => r.data);

export const patchGabinete = (id: string, body: Partial<GabineteForm>) =>
  apiClient.patch<Gabinete>(`/api/gabinetes/${id}`, body).then((r) => r.data);

export const deleteGabinete = (id: string) =>
  apiClient.delete<{ success: boolean }>(`/api/gabinetes/${id}`).then((r) => r.data);

export const emitirGabinete = (id: string, label?: string | null) =>
  apiClient.post<GabineteVersion>(`/api/gabinetes/${id}/emitir`, { label }).then((r) => r.data);

/**
 * Las hojas de la lámina en SVG, sin persistir nada. El dibujo se genera en el
 * server (mismo código que el PDF), así el preview nunca se despega del
 * entregable.
 */
export const previewGabinete = (body: Partial<GabineteForm> & { projectId?: string }) =>
  apiClient
    .post<{ hojas: string[] }>("/api/gabinetes/preview", body)
    .then((r) => r.data.hojas);

/** Valores con los que arranca un gabinete nuevo: el que más se pide. */
export const GABINETE_DEFAULTS: GabineteForm = {
  nombre: "Gabinete metálico exterior con tapa",
  anchoCm: 50,
  altoCm: 85,
  profundidadCm: 26,
  fondoAbierto: true,
  pestanaAmure: true,
  pestanaAnchoCm: 3,
  union: "Dos piezas en L atornilladas",
  tornillos: "Tornillo punta mecha tipo T1",
  solapeUnionCm: 3,
  pasoTornillosCm: 15,
  agujeroAmureDiamMm: 6,
  agujerosAmureVertical: 4,
  agujerosAmureHorizontal: 3,
  rebordeTapaCm: 2,
  rebordeFrenteCm: 2,
  solapeTapaCm: 1,
  holguraTapaMm: 2,
  material: "Chapa galvanizada en caliente",
  espesorMm: 1.5,
  acabado: "Galvanizado",
  toleranciaMm: 2,
  cantidad: 1,
  notas: null,
  specsExtra: [],
};

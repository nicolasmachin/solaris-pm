// Plan de Protección contra Granizo (servicio de reposición de Voltia; NO es un
// seguro: en pantalla se dice "plan", "anualidad" y "daño por granizo"). Las
// rutas del backend conservan el nombre interno `seguro-granizo`.

import axios from "axios";

import { apiClient as api } from "./axios";

const P = "/api";

export type EstadoPlan =
  | "PENDIENTE_INICIO"
  | "PENDIENTE_ACTIVACION"
  | "EN_CARENCIA"
  | "VIGENTE"
  | "POR_VENCER"
  | "EN_GRACIA"
  | "SUSPENDIDA"
  | "VENCIDA"
  | "CANCELADA";

export type EstadoDanio = "REPORTADO" | "EVALUADO" | "REPUESTO" | "RECHAZADO";
export type CobroEstado = "SIN_COBRO" | "PAGADO" | "PREVISTO";

export interface ArchivoPlan {
  id: string;
  filename: string;
  thumbnailUrl: string;
  fullUrl: string;
  createdAt: string;
}

export interface PlazoEtapa {
  limite: string;
  cumplido: boolean | null;
  diasRestantes: number | null;
  unidad: "habiles" | "corridos";
}

export interface DanioPlan {
  id: string;
  fechaEvento: string;
  fechaAviso: string;
  descripcion: string;
  panelesAfectados: number | null;
  eventoMasivo: boolean;
  estado: EstadoDanio;
  cubiertoAlEvento: boolean;
  fechaInspeccion: string | null;
  fechaReposicion: string | null;
  panelesRepuestos: number | null;
  evaluacionNota: string | null;
  motivoRechazoCodigo: string | null;
  motivoRechazoLabel: string | null;
  motivoRechazo: string | null;
  costoRealUsd: number | null;
  costoDetalle: string | null;
  createdAt: string;
  plazos: {
    diasHabilesHastaAviso: number;
    avisoFueraDePlazo: boolean;
    inspeccion: PlazoEtapa;
    reposicion: PlazoEtapa | null;
    pendiente: { etapa: "INSPECCION" | "REPOSICION"; vencido: boolean } | null;
  };
  fotos: ArchivoPlan[];
}

export interface AnualidadPlan {
  id: string;
  numero: number;
  desde: string;
  hasta: string;
  inicioProvisorio: boolean;
  cantidadPaneles: number;
  precioPorPanelUsd: number;
  montoUsd: number;
  cobro: { estado: CobroEstado; movementId: string | null; fechaPago: string | null; vence: string };
}

export interface AmpliacionPlan {
  id: string;
  projectId: string;
  paneles: number;
  desde: string;
  hasta: string;
  meses: number;
  montoUsd: number;
  cobro: { estado: CobroEstado; fechaPago: string | null };
}

export interface EstadoPlanInfo {
  estado: EstadoPlan;
  coberturaActiva: boolean;
  alerta: boolean;
  faltaFirma: boolean;
  faltaPago: boolean;
  periodoActualId: string | null;
  coberturaDesde: string | null;
  vencimiento: string | null;
  diasParaVencer: number | null;
  proximoCobro: { fecha: string | null; montoUsd: number; periodoId: string | null } | null;
  deudaUsd: number;
}

export interface PlanGranizo {
  id: string;
  projectId: string;
  project: { id: string; code: string; clientName: string; capacityKwp: number | null };
  origen: "VENTA" | "MANUAL";
  estadoBase: "PENDIENTE_INICIO" | "ACTIVA" | "CANCELADA";
  sinCarencia: boolean;
  inversorSerie: string | null;
  ampliaciones: AmpliacionPlan[];
  anexo: { firmadoEn: string | null; fileId: string | null; url: string | null };
  fechaInicio: string | null;
  fechaVencimiento: string | null;
  cantidadPaneles: number;
  cantidadPanelesFuente: string;
  precioPorPanelUsd: number;
  montoAnualUsd: number;
  notas: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  createdAt: string;
  estado: EstadoPlanInfo;
  periodos: AnualidadPlan[];
  siniestros: DanioPlan[];
  fotosInicio: ArchivoPlan[];
}

export interface PlanesKpis {
  vigentes: number;
  panelesCubiertos: number;
  cobradoAnioUsd: number;
  reposicionesAnioUsd: number;
  pendienteCobroUsd: number;
  enAlerta: number;
  anio: number;
}

export interface PlanDeProyecto {
  poliza: PlanGranizo | null;
  esAmpliacionDe: { projectId: string; clientName: string; code: string } | null;
  sugerencias: {
    cantidadPaneles: number | null;
    fuente: "UNIFILAR" | "PROPUESTA" | "MANUAL";
    ampliaciones: number;
    precioPorPanelUsd: number;
    puestaEnMarcha: string | null;
  };
}

export interface AmpliacionPendiente {
  projectId: string;
  code: string;
  clientName: string;
  panelesSugeridos: number | null;
  puestaEnMarcha: string | null;
}

export interface ResumenPlan {
  polizaId: string;
  estado: EstadoPlan;
  alerta: boolean;
  coberturaActiva: boolean;
  vencimiento: string | null;
  diasParaVencer: number | null;
}

type Res = { poliza: PlanGranizo };
const plan = async (p: Promise<{ data: Res }>) => (await p).data.poliza;

export const planGranizoApi = {
  list: async (params: { estado?: string; q?: string }) => {
    const { data } = await api.get<{ items: PlanGranizo[]; kpis: PlanesKpis }>(`${P}/seguro-granizo/polizas`, { params });
    return data;
  },
  get: (id: string) => plan(api.get<Res>(`${P}/seguro-granizo/polizas/${id}`)),
  deProyecto: async (projectId: string) => {
    const { data } = await api.get<PlanDeProyecto>(`${P}/seguro-granizo/proyecto/${projectId}`);
    return data;
  },
  motivosRechazo: async () => {
    const { data } = await api.get<{ motivos: { codigo: string; label: string }[] }>(`${P}/seguro-granizo/motivos-rechazo`);
    return data.motivos;
  },
  crear: (body: {
    projectId: string;
    cantidadPaneles?: number | null;
    sinCarencia?: boolean;
    fechaInicio?: string | null;
    inversorSerie?: string | null;
    notas?: string | null;
    primerCobroPagadoEl?: string | null;
  }) => plan(api.post<Res>(`${P}/seguro-granizo/polizas`, body)),
  editar: (id: string, body: { cantidadPaneles?: number; inversorSerie?: string | null; notas?: string | null; aplicarAPendientes?: boolean }) =>
    plan(api.patch<Res>(`${P}/seguro-granizo/polizas/${id}`, body)),
  activar: (id: string, fechaInicio: string) => plan(api.post<Res>(`${P}/seguro-granizo/polizas/${id}/activar`, { fechaInicio })),
  renovar: (id: string) => plan(api.post<Res>(`${P}/seguro-granizo/polizas/${id}/renovar`, {})),
  cancelar: (id: string, motivo: string, anularCobrosPendientes: boolean) =>
    plan(api.post<Res>(`${P}/seguro-granizo/polizas/${id}/cancelar`, { motivo, anularCobrosPendientes })),
  reactivar: (id: string) => plan(api.post<Res>(`${P}/seguro-granizo/polizas/${id}/reactivar`, {})),
  subirAnexo: (id: string, fechaFirma: string, file: File) => {
    const fd = new FormData();
    fd.append("fechaFirma", fechaFirma);
    fd.append("file", file);
    return plan(api.post<Res>(`${P}/seguro-granizo/polizas/${id}/anexo`, fd));
  },
  quitarAnexo: (id: string) => plan(api.delete<Res>(`${P}/seguro-granizo/polizas/${id}/anexo`)),
  // El server acepta un archivo por pedido (límite global de multipart): se
  // suben de a una, en orden.
  subirFotosInicio: async (id: string, files: File[]) => {
    let ultimo: PlanGranizo | null = null;
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      ultimo = await plan(api.post<Res>(`${P}/seguro-granizo/polizas/${id}/fotos-inicio`, fd));
    }
    return ultimo!;
  },
  borrarFotoInicio: (id: string, fileId: string) => plan(api.delete<Res>(`${P}/seguro-granizo/polizas/${id}/fotos-inicio/${fileId}`)),
  marcarCobro: (periodoId: string, estado: "PAGADO" | "PREVISTO", fechaPago?: string) =>
    plan(api.patch<Res>(`${P}/seguro-granizo/periodos/${periodoId}/cobro`, { estado, fechaPago: fechaPago ?? null })),
  regenerarCobro: (periodoId: string) => plan(api.post<Res>(`${P}/seguro-granizo/periodos/${periodoId}/regenerar-cobro`, {})),
  ampliacionesPendientes: async (id: string) => {
    const { data } = await api.get<{ ampliaciones: AmpliacionPendiente[] }>(`${P}/seguro-granizo/polizas/${id}/ampliaciones-pendientes`);
    return data.ampliaciones;
  },
  agregarAmpliacion: (id: string, body: { projectId: string; paneles: number; desde: string }) =>
    plan(api.post<Res>(`${P}/seguro-granizo/polizas/${id}/ampliaciones`, body)),
  marcarCobroAmpliacion: (ampliacionId: string, estado: "PAGADO" | "PREVISTO", fechaPago?: string) =>
    plan(api.patch<Res>(`${P}/seguro-granizo/ampliaciones/${ampliacionId}/cobro`, { estado, fechaPago: fechaPago ?? null })),
  crearDanio: async (polizaId: string, body: { fechaEvento: string; fechaAviso?: string | null; descripcion: string; panelesAfectados?: number | null; eventoMasivo?: boolean }) => {
    const { data } = await api.post<Res & { siniestroId: string }>(`${P}/seguro-granizo/polizas/${polizaId}/siniestros`, body);
    return data;
  },
  actualizarDanio: (id: string, body: Record<string, unknown>) => plan(api.patch<Res>(`${P}/seguro-granizo/siniestros/${id}`, body)),
  borrarDanio: async (id: string) => {
    await api.delete(`${P}/seguro-granizo/siniestros/${id}`);
  },
  subirFotosDanio: async (id: string, files: File[]) => {
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      await api.post(`${P}/seguro-granizo/siniestros/${id}/fotos`, fd);
    }
  },
  borrarFotoDanio: async (id: string, fileId: string) => {
    await api.delete(`${P}/seguro-granizo/siniestros/${id}/fotos/${fileId}`);
  },
  // Los archivos piden auth: se traen como blob y se abren en una pestaña.
  abrirArchivo: async (url: string) => {
    const { data } = await api.get<Blob>(url, { responseType: "blob" });
    const obj = URL.createObjectURL(data);
    window.open(obj, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(obj), 60_000);
  },
  blobUrl: async (url: string) => {
    const { data } = await api.get<Blob>(url, { responseType: "blob" });
    return URL.createObjectURL(data);
  },
};

// ─── Documento: condiciones del plan + Anexo A ───────────────────────────────

export interface PlanGranizoDocData {
  cliente: { nombre: string; documento: string; direccion: string; telefono: string; email: string };
  plan: {
    cantidadPaneles: number;
    precioPorPanelUsd: number;
    anualidadUsd: number;
    instalacion: "NUEVA" | "EXISTENTE";
    inversorSerie: string;
    fotosAdjuntas: boolean | null;
    /** Cobertura opcional: también repone paneles dañados por vandalismo (mismo precio). */
    incluyeVandalismo: boolean;
  };
  empresa: { razonSocial: string; rut: string; domicilio: string };
  fecha: string;
}

export interface PlanGranizoDocContext {
  cliente: Partial<PlanGranizoDocData["cliente"]>;
  plan: {
    cantidadPaneles?: number;
    precioPorPanelUsd: number;
    instalacion: "NUEVA" | "EXISTENTE";
    inversorSerie?: string;
    fotosAdjuntas: boolean | null;
  };
  empresa: PlanGranizoDocData["empresa"];
  esAmpliacionDe: { projectId: string; clientName: string } | null;
}

export interface PlanGranizoDocVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  status: "PUBLISHED" | "DISCARDED";
  publishedAt: string;
  clientName: string | null;
  cantidadPaneles: number | null;
  anualidadUsd: number | null;
  incluyeVandalismo: boolean;
}

export const planGranizoDocApi = {
  getDraft: async (projectId: string): Promise<{ data: Partial<PlanGranizoDocData> } | null> => {
    try {
      const { data } = await api.get<{ data: Partial<PlanGranizoDocData> }>(`${P}/projects/${projectId}/plan-granizo/draft`);
      return data;
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) return null;
      throw e;
    }
  },
  getContext: async (projectId: string) => {
    const { data } = await api.get<PlanGranizoDocContext>(`${P}/projects/${projectId}/plan-granizo/context`);
    return data;
  },
  putDraft: async (projectId: string, data: PlanGranizoDocData) => {
    await api.put(`${P}/projects/${projectId}/plan-granizo/draft`, { data });
  },
  getDraftPreviewBlob: async (projectId: string) => {
    const { data } = await api.get<Blob>(`${P}/projects/${projectId}/plan-granizo/draft/preview.pdf`, { responseType: "blob" });
    return data;
  },
  listVersions: async (projectId: string, includeDiscarded: boolean) => {
    const { data } = await api.get<{ versions: PlanGranizoDocVersion[] }>(`${P}/projects/${projectId}/plan-granizo/versions`, {
      params: { includeDiscarded: includeDiscarded ? "true" : "false" },
    });
    return data.versions;
  },
  publishVersion: async (projectId: string) => {
    const { data } = await api.post<PlanGranizoDocVersion>(`${P}/projects/${projectId}/plan-granizo/versions`, {});
    return data;
  },
  discardVersion: async (id: string) => {
    await api.delete(`${P}/plan-granizo/versions/${id}`, { data: {} });
  },
  restoreVersion: async (id: string) => {
    await api.post(`${P}/plan-granizo/versions/${id}/restore`, {});
  },
  openVersionPreview: async (id: string) => {
    const { data } = await api.get<Blob>(`${P}/plan-granizo/versions/${id}/preview`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  downloadVersionPdf: async (id: string, filename: string) => {
    const { data } = await api.get<Blob>(`${P}/plan-granizo/versions/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};

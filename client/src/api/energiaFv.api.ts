import { apiClient } from "./axios";

// Vista de energía de una planta (como la aplicación de Growatt).
// Ver server/src/services/reportesFv/energia/curva.service.ts.

export type MarcaPlanta = "GROWATT" | "HUAWEI" | null;
export type OrigenMedicion = "INVERSOR" | "MEDIDOR";

export interface ResumenEnergia {
  generacionKwh: number | null;
  consumoKwh: number | null;
  importacionKwh: number | null;
  exportacionKwh: number | null;
  autoconsumoKwh: number | null;
  /** Días (o meses) con producción y cuántos de ellos tienen consumo medido. */
  cobertura?: { conProduccion: number; conConsumo: number };
}

export interface PuntoCurva {
  /** "HH:MM", inicio del tramo de 5 minutos. Potencias en W. */
  h: string;
  gen: number;
  consumo: number | null;
  deRed: number | null;
  aRed: number | null;
}

export interface CurvaDia {
  dia: string;
  marca: MarcaPlanta;
  disponible: boolean;
  motivo: string | null;
  puntos: PuntoCurva[];
  resumen: ResumenEnergia;
  origenMedicion: OrigenMedicion | null;
  completo: boolean;
  actualizadoEn: string | null;
}

export interface BarraEnergia {
  /** "YYYY-MM-DD", "YYYY-MM" o "YYYY". */
  clave: string;
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
  importacionKwh: number | null;
}

export interface SerieEnergia {
  marca: MarcaPlanta;
  barras: BarraEnergia[];
  resumen: ResumenEnergia;
}

/** De dónde saca los datos la vista: la ficha interna o, más adelante, el portal. */
export interface FuentesEnergia {
  curva: (fecha: string, forzar?: boolean) => Promise<CurvaDia>;
  dias: (periodo: string) => Promise<SerieEnergia & { periodo: string; diasDelMes: number }>;
  meses: (anio: number) => Promise<SerieEnergia & { anio: number }>;
  anios: () => Promise<SerieEnergia>;
}

const base = (projectId: string) => `/api/reportes-fv/generadores/${projectId}/energia`;

export function fuentesInternas(projectId: string): FuentesEnergia {
  return {
    curva: (fecha, forzar) =>
      apiClient
        .get<CurvaDia>(`${base(projectId)}/curva`, { params: { fecha, forzar: forzar ? "true" : undefined } })
        .then((r) => r.data),
    dias: (periodo) => apiClient.get(`${base(projectId)}/dias`, { params: { periodo } }).then((r) => r.data),
    meses: (anio) => apiClient.get(`${base(projectId)}/meses`, { params: { anio } }).then((r) => r.data),
    anios: () => apiClient.get(`${base(projectId)}/anios`).then((r) => r.data),
  };
}

// Portal de Voltia: las mismas cuatro consultas, sobre las plantas del cliente.
const basePortal = (projectId: string) => `/api/client/energia/${projectId}`;

export function fuentesPortal(projectId: string): FuentesEnergia {
  return {
    curva: (fecha, forzar) =>
      apiClient
        .get<CurvaDia>(`${basePortal(projectId)}/curva`, { params: { fecha, forzar: forzar ? "true" : undefined } })
        .then((r) => r.data),
    dias: (periodo) => apiClient.get(`${basePortal(projectId)}/dias`, { params: { periodo } }).then((r) => r.data),
    meses: (anio) => apiClient.get(`${basePortal(projectId)}/meses`, { params: { anio } }).then((r) => r.data),
    anios: () => apiClient.get(`${basePortal(projectId)}/anios`).then((r) => r.data),
  };
}

export const getPlantasDelCliente = () =>
  apiClient.get<{ plantas: { projectId: string; nombre: string }[] }>("/api/client/energia/plantas").then((r) => r.data.plantas);

import { apiClient } from "./axios";

// Mesa de Soporte. Ver server/src/routes/soporte.routes.ts.

export type SoporteCasoTipo = "SIN_GENERACION" | "SIN_COMUNICACION" | "FALLA_INVERSOR" | "BAJO_RENDIMIENTO";
export type SoporteCasoEstado = "ABIERTO" | "RESUELTO" | "DESCARTADO";

export interface SoporteCaso {
  id: string;
  projectId: string;
  cliente: string;
  codigo: string;
  conPortal: boolean;
  tipo: SoporteCasoTipo;
  estado: SoporteCasoEstado;
  titulo: string;
  detalle: string;
  codigoFalla: number | null;
  detectadoEn: string;
  ultimaVezEn: string;
  resueltoEn: string | null;
  resueltoPor: string | null;
  motivoCierre: string | null;
  clienteAvisadoEn: string | null;
  clienteAvisadoPor: string | null;
  mensajeCliente: string | null;
}

export interface SoportePlanta {
  marca: "GROWATT" | "HUAWEI";
  projectId: string;
  cliente: string;
  codigo: string;
  kwp: number | null;
  enLinea: boolean;
  potenciaW: number | null;
  energiaHoyKwh: number | null;
  /** 1 = rinde como siempre respecto de la cartera. null = sin dato o aprendiendo. */
  vsNormal: number | null;
  aprendiendo: boolean;
  leidoEn: string;
  ultimaGeneracionEn: string | null;
  caso: { id: string; tipo: SoporteCasoTipo; titulo: string } | null;
  /** Últimos días con sol: kWh y cuánto rindió contra lo normal para ella (1 = normal). */
  dias: Array<{ dia: string; kwh: number; vs: number }> | null;
  /** En obra (la propia o una ampliación) o silenciada: no da aviso. */
  pausa: { motivo: "OBRA" | "SILENCIADA"; hasta: string } | null;
}

export type SoporteGrupo = "FALLA" | "NO_GENERA" | "NO_COMUNICA" | "GENERA_MENOS" | "MEDIDOR" | "NO_EXPORTA" | "SIN_DATOS";

/** Un problema de la mesa: caso de Soporte o incidencia del monitoreo diario. */
export interface SoporteProblema {
  clave: string;
  origen: "SOPORTE" | "MONITOREO";
  id: string;
  projectId: string | null;
  cliente: string;
  grupo: SoporteGrupo;
  titulo: string;
  detalle: string;
  desde: string;
  avisadoCliente: string | null;
  conPortal: boolean;
  revisada: boolean;
  monitoreoDesde: string | null;
  kwp: number | null;
  dias: Array<{ dia: string; kwh: number; vs: number }> | null;
  pausa: { motivo: "OBRA" | "SILENCIADA"; hasta: string } | null;
  reclamo: { id: string; titulo: string } | null;
}

export interface SoporteTablero {
  haySol: boolean;
  problemas: SoporteProblema[];
  vigiaAutomatico: boolean;
  ultimaLectura: string | null;
  mediana: number | null;
  plantas: SoportePlanta[];
  casos: SoporteCaso[];
  reclamosAbiertos: number;
  incidenciasMonitoreo: number;
}

export const getSoporteTablero = () => apiClient.get<SoporteTablero>("/api/soporte/tablero").then((r) => r.data);
export const getSoporteCasos = (estado?: SoporteCasoEstado) =>
  apiClient.get<{ casos: SoporteCaso[] }>("/api/soporte/casos", { params: { estado } }).then((r) => r.data.casos);
export const getMensajeCliente = (id: string) =>
  apiClient.get<{ mensaje: string }>(`/api/soporte/casos/${id}/mensaje`).then((r) => r.data.mensaje);
export const avisarClienteSoporte = (id: string, mensaje: string) =>
  apiClient.post<{ avisados: number }>(`/api/soporte/casos/${id}/avisar-cliente`, { mensaje }).then((r) => r.data);
export const cerrarCasoSoporte = (id: string, estado: "RESUELTO" | "DESCARTADO", motivo: string) =>
  apiClient.post(`/api/soporte/casos/${id}/cerrar`, { estado, motivo }).then((r) => r.data);
export const correrVigia = () =>
  apiClient
    .post<{ plantas: number; casosNuevos: number; casosCerrados: number }>("/api/soporte/vigia")
    .then((r) => r.data);
export const correrRendimiento = () =>
  apiClient.post<{ abiertos: number; cerrados: number }>("/api/soporte/rendimiento").then((r) => r.data);

// Incidencias del monitoreo diario (mismas rutas que Experiencia Solar → Monitoreo).
export const revisarIncidencia = (id: string) =>
  apiClient.post(`/api/reportes-fv/monitor/incidencias/${id}/revisar`, {}).then((r) => r.data);
export const descartarIncidencia = (id: string, nota: string) =>
  apiClient.post(`/api/reportes-fv/monitor/incidencias/${id}/descartar`, { nota }).then((r) => r.data);

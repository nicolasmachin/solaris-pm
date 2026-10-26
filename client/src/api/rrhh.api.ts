import { apiClient } from "./axios";

// Módulo Recursos Humanos. "Mi legajo" (RRHH:VIEW) trabaja siempre sobre el
// legajo propio; /rrhh (RRHH:EDIT) sobre el de cualquiera. Las descargas llevan
// el token en la URL (downloadUrl/previewUrl ya lo traen): ver fileSrc().

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export type Vinculo = "DEPENDIENTE" | "TERCERIZADO";
export type EstadoDocumento = "PENDIENTE" | "VALIDADO" | "RECHAZADO";
export type EstadoVencimiento = "VENCIDO" | "POR_VENCER" | "VIGENTE" | null;
export type TipoDocumento =
  | "RECIBO_SUELDO"
  | "CONTRATO"
  | "CARNE_SALUD"
  | "LICENCIA_CONDUCIR"
  | "CEDULA"
  | "CURSO_ALTURA"
  | "PRIMEROS_AUXILIOS"
  | "HABILITACION_ELECTRICA"
  | "ANTECEDENTES"
  | "CONSTANCIA_DOMICILIO"
  | "BPS"
  | "BSE"
  | "ENTREGA_EPP"
  | "AMONESTACION"
  | "OTRO";

export const TIPO_LABEL: Record<TipoDocumento, string> = {
  RECIBO_SUELDO: "Recibo de sueldo",
  CONTRATO: "Contrato",
  CARNE_SALUD: "Carné de salud",
  LICENCIA_CONDUCIR: "Licencia de conducir",
  CEDULA: "Cédula de identidad",
  CURSO_ALTURA: "Curso de trabajo en altura",
  PRIMEROS_AUXILIOS: "Curso de primeros auxilios",
  HABILITACION_ELECTRICA: "Habilitación eléctrica",
  ANTECEDENTES: "Certificado de antecedentes",
  CONSTANCIA_DOMICILIO: "Constancia de domicilio",
  BPS: "Constancia de BPS al día",
  BSE: "Constancia de BSE al día",
  ENTREGA_EPP: "Entrega de equipos de protección",
  AMONESTACION: "Amonestación",
  OTRO: "Otro",
};

export const VINCULO_LABEL: Record<Vinculo, string> = {
  DEPENDIENTE: "Empleado",
  TERCERIZADO: "Tercerizado",
};

export interface DatosPersonales {
  cedula: string | null;
  fechaNacimiento: string | null;
  direccion: string | null;
  telefonoPersonal: string | null;
  emailPersonal: string | null;
  emergenciaNombre: string | null;
  emergenciaTelefono: string | null;
  emergenciaVinculo: string | null;
  mutualista: string | null;
  emergenciaMovil: string | null;
  grupoSanguineo: string | null;
  alergias: string | null;
  banco: string | null;
  cuentaBancaria: string | null;
  talleRopa: string | null;
  talleCalzado: string | null;
  licenciaConducirCategoria: string | null;
}

export interface DatosEmpresa {
  vinculo: Vinculo;
  fechaIngreso: string | null;
  fechaEgreso: string | null;
  cargo: string | null;
  tipoContrato: string | null;
  categoria: string | null;
  sueldoNominal: number | null;
  sueldoMoneda: "UYU" | "USD";
  notasInternas: string | null;
}

/** Mi legajo: los datos personales más lo de la empresa que la persona puede ver. */
export type LegajoPropio = { id: string; userId: string } & DatosPersonales &
  Pick<DatosEmpresa, "vinculo" | "fechaIngreso" | "cargo" | "tipoContrato">;

export type LegajoCompleto = { id: string; userId: string } & DatosPersonales & DatosEmpresa;

export interface DocumentoLegajo {
  id: string;
  tipo: TipoDocumento;
  tipoLabel: string;
  titulo: string;
  periodo: string | null;
  vencimiento: string | null;
  estadoVencimiento: EstadoVencimiento;
  estado: EstadoDocumento;
  motivoRechazo: string | null;
  soloInterno: boolean;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  vistoAt: string | null;
  createdAt: string;
  validadoAt: string | null;
  subidoPor: string;
  subidoPorUserId: string;
  validadoPor: string | null;
  downloadUrl: string;
  previewUrl: string;
}

export interface ResumenLegajo {
  faltantes: TipoDocumento[];
  vencidos: TipoDocumento[];
  porVencer: TipoDocumento[];
}

export interface MiLegajoResponse {
  legajo: LegajoPropio;
  documentos: DocumentoLegajo[];
  resumen: ResumenLegajo;
  tiposAutocarga: Array<{ tipo: TipoDocumento; label: string }>;
  requeridos: TipoDocumento[];
}

export interface LegajoResumenFila extends ResumenLegajo {
  userId: string;
  nombre: string;
  email: string | null;
  rol: string;
  vinculo: Vinculo;
  cargo: string | null;
  fechaIngreso: string | null;
  fechaEgreso: string | null;
  pendientesValidar: number;
  ultimoRecibo: string | null;
}

export interface VencimientoFila {
  userId: string;
  nombre: string;
  vinculo: Vinculo;
  vencidos: string[];
  porVencer: string[];
  faltantes: string[];
}

export interface LegajoDetalleResponse {
  usuario: { id: string; nombre: string; email: string | null; telefono: string | null; rol: string };
  legajo: LegajoCompleto;
  documentos: DocumentoLegajo[];
  resumen: ResumenLegajo;
  requeridos: TipoDocumento[];
}

export interface DatosSubida {
  tipo: TipoDocumento;
  titulo?: string;
  periodo?: string;
  vencimiento?: string;
  soloInterno?: boolean;
}

/** URL absoluta de una descarga (el token ya viene en la query). */
export function fileSrc(url: string) {
  return `${BASE_URL}${url}`;
}

function paramsSubida(d: DatosSubida) {
  return {
    tipo: d.tipo,
    titulo: d.titulo?.trim() || undefined,
    periodo: d.periodo || undefined,
    vencimiento: d.vencimiento || undefined,
    soloInterno: d.soloInterno ? "true" : undefined,
  };
}

function formArchivo(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

// ─── Mi legajo ──────────────────────────────────────────────────────────────

export async function getMiLegajo() {
  const { data } = await apiClient.get<MiLegajoResponse>("/api/mi-legajo");
  return data;
}

export async function updateMisDatos(body: Partial<DatosPersonales>) {
  const { data } = await apiClient.patch<LegajoPropio>("/api/mi-legajo", body);
  return data;
}

export async function uploadMiDocumento(file: File, d: DatosSubida) {
  const { soloInterno: _s, ...params } = paramsSubida(d);
  void _s;
  const { data } = await apiClient.post<DocumentoLegajo>("/api/mi-legajo/documentos", formArchivo(file), {
    params,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteMiDocumento(id: string) {
  await apiClient.delete(`/api/mi-legajo/documentos/${id}`);
}

// ─── Gestión ────────────────────────────────────────────────────────────────

export async function listLegajos() {
  const { data } = await apiClient.get<LegajoResumenFila[]>("/api/rrhh/legajos");
  return data;
}

export async function listVencimientos() {
  const { data } = await apiClient.get<VencimientoFila[]>("/api/rrhh/vencimientos");
  return data;
}

export async function listTipos() {
  const { data } = await apiClient.get<Array<{ tipo: TipoDocumento; label: string }>>("/api/rrhh/tipos");
  return data;
}

export async function getLegajo(userId: string) {
  const { data } = await apiClient.get<LegajoDetalleResponse>(`/api/rrhh/legajos/${userId}`);
  return data;
}

export async function updateLegajo(userId: string, body: Partial<DatosPersonales & DatosEmpresa>) {
  const { data } = await apiClient.patch<LegajoCompleto>(`/api/rrhh/legajos/${userId}`, body);
  return data;
}

export async function uploadDocumentoLegajo(userId: string, file: File, d: DatosSubida) {
  const { data } = await apiClient.post<DocumentoLegajo>(`/api/rrhh/legajos/${userId}/documentos`, formArchivo(file), {
    params: paramsSubida(d),
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateDocumentoLegajo(
  id: string,
  body: { titulo?: string; vencimiento?: string | null; periodo?: string | null; soloInterno?: boolean },
) {
  const { data } = await apiClient.patch<DocumentoLegajo>(`/api/rrhh/documentos/${id}`, body);
  return data;
}

export async function revisarDocumentoLegajo(
  id: string,
  body: { aprobar: boolean; motivo?: string | null; vencimiento?: string | null },
) {
  const { data } = await apiClient.post<DocumentoLegajo>(`/api/rrhh/documentos/${id}/revision`, body);
  return data;
}

export async function deleteDocumentoLegajo(id: string) {
  await apiClient.delete(`/api/rrhh/documentos/${id}`);
}

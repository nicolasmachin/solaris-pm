import { apiClient } from "./axios";
import type { EmailTemplateContext } from "./email.api";

// Solicitud de suministro individual / aumento de potencia contratada a UTE.
// El contexto viaja completo en el cuerpo del pedido porque el asesor lo edita
// en pantalla: el formulario adjunto tiene que decir exactamente lo mismo que
// él vio antes de mandar.

export const SUMINISTRO_TEMPLATE_KEY = "suministro_individual_ute";

// Valores admitidos por las listas desplegables del formulario de UTE.
// ESPEJO de server/src/services/ute-suministro/cells.ts → OPCIONES.
// Si se manda un valor fuera de estas listas, UTE rechaza el formulario.
export const OPCIONES_UTE = {
  documento: ["CI", "RUT", "Otros"],
  tipoSolicitud: ["Definitiva", "Estimativa"],
  tramite: [
    "Nuevo Servicio",
    "Aumento",
    "Reducción",
    "Rehabilitación",
    "Solicitud Instalación de Enlace",
    "Provisorio General *",
    "Provisorio Obra",
  ],
  pasaLinea: ["Si", "No", "No Declara"],
  acometida: ["Aérea", "Subterránea"],
  requerimiento: ["", "Informe Técnico", "Presupuesto", "Informe Técnico y Presupuesto"],
  tipoMedida: ["Centralizado", "Descentralizado"],
  actividad: ["Residencial", "General"],
  tension: ["230 V", "400 V", "6,4 KV", "15 KV", "22 KV", "31,5 KV", "63 KV"],
  fases: ["Monofásica", "Trifásica"],
  tarifa: [
    "Residencial Simple",
    "Residencial Doble",
    "Residencial Triple",
    "General Simple",
    "General Hora Estacional",
    "Zafra Estival",
    "Medianos Consumidores",
    "Grandes Consumidores",
  ],
  siNo: ["Si", "No"],
  departamento: [
    "Artigas",
    "Canelones",
    "Cerro Largo",
    "Colonia",
    "Durazno",
    "Flores",
    "Florida",
    "Lavalleja",
    "Maldonado",
    "Montevideo",
    "Paysandú",
    "Río Negro",
    "Rivera",
    "Rocha",
    "Salto",
    "San José",
    "Soriano",
    "Tacuarembó",
    "Treinta y Tres",
  ],
} as const;

// La potencia no es texto libre: UTE la ofrece como lista cerrada y los
// escalones dependen de si el suministro es monofásico o trifásico.
export const POTENCIAS_MONOFASICO = [
  "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5",
  "8", "8.5", "9", "9.5", "10", "10.5", "11", "11.5",
  "Potencia excepcional",
];

export const POTENCIAS_TRIFASICO = [
  "6", "8", "10", "12", "15", "20", "25", "30", "35", "40",
  "Mayor a 40 KW",
];

export function potenciasPara(fases: string): string[] {
  return fases === "Trifásica" ? POTENCIAS_TRIFASICO : POTENCIAS_MONOFASICO;
}

export interface EnviarSuministroBody {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  context: EmailTemplateContext;
}

/** Descarga el formulario completado para revisarlo antes de enviarlo. */
export async function previewFormularioSuministro(
  projectId: string,
  context: EmailTemplateContext,
): Promise<{ blob: Blob; filename: string }> {
  const res = await apiClient.post(
    `/projects/${projectId}/suministro-individual/preview.xlsx`,
    { context },
    { responseType: "blob" },
  );
  const disp = String(res.headers["content-disposition"] ?? "");
  const match = /filename="([^"]+)"/.exec(disp);
  return { blob: res.data as Blob, filename: match?.[1] ?? "formulario-ute.xlsx" };
}

export async function enviarSuministroIndividual(
  projectId: string,
  body: EnviarSuministroBody,
): Promise<{ ok: true; emailLogId: string; filename: string }> {
  const { data } = await apiClient.post(
    `/projects/${projectId}/suministro-individual/enviar`,
    body,
  );
  return data;
}

export interface EstadoSuministro {
  solicitadoEl: string | null;
  potenciaSolicitada: string;
  potenciaContratada: string;
}

export async function getEstadoSuministro(projectId: string): Promise<EstadoSuministro> {
  const { data } = await apiClient.get(`/projects/${projectId}/suministro-individual/estado`);
  return data;
}

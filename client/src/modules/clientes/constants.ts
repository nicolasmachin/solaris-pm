import type {
  InteractionChannel,
  InteractionDirection,
  InteractionReason,
  ClienteEstado,
  ClienteRecorrido,
} from "../../api/clientes.api";

// Etiquetas en español de los canales de la bitácora.
export const CHANNEL_LABELS: Record<InteractionChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  LLAMADA: "Llamada",
  VISITA: "Visita",
  OTRO: "Otro",
};

export const CHANNEL_OPTIONS: InteractionChannel[] = ["WHATSAPP", "EMAIL", "LLAMADA", "VISITA", "OTRO"];

// Dirección y motivo de la interacción (seguimientos paralelos de CX).
export const DIRECTION_LABELS: Record<InteractionDirection, string> = {
  ENTRANTE: "Entrante",
  SALIENTE: "Saliente",
};
export const DIRECTION_OPTIONS: InteractionDirection[] = ["SALIENTE", "ENTRANTE"];

export const REASON_LABELS: Record<InteractionReason, string> = {
  BIENVENIDA: "Bienvenida",
  SEGUIMIENTO: "Seguimiento",
  AVISO_HABILITACION: "Aviso de habilitación",
  CONSULTA: "Consulta",
  OTRO: "Otro",
};
export const REASON_OPTIONS: InteractionReason[] = [
  "SEGUIMIENTO",
  "BIENVENIDA",
  "AVISO_HABILITACION",
  "CONSULTA",
  "OTRO",
];

// "Etapa" del CRM = recorrido del cliente en 3 etapas (E1/E2/E3), derivado del
// pipeline operativo. Ver EXPERIENCIA_CLIENTES_ROADMAP.md.
export const RECORRIDO_LABELS: Record<ClienteRecorrido, string> = {
  E1: "De la venta a la obra",
  E2: "De la obra a la habilitación",
  E3: "De la habilitación al uso continuo",
};

// Etiqueta compacta para el filtro/chips (el DTO ya trae los nombres por fila).
export const RECORRIDO_SHORT: Record<ClienteRecorrido, string> = {
  E1: "E1 · Pre-obra",
  E2: "E2 · Habilitación",
  E3: "E3 · Post-Habilitación",
};

export const RECORRIDO_OPTIONS: ClienteRecorrido[] = ["E1", "E2", "E3"];

export const ESTADO_LABELS: Record<ClienteEstado, string> = {
  ACTIVO: "Activo",
  FINALIZADO: "Finalizado",
  ARCHIVADO: "Archivado",
  PROSPECTO: "En cotización",
};

// Etapas del trámite UTE (para mostrar la etapa actual en la ficha).
export const UTE_STAGE_LABELS: Record<string, string> = {
  CONSULTA: "Consulta",
  SOLICITUD: "Solicitud",
  DOCS_1: "Documentación 1",
  DOCS_2: "Documentación 2",
  RELEVAR: "Relevamiento",
  ENSAYOS: "Ensayos",
  FINALIZADO: "Finalizado",
};

// Los 19 departamentos de Uruguay — opciones del filtro por departamento.
export const DEPARTAMENTOS_UY = [
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
];

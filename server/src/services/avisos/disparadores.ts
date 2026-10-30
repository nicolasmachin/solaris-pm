/**
 * Catálogo de disparadores de los avisos automáticos al cliente: los hechos del
 * flujo de Voltia PM que pueden mandarle un mensaje.
 *
 * Cada disparador se engancha en UN punto del código (el que se nombra en
 * `dondeSeDispara`), llamando a `emitirHecho()`. Agregar uno nuevo es sumarlo
 * acá y llamar a `emitirHecho()` en ese punto; la pantalla lo lista sola.
 */

import { StageType } from "@prisma/client";

import { STAGE_LABELS } from "../pipeline-definitions.js";
import { UTE_HITO_LABEL } from "../ute-timeline.service.js";

export type Disparador = {
  clave: string;
  grupo: "Venta" | "Obra" | "Etapas" | "UTE" | "Agenda";
  etiqueta: string;
  /** Cuándo pasa, en palabras del usuario. */
  cuando: string;
  /** Las variables que tienen dato con este disparador (además de las de siempre). */
  variables: string[];
  /** Si el disparador lleva "N días antes". */
  conDias?: boolean;
};

/** Etapas del pipeline que se pueden usar como "etapa completada". */
const ETAPAS: StageType[] = [
  StageType.ONBOARDING,
  StageType.PRE_INGENIERIA,
  StageType.VALIDACION_OPERACIONES,
  StageType.INGENIERIA_FINAL,
  StageType.COMPRAS,
  StageType.EJECUCION_OBRA,
  StageType.TRAMITACION_UTE,
];

/** Hitos de UTE como disparador. `finalizedAt` no va: la habilitación es su propio disparador. */
const HITOS_UTE = [
  "consultaSentAt",
  "caseOpenedAt",
  "consultaApprovedAt",
  "solicitudSentAt",
  "proyectoApprovedAt",
  "docs1SentAt",
  "docs1ApprovedAt",
  "ensayosSentAt",
  "ensayosApprovedAt",
  "docs2SentAt",
] as const;

const OBRA = ["obra.fecha", "obra.fechaFin"];

export const DISPARADORES: Disparador[] = [
  {
    clave: "proyecto.creado",
    grupo: "Venta",
    etiqueta: "Venta cerrada",
    cuando: "Cuando el asesor convierte el lead ganado en proyecto.",
    variables: [],
  },
  {
    clave: "obra.fecha_confirmada",
    grupo: "Obra",
    etiqueta: "Fecha de obra confirmada",
    cuando: "Cuando Operaciones confirma la fecha de la obra en el calendario.",
    variables: OBRA,
  },
  {
    clave: "obra.reprogramada",
    grupo: "Obra",
    etiqueta: "Obra reprogramada",
    cuando: "Cuando se cambia la fecha de una obra que ya estaba confirmada.",
    variables: OBRA,
  },
  {
    clave: "obra.proxima",
    grupo: "Obra",
    etiqueta: "Faltan N días para la obra",
    cuando: "Se revisa todas las mañanas: sale cuando faltan los días elegidos para el primer día de obra confirmada.",
    variables: OBRA,
    conDias: true,
  },
  {
    clave: "etapa.completada:EJECUCION_OBRA",
    grupo: "Obra",
    etiqueta: "Obra terminada",
    cuando: "Cuando se completa la etapa Ejecución de Obra.",
    variables: OBRA,
  },
  ...ETAPAS.filter((e) => e !== StageType.EJECUCION_OBRA).map(
    (e): Disparador => ({
      clave: `etapa.completada:${e}`,
      grupo: "Etapas",
      etiqueta: `Etapa completada: ${STAGE_LABELS[e]}`,
      cuando: `Cuando se completa la etapa ${STAGE_LABELS[e]} del proyecto.`,
      variables: [],
    }),
  ),
  ...HITOS_UTE.map(
    (h): Disparador => ({
      clave: `ute.hito:${h}`,
      grupo: "UTE",
      etiqueta: `UTE: ${UTE_HITO_LABEL[h]}`,
      cuando: `Cuando Tramitación UTE carga la fecha de "${UTE_HITO_LABEL[h]}".`,
      variables: ["evento.fecha"],
    }),
  ),
  {
    clave: "ute.habilitado",
    grupo: "UTE",
    etiqueta: "UTE habilitó la instalación",
    cuando: "Cuando termina el trámite de UTE (con varios suministros, cuando terminan todos).",
    variables: ["evento.fecha"],
  },
  {
    clave: "agenda.creado:VISITA_TECNICA",
    grupo: "Agenda",
    etiqueta: "Visita técnica agendada",
    cuando: "Cuando se agenda una visita técnica del proyecto en el calendario.",
    variables: ["evento.fecha"],
  },
  {
    clave: "agenda.creado:MANTENIMIENTO",
    grupo: "Agenda",
    etiqueta: "Mantenimiento agendado",
    cuando: "Cuando se agenda un mantenimiento del proyecto en el calendario.",
    variables: ["evento.fecha"],
  },
];

export const DISPARADOR_POR_CLAVE = new Map(DISPARADORES.map((d) => [d.clave, d]));

/** Variables que se pueden usar en un mensaje, con un ejemplo (Meta pide uno por hueco). */
export const VARIABLES: Record<string, { etiqueta: string; ejemplo: string }> = {
  "cliente.nombre": { etiqueta: "Primer nombre del cliente", ejemplo: "María" },
  "cliente.nombreCompleto": { etiqueta: "Nombre completo del cliente", ejemplo: "María Pérez" },
  "obra.fecha": { etiqueta: "Primer día de obra", ejemplo: "martes 3 de noviembre" },
  "obra.fechaFin": { etiqueta: "Último día de obra", ejemplo: "jueves 5 de noviembre" },
  "evento.fecha": { etiqueta: "Fecha del hecho (el hito, la visita)", ejemplo: "miércoles 4 de noviembre" },
  "portal.link": { etiqueta: "Link al portal de Voltia", ejemplo: "https://app.voltia.com.uy/portal" },
};

/** Las que tienen dato con cualquier disparador. */
export const VARIABLES_SIEMPRE = ["cliente.nombre", "cliente.nombreCompleto", "portal.link"];

export function variablesDe(disparador: string): string[] {
  const d = DISPARADOR_POR_CLAVE.get(disparador);
  return [...VARIABLES_SIEMPRE, ...(d?.variables ?? [])];
}

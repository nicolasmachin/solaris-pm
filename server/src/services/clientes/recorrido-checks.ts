/**
 * El catálogo de checks del recorrido de Experiencia Solar.
 *
 * Reglas que lo gobiernan (definidas con el equipo):
 *
 *  - **Los checks son de aviso al cliente, no de tarea interna.** Por eso el de
 *    la encuesta no es "encuesta enviada" —eso lo hace el sistema solo— sino
 *    "le avisé al cliente que la tiene", que es lo que realmente falta hoy.
 *  - **El cumplimiento se calcula, no se declara.** Por eso NO hay un check de
 *    "contacto semanal al día": la cadencia sale de las interacciones
 *    registradas. Los checks quedan solo para hitos puntuales.
 *  - **Vencer no bloquea.** Experiencia Solar acompaña, no avanza el recorrido:
 *    un check vencido se ve, pero no frena la obra ni el trámite.
 */

export type ChecklistDef = {
  codigo: string;
  titulo: string;
  orden: number;
  /**
   * Días hábiles de plazo desde el hecho que lo activa (ver `activarCheck` y
   * `HECHO_ACTIVA_CHECKS`). Null = sin plazo.
   */
  plazoDiasHabiles: number | null;
  /**
   * Plazo en horas reales, para el único aviso que se mide en horas: la Regla de
   * Oro (24-48 h desde la habilitación). Si está, manda sobre `plazoDiasHabiles`.
   */
  plazoHoras?: number;
  /** Ayuda para quien lo ejecuta. */
  detalle?: string;
  /**
   * Los tres avisos que el cliente sí o sí tiene que recibir. Se resaltan en la
   * pantalla porque el resto del recorrido se puede hacer con más o menos
   * prolijidad, pero si falta uno de estos el cliente queda a ciegas en el
   * momento en que más necesita saber: al arrancar, cuando le tocan la casa y
   * cuando ya puede encender.
   */
  clave?: boolean;
};

export const CHECKS_E1: ChecklistDef[] = [
  {
    codigo: "e1_bienvenida",
    titulo: "Bienvenida y presentación",
    orden: 1,
    plazoDiasHabiles: 1,
    clave: true,
    detalle:
      "La manda Experiencia Solar, después de que el asesor le presentó al referente al cerrar el onboarding.",
  },
  {
    codigo: "e1_expectativa",
    titulo: "Conversación de expectativa inicial",
    orden: 2,
    plazoDiasHabiles: 3,
    detalle:
      "Por WhatsApp: el recorrido completo y los plazos reales, incluido UTE. Obligatoria: no se promete cadencia.",
  },
  {
    codigo: "e1_portal",
    titulo: "Envío del acceso al portal",
    orden: 3,
    plazoDiasHabiles: 2,
    detalle: "Por WhatsApp. Se tilda solo al crearle el usuario del portal.",
  },
  {
    codigo: "e1_contrato_firmado",
    titulo: "Contrato firmado por las dos partes, recabado y archivado",
    orden: 4,
    plazoDiasHabiles: 5,
    detalle:
      "Coordinarlo con el cliente: si está en Montevideo, que pase a firmarlo; si es del interior, " +
      "por correo (va el nuestro firmado y vuelve con su firma). Va al principio, no al final.",
  },
  {
    codigo: "e1_capataz",
    titulo: "Presentación del capataz",
    orden: 5,
    plazoDiasHabiles: 2,
    detalle: "Con el alcance explícito: obra con él, todo lo demás con Experiencia Solar.",
  },
  {
    codigo: "e1_fecha_obra",
    titulo: "Aviso de fecha de obra confirmada",
    orden: 6,
    plazoDiasHabiles: 2,
    clave: true,
    detalle: "Dentro de 2 días hábiles de que se confirma en el calendario.",
  },
  {
    codigo: "e1_obra_terminada",
    titulo: "Aviso de obra terminada y qué sigue",
    orden: 7,
    plazoDiasHabiles: 1,
    detalle: "Que terminó y que ahora arranca el trámite, con su plazo. Va ANTES que la encuesta.",
  },
  {
    codigo: "e1_encuesta_obra",
    titulo: "Aviso de la encuesta de obra",
    orden: 8,
    plazoDiasHabiles: 2,
    detalle: "Contacto propio, nunca pegado a otro mensaje.",
  },
];

export const CHECKS_E2: ChecklistDef[] = [
  {
    codigo: "e2_habilitacion",
    titulo: "Aviso de habilitación otorgada",
    orden: 1,
    plazoDiasHabiles: 2,
    plazoHoras: 48,
    clave: true,
    detalle: "Regla de Oro: dentro de 24-48 h. Cada día que pasa el cliente deja de ahorrar.",
  },
  {
    codigo: "e2_encuesta_habilitacion",
    titulo: "Aviso de la encuesta de habilitación",
    orden: 2,
    plazoDiasHabiles: 2,
  },
];

export const CHECKS_E3: ChecklistDef[] = [
  {
    codigo: "e3_capacitacion",
    titulo: "Capacitación: material y videos",
    orden: 1,
    plazoDiasHabiles: 15,
    detalle: "No es una llamada: es el envío del material. El check es 'le mandé el material'.",
  },
  {
    codigo: "e3_alta_reportes",
    titulo: "Alta en reportes mensuales y dónde encontrarlos",
    orden: 2,
    plazoDiasHabiles: 15,
    detalle: "Es el único correo automático que recibe el cliente en 25 años.",
  },
  {
    codigo: "e3_portal_recorrido",
    titulo: "Recorrido por las funcionalidades del portal",
    orden: 3,
    plazoDiasHabiles: 15,
    detalle: "Su planta en vivo, reclamos, documentos, encuestas y reportes.",
  },
];

// Retirado el 28-10-2026: `e3_acceso_inversor` ("Entrega del acceso a la
// plataforma del inversor"). El portal de Voltia ya muestra la generación, el
// consumo y el flujo de energía en vivo: mandar al cliente a la aplicación de
// otra marca para ver lo mismo no tiene sentido (decisión de Nicolás). En prod
// había 93 filas, 41 tildadas, ninguna con nota. Se borran con
// `prisma/scripts/retirar-check-acceso-inversor.ts`.
//
// Retirado el 24-09-2026: `e3_garantias` ("Repaso de garantías"). No se hacía. La
// garantía ya está en el contrato firmado y el paso no producía ningún documento
// nuevo: era un recordatorio que sumaba un renglón a la lista sin sumar trabajo
// real. Medido antes de sacarlo: de 72 filas en producción, las 28 tildadas se
// marcaron todas el mismo día y en el mismo minuto que otros checks de E3 del
// mismo proyecto — limpieza en masa, no 28 repasos.
//
// Criterio de fondo, que vale para el próximo paso que se quiera agregar: primero
// que funcione lo que ya está definido; los pasos "que quedan lindos" agregan
// complejidad y ruido a la lista antes de agregar valor.
//
// Las filas viejas se borran con `prisma/scripts/retirar-check-garantias.ts`: el
// listado sale de la tabla, no del catálogo, así que sacar la definición no las
// hace desaparecer solas.

export const CHECKS_POR_RECORRIDO: Record<string, ChecklistDef[]> = {
  E1: CHECKS_E1,
  E2: CHECKS_E2,
  E3: CHECKS_E3,
};

/**
 * El aviso de habilitación. Tildarlo es lo que corta las alertas de la Regla de
 * Oro: por eso el código vive acá y no suelto en el service.
 */
export const CODIGO_AVISO_HABILITACION = "e2_habilitacion";

/** Prefijo de los checks dinámicos por reprogramación de obra. */
export const CODIGO_REAGENDA = "e1_reagenda";

/**
 * Qué hecho arranca el reloj de cada paso. Un paso nace sin plazo y lo recibe
 * cuando pasa esto: poner el reloj a correr desde la creación haría que todo
 * naciera vencido.
 *
 *  - `onboarding`: el asesor cerró el onboarding (y presentó al referente).
 *  - `fecha_confirmada`: Operaciones confirmó la fecha de obra en el calendario.
 *  - `obra_terminada`: se cerró la etapa de obra.
 *  - `encuesta_obra` / `encuesta_habilitacion`: se generó esa encuesta.
 *  - `habilitacion`: UTE finalizó el trámite.
 */
export const HECHO_ACTIVA_CHECKS = {
  onboarding: ["e1_bienvenida", "e1_expectativa", "e1_portal", "e1_contrato_firmado"],
  fecha_confirmada: ["e1_fecha_obra", "e1_capataz"],
  obra_terminada: ["e1_obra_terminada"],
  encuesta_obra: ["e1_encuesta_obra"],
  encuesta_habilitacion: ["e2_encuesta_habilitacion"],
  habilitacion: [
    "e2_habilitacion",
    "e3_capacitacion",
    "e3_alta_reportes",
    "e3_portal_recorrido",
  ],
} as const;

export type HechoRecorrido = keyof typeof HECHO_ACTIVA_CHECKS;

/** Pasos que se cierran solos con el motivo con que se registra un contacto. */
export const CHECK_POR_MOTIVO: Partial<Record<string, string>> = {
  BIENVENIDA: "e1_bienvenida",
  AVISO_HABILITACION: CODIGO_AVISO_HABILITACION,
};

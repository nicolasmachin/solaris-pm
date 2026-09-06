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
  /** Días hábiles de plazo desde que se crea. Null = sin plazo. */
  plazoDiasHabiles: number | null;
  /** Ayuda para quien lo ejecuta. */
  detalle?: string;
};

export const CHECKS_E1: ChecklistDef[] = [
  {
    codigo: "e1_bienvenida",
    titulo: "Bienvenida y presentación",
    orden: 1,
    plazoDiasHabiles: null,
    detalle: "La manda el vendedor al cerrar. Sin esto, Experiencia Solar contacta en frío.",
  },
  {
    codigo: "e1_expectativa",
    titulo: "Conversación de expectativa inicial",
    orden: 2,
    plazoDiasHabiles: null,
    detalle: "El recorrido completo y los plazos reales, incluido UTE. Obligatoria: no se promete cadencia.",
  },
  {
    codigo: "e1_portal",
    titulo: "Envío del acceso al portal",
    orden: 3,
    plazoDiasHabiles: null,
    detalle: "Por WhatsApp. Sin plazo, pero aparece pendiente hasta que se haga.",
  },
  {
    codigo: "e1_capataz",
    titulo: "Presentación del capataz",
    orden: 4,
    plazoDiasHabiles: null,
    detalle: "Con el alcance explícito: obra con él, todo lo demás con Experiencia Solar.",
  },
  {
    codigo: "e1_fecha_obra",
    titulo: "Aviso de fecha de obra confirmada",
    orden: 5,
    plazoDiasHabiles: 2,
    detalle: "Dentro de 2 días hábiles de que se confirma en el calendario.",
  },
  {
    codigo: "e1_obra_terminada",
    titulo: "Aviso de obra terminada y qué sigue",
    orden: 6,
    plazoDiasHabiles: null,
    detalle: "Que terminó y que ahora arranca el trámite, con su plazo. Va ANTES que la encuesta.",
  },
  {
    codigo: "e1_encuesta_obra",
    titulo: "Aviso de la encuesta de obra",
    orden: 7,
    plazoDiasHabiles: null,
    detalle: "Contacto propio, nunca pegado a otro mensaje.",
  },
];

export const CHECKS_E2: ChecklistDef[] = [
  {
    codigo: "e2_habilitacion",
    titulo: "Aviso de habilitación otorgada",
    orden: 1,
    plazoDiasHabiles: 2,
    detalle: "Regla de Oro: dentro de 24-48 h. Cada día que pasa el cliente deja de ahorrar.",
  },
  {
    codigo: "e2_encuesta_habilitacion",
    titulo: "Aviso de la encuesta de habilitación",
    orden: 2,
    plazoDiasHabiles: null,
  },
];

export const CHECKS_E3: ChecklistDef[] = [
  {
    codigo: "e3_capacitacion",
    titulo: "Capacitación: material y videos de la app",
    orden: 1,
    plazoDiasHabiles: 15,
    detalle: "No es una llamada: es el envío del material. El check es 'le mandé el material'.",
  },
  {
    codigo: "e3_acceso_inversor",
    titulo: "Entrega del acceso a la plataforma del inversor",
    orden: 2,
    plazoDiasHabiles: 15,
    detalle: "El usuario y la contraseña los deja registrados el técnico; acá se le entregan al cliente.",
  },
  {
    codigo: "e3_alta_reportes",
    titulo: "Alta en reportes mensuales y dónde encontrarlos",
    orden: 3,
    plazoDiasHabiles: 15,
    detalle: "Es el único correo automático que recibe el cliente en 25 años.",
  },
  {
    codigo: "e3_garantias",
    titulo: "Repaso de garantías",
    orden: 4,
    plazoDiasHabiles: 15,
    detalle: "No se produce ningún documento: ya está en el contrato. Se le recuerda lo que firmó.",
  },
  {
    codigo: "e3_portal_recorrido",
    titulo: "Recorrido por las funcionalidades del portal",
    orden: 5,
    plazoDiasHabiles: 15,
    detalle: "Tickets, encuestas, reportes y documentación.",
  },
];

export const CHECKS_POR_RECORRIDO: Record<string, ChecklistDef[]> = {
  E1: CHECKS_E1,
  E2: CHECKS_E2,
  E3: CHECKS_E3,
};

/** Prefijo de los checks dinámicos por reprogramación de obra. */
export const CODIGO_REAGENDA = "e1_reagenda";

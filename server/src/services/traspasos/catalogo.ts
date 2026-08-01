import { StageType, TraspasoTipo } from "@prisma/client";

// Catálogo declarativo de los traspasos entre áreas. Fuente de verdad de:
//   - quién recibe la notificación (roles primarios + roles en copia)
//   - el texto del modal de confirmación
//   - el mapeo etapa del pipeline → traspaso
//
// Basado en el catálogo de la Sección 11 del PROTOCOLO_OPERATIVO_ENTREGA_SERVICIO
// y el registro de cambios v3 (13 traspasos, T4 nuevo, T2→Gerente, etapa 3 =
// VALIDACION_OPERACIONES). ADMIN va SIEMPRE en copia (regla transversal).
//
// MODELO DE ROLES (unificado, jul-2026): el ruteo es 100% por ROL real de la
// tabla `roles` — se eliminó el mecanismo viejo de `subRolesOperaciones` (nunca
// se asignaba en ningún lado). Cada persona es "Gerente de Operaciones",
// "Capataz" o "Logística" por su ROL, no por una marca dentro de Operaciones.

// Nombres de rol tal cual figuran en la tabla `roles` (role.name).
export const ROLE = {
  ADMIN: "ADMIN",
  ASESOR_COMERCIAL: "ASESOR_COMERCIAL",
  INGENIERIA: "INGENIERIA",
  OPERACIONES: "OPERACIONES",
  FINANZAS: "FINANZAS",
  TRAMITACION_UTE: "TRAMITACION_UTE",
  EXPERIENCIA_SOLAR: "EXPERIENCIA_SOLAR",
  GERENTE_OPERACIONES: "GERENTE_OPERACIONES",
  GERENTE_COMERCIAL: "GERENTE_COMERCIAL",
  GERENTE_INGENIERIA: "GERENTE_INGENIERIA",
  GERENTE_FINANZAS: "GERENTE_FINANZAS",
  LOGISTICA: "LOGISTICA",
  CAPATAZ: "CAPATAZ",
} as const;

// Un ÁREA agrupa el rol base + su gerencia + sub-roles. Notificar a un área
// incluye a TODOS estos roles (decisión jul-2026: el gerente ve todos los
// traspasos de su área). Para apuntar SÓLO al gerente/logística, se usa el rol
// puntual en la entrada del catálogo, no el área.
export const AREA_ROLES: Record<string, string[]> = {
  OPERACIONES: [ROLE.OPERACIONES, ROLE.GERENTE_OPERACIONES, ROLE.CAPATAZ, ROLE.LOGISTICA],
  INGENIERIA: [ROLE.INGENIERIA, ROLE.GERENTE_INGENIERIA],
  COMERCIAL: [ROLE.ASESOR_COMERCIAL, ROLE.GERENTE_COMERCIAL],
  FINANZAS: [ROLE.FINANZAS, ROLE.GERENTE_FINANZAS],
  EXPERIENCIA_SOLAR: [ROLE.EXPERIENCIA_SOLAR],
  TRAMITACION_UTE: [ROLE.TRAMITACION_UTE],
};

export type CatalogoEntry = {
  // Roles (ya expandidos) cuyos usuarios reciben como destinatarios primarios.
  rolesPrimarios: string[];
  // Roles que reciben en copia (ADMIN se agrega SIEMPRE aparte, no va acá).
  rolesCopia: string[];
  // Etiqueta corta del área destinataria (para el modal y la preview).
  areaDestino: string;
};

export const TRASPASO_CATALOGO: Record<TraspasoTipo, CatalogoEntry> = {
  T1_ONBOARDING_COMPLETADO: {
    rolesPrimarios: [...AREA_ROLES.INGENIERIA, ...AREA_ROLES.EXPERIENCIA_SOLAR],
    rolesCopia: [],
    areaDestino: "Ingeniería y Experiencia Solar",
  },
  // v3 C5: T2 va al Gerente de Operaciones (rol puntual, no toda el área).
  T2_PREINGENIERIA_PRONTA: {
    rolesPrimarios: [ROLE.GERENTE_OPERACIONES],
    rolesCopia: [],
    areaDestino: "Gerente de Operaciones",
  },
  // v3 C12: cierre de la etapa 3 genera DOS traspasos (T3 a Ingeniería, T4 a
  // Experiencia Solar) desde un solo acto de confirmación del gerente.
  T3_VALIDACION_OPERACIONES_A_INGENIERIA: {
    rolesPrimarios: [...AREA_ROLES.INGENIERIA],
    rolesCopia: [ROLE.GERENTE_OPERACIONES],
    areaDestino: "Ingeniería",
  },
  T4_VALIDACION_OPERACIONES_A_ATENCION_CLIENTE: {
    rolesPrimarios: [...AREA_ROLES.EXPERIENCIA_SOLAR],
    rolesCopia: [],
    areaDestino: "Experiencia Solar",
  },
  // Ingeniería final → Logística (antes "Compras", rol eliminado; Logística cubre
  // compras/materiales). Gerente de Operaciones en copia.
  T5_INGENIERIA_FINAL_COMPLETADA: {
    rolesPrimarios: [ROLE.LOGISTICA],
    rolesCopia: [ROLE.GERENTE_OPERACIONES],
    areaDestino: "Logística",
  },
  // El aviso de materiales recibidos va al Gerente de Operaciones (no a
  // Operaciones en general); ADMIN queda en copia como en todos.
  T6_MATERIALES_RECIBIDOS_EN_DEPOSITO: {
    rolesPrimarios: [ROLE.GERENTE_OPERACIONES],
    rolesCopia: [],
    areaDestino: "Gerente de Operaciones",
  },
  T7_OBRA_TERMINADA: {
    rolesPrimarios: [...AREA_ROLES.EXPERIENCIA_SOLAR, ...AREA_ROLES.TRAMITACION_UTE],
    rolesCopia: [ROLE.GERENTE_OPERACIONES],
    areaDestino: "Experiencia Solar y Tramitación UTE",
  },
  T8_TRAMITE_UTE_FINALIZADO: {
    rolesPrimarios: [...AREA_ROLES.EXPERIENCIA_SOLAR],
    rolesCopia: [],
    areaDestino: "Experiencia Solar",
  },
  // T9–T13: segunda fase (tickets/encuestas/mantenimientos). Se dejan definidos
  // para no re-migrar el enum. T9 resuelve el área destino dinámicamente desde
  // el payload (Ingeniería u Operaciones) en calcularDestinatarios.
  T9_TICKET_DERIVADO: {
    rolesPrimarios: [],
    rolesCopia: [],
    areaDestino: "Área técnica derivada",
  },
  T10_TICKET_RESUELTO: {
    rolesPrimarios: [...AREA_ROLES.EXPERIENCIA_SOLAR],
    rolesCopia: [],
    areaDestino: "Experiencia Solar",
  },
  T11_ENCUESTA_NOTA_BAJA: {
    rolesPrimarios: [...AREA_ROLES.EXPERIENCIA_SOLAR],
    rolesCopia: [],
    areaDestino: "Experiencia Solar",
  },
  // El área Operaciones ya incluye al Gerente (y Capataz/Logística) como primario.
  T12_CLIENTE_AUTOAGENDO_MANTENIMIENTO: {
    rolesPrimarios: [...AREA_ROLES.OPERACIONES],
    rolesCopia: [],
    areaDestino: "Operaciones",
  },
  T13_MANTENIMIENTO_EJECUTADO: {
    rolesPrimarios: [...AREA_ROLES.EXPERIENCIA_SOLAR],
    rolesCopia: [],
    areaDestino: "Experiencia Solar",
  },
};

// Mapeo etapa del pipeline (al completarse) → traspaso que dispara. Solo las
// etapas del MVP (T1–T8). VALIDACION_OPERACIONES mapea a T3; el T4 (a Atención
// al Cliente) lo dispara el endpoint dedicado de la etapa 3 junto con T3 (v3 C12).
// EJECUCION_OBRA y demás usan el disparo por completitud de sub-tareas.
export const STAGE_TO_TRASPASO: Partial<Record<StageType, TraspasoTipo>> = {
  ONBOARDING: TraspasoTipo.T1_ONBOARDING_COMPLETADO,
  PRE_INGENIERIA: TraspasoTipo.T2_PREINGENIERIA_PRONTA,
  VALIDACION_OPERACIONES: TraspasoTipo.T3_VALIDACION_OPERACIONES_A_INGENIERIA,
  INGENIERIA_FINAL: TraspasoTipo.T5_INGENIERIA_FINAL_COMPLETADA,
  COMPRAS: TraspasoTipo.T6_MATERIALES_RECIBIDOS_EN_DEPOSITO,
  EJECUCION_OBRA: TraspasoTipo.T7_OBRA_TERMINADA,
  TRAMITACION_UTE: TraspasoTipo.T8_TRAMITE_UTE_FINALIZADO,
};

// Traspaso adicional que se dispara junto al de cierre de una etapa (v3 C12):
// la etapa 3 dispara T3 (mapa de arriba) y T4 (este) en un solo acto.
export const STAGE_TO_TRASPASO_EXTRA: Partial<Record<StageType, TraspasoTipo>> = {
  VALIDACION_OPERACIONES: TraspasoTipo.T4_VALIDACION_OPERACIONES_A_ATENCION_CLIENTE,
};

// Etapa a la que "avanza" la vista del proyecto al confirmar cada traspaso de
// cierre de etapa (la SIGUIENTE del pipeline lineal). Se usa para el toggle
// "Avanzar la etapa mostrada" del popup. Los traspasos que no cierran una etapa
// del pipeline (tickets, encuestas) no avanzan y no están en el mapa.
export const TRASPASO_ADVANCE_STAGE: Partial<Record<TraspasoTipo, StageType>> = {
  [TraspasoTipo.T1_ONBOARDING_COMPLETADO]: StageType.PRE_INGENIERIA,
  [TraspasoTipo.T2_PREINGENIERIA_PRONTA]: StageType.VALIDACION_OPERACIONES,
  [TraspasoTipo.T3_VALIDACION_OPERACIONES_A_INGENIERIA]: StageType.INGENIERIA_FINAL,
  [TraspasoTipo.T4_VALIDACION_OPERACIONES_A_ATENCION_CLIENTE]: StageType.INGENIERIA_FINAL,
  [TraspasoTipo.T5_INGENIERIA_FINAL_COMPLETADA]: StageType.COMPRAS,
  [TraspasoTipo.T6_MATERIALES_RECIBIDOS_EN_DEPOSITO]: StageType.EJECUCION_OBRA,
  [TraspasoTipo.T7_OBRA_TERMINADA]: StageType.TRAMITACION_UTE,
  [TraspasoTipo.T8_TRAMITE_UTE_FINALIZADO]: StageType.POST_HABILITACION,
};

// Etiqueta corta y legible del traspaso (para notificaciones y reportes).
export const TRASPASO_LABEL: Record<TraspasoTipo, string> = {
  T1_ONBOARDING_COMPLETADO: "Onboarding completado",
  T2_PREINGENIERIA_PRONTA: "Pre-ingeniería pronta",
  T3_VALIDACION_OPERACIONES_A_INGENIERIA: "Validación de Operaciones → Ingeniería",
  T4_VALIDACION_OPERACIONES_A_ATENCION_CLIENTE: "Validación de Operaciones → Experiencia Solar (fecha)",
  T5_INGENIERIA_FINAL_COMPLETADA: "Ingeniería final completada",
  T6_MATERIALES_RECIBIDOS_EN_DEPOSITO: "Materiales recibidos en depósito",
  T7_OBRA_TERMINADA: "Obra terminada",
  T8_TRAMITE_UTE_FINALIZADO: "Trámite UTE finalizado",
  T9_TICKET_DERIVADO: "Ticket derivado a área técnica",
  T10_TICKET_RESUELTO: "Ticket resuelto",
  T11_ENCUESTA_NOTA_BAJA: "Encuesta con nota baja",
  T12_CLIENTE_AUTOAGENDO_MANTENIMIENTO: "Cliente autoagendó mantenimiento",
  T13_MANTENIMIENTO_EJECUTADO: "Mantenimiento ejecutado",
};

// Texto del modal que ve el actor antes de confirmar (por proyecto).
export function buildModalTexto(tipo: TraspasoTipo, projectName: string): string {
  const p = projectName;
  switch (tipo) {
    case TraspasoTipo.T1_ONBOARDING_COMPLETADO:
      return `Marcaste el Onboarding completado para ${p}. Al confirmar, se notifica a Ingeniería y a Experiencia Solar para que arranquen su parte.`;
    case TraspasoTipo.T2_PREINGENIERIA_PRONTA:
      return `Marcaste la pre-ingeniería como pronta para ${p}. Al confirmar, se notifica al gerente de Operaciones para que valide la lista de materiales (con o sin visita del capataz) y confirme la fecha de obra.`;
    case TraspasoTipo.T3_VALIDACION_OPERACIONES_A_INGENIERIA:
      return `Validaste la etapa de Operaciones para ${p} (informe del capataz + fecha de obra confirmada). Al confirmar, se notifica a Ingeniería para que avance con la ingeniería final.`;
    case TraspasoTipo.T4_VALIDACION_OPERACIONES_A_ATENCION_CLIENTE:
      return `Confirmaste la fecha de obra para ${p}. Al confirmar, se notifica a Experiencia Solar para que confirme la fecha con el Generador y coordine la recepción del equipo.`;
    case TraspasoTipo.T5_INGENIERIA_FINAL_COMPLETADA:
      return `Marcaste la ingeniería final completada para ${p}. La documentación técnica para UTE queda incluida en la lista de materiales. Al confirmar, se notifica a Logística para la compra/pedido de materiales.`;
    case TraspasoTipo.T6_MATERIALES_RECIBIDOS_EN_DEPOSITO:
      return `Marcaste los materiales como recibidos y verificados en depósito para ${p}. Al confirmar, se notifica al Gerente de Operaciones que la obra puede arrancar con todos los materiales disponibles.`;
    case TraspasoTipo.T7_OBRA_TERMINADA:
      return `Marcaste la obra como terminada para ${p}, incluyendo ensayos. Al confirmar, se notifica a Experiencia Solar y a Tramitación UTE.`;
    case TraspasoTipo.T8_TRAMITE_UTE_FINALIZADO:
      return `Marcaste el trámite UTE como finalizado para ${p}. Al confirmar, se notifica a Experiencia Solar para que avise al Generador que ya puede empezar a producir su propia energía.`;
    case TraspasoTipo.T11_ENCUESTA_NOTA_BAJA:
      return `El Generador de ${p} respondió una encuesta con nota baja. Al confirmar, se notifica al equipo de Experiencia Solar para que lo contacte y atienda su insatisfacción.`;
    default:
      return `Confirmá el traspaso "${TRASPASO_LABEL[tipo]}" para ${p}.`;
  }
}

// Mensaje in-app / email que recibe el destinatario.
export function buildNotificacionMensaje(
  tipo: TraspasoTipo,
  projectName: string,
  nota?: string | null,
): { title: string; message: string } {
  const title = `Traspaso: ${TRASPASO_LABEL[tipo]}`;
  let message = `Recibiste un traspaso "${TRASPASO_LABEL[tipo]}" en el proyecto "${projectName}".`;
  if (nota && nota.trim()) {
    message += ` Nota del emisor: "${nota.trim()}"`;
  }
  return { title, message };
}

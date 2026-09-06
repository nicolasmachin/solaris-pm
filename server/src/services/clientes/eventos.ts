/**
 * Qué eventos del registro de actividad son NOVEDAD para el cliente.
 *
 * Problema que resuelve: el log se escribió para desarrolladores. Quien acompaña
 * al cliente lo abre, encuentra entradas que no entiende y tiene que preguntar
 * qué son. Medido en producción (180 días, ~31.000 entradas):
 *
 *   alert_triggered            13.693  ← el MISMO evento 1.245 veces por proyecto
 *   updated                     7.947  ← genérico, sin contexto
 *   proposal_v2_draft_updated   3.759  ← autoguardado del cotizador
 *
 * Esos tres son ~80% del log y no le dicen nada a nadie. Por eso cada acción se
 * clasifica en uno de tres cajones y solo el primero llega a la ficha del cliente.
 */

import { AuditAction } from "@prisma/client";

export type Visibilidad =
  /** Alguien tiene que enterarse. Va al historial del cliente. */
  | "novedad"
  /** Trazabilidad: se guarda, no se muestra. */
  | "auditoria"
  /** Ruido puro: no aporta ni como trazabilidad. */
  | "descartable";

type EventoDef = {
  visibilidad: Visibilidad;
  /** Texto en lenguaje humano. Si falta, se usa la descripción original. */
  etiqueta?: string;
};

export const EVENTOS: Record<AuditAction, EventoDef> = {
  // ─── Novedad: el cliente lo percibe o cambia su situación ──────────────────
  [AuditAction.stage_advanced]: { visibilidad: "novedad", etiqueta: "Avanzó de etapa" },
  [AuditAction.status_changed]: { visibilidad: "novedad", etiqueta: "Cambió el estado del proyecto" },
  [AuditAction.email_sent]: { visibilidad: "novedad", etiqueta: "Se le envió un correo" },
  [AuditAction.lead_converted]: { visibilidad: "novedad", etiqueta: "Se convirtió en proyecto" },
  [AuditAction.traspaso_confirmado]: { visibilidad: "novedad", etiqueta: "Traspaso entre áreas" },
  [AuditAction.traspaso_escalado]: { visibilidad: "novedad", etiqueta: "Traspaso escalado" },
  [AuditAction.contract_version_published]: { visibilidad: "novedad", etiqueta: "Contrato emitido" },
  [AuditAction.proforma_version_published]: { visibilidad: "novedad", etiqueta: "Proforma emitida" },
  [AuditAction.proposal_v2_version_published]: { visibilidad: "novedad", etiqueta: "Propuesta emitida" },
  [AuditAction.proposal_generated]: { visibilidad: "novedad", etiqueta: "Propuesta generada" },

  // ─── Auditoría: trazabilidad interna, no se muestra ───────────────────────
  [AuditAction.created]: { visibilidad: "auditoria" },
  [AuditAction.updated]: { visibilidad: "auditoria" },
  [AuditAction.deleted]: { visibilidad: "auditoria" },
  [AuditAction.file_uploaded]: { visibilidad: "auditoria" },
  // comment_added NO va como novedad: el comentario ya llega al historial por su
  // propia fuente (la tabla de comentarios, con su texto y su autor). Dejarlo acá
  // duplicaba cada comentario con un "Agregó un comentario en el proyecto X".
  [AuditAction.comment_added]: { visibilidad: "auditoria" },
  [AuditAction.comment_edited]: { visibilidad: "auditoria" },
  [AuditAction.comment_deleted]: { visibilidad: "auditoria" },
  [AuditAction.lead_created]: { visibilidad: "auditoria" },
  [AuditAction.lead_stage_changed]: { visibilidad: "auditoria" },
  [AuditAction.setting_changed]: { visibilidad: "auditoria" },
  [AuditAction.role_changed]: { visibilidad: "auditoria" },
  [AuditAction.permission_changed]: { visibilidad: "auditoria" },
  [AuditAction.commission_created]: { visibilidad: "auditoria" },
  [AuditAction.commission_paid]: { visibilidad: "auditoria" },
  [AuditAction.traspaso_cancelado]: { visibilidad: "auditoria" },
  [AuditAction.traspaso_pospuesto]: { visibilidad: "auditoria" },
  [AuditAction.contract_version_discarded]: { visibilidad: "auditoria" },
  [AuditAction.contract_version_restored]: { visibilidad: "auditoria" },
  [AuditAction.proforma_version_discarded]: { visibilidad: "auditoria" },
  [AuditAction.proforma_version_restored]: { visibilidad: "auditoria" },
  [AuditAction.proposal_v2_version_discarded]: { visibilidad: "auditoria" },
  [AuditAction.proposal_v2_version_restored]: { visibilidad: "auditoria" },
  [AuditAction.proposal_v2_version_pdf_regenerated]: { visibilidad: "auditoria" },

  // ─── Descartable: ruido de alto volumen ───────────────────────────────────
  // alert_triggered: 13.693 entradas en 11 proyectos. Es la alerta de "etapa en
  // riesgo por tiempo" reescribiéndose en cada corrida del job. El estado en
  // riesgo ya se ve en el semáforo del proyecto; no aporta como historia.
  [AuditAction.alert_triggered]: { visibilidad: "descartable" },
  // Autoguardados: se escriben cada pocos segundos mientras se edita.
  [AuditAction.proposal_v2_draft_updated]: { visibilidad: "descartable" },
  [AuditAction.contract_draft_updated]: { visibilidad: "descartable" },
  [AuditAction.proforma_draft_updated]: { visibilidad: "descartable" },
};

/** Acciones que llegan al historial del cliente. */
export const ACCIONES_NOVEDAD: AuditAction[] = (
  Object.keys(EVENTOS) as AuditAction[]
).filter((a) => EVENTOS[a].visibilidad === "novedad");

/**
 * Texto para mostrar. Prefiere la descripción real (tiene el detalle: nombre de
 * la etapa, del documento) y cae a la etiqueta genérica si viene vacía.
 */
export function textoEvento(action: AuditAction, description: string | null): string {
  const desc = description?.trim();
  if (desc) return desc;
  return EVENTOS[action]?.etiqueta ?? action;
}

// Sincroniza las subetapas de la stage HABILITACION_UTE de un proyecto con
// el estado de su UteProcess. La fuente de verdad son los 11 campos de fecha
// del UteProcess (consultaSentAt … finalizedAt). Cada subetapa "system" se
// genera 1-a-1 con una de esas acciones (campo Substage.uteAction).
//
// Reglas:
//   - actualEndDate de la subetapa = fecha de la acción correspondiente
//   - status = COMPLETED si la acción tiene fecha
//             IN_PROGRESS si es la primera sin fecha (la "actual")
//             PENDING si está más adelante
//   - actualStartDate = fecha de la acción inmediata anterior con fecha (o null)
//   - dueDate, userId, notes, deadline → NO se pisan en re-sync (editables)
//   - Nombre y orden de las 11 subetapas system son fijos (no editables)

import type { Prisma, PrismaClient, SubstageStatus, UteProcess } from "@prisma/client";

import { calculateProjectProgress, syncStageProgress } from "./project.service.js";
import { UTE_ACTION_KEYS, type UteActionKey } from "./uteProcess.service.js";

export type UteSubstageSpec = {
  uteAction: UteActionKey;
  name: string;
  order: number;
};

// Orden cronológico oficial de las 11 acciones del trámite UTE.
// El `order` empieza en 1 (no 0) para coincidir con el modelo Substage.
export const UTE_SUBSTAGE_SPECS: UteSubstageSpec[] = [
  { uteAction: "consultaSentAt",     name: "Consulta enviada",         order: 1 },
  { uteAction: "caseOpenedAt",       name: "Caso abierto en UTE",      order: 2 },
  { uteAction: "consultaApprovedAt", name: "Consulta aprobada",        order: 3 },
  { uteAction: "solicitudSentAt",    name: "Solicitud enviada",        order: 4 },
  { uteAction: "proyectoApprovedAt", name: "Proyecto aprobado",        order: 5 },
  { uteAction: "docs1SentAt",        name: "Documentos 1 enviados",    order: 6 },
  { uteAction: "docs1ApprovedAt",    name: "Documentos 1 aprobados",   order: 7 },
  { uteAction: "ensayosSentAt",      name: "Ensayos enviados",         order: 8 },
  { uteAction: "ensayosApprovedAt",  name: "Ensayos aprobados",        order: 9 },
  { uteAction: "docs2SentAt",        name: "Documentos finales enviados", order: 10 },
  { uteAction: "finalizedAt",        name: "Trámite finalizado",       order: 11 },
];

// Validación de tiempo de compilación: tiene que coincidir con UTE_ACTION_KEYS.
{
  const specKeys = new Set(UTE_SUBSTAGE_SPECS.map((s) => s.uteAction));
  for (const k of UTE_ACTION_KEYS) {
    if (!specKeys.has(k)) {
      throw new Error(`UTE_SUBSTAGE_SPECS missing action ${k}`);
    }
  }
}

type Tx = Prisma.TransactionClient | PrismaClient;

async function findHabilitacionStage(tx: Tx, projectId: string) {
  return tx.stage.findFirst({
    where: { projectId, name: "HABILITACION_UTE", deletedAt: null },
    select: { id: true, projectId: true },
  });
}

/**
 * Asegura que la stage HABILITACION_UTE del proyecto tenga las 11 subetapas
 * system. Si faltan, las crea. Si sobran subetapas system con uteAction que no
 * están en la spec actual, las marca como deletedAt. NO toca subetapas no-system.
 *
 * Idempotente: llamarla N veces deja el mismo resultado.
 */
export async function ensureUteSubstages(
  tx: Tx,
  projectId: string,
): Promise<void> {
  const stage = await findHabilitacionStage(tx, projectId);
  if (!stage) return; // proyecto sin etapa HABILITACION_UTE; no hay nada que sincronizar.

  const existing = await tx.substage.findMany({
    where: {
      stageId: stage.id,
      deletedAt: null,
      uteAction: { not: null },
    },
    select: { id: true, uteAction: true, order: true },
  });
  const byAction = new Map(existing.map((s) => [s.uteAction!, s]));

  for (const spec of UTE_SUBSTAGE_SPECS) {
    const existingMatch = byAction.get(spec.uteAction);
    if (existingMatch) {
      // Forzar el orden y el nombre canónico.
      await tx.substage.update({
        where: { id: existingMatch.id },
        data: { name: spec.name, order: spec.order, isSystem: true },
      });
      continue;
    }
    // Crear nueva — necesita ocupar order=spec.order. Si hay un substage NO-uteAction
    // en ese order, lo desplazamos al final.
    const conflict = await tx.substage.findFirst({
      where: { stageId: stage.id, order: spec.order, deletedAt: null },
      select: { id: true },
    });
    if (conflict) {
      const max = await tx.substage.aggregate({
        where: { stageId: stage.id },
        _max: { order: true },
      });
      await tx.substage.update({
        where: { id: conflict.id },
        data: { order: (max._max.order ?? spec.order) + 1 },
      });
    }
    await tx.substage.create({
      data: {
        stageId: stage.id,
        projectId,
        order: spec.order,
        name: spec.name,
        status: "PENDING" as SubstageStatus,
        responsible: "",
        isSystem: true,
        uteAction: spec.uteAction,
      },
    });
  }
}

/**
 * Re-syncea status / actualStartDate / actualEndDate de las subetapas system
 * del proyecto, leyendo las 11 fechas del UteProcess.
 *
 * NO pisa: dueDate, userId, notes, deadline. Esos quedan tal cual los dejó
 * el usuario.
 */
export async function syncUteSubstages(
  tx: Tx,
  uteProcess: UteProcess,
): Promise<void> {
  const stage = await findHabilitacionStage(tx, uteProcess.projectId);
  if (!stage) return;

  const subs = await tx.substage.findMany({
    where: {
      stageId: stage.id,
      isSystem: true,
      uteAction: { not: null },
      deletedAt: null,
    },
    select: { id: true, uteAction: true },
  });

  // Trámite cerrado manualmente: la etapa se da por finalizada aunque no estén
  // cargadas las fechas de cada paso. Forzamos las 11 subetapas a COMPLETED
  // (sin inventar fechas) para que syncStageProgress complete la stage. Las
  // métricas UTE leen las fechas del UteProcess, no el status de subetapas, así
  // que esto no las afecta.
  const closed = uteProcess.currentStatus === "CERRADO";

  // Calcular cuál es la "primera sin fecha" — esa va a IN_PROGRESS.
  let firstPendingIdx = UTE_SUBSTAGE_SPECS.length; // si están todas, no hay current
  for (let i = 0; i < UTE_SUBSTAGE_SPECS.length; i++) {
    const date = uteProcess[UTE_SUBSTAGE_SPECS[i].uteAction] as Date | null;
    if (!date) {
      firstPendingIdx = i;
      break;
    }
  }

  for (const sub of subs) {
    const idx = UTE_SUBSTAGE_SPECS.findIndex((s) => s.uteAction === sub.uteAction);
    if (idx < 0) continue;

    const myDate = uteProcess[UTE_SUBSTAGE_SPECS[idx].uteAction] as Date | null;
    const prevDate =
      idx > 0 ? (uteProcess[UTE_SUBSTAGE_SPECS[idx - 1].uteAction] as Date | null) : null;

    let nextStatus: SubstageStatus;
    let actualStartDate: Date | null = prevDate;
    let actualEndDate: Date | null = null;

    if (closed) {
      // Cerrado: completar sin pisar/forzar fechas (se respeta la fecha de la
      // acción si existe, sino queda null).
      nextStatus = "COMPLETED" as SubstageStatus;
      actualEndDate = myDate;
      actualStartDate = prevDate ?? myDate;
    } else if (myDate) {
      nextStatus = "COMPLETED" as SubstageStatus;
      actualEndDate = myDate;
      // start = la acción anterior con fecha (o la propia si no hay anterior).
      actualStartDate = prevDate ?? myDate;
    } else if (idx === firstPendingIdx) {
      nextStatus = "IN_PROGRESS" as SubstageStatus;
      actualStartDate = prevDate;
      actualEndDate = null;
    } else {
      nextStatus = "PENDING" as SubstageStatus;
      actualStartDate = null;
      actualEndDate = null;
    }

    await tx.substage.update({
      where: { id: sub.id },
      data: {
        status: nextStatus,
        actualStartDate,
        actualEndDate,
        progressPercent:
          nextStatus === "COMPLETED" ? 100 : nextStatus === "IN_PROGRESS" ? 50 : 0,
      },
    });
  }
}

/**
 * Wrapper conveniente: ensure + sync. También recalcula `progressPercent` y
 * `status` de la stage HABILITACION_UTE (PENDING → IN_PROGRESS → COMPLETED
 * según las subetapas) y el progreso global del proyecto.
 *
 * `syncStageProgress` y `calculateProjectProgress` usan el `prisma` global
 * (no respetan `tx`), así que se llaman después de la sync principal.
 */
export async function regenerateUteSubstages(
  tx: Tx,
  uteProcess: UteProcess,
): Promise<void> {
  await ensureUteSubstages(tx, uteProcess.projectId);
  await syncUteSubstages(tx, uteProcess);

  const stage = await findHabilitacionStage(tx, uteProcess.projectId);
  if (stage) {
    await syncStageProgress(stage.id);
    await calculateProjectProgress(uteProcess.projectId);
  }
}

/**
 * Helper para los endpoints de Substage: indica si la subetapa es
 * system-managed por UTE y por lo tanto tiene campos bloqueados a edición
 * manual (nombre, orden, eliminar). userId, dueDate, notes y deadline siguen
 * siendo editables.
 */
export function isUteManagedSubstage(s: { isSystem: boolean; uteAction: string | null }) {
  return s.isSystem && s.uteAction != null;
}

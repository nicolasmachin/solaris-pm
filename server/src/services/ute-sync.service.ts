// Sincroniza las subetapas de la stage de tramitación UTE de un proyecto con
// el estado de su UteProcess (etapa TRAMITACION_UTE en el pipeline nuevo, o la
// vieja HABILITACION_UTE en proyectos sin migrar). La fuente de verdad son los 11 campos de fecha
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

import type { Prisma, PrismaClient, StageStatus, SubstageStatus, UteProcess } from "@prisma/client";
import { StageType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import {
  calculateProjectProgress,
  completeProjectIfAllStagesDone,
  syncStageProgress,
} from "./project.service.js";
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

// Post-v8.0 conviven los nombres de etapa nuevos (pipeline de 8 etapas) con los
// viejos (proyectos que no se migraron). El sync UTE tiene que reconocer ambos.
const UTE_STAGE_TYPES = [StageType.TRAMITACION_UTE, StageType.HABILITACION_UTE];
const UTE_STAGE_NAMES: string[] = ["TRAMITACION_UTE", "HABILITACION_UTE"];
const POST_HABILITACION_NAMES: string[] = ["POST_HABILITACION", "POSTVENTA"];
const ULTIMA_OPERACIONES_NAMES: string[] = ["EJECUCION_OBRA", "OPERACIONES"];

async function findHabilitacionStage(tx: Tx, projectId: string) {
  return tx.stage.findFirst({
    where: { projectId, name: { in: UTE_STAGE_TYPES }, deletedAt: null },
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
    await advancePostventaOnUteFinalizado(uteProcess);
    await calculateProjectProgress(uteProcess.projectId);
  }
}

/**
 * Avance automático del pipeline al finalizar el trámite UTE.
 *
 * Cuando el trámite quedó finalizado, completa la etapa POSTVENTA (Post-
 * Habilitación) del pipeline con la fecha de finalización del trámite y, si con
 * eso TODAS las etapas quedan COMPLETED, marca el proyecto como COMPLETED
 * (reusando completeProjectIfAllStagesDone, la misma regla de cierre que usa
 * syncStageProgress).
 *
 * Reglas:
 *   - "Finalizado" = currentStage FINALIZADO o finalizedAt presente. Misma
 *     condición robusta que isUteFinalizado (clientes) y que el backfill: cubre
 *     ambos caminos de finalización (botón "finalizar" y carga de la fecha).
 *   - Idempotente: si POSTVENTA ya está COMPLETED, no hace nada.
 *   - Guarda: sólo avanza si HABILITACION_UTE ya está COMPLETED. POSTVENTA es
 *     "post-habilitación": nunca debe cerrarse antes que la habilitación. En el
 *     flujo normal syncStageProgress ya completó HABILITACION_UTE justo antes.
 *   - Fecha en cascada: finalizedAt ?? HABILITACION_UTE.actualEndDate ??
 *     OPERACIONES.actualEndDate. Si las tres son null NO inventa la fecha de hoy:
 *     loguea un warning y saltea el proyecto (caso a revisar a mano).
 *
 * Usa el `prisma` global (no `tx`), igual que syncStageProgress, con el que
 * comparte la suposición de que los callers pasan el cliente global.
 */
// Forma mínima de etapa que necesita la decisión de avance (testeable sin DB).
export type StageForAdvance = {
  id: string;
  name: string;
  status: string;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
};

export type PostventaAdvancePlan =
  | { action: "skip"; reason: PostventaSkipReason }
  | { action: "advance"; postventaId: string; completedAt: Date };

export type PostventaSkipReason =
  | "tramite-no-finalizado"
  | "sin-etapa-postventa"
  | "postventa-ya-completada"
  | "habilitacion-no-completada"
  | "sin-fecha";

/**
 * Decisión PURA (sin DB) del avance de POSTVENTA al finalizar el trámite UTE.
 * Separada de la escritura para poder testear todas las ramas sin tocar la base.
 * La explicación de cada regla está en advancePostventaOnUteFinalizado.
 */
export function planPostventaAdvance(
  ute: { currentStage: string; finalizedAt: Date | null },
  stages: StageForAdvance[],
): PostventaAdvancePlan {
  const finalizado = ute.currentStage === "FINALIZADO" || ute.finalizedAt !== null;
  if (!finalizado) return { action: "skip", reason: "tramite-no-finalizado" };

  const postventa = stages.find((s) => POST_HABILITACION_NAMES.includes(s.name));
  if (!postventa) return { action: "skip", reason: "sin-etapa-postventa" };
  if (postventa.status === "COMPLETED") return { action: "skip", reason: "postventa-ya-completada" };

  const habilitacion = stages.find((s) => UTE_STAGE_NAMES.includes(s.name));
  if (!habilitacion || habilitacion.status !== "COMPLETED") {
    return { action: "skip", reason: "habilitacion-no-completada" };
  }

  const operaciones = stages.find((s) => ULTIMA_OPERACIONES_NAMES.includes(s.name));
  const completedAt =
    ute.finalizedAt ?? habilitacion.actualEndDate ?? operaciones?.actualEndDate ?? null;
  if (!completedAt) return { action: "skip", reason: "sin-fecha" };

  return { action: "advance", postventaId: postventa.id, completedAt };
}

export async function advancePostventaOnUteFinalizado(uteProcess: UteProcess): Promise<void> {
  // Early-out barato (sin DB) para el caso común: la mayoría de los updates de
  // UTE no finalizan el trámite y regenerateUteSubstages corre en cada uno.
  if (uteProcess.currentStage !== "FINALIZADO" && uteProcess.finalizedAt === null) return;

  const stages = await prisma.stage.findMany({
    where: { projectId: uteProcess.projectId, deletedAt: null },
    select: { id: true, name: true, status: true, actualStartDate: true, actualEndDate: true },
  });

  const plan = planPostventaAdvance(uteProcess, stages);
  if (plan.action === "skip") {
    if (plan.reason === "sin-fecha") {
      console.warn(
        `[ute-sync] POSTVENTA no avanzada para proyecto ${uteProcess.projectId}: trámite ` +
          `finalizado pero sin fecha (finalizedAt / HABILITACION_UTE.actualEndDate / ` +
          `OPERACIONES.actualEndDate todas null). Se saltea — revisar a mano.`,
      );
    }
    return;
  }

  const postventa = stages.find((s) => s.id === plan.postventaId);

  await prisma.stage.update({
    where: { id: plan.postventaId },
    data: {
      status: "COMPLETED" as StageStatus,
      actualStartDate: postventa?.actualStartDate ?? plan.completedAt,
      actualEndDate: plan.completedAt,
      progressPercent: 100,
    },
  });

  // Ahora todas las etapas pueden estar COMPLETED → cerrar el proyecto con la
  // fecha del trámite (NO la de hoy).
  await completeProjectIfAllStagesDone(uteProcess.projectId, plan.completedAt);
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

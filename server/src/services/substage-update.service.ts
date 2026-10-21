// Edición de una subetapa del pipeline (estado, responsable, fechas, notas).
//
// Vivía entera dentro de la ruta PATCH /projects/:projectId/stages/:stageId/
// substages/:substageId. Se sacó acá para que el conector MCP (herramienta
// `marcar_subetapa`) cambie el estado por el MISMO camino que la pantalla: las
// mismas reglas duras (Onboarding definido, Pre-Ingeniería definida, obra con
// Operaciones en curso, subetapas de UTE bloqueadas), la misma auditoría, el
// aviso al responsable de la siguiente subetapa y el recálculo de avance que
// cierra la etapa y dispara el traspaso.
//
// Lo que NO está acá es la autorización: la ruta la resuelve con
// `authorizeByStageContext` (EDIT del módulo de la etapa, y además COMPLETE si
// se completa) y el conector con la matriz equivalente.

import {
  Prisma,
  StageStatus,
  StageType,
  SubstageStatus,
  type Substage,
  AuditEntityType,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { AppError, badRequest } from "../utils/errors.js";
import { diffInDays, parseDateOnly, todayUtc } from "../utils/dates.js";
import { createAuditEntriesForChanges } from "./audit.service.js";
import { definicionesPendientesOnboarding, SUBETAPA_MODALIDAD_PAGO } from "./checklist-evidencias.js";
import { getDatosTecnicosObra } from "./datos-tecnicos-obra.service.js";
import { calculateProjectProgress, syncStageProgress, syncSubstageProgress } from "./project.service.js";
import { markSubstageActivity } from "./substage-activity.service.js";
import { notifyNextSubstageOwner } from "./substage-notifications.service.js";
import { isUteManagedSubstage } from "./ute-sync.service.js";

export const substageFieldLabels: Record<string, string> = {
  name: "nombre de la subetapa",
  sopCode: "código SOP",
  responsableRol: "rol responsable",
  status: "estado de la subetapa",
  progressPercent: "avance de la subetapa",
  responsible: "responsable",
  userId: "usuario asignado",
  dueDate: "vencimiento",
  plannedStartDate: "inicio planificado",
  plannedEndDate: "fin planificado",
  actualStartDate: "inicio real",
  actualEndDate: "fin real",
  actualDurationDays: "duración real",
  delayDays: "desvío",
  notes: "notas",
  order: "orden",
  isActive: "visibilidad",
};

/**
 * Regla dura de Finanzas: el Onboarding no cierra sin saber cómo y cuándo paga el
 * cliente. Devuelve 409 DEFINICIONES_PENDIENTES con la lista de lo que falta, y la
 * pantalla abre el modal para completarlo y reintenta.
 */
export async function assertOnboardingDefinido(projectId: string) {
  const faltantes = await definicionesPendientesOnboarding(projectId);
  if (faltantes.length > 0) {
    throw new AppError(409, "DEFINICIONES_PENDIENTES", faltantes.map((f) => f.mensaje).join(" "), { projectId, faltantes });
  }
}

/**
 * Regla dura de Operaciones: la Pre-Ingeniería no cierra sin paneles, inversor,
 * fase y montaje cargados en Datos técnicos y coincidiendo con la pre-ingeniería.
 * Mismo 409 DEFINICIONES_PENDIENTES que el Onboarding: la pantalla lo muestra y
 * manda a la ficha a completarlo.
 */
export const SUBETAPA_DOCUMENTO_PREINGENIERIA = "Documento pre-ingeniería";

export async function assertPreIngenieriaDefinida(projectId: string) {
  const { faltantes } = await getDatosTecnicosObra(projectId);
  if (faltantes.length > 0) {
    throw new AppError(409, "DEFINICIONES_PENDIENTES", faltantes.map((f) => f.mensaje).join(" "), {
      projectId,
      etapa: "PRE_INGENIERIA",
      faltantes,
    });
  }
}

/**
 * ¿Resolver esta subetapa cierra la Pre-Ingeniería? Sí si es de esa etapa y es
 * el documento de pre-ingeniería (de donde salen los datos) o la última que
 * quedaba: la etapa se completa sola cuando se resuelven todas.
 */
export async function resolverSubetapaCierraPreIngenieria(substage: { id: string; stageId: string; name: string }) {
  const stage = await prisma.stage.findUnique({
    where: { id: substage.stageId },
    select: {
      name: true,
      substages: { where: { deletedAt: null, isActive: true }, select: { id: true, status: true } },
    },
  });
  if (stage?.name !== StageType.PRE_INGENIERIA) return false;
  if (substage.name === SUBETAPA_DOCUMENTO_PREINGENIERIA) return true;
  return stage.substages.every(
    (s) => s.id === substage.id || s.status === SubstageStatus.COMPLETED || s.status === SubstageStatus.NO_APLICA,
  );
}

// Regla 2: identifica si una subetapa es de ejecución de obra
// (la spec pide OPERACIONES_OBRA_PROPIA/TERCERIZADA pero esos enums no existen;
// las subetapas se identifican por nombre "Ejecución de Obra" bajo stage OPERACIONES)
export function isInstallationWorkSubstage(substageName: string, stage: { name: StageType }): boolean {
  if (stage.name !== StageType.OPERACIONES && stage.name !== StageType.EJECUCION_OBRA) return false;
  return substageName.toLowerCase().includes("ejecución de obra");
}

// Helper: valida que un userId corresponda a un usuario existente y activo.
// Devuelve los campos mínimos útiles del usuario validado. Usado al asignar
// responsables a Stage/Substage/Task y al consultar /my-tasks?userId=...
export async function assertUserActiveOrThrow(userId: string, fieldName = "userId") {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      role: { select: { name: true } },
    },
  });
  if (!user) {
    throw badRequest("INVALID_USER_ID", `El ${fieldName} indicado no corresponde a un usuario activo`);
  }
  return { id: user.id, name: user.name, role: user.role.name };
}

// Mantiene dueDate y deadline sincronizados (dueDate es espejo de deadline).
// Si el body trae `deadline`, manda deadline; si trae `dueDate`, lo replica a
// deadline; si trae ambos, prioriza deadline. En edición manual marca
// deadlineManuallySet=true para que el recálculo respete el override.
export function syncDeadlineDueDate(patch: { deadline?: Date | null; dueDate?: Date | null }): {
  deadline?: Date | null;
  dueDate?: Date | null;
  deadlineManuallySet?: boolean;
} {
  if (patch.deadline !== undefined) {
    return { deadline: patch.deadline, dueDate: patch.deadline, deadlineManuallySet: true };
  }
  if (patch.dueDate !== undefined) {
    return { deadline: patch.dueDate, dueDate: patch.dueDate, deadlineManuallySet: true };
  }
  return {};
}

/** Lo que se puede cambiar de una subetapa (mismo shape que `substagePatchSchema`). */
export interface SubstagePatch {
  name?: string;
  sopCode?: string | null;
  responsableRol?: string | null;
  status?: SubstageStatus;
  responsible?: string;
  userId?: string | null;
  dueDate?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  notes?: string | null;
}

/**
 * Valida las reglas de negocio de un cambio sin escribir nada. La usa
 * `actualizarSubetapa` y también el conector para la vista previa: si una regla
 * no se cumple, el chat lo dice antes de pedir confirmación.
 */
export async function validarCambioSubetapa(input: {
  projectId: string;
  stageId: string;
  substage: Substage;
  body: SubstagePatch;
}) {
  const { projectId, stageId, substage, body } = input;

  // Bloqueo: las subetapas system de HABILITACION_UTE (las 11 generadas
  // desde UteProcess) no permiten cambios de nombre, status, sopCode,
  // responsable* ni fechas planned/actual desde este endpoint. Sí permiten
  // userId, dueDate y notes.
  if (isUteManagedSubstage(substage)) {
    const blocked: Array<keyof SubstagePatch> = [
      "name",
      "sopCode",
      "responsableRol",
      "responsible",
      "plannedStartDate",
      "plannedEndDate",
      "status",
    ];
    for (const k of blocked) {
      if (body[k] !== undefined) {
        throw badRequest(
          "UTE_SUBSTAGE_LOCKED",
          "Esta subetapa se sincroniza automáticamente desde el módulo Trámites UTE. Sólo podés editar responsable, deadline y notas.",
        );
      }
    }
  }

  if (
    (body.status === SubstageStatus.COMPLETED || body.status === SubstageStatus.NO_APLICA) &&
    body.status !== substage.status &&
    substage.name === SUBETAPA_MODALIDAD_PAGO
  ) {
    await assertOnboardingDefinido(projectId);
  }
  if (
    (body.status === SubstageStatus.COMPLETED || body.status === SubstageStatus.NO_APLICA) &&
    body.status !== substage.status &&
    (await resolverSubetapaCierraPreIngenieria(substage))
  ) {
    await assertPreIngenieriaDefinida(projectId);
  }

  // Regla 2: no permitir iniciar/completar subetapa de ejecución si OPERACIONES no está activa
  if (
    body.status &&
    (body.status === SubstageStatus.IN_PROGRESS || body.status === SubstageStatus.COMPLETED) &&
    body.status !== substage.status
  ) {
    const stage = await prisma.stage.findUnique({
      where: { id: stageId },
      select: { name: true, status: true },
    });
    if (stage && isInstallationWorkSubstage(substage.name, stage) && stage.status !== StageStatus.IN_PROGRESS) {
      throw badRequest(
        "OPERATIONS_NOT_ACTIVE",
        "No podés iniciar la instalación si la etapa Operaciones no está en curso. Primero activá la etapa Operaciones.",
      );
    }
  }
}

/**
 * Aplica el cambio. Quien llama ya resolvió los permisos (EDIT del módulo de la
 * etapa, y COMPLETE si `body.status` es COMPLETED).
 *
 * `auditMetadata` se agrega a cada entrada de auditoría: el conector deja
 * `{ source: "mcp", tool }` para que se sepa que vino del chat.
 */
export async function actualizarSubetapa(input: {
  projectId: string;
  stageId: string;
  substage: Substage;
  body: SubstagePatch;
  userId: string;
  auditMetadata?: Prisma.InputJsonValue;
}) {
  const { projectId, stageId, substage, body, userId } = input;

  await validarCambioSubetapa({ projectId, stageId, substage, body });

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.sopCode !== undefined) updateData.sopCode = body.sopCode;
  if (body.responsableRol !== undefined) updateData.responsableRol = body.responsableRol;
  if (body.responsible !== undefined) updateData.responsible = body.responsible;
  if (body.userId !== undefined) {
    if (body.userId !== null) {
      await assertUserActiveOrThrow(body.userId, "userId");
    }
    updateData.userId = body.userId;
  }
  if (body.dueDate !== undefined) {
    // Editar dueDate sincroniza deadline (espejo) y marca override manual.
    const parsedDue = body.dueDate ? parseDateOnly(body.dueDate) : null;
    Object.assign(updateData, syncDeadlineDueDate({ dueDate: parsedDue }));
  }
  if (body.plannedStartDate !== undefined) updateData.plannedStartDate = body.plannedStartDate ? parseDateOnly(body.plannedStartDate) : null;
  if (body.plannedEndDate !== undefined) updateData.plannedEndDate = body.plannedEndDate ? parseDateOnly(body.plannedEndDate) : null;
  if (body.notes !== undefined) updateData.notes = body.notes;

  // G.3: cualquier cambio en una subetapa cuenta como "actividad"
  await markSubstageActivity(substage.id);

  if (body.status && body.status !== substage.status) {
    updateData.status = body.status;
    if (body.status === SubstageStatus.IN_PROGRESS) {
      updateData.actualStartDate = substage.actualStartDate ?? todayUtc();
    }
    if (body.status === SubstageStatus.COMPLETED) {
      const actualEndDate = todayUtc();
      const actualStartDate = substage.actualStartDate ?? actualEndDate;
      const actualDurationDays = Math.max(0, diffInDays(actualStartDate, actualEndDate));
      const plannedDurationDays =
        substage.plannedStartDate && substage.plannedEndDate
          ? Math.max(0, diffInDays(substage.plannedStartDate, substage.plannedEndDate))
          : 0;

      updateData.actualEndDate = actualEndDate;
      updateData.actualStartDate = actualStartDate;
      updateData.actualDurationDays = actualDurationDays;
      updateData.delayDays = actualDurationDays - plannedDurationDays;
      updateData.progressPercent = 100;
    }
    // G.3: si se reabre una subetapa completada → limpiar actualEndDate y duración
    if (substage.status === SubstageStatus.COMPLETED && body.status !== SubstageStatus.COMPLETED) {
      updateData.actualEndDate = null;
      updateData.actualDurationDays = null;
      updateData.delayDays = null;
    }
  }

  const updatedSubstage = await prisma.substage.update({
    where: { id: substage.id },
    data: updateData,
  });

  // G.3: si recién se completó esta subetapa, notificar al responsable de la
  // siguiente. Best-effort, no bloquea la respuesta si falla.
  if (body.status === SubstageStatus.COMPLETED && substage.status !== SubstageStatus.COMPLETED) {
    void notifyNextSubstageOwner(substage.id);
  }

  const syncedSubstage = await syncSubstageProgress(substage.id);
  const syncedStage = await syncStageProgress(stageId, { actorUserId: userId });
  await calculateProjectProgress(projectId);

  await createAuditEntriesForChanges({
    entityType: AuditEntityType.substage,
    entityId: substage.id,
    projectId,
    userId,
    oldData: substage,
    newData: { ...substage, ...updateData },
    labels: substageFieldLabels,
    formatter: ({ label, oldValue, newValue }) =>
      `Actualizó ${label} de subetapa '${substage.name}' de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`,
    ...(input.auditMetadata !== undefined ? { metadata: input.auditMetadata } : {}),
  });

  return { updatedSubstage, syncedSubstage, syncedStage };
}

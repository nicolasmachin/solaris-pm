import {
  AuditAction,
  AuditEntityType,
  PostHabilitacionSubFase,
  type Prisma,
  TraspasoEstado,
  TraspasoTipo,
} from "@prisma/client";

import { NotificationType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { createNotification } from "../notification.service.js";
import { TRASPASO_ADVANCE_STAGE, TRASPASO_LABEL } from "./catalogo.js";
import { calcularDestinatarios } from "./destinatarios.js";
import { notificarDestinatarios } from "./notificar.js";

// Crea un traspaso en PENDIENTE_CONFIRMACION. El modal se le muestra al actor
// que ejecutó la acción (modalUsuarioId). No dispara notificaciones todavía:
// eso ocurre al confirmar.
export async function crearTraspaso(params: {
  tipo: TraspasoTipo;
  projectId: string;
  actorUserId: string;
  payload?: Prisma.InputJsonValue;
}) {
  const traspaso = await prisma.traspaso.create({
    data: {
      tipo: params.tipo,
      projectId: params.projectId,
      modalUsuarioId: params.actorUserId,
      payload: params.payload ?? undefined,
    },
  });

  // Acuse: se notifica al actor (in-app) que tiene un traspaso para confirmar.
  // Recién al confirmarlo se notifica al área destino (ver confirmarTraspaso).
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { clientName: true },
    });
    await createNotification({
      userId: params.actorUserId,
      projectId: params.projectId,
      type: NotificationType.traspaso_por_confirmar,
      title: `Confirmá el traspaso: ${TRASPASO_LABEL[params.tipo]}`,
      message: `Disparaste un traspaso en "${project?.clientName ?? ""}". Entrá a Pendientes para confirmarlo y notificar al área correspondiente.`,
    });
  } catch (err) {
    console.error("[traspasos] no se pudo notificar al actor:", err);
  }

  return traspaso;
}

// Crea un traspaso solo si no existe ya uno del mismo (proyecto, tipo) en estado
// no cancelado. Idempotente: evita que el wiring por-etapa y los endpoints
// dedicados (T3/T5) disparen el mismo traspaso dos veces. Devuelve el existente
// o el recién creado. Best-effort: nunca interrumpe la acción que lo dispara.
export async function crearTraspasoSiNoExiste(params: {
  tipo: TraspasoTipo;
  projectId: string;
  actorUserId: string;
  payload?: Prisma.InputJsonValue;
}) {
  try {
    const existente = await prisma.traspaso.findFirst({
      where: {
        projectId: params.projectId,
        tipo: params.tipo,
        estado: { not: TraspasoEstado.CANCELADO },
      },
    });
    if (existente) return existente;
    return await crearTraspaso(params);
  } catch (err) {
    console.error(`[traspasos] no se pudo crear traspaso ${params.tipo} para ${params.projectId}:`, err);
    return null;
  }
}

// Confirma un traspaso: valida ownership, calcula destinatarios, los persiste,
// ejecuta el efecto-consecuencia (T7 → E3-A) y dispara las notificaciones.
export async function confirmarTraspaso(params: {
  traspasoId: string;
  userId: string;
  notaAlReceptor?: string | null;
  // Por defecto (true) avanza la etapa MOSTRADA del proyecto a la siguiente
  // (empujón hacia adelante). El usuario puede destildarlo en el popup.
  avanzarEtapa?: boolean;
}): Promise<{ traspasoId: string; notificacionesEnviadas: number }> {
  const traspaso = await prisma.traspaso.findUnique({
    where: { id: params.traspasoId },
    include: { project: { select: { id: true, clientName: true, postHabilitacionInicioEn: true } } },
  });
  if (!traspaso) throw notFound("TRASPASO_NOT_FOUND", "El traspaso no existe.");
  if (traspaso.estado !== TraspasoEstado.PENDIENTE_CONFIRMACION) {
    throw badRequest("TRASPASO_ESTADO_INVALIDO", `El traspaso ya está en estado ${traspaso.estado}.`);
  }
  if (traspaso.modalUsuarioId !== params.userId) {
    throw forbidden("Solo el usuario que originó el traspaso puede confirmarlo.");
  }

  const nota = params.notaAlReceptor?.trim() || null;

  const destinatarios = await calcularDestinatarios(traspaso.tipo, {
    payload: traspaso.payload,
    excludeUserId: params.userId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.traspaso.update({
      where: { id: traspaso.id },
      data: {
        estado: TraspasoEstado.CONFIRMADO,
        confirmadoEn: new Date(),
        confirmadoPorId: params.userId,
        notaAlReceptor: nota,
        modalMostradoEn: traspaso.modalMostradoEn ?? new Date(),
      },
    });
    if (destinatarios.length > 0) {
      await tx.traspasoDestinatario.createMany({
        data: destinatarios.map((d) => ({
          traspasoId: traspaso.id,
          usuarioId: d.usuarioId,
          esCopia: d.esCopia,
        })),
        skipDuplicates: true,
      });
    }

    // Actualización del proyecto: avance de etapa mostrada (si corresponde) +
    // efecto-consecuencia de T8. Se agrupa en un solo update.
    const projectData: Prisma.ProjectUpdateInput = {};

    // "Empujón hacia adelante": fija la etapa mostrada en la siguiente del
    // pipeline. Por defecto sí; getDisplayStage nunca la muestra hacia atrás.
    const avanzarEtapa = params.avanzarEtapa ?? true;
    const nuevaEtapa = avanzarEtapa ? TRASPASO_ADVANCE_STAGE[traspaso.tipo] : undefined;
    if (nuevaEtapa) projectData.stageOverride = nuevaEtapa;

    // Efecto-consecuencia de T8 (trámite UTE finalizado): arranca la sub-fase
    // E3-A del Post-Habilitación. Idempotente: no pisa una fecha ya seteada.
    // TODO(v3 C10): reconciliar con el auto-avance de ute-sync.service.ts para
    // no duplicar el avance a POSTVENTA (se resuelve en el item A / pipeline).
    if (traspaso.tipo === TraspasoTipo.T8_TRAMITE_UTE_FINALIZADO) {
      projectData.postHabilitacionSubFase = PostHabilitacionSubFase.E3_A_COMPROMISO_COMERCIAL;
      projectData.postHabilitacionInicioEn = traspaso.project.postHabilitacionInicioEn ?? new Date();
    }

    if (Object.keys(projectData).length > 0) {
      await tx.project.update({ where: { id: traspaso.projectId }, data: projectData });
    }
  });

  await createAuditEntry({
    entityType: AuditEntityType.traspaso,
    entityId: traspaso.id,
    projectId: traspaso.projectId,
    userId: params.userId,
    action: AuditAction.traspaso_confirmado,
    description: `Confirmó el traspaso "${TRASPASO_LABEL[traspaso.tipo]}" — notificó a ${destinatarios.length} destinatario(s).`,
  });

  // Notificaciones fuera de la transacción (best-effort).
  await notificarDestinatarios(
    {
      traspasoId: traspaso.id,
      tipo: traspaso.tipo,
      projectId: traspaso.projectId,
      projectName: traspaso.project.clientName,
      nota,
    },
    destinatarios,
  );

  return { traspasoId: traspaso.id, notificacionesEnviadas: destinatarios.length };
}

// Horas que dura el "posponer" antes de que el traspaso vuelva a aparecer.
export const POSPONER_HORAS = 6;

// Pospone un traspaso: lo oculta del popup y de la bandeja durante POSPONER_HORAS
// y evita que escale en ese lapso. Solo el usuario al que se le muestra el modal
// puede posponerlo. Al vencer `pospuestoHasta`, reaparece.
export async function posponerTraspaso(params: { traspasoId: string; userId: string }) {
  const traspaso = await prisma.traspaso.findUnique({ where: { id: params.traspasoId } });
  if (!traspaso) throw notFound("TRASPASO_NOT_FOUND", "El traspaso no existe.");
  if (traspaso.estado !== TraspasoEstado.PENDIENTE_CONFIRMACION) {
    throw badRequest("TRASPASO_ESTADO_INVALIDO", `El traspaso ya está en estado ${traspaso.estado}.`);
  }
  if (traspaso.modalUsuarioId !== params.userId) {
    throw forbidden("Solo el usuario que originó el traspaso puede posponerlo.");
  }

  const pospuestoHasta = new Date(Date.now() + POSPONER_HORAS * 60 * 60 * 1000);
  await prisma.traspaso.update({
    where: { id: traspaso.id },
    data: { pospuestoHasta },
  });

  await createAuditEntry({
    entityType: AuditEntityType.traspaso,
    entityId: traspaso.id,
    projectId: traspaso.projectId,
    userId: params.userId,
    action: AuditAction.traspaso_pospuesto,
    description: `Pospuso el traspaso "${TRASPASO_LABEL[traspaso.tipo]}" ${POSPONER_HORAS} horas.`,
  });

  return { traspasoId: traspaso.id, pospuestoHasta };
}

// Cancela un traspaso (caso excepcional: la condición se revirtió). Autorizado
// al usuario que lo originó (modalUsuario) o a un ADMIN.
export async function cancelarTraspaso(params: {
  traspasoId: string;
  userId: string;
  isAdmin?: boolean;
  motivo?: string | null;
}) {
  const traspaso = await prisma.traspaso.findUnique({ where: { id: params.traspasoId } });
  if (!traspaso) throw notFound("TRASPASO_NOT_FOUND", "El traspaso no existe.");
  if (traspaso.estado === TraspasoEstado.CANCELADO) {
    throw badRequest("TRASPASO_YA_CANCELADO", "El traspaso ya estaba cancelado.");
  }
  if (!params.isAdmin && traspaso.modalUsuarioId !== params.userId) {
    throw forbidden("Solo el usuario que originó el traspaso o un ADMIN pueden cancelarlo.");
  }

  await prisma.traspaso.update({
    where: { id: traspaso.id },
    data: { estado: TraspasoEstado.CANCELADO },
  });

  await createAuditEntry({
    entityType: AuditEntityType.traspaso,
    entityId: traspaso.id,
    projectId: traspaso.projectId,
    userId: params.userId,
    action: AuditAction.traspaso_cancelado,
    description: `Canceló el traspaso "${TRASPASO_LABEL[traspaso.tipo]}".${params.motivo ? ` Motivo: ${params.motivo}` : ""}`,
  });

  return { traspasoId: traspaso.id };
}

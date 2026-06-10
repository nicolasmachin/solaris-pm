// Servicio del módulo Informes: lógica de estado consolidado, visibilidad
// row-level (autor + destinatarios) y transiciones. Ver docs/features/informes/SPEC.md.

import { InformeEstado, InformeRespuesta, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, conflict, forbidden, notFound } from "../../utils/errors.js";
import { deleteStoredFile } from "../file-storage.service.js";
import { serializeDate } from "../../utils/serialization.js";

export type RequestUser = { id: string; role: string };

const ADMIN_ROLE = "ADMIN";

// ─── Estado consolidado (puro) ────────────────────────────────────────────────
// Regla: DEVUELTO gana sobre PENDIENTE sobre APROBADO. Defensivo: lista vacía → APROBADO.
export function calcularEstadoConsolidado(
  destinatarios: { respuesta: InformeRespuesta }[],
): Exclude<InformeEstado, "BORRADOR"> {
  if (destinatarios.some((d) => d.respuesta === InformeRespuesta.DEVUELTO)) {
    return InformeEstado.DEVUELTO;
  }
  if (destinatarios.some((d) => d.respuesta === InformeRespuesta.PENDIENTE)) {
    return InformeEstado.PENDIENTE;
  }
  return InformeEstado.APROBADO;
}

// ─── Validación de destinatarios ──────────────────────────────────────────────
async function validarDestinatarios(autorId: string, destinatariosIds: string[]): Promise<void> {
  const unicos = [...new Set(destinatariosIds)];
  if (unicos.length !== destinatariosIds.length) {
    throw badRequest("DESTINATARIOS_DUPLICADOS", "Hay destinatarios repetidos");
  }
  if (unicos.includes(autorId)) {
    throw badRequest("AUTOR_NO_DESTINATARIO", "El autor no puede ser destinatario de su propio informe");
  }
  const existentes = await prisma.user.count({
    where: { id: { in: unicos }, deletedAt: null },
  });
  if (existentes !== unicos.length) {
    throw badRequest("DESTINATARIO_INVALIDO", "Algún destinatario no existe o está inactivo");
  }
}

async function validarProyecto(projectId: string | null | undefined): Promise<void> {
  if (!projectId) return;
  const proyecto = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null }, select: { id: true } });
  if (!proyecto) throw badRequest("PROYECTO_INVALIDO", "La obra indicada no existe");
}

// ─── Serializadores ───────────────────────────────────────────────────────────
type InformeListRow = Prisma.InformeGetPayload<{
  include: {
    autor: { select: { id: true; name: true } };
    project: { select: { code: true; clientName: true } };
    destinatarios: { select: { respuesta: true } };
  };
}>;

function serializeListItem(i: InformeListRow) {
  const total = i.destinatarios.length;
  const respondidos = i.destinatarios.filter((d) => d.respuesta !== InformeRespuesta.PENDIENTE).length;
  return {
    id: i.id,
    titulo: i.titulo,
    estado: i.estado,
    autor: { id: i.autor.id, nombre: i.autor.name },
    projectId: i.projectId,
    project: i.project ? { codigo: i.project.code, nombre: i.project.clientName } : null,
    enviadoAt: serializeDate(i.enviadoAt),
    createdAt: serializeDate(i.createdAt),
    totalDestinatarios: total,
    respondidos,
  };
}

// ─── Crear (BORRADOR) ─────────────────────────────────────────────────────────
export async function crearInforme(
  autorId: string,
  input: { titulo: string; cuerpo: string; projectId?: string | null; destinatariosIds: string[] },
) {
  await validarDestinatarios(autorId, input.destinatariosIds);
  await validarProyecto(input.projectId);

  const creado = await prisma.informe.create({
    data: {
      titulo: input.titulo,
      cuerpo: input.cuerpo,
      estado: InformeEstado.BORRADOR,
      autorId,
      projectId: input.projectId ?? null,
      destinatarios: {
        create: [...new Set(input.destinatariosIds)].map((usuarioId) => ({ usuarioId })),
      },
    },
  });
  return creado;
}

// ─── Editar (solo BORRADOR + autor) ───────────────────────────────────────────
export async function editarInforme(
  id: string,
  autorId: string,
  input: { titulo?: string; cuerpo?: string; projectId?: string | null; destinatariosIds?: string[] },
) {
  const existing = await prisma.informe.findUnique({ where: { id }, select: { id: true, autorId: true, estado: true } });
  if (!existing) throw notFound("INFORME_NOT_FOUND", "Informe no encontrado");
  if (existing.autorId !== autorId) throw forbidden("Solo el autor puede editar el informe");
  if (existing.estado !== InformeEstado.BORRADOR) {
    throw conflict("INFORME_NO_BORRADOR", "Solo se puede editar un informe en estado BORRADOR");
  }

  if (input.destinatariosIds !== undefined) await validarDestinatarios(autorId, input.destinatariosIds);
  if (input.projectId !== undefined) await validarProyecto(input.projectId);

  return prisma.$transaction(async (tx) => {
    if (input.destinatariosIds !== undefined) {
      await tx.informeDestinatario.deleteMany({ where: { informeId: id } });
      await tx.informeDestinatario.createMany({
        data: [...new Set(input.destinatariosIds)].map((usuarioId) => ({ informeId: id, usuarioId })),
      });
    }
    return tx.informe.update({
      where: { id },
      data: {
        ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
        ...(input.cuerpo !== undefined ? { cuerpo: input.cuerpo } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      },
    });
  });
}

// ─── Listar (row-level + ADMIN) ───────────────────────────────────────────────
export async function listarInformes(
  user: RequestUser,
  filtros: { box?: "recibidos" | "enviados" | "todos"; estado?: InformeEstado; projectId?: string; search?: string },
) {
  const box = filtros.box ?? "todos";
  const esAdmin = user.role === ADMIN_ROLE;

  // Visibilidad por caja. Un BORRADOR solo lo ve su autor (nunca destinatario ni ADMIN).
  const soyAutor: Prisma.InformeWhereInput = { autorId: user.id };
  const soyDestinatarioEnviado: Prisma.InformeWhereInput = {
    destinatarios: { some: { usuarioId: user.id } },
    estado: { not: InformeEstado.BORRADOR },
  };

  let visibilidad: Prisma.InformeWhereInput;
  if (box === "enviados") {
    visibilidad = soyAutor;
  } else if (box === "recibidos") {
    visibilidad = soyDestinatarioEnviado;
  } else if (esAdmin) {
    // todos (ADMIN): todo salvo BORRADOR ajeno.
    visibilidad = { OR: [{ estado: { not: InformeEstado.BORRADOR } }, { autorId: user.id }] };
  } else {
    visibilidad = { OR: [soyAutor, soyDestinatarioEnviado] };
  }

  const where: Prisma.InformeWhereInput = {
    AND: [
      visibilidad,
      ...(filtros.estado ? [{ estado: filtros.estado }] : []),
      ...(filtros.projectId ? [{ projectId: filtros.projectId }] : []),
      ...(filtros.search ? [{ titulo: { contains: filtros.search, mode: "insensitive" as const } }] : []),
    ],
  };

  const rows = await prisma.informe.findMany({
    where,
    include: {
      autor: { select: { id: true, name: true } },
      project: { select: { code: true, clientName: true } },
      destinatarios: { select: { respuesta: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(serializeListItem);
}

// ─── Detalle (guard row-level estricto, también para ADMIN) ───────────────────
export async function obtenerInforme(id: string, user: RequestUser) {
  const informe = await prisma.informe.findUnique({
    where: { id },
    include: {
      autor: { select: { id: true, name: true } },
      project: { select: { code: true, clientName: true } },
      adjuntos: {
        where: { deletedAt: null },
        select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
      destinatarios: {
        include: { usuario: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!informe) throw notFound("INFORME_NOT_FOUND", "Informe no encontrado");

  const esAutor = informe.autorId === user.id;
  const esDestinatario = informe.destinatarios.some((d) => d.usuarioId === user.id);
  // BORRADOR solo lo ve el autor. El resto: autor o destinatario. ADMIN sin
  // relación NO accede al detalle (solo metadatos vía lista).
  const visible = esAutor || (esDestinatario && informe.estado !== InformeEstado.BORRADOR);
  if (!visible) throw forbidden("No tenés acceso a este informe");

  return {
    id: informe.id,
    titulo: informe.titulo,
    cuerpo: informe.cuerpo,
    estado: informe.estado,
    autor: { id: informe.autor.id, nombre: informe.autor.name },
    projectId: informe.projectId,
    project: informe.project ? { codigo: informe.project.code, nombre: informe.project.clientName } : null,
    enviadoAt: serializeDate(informe.enviadoAt),
    createdAt: serializeDate(informe.createdAt),
    adjuntos: informe.adjuntos.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdAt: serializeDate(a.createdAt),
      downloadUrl: `/api/informes/${informe.id}/adjuntos/${a.id}/download`,
      previewUrl: `/api/informes/${informe.id}/adjuntos/${a.id}/preview`,
    })),
    destinatarios: informe.destinatarios.map((d) => ({
      usuario: { id: d.usuario.id, nombre: d.usuario.name },
      respuesta: d.respuesta,
      comentario: d.comentario,
      respondidoAt: serializeDate(d.respondidoAt),
    })),
    // Flags útiles para la UI (sin lógica de permisos en cliente).
    puedeResponder: esDestinatario && informe.estado !== InformeEstado.BORRADOR,
    esAutor,
  };
}

// ─── Enviar (BORRADOR → PENDIENTE, solo autor) ────────────────────────────────
export async function enviarInforme(id: string, autorId: string) {
  const informe = await prisma.informe.findUnique({
    where: { id },
    select: { id: true, autorId: true, estado: true, _count: { select: { destinatarios: true } } },
  });
  if (!informe) throw notFound("INFORME_NOT_FOUND", "Informe no encontrado");
  if (informe.autorId !== autorId) throw forbidden("Solo el autor puede enviar el informe");
  if (informe.estado !== InformeEstado.BORRADOR) {
    throw conflict("INFORME_NO_BORRADOR", "El informe ya fue enviado");
  }
  if (informe._count.destinatarios < 1) {
    throw badRequest("SIN_DESTINATARIOS", "El informe necesita al menos un destinatario para enviarse");
  }

  return prisma.informe.update({
    where: { id },
    data: { estado: InformeEstado.PENDIENTE, enviadoAt: new Date() },
  });
}

// ─── Responder (destinatario; transaccional; definitivo) ──────────────────────
export async function responderInforme(
  id: string,
  usuarioId: string,
  input: { respuesta: "APROBADO" | "DEVUELTO"; comentario?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const informe = await tx.informe.findUnique({ where: { id }, select: { id: true, estado: true } });
    if (!informe) throw notFound("INFORME_NOT_FOUND", "Informe no encontrado");
    // El recálculo nunca opera sobre BORRADOR.
    if (informe.estado === InformeEstado.BORRADOR) {
      throw conflict("INFORME_BORRADOR", "No se puede responder un informe en borrador");
    }

    const destinatario = await tx.informeDestinatario.findUnique({
      where: { informeId_usuarioId: { informeId: id, usuarioId } },
      select: { id: true, respuesta: true },
    });
    if (!destinatario) throw forbidden("No sos destinatario de este informe");
    if (destinatario.respuesta !== InformeRespuesta.PENDIENTE) {
      throw conflict("RESPUESTA_DEFINITIVA", "Ya respondiste este informe; la respuesta es definitiva");
    }

    const nuevaRespuesta =
      input.respuesta === "DEVUELTO" ? InformeRespuesta.DEVUELTO : InformeRespuesta.APROBADO;

    await tx.informeDestinatario.update({
      where: { id: destinatario.id },
      data: {
        respuesta: nuevaRespuesta,
        comentario: input.comentario ?? null,
        respondidoAt: new Date(),
      },
    });

    // Releer TODOS los destinatarios dentro de la transacción para recalcular
    // sin race condition entre respuestas concurrentes.
    const todos = await tx.informeDestinatario.findMany({
      where: { informeId: id },
      select: { respuesta: true },
    });
    const estado = calcularEstadoConsolidado(todos);

    const actualizado = await tx.informe.update({
      where: { id },
      data: { estado },
    });
    return { informe: actualizado, estado };
  });
}

// ─── Borrar (solo BORRADOR + autor; limpia archivos físicos) ──────────────────
export async function borrarInforme(id: string, autorId: string): Promise<void> {
  const informe = await prisma.informe.findUnique({
    where: { id },
    select: { id: true, autorId: true, estado: true, adjuntos: { select: { url: true } } },
  });
  if (!informe) throw notFound("INFORME_NOT_FOUND", "Informe no encontrado");
  if (informe.autorId !== autorId) throw forbidden("Solo el autor puede borrar el informe");
  if (informe.estado !== InformeEstado.BORRADOR) {
    throw conflict("INFORME_NO_BORRADOR", "Solo se puede borrar un informe en borrador");
  }

  // Cascade borra destinatarios y filas FileAttachment; los archivos físicos NO,
  // así que se limpian a mano (best-effort).
  await prisma.informe.delete({ where: { id } });
  await Promise.all(informe.adjuntos.map((a) => deleteStoredFile(a.url).catch(() => undefined)));
}

// ─── Contador de pendientes (badge): donde soy destinatario PENDIENTE ─────────
export async function contarPendientes(usuarioId: string): Promise<number> {
  return prisma.informeDestinatario.count({
    where: {
      usuarioId,
      respuesta: InformeRespuesta.PENDIENTE,
      informe: { estado: { not: InformeEstado.BORRADOR } },
    },
  });
}

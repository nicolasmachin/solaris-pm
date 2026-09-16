// Preguntas y aportes del equipo debajo de cada video de capacitación.
//
// Reutiliza el modelo `Comment` (el mismo de proyectos, leads y tareas) con
// `capacitacionVideoId`. Quien puede ver el video puede leer y escribir; borrar
// y editar es del autor, y quien gestiona el módulo puede borrar cualquiera
// (moderación).

import { AuditAction, AuditEntityType, NotificationType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { createNotification } from "../notification.service.js";
import { type CapUser, puedeGestionar, videoParaComentarios } from "./capacitacion.service.js";

const MAX_LARGO = 4000;

const autorSelect = { id: true, name: true } as const;

function serializar(c: {
  id: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  isEdited: boolean;
  author: { id: string; name: string };
}) {
  return {
    id: c.id,
    contenido: c.content,
    autorId: c.author.id,
    autorNombre: c.author.name,
    createdAt: c.createdAt.toISOString(),
    editadoAt: c.editedAt?.toISOString() ?? null,
    editado: c.isEdited,
  };
}

export async function listarComentarios(videoId: string, user: CapUser) {
  await videoParaComentarios(videoId, user);
  const comentarios = await prisma.comment.findMany({
    where: { capacitacionVideoId: videoId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      editedAt: true,
      isEdited: true,
      author: { select: autorSelect },
    },
  });
  return comentarios.map(serializar);
}

export async function crearComentario(videoId: string, user: CapUser, contenido: string) {
  const texto = contenido.trim();
  if (!texto) throw badRequest("COMENTARIO_VACIO", "Escribí algo antes de enviar");
  if (texto.length > MAX_LARGO) throw badRequest("COMENTARIO_LARGO", "El comentario es demasiado largo");

  const video = await videoParaComentarios(videoId, user);
  const comentario = await prisma.comment.create({
    data: { content: texto, authorId: user.id, capacitacionVideoId: videoId },
    select: {
      id: true,
      content: true,
      createdAt: true,
      editedAt: true,
      isEdited: true,
      author: { select: autorSelect },
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.comment,
    entityId: comentario.id,
    userId: user.id,
    action: AuditAction.comment_added,
    description: `Comentó en el video de capacitación '${video.titulo}'`,
  });

  await notificarParticipantes(videoId, video, comentario.author.name, texto, user.id);
  return serializar(comentario);
}

/**
 * Avisa a quien cargó el video y a quienes ya participaron del hilo, menos a
 * quien acaba de escribir. Nunca frena el comentario si la notificación falla.
 */
async function notificarParticipantes(
  videoId: string,
  video: { titulo: string; listaId: string },
  autorNombre: string,
  texto: string,
  autorId: string,
) {
  try {
    const previos = await prisma.comment.findMany({
      where: { capacitacionVideoId: videoId, deletedAt: null },
      select: { authorId: true },
      distinct: ["authorId"],
    });
    const destinatarios = new Set(previos.map((p) => p.authorId));
    const cargadoPor = await prisma.capacitacionVideo.findUnique({
      where: { id: videoId },
      select: { createdById: true },
    });
    if (cargadoPor) destinatarios.add(cargadoPor.createdById);
    destinatarios.delete(autorId);
    if (destinatarios.size === 0) return;

    const resumen = texto.length > 140 ? `${texto.slice(0, 140)}…` : texto;
    const link = `/capacitacion/lista/${video.listaId}?v=${videoId}`;
    await Promise.all(
      [...destinatarios].map((userId) =>
        createNotification({
          userId,
          type: NotificationType.capacitacion_comentario,
          title: `${autorNombre} comentó en "${video.titulo}"`,
          message: resumen,
          link,
        }),
      ),
    );
  } catch (error) {
    console.error("[capacitacion] no se pudo notificar el comentario:", error);
  }
}

async function comentarioPropioOModerable(comentarioId: string, user: CapUser) {
  const comentario = await prisma.comment.findFirst({
    where: { id: comentarioId, capacitacionVideoId: { not: null }, deletedAt: null },
    select: { id: true, authorId: true, capacitacionVideoId: true, content: true },
  });
  if (!comentario) throw notFound("COMENTARIO_NOT_FOUND", "Comentario no encontrado");
  // Que el comentario exista no alcanza: hay que poder ver el video.
  await videoParaComentarios(comentario.capacitacionVideoId!, user);
  return comentario;
}

export async function editarComentario(comentarioId: string, user: CapUser, contenido: string) {
  const texto = contenido.trim();
  if (!texto) throw badRequest("COMENTARIO_VACIO", "Escribí algo antes de guardar");
  const comentario = await comentarioPropioOModerable(comentarioId, user);
  // Editar es solo del autor: nadie puede cambiar las palabras de otro.
  if (comentario.authorId !== user.id) throw forbidden("Solo el autor puede editar su comentario");
  const actualizado = await prisma.comment.update({
    where: { id: comentarioId },
    data: { content: texto, isEdited: true, editedAt: new Date() },
    select: {
      id: true,
      content: true,
      createdAt: true,
      editedAt: true,
      isEdited: true,
      author: { select: autorSelect },
    },
  });
  return serializar(actualizado);
}

export async function borrarComentario(comentarioId: string, user: CapUser) {
  const comentario = await comentarioPropioOModerable(comentarioId, user);
  const moderador = await puedeGestionar(user);
  if (comentario.authorId !== user.id && !moderador) {
    throw forbidden("Solo el autor o quien gestiona capacitación puede borrar el comentario");
  }
  await prisma.comment.update({ where: { id: comentarioId }, data: { deletedAt: new Date() } });
  await createAuditEntry({
    entityType: AuditEntityType.comment,
    entityId: comentarioId,
    userId: user.id,
    action: AuditAction.comment_deleted,
    description: `Borró un comentario de capacitación${comentario.authorId === user.id ? "" : " (moderación)"}`,
  });
}

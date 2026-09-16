// Módulo Capacitación: secciones por área → listas de reproducción → videos de
// Bunny Stream, más documentos subidos por sección (opcionalmente de una lista).
//
// Visibilidad (row-level, se valida en CADA lectura, además de CAPACITACION:VIEW):
//   - quien tiene CAPACITACION:EDIT ve todas las secciones (activas o no);
//   - el resto ve solo las secciones activas donde su rol figura en
//     `CapacitacionSeccionRol`.
// Una sección que el usuario no puede ver responde 404, no 403: no se revela
// que existe.

import type { MultipartFile } from "@fastify/multipart";
import { Action, Module, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { hasPermission } from "../../middleware/authorize.middleware.js";
import { badRequest, conflict, notFound } from "../../utils/errors.js";
import {
  BUNNY_STATUS_FINISHED,
  bunnyLibraryId,
  firmarEmbed,
  listarTodosLosVideos,
  obtenerVideo,
  type BunnyVideo,
} from "../bunny-stream.service.js";
import { deleteStoredFile, getStoredFilePath, saveUploadedFile } from "../file-storage.service.js";

export type CapUser = { id: string; role: string };

// Un video se da por visto al llegar a este porcentaje: los últimos segundos
// suelen ser créditos o silencio y mucha gente corta antes.
export const UMBRAL_COMPLETADO = 0.9;

// ─── Helpers puros (testeables) ─────────────────────────────────────────────

export function alcanzaUmbral(segundos: number, duracionSeg: number | null | undefined) {
  if (!duracionSeg || duracionSeg <= 0) return false;
  return segundos >= duracionSeg * UMBRAL_COMPLETADO;
}

/**
 * Nuevo estado de una vista. `segundosVistos` guarda el máximo alcanzado.
 * `completado` explícito (botón manual) manda; si no viene, se completa sola al
 * pasar el umbral y nunca se "descompleta" sola.
 */
export function resolverProgreso(input: {
  previoSegundos: number;
  previoCompletadoAt: Date | null;
  segundos: number;
  duracionSeg: number | null;
  completado?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const segundosVistos = Math.max(input.previoSegundos, Math.max(0, Math.floor(input.segundos)));
  let completadoAt = input.previoCompletadoAt;
  if (input.completado === true) completadoAt = completadoAt ?? now;
  else if (input.completado === false) completadoAt = null;
  else if (!completadoAt && alcanzaUmbral(segundosVistos, input.duracionSeg)) completadoAt = now;
  return { segundosVistos, completadoAt };
}

/** Orden para un array de ids: valida que sea exactamente el conjunto esperado. */
export function validarOrden(idsNuevos: string[], idsActuales: string[]) {
  const a = new Set(idsNuevos);
  if (a.size !== idsNuevos.length) return false;
  if (a.size !== idsActuales.length) return false;
  return idsActuales.every((id) => a.has(id));
}

// ─── Visibilidad ────────────────────────────────────────────────────────────

export async function puedeGestionar(user: CapUser) {
  return hasPermission(user.role, Module.CAPACITACION, Action.EDIT);
}

async function whereSeccionVisible(user: CapUser): Promise<Prisma.CapacitacionSeccionWhereInput> {
  if (await puedeGestionar(user)) return {};
  return { activa: true, roles: { some: { role: { name: user.role } } } };
}

async function assertSeccionVisible(seccionId: string, user: CapUser) {
  const seccion = await prisma.capacitacionSeccion.findFirst({
    where: { id: seccionId, ...(await whereSeccionVisible(user)) },
    select: { id: true, nombre: true, descripcion: true, activa: true },
  });
  if (!seccion) throw notFound("SECCION_NOT_FOUND", "Sección no encontrada");
  return seccion;
}

async function assertListaVisible(listaId: string, user: CapUser) {
  const lista = await prisma.capacitacionLista.findFirst({
    where: { id: listaId, deletedAt: null, seccion: await whereSeccionVisible(user) },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      seccionId: true,
      seccion: { select: { id: true, nombre: true } },
    },
  });
  if (!lista) throw notFound("LISTA_NOT_FOUND", "Lista no encontrada");
  return lista;
}

async function assertVideoVisible(videoId: string, user: CapUser) {
  const video = await prisma.capacitacionVideo.findFirst({
    where: {
      id: videoId,
      deletedAt: null,
      lista: { deletedAt: null, seccion: await whereSeccionVisible(user) },
    },
    select: { id: true, bunnyLibraryId: true, bunnyVideoId: true, duracionSeg: true },
  });
  if (!video) throw notFound("VIDEO_NOT_FOUND", "Video no encontrado");
  return video;
}

// ─── Serialización ──────────────────────────────────────────────────────────

const videoSelect = {
  id: true,
  listaId: true,
  bunnyVideoId: true,
  titulo: true,
  descripcion: true,
  duracionSeg: true,
  thumbnailFileName: true,
  orden: true,
} satisfies Prisma.CapacitacionVideoSelect;

const documentoSelect = {
  id: true,
  seccionId: true,
  listaId: true,
  titulo: true,
  descripcion: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  orden: true,
  createdAt: true,
} satisfies Prisma.CapacitacionDocumentoSelect;

type VideoRow = Prisma.CapacitacionVideoGetPayload<{ select: typeof videoSelect }>;
type DocumentoRow = Prisma.CapacitacionDocumentoGetPayload<{ select: typeof documentoSelect }>;
type VistaMap = Map<string, { segundosVistos: number; completadoAt: Date | null }>;

async function vistasDe(userId: string, videoIds: string[]): Promise<VistaMap> {
  if (videoIds.length === 0) return new Map();
  const vistas = await prisma.capacitacionVista.findMany({
    where: { userId, videoId: { in: videoIds } },
    select: { videoId: true, segundosVistos: true, completadoAt: true },
  });
  return new Map(vistas.map((v) => [v.videoId, v]));
}

/**
 * La miniatura la sirve la app, no el CDN de Bunny: el permiso se controla acá
 * y la URL no expone la biblioteca. El `?t=` (token corto) lo agrega el front.
 */
function urlMiniaturaApp(videoId: string, thumbnailFileName: string | null) {
  return thumbnailFileName ? `/api/capacitacion/videos/${videoId}/miniatura` : null;
}

function serializarVideo(v: VideoRow, vistas: VistaMap) {
  const vista = vistas.get(v.id);
  return {
    id: v.id,
    listaId: v.listaId,
    bunnyVideoId: v.bunnyVideoId,
    titulo: v.titulo,
    descripcion: v.descripcion,
    duracionSeg: v.duracionSeg,
    orden: v.orden,
    thumbnailUrl: urlMiniaturaApp(v.id, v.thumbnailFileName),
    segundosVistos: vista?.segundosVistos ?? 0,
    visto: Boolean(vista?.completadoAt),
  };
}

function serializarDocumento(d: DocumentoRow) {
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
    downloadUrl: `/api/capacitacion/documentos/${d.id}/download`,
    previewUrl: `/api/capacitacion/documentos/${d.id}/preview`,
  };
}

// ─── Consumo ────────────────────────────────────────────────────────────────

export async function listarSecciones(user: CapUser) {
  const gestiona = await puedeGestionar(user);
  const secciones = await prisma.capacitacionSeccion.findMany({
    where: await whereSeccionVisible(user),
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      activa: true,
      orden: true,
      roles: { select: { role: { select: { id: true, name: true, label: true } } } },
      listas: {
        where: { deletedAt: null },
        select: { videos: { where: { deletedAt: null }, select: { id: true, thumbnailFileName: true }, orderBy: { orden: "asc" } } },
        orderBy: { orden: "asc" },
      },
      _count: { select: { documentos: { where: { deletedAt: null } } } },
    },
  });

  const todosLosVideos = secciones.flatMap((s) => s.listas.flatMap((l) => l.videos.map((v) => v.id)));
  const vistas = await vistasDe(user.id, todosLosVideos);

  return secciones.map((s) => {
    const videos = s.listas.flatMap((l) => l.videos);
    const primero = videos[0];
    return {
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion,
      activa: s.activa,
      orden: s.orden,
      // Los roles solo le importan a quien gestiona.
      roles: gestiona ? s.roles.map((r) => r.role) : undefined,
      totalListas: s.listas.length,
      totalVideos: videos.length,
      totalDocumentos: s._count.documentos,
      videosVistos: videos.filter((v) => vistas.get(v.id)?.completadoAt).length,
      thumbnailUrl: primero ? urlMiniaturaApp(primero.id, primero.thumbnailFileName) : null,
    };
  });
}

export async function detalleSeccion(seccionId: string, user: CapUser) {
  const seccion = await assertSeccionVisible(seccionId, user);
  const [listas, documentos] = await Promise.all([
    prisma.capacitacionLista.findMany({
      where: { seccionId, deletedAt: null },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        titulo: true,
        descripcion: true,
        orden: true,
        videos: { where: { deletedAt: null }, orderBy: [{ orden: "asc" }, { createdAt: "asc" }], select: videoSelect },
      },
    }),
    prisma.capacitacionDocumento.findMany({
      where: { seccionId, deletedAt: null },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      select: documentoSelect,
    }),
  ]);
  const vistas = await vistasDe(user.id, listas.flatMap((l) => l.videos.map((v) => v.id)));
  return {
    ...seccion,
    listas: listas.map((l) => {
      const videos = l.videos.map((v) => serializarVideo(v, vistas));
      return {
        id: l.id,
        titulo: l.titulo,
        descripcion: l.descripcion,
        orden: l.orden,
        videos,
        duracionTotalSeg: videos.reduce((acc, v) => acc + (v.duracionSeg ?? 0), 0),
        videosVistos: videos.filter((v) => v.visto).length,
      };
    }),
    documentos: documentos.map(serializarDocumento),
  };
}

export async function detalleLista(listaId: string, user: CapUser) {
  const lista = await assertListaVisible(listaId, user);
  const [videos, documentos] = await Promise.all([
    prisma.capacitacionVideo.findMany({
      where: { listaId, deletedAt: null },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      select: videoSelect,
    }),
    prisma.capacitacionDocumento.findMany({
      where: { listaId, deletedAt: null },
      orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
      select: documentoSelect,
    }),
  ]);
  const vistas = await vistasDe(user.id, videos.map((v) => v.id));
  return {
    id: lista.id,
    titulo: lista.titulo,
    descripcion: lista.descripcion,
    seccion: lista.seccion,
    videos: videos.map((v) => serializarVideo(v, vistas)),
    documentos: documentos.map(serializarDocumento),
  };
}

/** Datos para servir la miniatura, validando que el usuario pueda ver el video. */
export async function miniaturaDeVideo(videoId: string, user: CapUser) {
  const video = await prisma.capacitacionVideo.findFirst({
    where: {
      id: videoId,
      deletedAt: null,
      lista: { deletedAt: null, seccion: await whereSeccionVisible(user) },
    },
    select: { bunnyVideoId: true, thumbnailFileName: true },
  });
  if (!video?.thumbnailFileName) throw notFound("MINIATURA_NOT_FOUND", "El video no tiene miniatura");
  return { bunnyVideoId: video.bunnyVideoId, thumbnailFileName: video.thumbnailFileName };
}

export async function embedVideo(videoId: string, user: CapUser) {
  const video = await assertVideoVisible(videoId, user);
  return firmarEmbed(video.bunnyLibraryId, video.bunnyVideoId);
}

export async function guardarProgreso(
  videoId: string,
  user: CapUser,
  input: { segundos: number; completado?: boolean },
) {
  const video = await assertVideoVisible(videoId, user);
  const previa = await prisma.capacitacionVista.findUnique({
    where: { userId_videoId: { userId: user.id, videoId } },
    select: { segundosVistos: true, completadoAt: true },
  });
  const next = resolverProgreso({
    previoSegundos: previa?.segundosVistos ?? 0,
    previoCompletadoAt: previa?.completadoAt ?? null,
    segundos: input.segundos,
    duracionSeg: video.duracionSeg,
    completado: input.completado,
  });
  const vista = await prisma.capacitacionVista.upsert({
    where: { userId_videoId: { userId: user.id, videoId } },
    create: { userId: user.id, videoId, ...next },
    update: next,
    select: { segundosVistos: true, completadoAt: true },
  });
  return { videoId, segundosVistos: vista.segundosVistos, visto: Boolean(vista.completadoAt) };
}

export async function documentoParaDescarga(documentoId: string, user: CapUser) {
  const doc = await prisma.capacitacionDocumento.findFirst({
    where: { id: documentoId, deletedAt: null, seccion: await whereSeccionVisible(user) },
    select: { filename: true, mimeType: true, url: true },
  });
  if (!doc) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  return { filename: doc.filename, mimeType: doc.mimeType, absolutePath: getStoredFilePath(doc.url) };
}

// ─── Gestión: secciones ─────────────────────────────────────────────────────

async function findSeccionOrThrow(id: string) {
  const s = await prisma.capacitacionSeccion.findUnique({ where: { id }, select: { id: true, nombre: true } });
  if (!s) throw notFound("SECCION_NOT_FOUND", "Sección no encontrada");
  return s;
}

async function validarRoles(roleIds: string[]) {
  const unicos = [...new Set(roleIds)];
  if (unicos.length === 0) return unicos;
  const existentes = await prisma.role.count({ where: { id: { in: unicos } } });
  if (existentes !== unicos.length) throw badRequest("ROL_INVALIDO", "Hay roles que no existen");
  return unicos;
}

export async function crearSeccion(input: { nombre: string; descripcion?: string | null; roleIds: string[] }) {
  const roleIds = await validarRoles(input.roleIds);
  const ultima = await prisma.capacitacionSeccion.aggregate({ _max: { orden: true } });
  return prisma.capacitacionSeccion.create({
    data: {
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      orden: (ultima._max.orden ?? -1) + 1,
      roles: { create: roleIds.map((roleId) => ({ roleId })) },
    },
    select: { id: true, nombre: true },
  });
}

export async function actualizarSeccion(
  id: string,
  input: { nombre?: string; descripcion?: string | null; activa?: boolean },
) {
  await findSeccionOrThrow(id);
  return prisma.capacitacionSeccion.update({ where: { id }, data: input, select: { id: true, nombre: true, activa: true } });
}

export async function asignarRolesSeccion(id: string, roleIdsInput: string[]) {
  await findSeccionOrThrow(id);
  const roleIds = await validarRoles(roleIdsInput);
  await prisma.$transaction([
    prisma.capacitacionSeccionRol.deleteMany({ where: { seccionId: id, roleId: { notIn: roleIds } } }),
    prisma.capacitacionSeccionRol.createMany({
      data: roleIds.map((roleId) => ({ seccionId: id, roleId })),
      skipDuplicates: true,
    }),
  ]);
  return roleIds;
}

export async function reordenarSecciones(ids: string[]) {
  const actuales = await prisma.capacitacionSeccion.findMany({ select: { id: true } });
  if (!validarOrden(ids, actuales.map((s) => s.id))) {
    throw badRequest("ORDEN_INVALIDO", "El orden no coincide con las secciones existentes");
  }
  await prisma.$transaction(ids.map((id, orden) => prisma.capacitacionSeccion.update({ where: { id }, data: { orden } })));
}

/** Solo se borra una sección vacía; con contenido se desactiva. */
export async function borrarSeccion(id: string) {
  const seccion = await findSeccionOrThrow(id);
  const [listas, documentos] = await Promise.all([
    prisma.capacitacionLista.count({ where: { seccionId: id, deletedAt: null } }),
    prisma.capacitacionDocumento.count({ where: { seccionId: id, deletedAt: null } }),
  ]);
  if (listas > 0 || documentos > 0) {
    throw conflict(
      "SECCION_CON_CONTENIDO",
      "La sección tiene listas o documentos. Quitalos primero, o desactivala para ocultarla.",
    );
  }
  await prisma.capacitacionSeccion.delete({ where: { id } });
  return seccion;
}

// ─── Gestión: listas ────────────────────────────────────────────────────────

async function findListaOrThrow(id: string) {
  const l = await prisma.capacitacionLista.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, titulo: true, seccionId: true },
  });
  if (!l) throw notFound("LISTA_NOT_FOUND", "Lista no encontrada");
  return l;
}

export async function crearLista(seccionId: string, input: { titulo: string; descripcion?: string | null }) {
  await findSeccionOrThrow(seccionId);
  const ultima = await prisma.capacitacionLista.aggregate({
    where: { seccionId, deletedAt: null },
    _max: { orden: true },
  });
  return prisma.capacitacionLista.create({
    data: {
      seccionId,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      orden: (ultima._max.orden ?? -1) + 1,
    },
    select: { id: true, titulo: true, seccionId: true },
  });
}

export async function actualizarLista(id: string, input: { titulo?: string; descripcion?: string | null }) {
  await findListaOrThrow(id);
  return prisma.capacitacionLista.update({ where: { id }, data: input, select: { id: true, titulo: true } });
}

export async function reordenarListas(seccionId: string, ids: string[]) {
  const actuales = await prisma.capacitacionLista.findMany({ where: { seccionId, deletedAt: null }, select: { id: true } });
  if (!validarOrden(ids, actuales.map((l) => l.id))) {
    throw badRequest("ORDEN_INVALIDO", "El orden no coincide con las listas de la sección");
  }
  await prisma.$transaction(ids.map((id, orden) => prisma.capacitacionLista.update({ where: { id }, data: { orden } })));
}

/** Soft delete. Los documentos asociados quedan en la sección, sin lista. */
export async function borrarLista(id: string) {
  const lista = await findListaOrThrow(id);
  await prisma.$transaction([
    prisma.capacitacionLista.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.capacitacionDocumento.updateMany({ where: { listaId: id }, data: { listaId: null } }),
  ]);
  return lista;
}

// ─── Gestión: videos ────────────────────────────────────────────────────────

type Omitido = { bunnyVideoId: string; titulo?: string; motivo: string };

/** Quita la extensión que suele quedar en el título de Bunny ("Embudo.mov"). */
export function limpiarTituloBunny(title: string) {
  return title.replace(/\.(mov|mp4|m4v|webm|mkv|avi|3gp)$/i, "").trim() || title;
}

async function agregarVideosBunny(listaId: string, videos: BunnyVideo[], userId: string) {
  const libraryId = bunnyLibraryId();
  const existentes = await prisma.capacitacionVideo.findMany({
    where: { listaId },
    select: { id: true, bunnyVideoId: true, deletedAt: true },
  });
  const porBunnyId = new Map(existentes.map((e) => [e.bunnyVideoId, e]));
  const ultima = await prisma.capacitacionVideo.aggregate({ where: { listaId, deletedAt: null }, _max: { orden: true } });
  let orden = (ultima._max.orden ?? -1) + 1;

  const agregados: string[] = [];
  const omitidos: Omitido[] = [];
  for (const v of videos) {
    if (v.status !== BUNNY_STATUS_FINISHED) {
      omitidos.push({ bunnyVideoId: v.guid, titulo: v.title, motivo: "Todavía se está procesando en Bunny" });
      continue;
    }
    const data = {
      bunnyLibraryId: libraryId,
      titulo: limpiarTituloBunny(v.title),
      descripcion: v.description,
      duracionSeg: v.length || null,
      thumbnailFileName: v.thumbnailFileName,
      orden: orden++,
    };
    const previo = porBunnyId.get(v.guid);
    if (previo && !previo.deletedAt) {
      omitidos.push({ bunnyVideoId: v.guid, titulo: v.title, motivo: "Ya está en la lista" });
      orden--;
      continue;
    }
    if (previo) {
      // Se había quitado: se reactiva (conserva el progreso de la gente).
      await prisma.capacitacionVideo.update({ where: { id: previo.id }, data: { ...data, deletedAt: null } });
      agregados.push(previo.id);
    } else {
      const creado = await prisma.capacitacionVideo.create({
        data: { ...data, listaId, bunnyVideoId: v.guid, createdById: userId },
        select: { id: true },
      });
      agregados.push(creado.id);
    }
  }
  return { agregados: agregados.length, omitidos };
}

export async function agregarVideos(listaId: string, bunnyVideoIds: string[], userId: string) {
  await findListaOrThrow(listaId);
  const videos: BunnyVideo[] = [];
  const noEncontrados: Omitido[] = [];
  for (const id of [...new Set(bunnyVideoIds)]) {
    try {
      videos.push(await obtenerVideo(id));
    } catch (error) {
      if ((error as { code?: string }).code === "BUNNY_NO_ENCONTRADO") {
        noEncontrados.push({ bunnyVideoId: id, motivo: "No existe en la biblioteca de Bunny" });
      } else {
        throw error;
      }
    }
  }
  const r = await agregarVideosBunny(listaId, videos, userId);
  return { agregados: r.agregados, omitidos: [...noEncontrados, ...r.omitidos] };
}

export async function importarColeccion(
  seccionId: string,
  input: { collectionId: string; titulo: string },
  userId: string,
) {
  const videos = await listarTodosLosVideos(input.collectionId);
  if (videos.length === 0) throw badRequest("COLECCION_VACIA", "La colección no tiene videos");
  // Bunny devuelve primero los más nuevos; en una lista de capacitación el orden
  // natural es el de carga.
  videos.sort((a, b) => a.dateUploaded.localeCompare(b.dateUploaded));
  const lista = await crearLista(seccionId, { titulo: input.titulo });
  const r = await agregarVideosBunny(lista.id, videos, userId);
  return { lista, ...r };
}

async function findVideoOrThrow(id: string) {
  const v = await prisma.capacitacionVideo.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, titulo: true, listaId: true },
  });
  if (!v) throw notFound("VIDEO_NOT_FOUND", "Video no encontrado");
  return v;
}

export async function actualizarVideo(id: string, input: { titulo?: string; descripcion?: string | null }) {
  await findVideoOrThrow(id);
  return prisma.capacitacionVideo.update({ where: { id }, data: input, select: { id: true, titulo: true } });
}

export async function reordenarVideos(listaId: string, ids: string[]) {
  const actuales = await prisma.capacitacionVideo.findMany({ where: { listaId, deletedAt: null }, select: { id: true } });
  if (!validarOrden(ids, actuales.map((v) => v.id))) {
    throw badRequest("ORDEN_INVALIDO", "El orden no coincide con los videos de la lista");
  }
  await prisma.$transaction(ids.map((id, orden) => prisma.capacitacionVideo.update({ where: { id }, data: { orden } })));
}

/** Soft delete: no toca Bunny ni el progreso guardado. */
export async function quitarVideo(id: string) {
  const video = await findVideoOrThrow(id);
  await prisma.capacitacionVideo.update({ where: { id }, data: { deletedAt: new Date() } });
  return video;
}

// ─── Gestión: documentos ────────────────────────────────────────────────────

async function validarListaDeSeccion(listaId: string | null | undefined, seccionId: string) {
  if (!listaId) return null;
  const lista = await prisma.capacitacionLista.findFirst({
    where: { id: listaId, seccionId, deletedAt: null },
    select: { id: true },
  });
  if (!lista) throw badRequest("LISTA_INVALIDA", "La lista no pertenece a la sección");
  return lista.id;
}

export async function subirDocumento(
  seccionId: string,
  file: MultipartFile,
  input: { titulo?: string; descripcion?: string | null; listaId?: string | null },
  userId: string,
) {
  await findSeccionOrThrow(seccionId);
  const listaId = await validarListaDeSeccion(input.listaId, seccionId);
  const saved = await saveUploadedFile(file, `capacitacion/${seccionId}`);
  const ultima = await prisma.capacitacionDocumento.aggregate({
    where: { seccionId, deletedAt: null },
    _max: { orden: true },
  });
  const titulo = input.titulo?.trim() || saved.filename.replace(/\.[^.]+$/, "");
  const doc = await prisma.capacitacionDocumento.create({
    data: {
      seccionId,
      listaId,
      titulo,
      descripcion: input.descripcion ?? null,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      orden: (ultima._max.orden ?? -1) + 1,
      uploadedById: userId,
    },
    select: documentoSelect,
  });
  return serializarDocumento(doc);
}

async function findDocumentoOrThrow(id: string) {
  const d = await prisma.capacitacionDocumento.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, titulo: true, seccionId: true, url: true },
  });
  if (!d) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  return d;
}

export async function actualizarDocumento(
  id: string,
  input: { titulo?: string; descripcion?: string | null; listaId?: string | null },
) {
  const doc = await findDocumentoOrThrow(id);
  const data: Prisma.CapacitacionDocumentoUncheckedUpdateInput = {
    titulo: input.titulo,
    descripcion: input.descripcion,
  };
  if (input.listaId !== undefined) data.listaId = await validarListaDeSeccion(input.listaId, doc.seccionId);
  const actualizado = await prisma.capacitacionDocumento.update({ where: { id }, data, select: documentoSelect });
  return serializarDocumento(actualizado);
}

export async function reordenarDocumentos(seccionId: string, ids: string[]) {
  const actuales = await prisma.capacitacionDocumento.findMany({
    where: { seccionId, deletedAt: null },
    select: { id: true },
  });
  if (!validarOrden(ids, actuales.map((d) => d.id))) {
    throw badRequest("ORDEN_INVALIDO", "El orden no coincide con los documentos de la sección");
  }
  await prisma.$transaction(ids.map((id, orden) => prisma.capacitacionDocumento.update({ where: { id }, data: { orden } })));
}

/** Soft delete de la fila + borrado del archivo físico (patrón de adjuntos). */
export async function borrarDocumento(id: string) {
  const doc = await findDocumentoOrThrow(id);
  await prisma.capacitacionDocumento.update({ where: { id }, data: { deletedAt: new Date() } });
  await deleteStoredFile(doc.url);
  return doc;
}

// ─── Seguimiento ────────────────────────────────────────────────────────────

/**
 * Avance de cada persona por lista. Por sección se consideran los usuarios
 * activos de los roles asignados a esa sección, más cualquiera que ya tenga
 * progreso en sus videos (ej. un gestor que la miró, o un rol que se quitó).
 */
export async function seguimiento(seccionId?: string) {
  const secciones = await prisma.capacitacionSeccion.findMany({
    where: seccionId ? { id: seccionId } : {},
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      nombre: true,
      activa: true,
      roles: { select: { roleId: true } },
      listas: {
        where: { deletedAt: null },
        orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
        select: { id: true, titulo: true, videos: { where: { deletedAt: null }, select: { id: true } } },
      },
    },
  });
  if (seccionId && secciones.length === 0) throw notFound("SECCION_NOT_FOUND", "Sección no encontrada");

  const videoIds = secciones.flatMap((s) => s.listas.flatMap((l) => l.videos.map((v) => v.id)));
  const vistas = videoIds.length
    ? await prisma.capacitacionVista.findMany({
        where: { videoId: { in: videoIds }, user: { deletedAt: null } },
        select: { userId: true, videoId: true, completadoAt: true, updatedAt: true },
      })
    : [];
  const roleIds = [...new Set(secciones.flatMap((s) => s.roles.map((r) => r.roleId)))];
  const usuarios = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [{ roleId: { in: roleIds } }, { id: { in: [...new Set(vistas.map((v) => v.userId))] } }],
    },
    select: { id: true, name: true, roleId: true, role: { select: { label: true } } },
    orderBy: { name: "asc" },
  });

  return secciones.map((s) => {
    const rolesSeccion = new Set(s.roles.map((r) => r.roleId));
    const videoALista = new Map<string, string>();
    for (const l of s.listas) for (const v of l.videos) videoALista.set(v.id, l.id);
    const vistasSeccion = vistas.filter((v) => videoALista.has(v.videoId));
    const conProgreso = new Set(vistasSeccion.map((v) => v.userId));
    const totalVideos = videoALista.size;

    const filas = usuarios
      .filter((u) => rolesSeccion.has(u.roleId) || conProgreso.has(u.id))
      .map((u) => {
        const propias = vistasSeccion.filter((v) => v.userId === u.id);
        const porLista: Record<string, number> = {};
        let completados = 0;
        let ultimaActividad: Date | null = null;
        for (const v of propias) {
          if (!ultimaActividad || v.updatedAt > ultimaActividad) ultimaActividad = v.updatedAt;
          if (!v.completadoAt) continue;
          completados++;
          const listaId = videoALista.get(v.videoId)!;
          porLista[listaId] = (porLista[listaId] ?? 0) + 1;
        }
        return {
          userId: u.id,
          nombre: u.name,
          rol: u.role.label,
          fueraDeRoles: !rolesSeccion.has(u.roleId),
          completados,
          totalVideos,
          porLista,
          ultimaActividad: ultimaActividad?.toISOString() ?? null,
        };
      });

    return {
      id: s.id,
      nombre: s.nombre,
      activa: s.activa,
      listas: s.listas.map((l) => ({ id: l.id, titulo: l.titulo, totalVideos: l.videos.length })),
      usuarios: filas,
    };
  });
}

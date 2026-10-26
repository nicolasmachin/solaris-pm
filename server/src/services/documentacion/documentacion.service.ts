// Módulo Documentación (intranet): manuales, procedimientos y reglamentos de
// uso interno, con historial de versiones y confirmación de lectura.
//
// Visibilidad: cada documento declara qué roles lo ven (DocumentoRol). Quien
// tiene DOCUMENTACION:EDIT ve todos, también los inactivos.
// La versión vigente es siempre la más nueva; las anteriores quedan para
// consulta. Los manuales del equipo llegan solos con el deploy: ver
// sincronizar-manuales.ts.

import { createHash } from "node:crypto";
import fsPromises from "node:fs/promises";

import type { MultipartFile } from "@fastify/multipart";
import { Action, DocumentoOrigen, Module, NotificationType, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { hasPermission } from "../../middleware/authorize.middleware.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { firmarTokenDescarga } from "../../utils/token-descarga.js";
import { deleteStoredFile, getStoredFilePath, saveUploadedFile } from "../file-storage.service.js";
import { createNotification } from "../notification.service.js";

export type DocUser = { id: string; role: string };

export const TOKEN_DESCARGA = "documento-version";
const CARPETA = "documentacion";
const ROL_CLIENTE = "CLIENT";

export async function puedeGestionar(user: DocUser) {
  return hasPermission(user.role, Module.DOCUMENTACION, Action.EDIT);
}

async function whereVisible(user: DocUser): Promise<Prisma.DocumentoWhereInput> {
  if (await puedeGestionar(user)) return { deletedAt: null };
  return { deletedAt: null, activo: true, roles: { some: { role: { name: user.role } } } };
}

// ─── Serialización ──────────────────────────────────────────────────────────

const versionSelect = {
  id: true,
  version: true,
  vigenteDesde: true,
  notas: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
  publicadoPor: { select: { id: true, name: true } },
} satisfies Prisma.DocumentoVersionSelect;

type VersionRow = Prisma.DocumentoVersionGetPayload<{ select: typeof versionSelect }>;

function serializarVersion(v: VersionRow, user: DocUser) {
  const t = firmarTokenDescarga(user, TOKEN_DESCARGA, v.id, "2h");
  return {
    id: v.id,
    version: v.version,
    vigenteDesde: v.vigenteDesde ? v.vigenteDesde.toISOString().slice(0, 10) : null,
    notas: v.notas,
    filename: v.filename,
    mimeType: v.mimeType,
    sizeBytes: v.sizeBytes,
    createdAt: v.createdAt.toISOString(),
    // null = la publicó el deploy (manual sincronizado).
    publicadoPor: v.publicadoPor?.name ?? null,
    downloadUrl: `/api/documentacion/versiones/${v.id}/download?t=${encodeURIComponent(t)}`,
    previewUrl: `/api/documentacion/versiones/${v.id}/preview?t=${encodeURIComponent(t)}`,
  };
}

const documentoSelect = {
  id: true,
  slug: true,
  titulo: true,
  descripcion: true,
  categoria: true,
  origen: true,
  requiereLectura: true,
  orden: true,
  activo: true,
  updatedAt: true,
  roles: { select: { role: { select: { id: true, name: true, label: true } } } },
  versiones: { orderBy: { createdAt: "desc" }, take: 1, select: versionSelect },
  _count: { select: { versiones: true } },
} satisfies Prisma.DocumentoSelect;

type DocumentoRow = Prisma.DocumentoGetPayload<{ select: typeof documentoSelect }>;

function serializarDocumento(d: DocumentoRow, user: DocUser, leidas: Set<string>, gestor: boolean) {
  const vigente = d.versiones[0] ?? null;
  return {
    id: d.id,
    slug: d.slug,
    titulo: d.titulo,
    descripcion: d.descripcion,
    categoria: d.categoria,
    origen: d.origen,
    requiereLectura: d.requiereLectura,
    orden: d.orden,
    activo: d.activo,
    totalVersiones: d._count.versiones,
    vigente: vigente ? serializarVersion(vigente, user) : null,
    // Solo cuenta si el documento pide confirmar lectura.
    leida: vigente ? leidas.has(vigente.id) : false,
    roles: gestor ? d.roles.map((r) => r.role) : undefined,
  };
}

async function versionesLeidas(userId: string, versionIds: string[]) {
  if (versionIds.length === 0) return new Set<string>();
  const rows = await prisma.documentoLectura.findMany({
    where: { userId, versionId: { in: versionIds } },
    select: { versionId: true },
  });
  return new Set(rows.map((r) => r.versionId));
}

// ─── Consumo ────────────────────────────────────────────────────────────────

export async function listar(user: DocUser) {
  const gestor = await puedeGestionar(user);
  const docs = await prisma.documento.findMany({
    where: await whereVisible(user),
    orderBy: [{ categoria: "asc" }, { orden: "asc" }, { titulo: "asc" }],
    select: documentoSelect,
  });
  const leidas = await versionesLeidas(
    user.id,
    docs.flatMap((d) => (d.versiones[0] ? [d.versiones[0].id] : [])),
  );
  return docs.map((d) => serializarDocumento(d, user, leidas, gestor));
}

/** Cuántos documentos le piden a esta persona confirmar la lectura de su versión vigente. */
export async function pendientesDeLectura(user: DocUser) {
  const docs = await prisma.documento.findMany({
    where: {
      deletedAt: null,
      activo: true,
      requiereLectura: true,
      roles: { some: { role: { name: user.role } } },
    },
    select: { versiones: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
  });
  const vigentes = docs.flatMap((d) => (d.versiones[0] ? [d.versiones[0].id] : []));
  const leidas = await versionesLeidas(user.id, vigentes);
  return vigentes.filter((id) => !leidas.has(id)).length;
}

export async function detalle(id: string, user: DocUser) {
  const gestor = await puedeGestionar(user);
  const doc = await prisma.documento.findFirst({
    where: { id, ...(await whereVisible(user)) },
    select: {
      ...documentoSelect,
      versiones: { orderBy: { createdAt: "desc" }, select: versionSelect },
    },
  });
  if (!doc) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  const vigente = doc.versiones[0];
  const leidas = await versionesLeidas(user.id, vigente ? [vigente.id] : []);
  return {
    ...serializarDocumento({ ...doc, versiones: vigente ? [vigente] : [] }, user, leidas, gestor),
    versiones: doc.versiones.map((v) => serializarVersion(v, user)),
    lecturas: gestor && doc.requiereLectura && vigente ? await lecturasDeVersion(doc.id, vigente.id) : undefined,
  };
}

/**
 * Quién leyó la versión vigente. Se consideran los usuarios activos de los
 * roles del documento, más cualquiera que la haya confirmado (un gestor, o
 * alguien de un rol que después se quitó).
 */
async function lecturasDeVersion(documentoId: string, versionId: string) {
  const [roles, lecturas] = await Promise.all([
    prisma.documentoRol.findMany({ where: { documentoId }, select: { roleId: true } }),
    prisma.documentoLectura.findMany({ where: { versionId }, select: { userId: true, leidoAt: true } }),
  ]);
  const leidoPor = new Map(lecturas.map((l) => [l.userId, l.leidoAt]));
  const usuarios = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [{ roleId: { in: roles.map((r) => r.roleId) } }, { id: { in: [...leidoPor.keys()] } }],
    },
    select: { id: true, name: true, role: { select: { label: true } } },
    orderBy: { name: "asc" },
  });
  return usuarios.map((u) => ({
    userId: u.id,
    nombre: u.name,
    rol: u.role.label,
    leidoAt: leidoPor.get(u.id)?.toISOString() ?? null,
  }));
}

/** "Leí esta versión". Solo vale para la vigente: confirmar una vieja no dice nada. */
export async function confirmarLectura(documentoId: string, user: DocUser) {
  const doc = await prisma.documento.findFirst({
    where: { id: documentoId, ...(await whereVisible(user)) },
    select: { versiones: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, version: true } } },
  });
  const vigente = doc?.versiones[0];
  if (!vigente) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  await prisma.documentoLectura.upsert({
    where: { versionId_userId: { versionId: vigente.id, userId: user.id } },
    create: { versionId: vigente.id, userId: user.id },
    update: {},
  });
  return { versionId: vigente.id, version: vigente.version };
}

export async function versionParaDescarga(versionId: string, user: DocUser) {
  const v = await prisma.documentoVersion.findFirst({
    where: { id: versionId, documento: await whereVisible(user) },
    select: { filename: true, mimeType: true, url: true },
  });
  if (!v) throw notFound("VERSION_NOT_FOUND", "Versión no encontrada");
  return { filename: v.filename, mimeType: v.mimeType, absolutePath: getStoredFilePath(v.url) };
}

// ─── Gestión ────────────────────────────────────────────────────────────────

export async function rolesAsignables() {
  return prisma.role.findMany({
    where: { name: { not: ROL_CLIENTE } },
    select: { id: true, name: true, label: true },
    orderBy: { label: "asc" },
  });
}

async function validarRoles(roleIds: string[]) {
  const unicos = [...new Set(roleIds)];
  if (unicos.length === 0) return unicos;
  const existentes = await prisma.role.count({ where: { id: { in: unicos }, name: { not: ROL_CLIENTE } } });
  if (existentes !== unicos.length) throw badRequest("ROL_INVALIDO", "Hay roles que no existen");
  return unicos;
}

async function findDocumentoOrThrow(id: string) {
  const d = await prisma.documento.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, titulo: true, origen: true, requiereLectura: true, activo: true },
  });
  if (!d) throw notFound("DOCUMENTO_NOT_FOUND", "Documento no encontrado");
  return d;
}

async function sha256DeArchivo(absolutePath: string) {
  return createHash("sha256").update(await fsPromises.readFile(absolutePath)).digest("hex");
}

type DatosDocumento = {
  titulo: string;
  descripcion?: string | null;
  categoria: string;
  requiereLectura: boolean;
  roleIds: string[];
};

type DatosVersion = { version: string; vigenteDesde?: string | null; notas?: string | null };

/** Documento nuevo subido a mano, con su primera versión. */
export async function crearDocumento(file: MultipartFile, datos: DatosDocumento & DatosVersion, userId: string) {
  const roleIds = await validarRoles(datos.roleIds);
  const saved = await saveUploadedFile(file, CARPETA);
  const sha256 = await sha256DeArchivo(saved.absolutePath);
  const ultimo = await prisma.documento.aggregate({
    where: { categoria: datos.categoria, deletedAt: null },
    _max: { orden: true },
  });
  const doc = await prisma.documento.create({
    data: {
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      categoria: datos.categoria,
      requiereLectura: datos.requiereLectura,
      origen: DocumentoOrigen.SUBIDO,
      orden: (ultimo._max.orden ?? -1) + 1,
      roles: { create: roleIds.map((roleId) => ({ roleId })) },
      versiones: {
        create: {
          version: datos.version,
          vigenteDesde: datos.vigenteDesde ? new Date(datos.vigenteDesde) : null,
          notas: datos.notas ?? null,
          filename: saved.filename,
          storedFilename: saved.storedFilename,
          mimeType: saved.mimeType,
          sizeBytes: saved.sizeBytes,
          url: saved.url,
          sha256,
          publicadoPorId: userId,
        },
      },
    },
    select: { id: true, titulo: true },
  });
  await avisarNuevaVersion(doc.id, datos.version, userId);
  return doc;
}

/** Versión nueva subida a mano. También sirve para un manual sincronizado (una corrección urgente). */
export async function subirVersion(documentoId: string, file: MultipartFile, datos: DatosVersion, userId: string) {
  const doc = await findDocumentoOrThrow(documentoId);
  const saved = await saveUploadedFile(file, CARPETA);
  const v = await prisma.documentoVersion.create({
    data: {
      documentoId,
      version: datos.version,
      vigenteDesde: datos.vigenteDesde ? new Date(datos.vigenteDesde) : null,
      notas: datos.notas ?? null,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      sha256: await sha256DeArchivo(saved.absolutePath),
      publicadoPorId: userId,
    },
    select: { id: true, version: true },
  });
  await prisma.documento.update({ where: { id: documentoId }, data: { updatedAt: new Date() } });
  await avisarNuevaVersion(documentoId, datos.version, userId);
  return { ...v, titulo: doc.titulo };
}

export async function actualizarDocumento(
  id: string,
  datos: Partial<DatosDocumento> & { activo?: boolean },
) {
  await findDocumentoOrThrow(id);
  const roleIds = datos.roleIds ? await validarRoles(datos.roleIds) : undefined;
  return prisma.$transaction(async (tx) => {
    if (roleIds) {
      await tx.documentoRol.deleteMany({ where: { documentoId: id } });
      await tx.documentoRol.createMany({ data: roleIds.map((roleId) => ({ documentoId: id, roleId })) });
    }
    return tx.documento.update({
      where: { id },
      data: {
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        categoria: datos.categoria,
        requiereLectura: datos.requiereLectura,
        activo: datos.activo,
      },
      select: { id: true, titulo: true },
    });
  });
}

/**
 * Baja de un documento subido a mano: soft delete y borrado de sus archivos.
 * Un manual sincronizado no se borra (el próximo deploy lo volvería a crear):
 * se desactiva, o se lo saca del manifiesto.
 */
export async function borrarDocumento(id: string) {
  const doc = await findDocumentoOrThrow(id);
  if (doc.origen === DocumentoOrigen.MANUAL_SINCRONIZADO) {
    throw badRequest(
      "DOCUMENTO_SINCRONIZADO",
      "Este manual se publica solo con cada deploy: desactivalo en vez de borrarlo",
    );
  }
  const versiones = await prisma.documentoVersion.findMany({ where: { documentoId: id }, select: { url: true } });
  await prisma.documento.update({ where: { id }, data: { deletedAt: new Date() } });
  for (const v of versiones) await deleteStoredFile(v.url);
  return doc;
}

// ─── Avisos ─────────────────────────────────────────────────────────────────

/**
 * Notificación a la gente de los roles del documento. Si pide lectura, el aviso
 * lo dice; si no, es solo informativo. Quien la publicó no se avisa a sí mismo.
 */
export async function avisarNuevaVersion(documentoId: string, version: string, autorId: string | null) {
  const doc = await prisma.documento.findUnique({
    where: { id: documentoId },
    select: { titulo: true, activo: true, requiereLectura: true, roles: { select: { roleId: true } } },
  });
  if (!doc || !doc.activo || doc.roles.length === 0) return 0;
  const usuarios = await prisma.user.findMany({
    where: { deletedAt: null, roleId: { in: doc.roles.map((r) => r.roleId) }, ...(autorId ? { id: { not: autorId } } : {}) },
    select: { id: true },
  });
  for (const u of usuarios) {
    await createNotification({
      userId: u.id,
      type: NotificationType.documento_nueva_version,
      title: `${doc.titulo}: versión ${version}`,
      message: doc.requiereLectura
        ? "Hay una versión nueva. Leela y confirmá la lectura en Documentación."
        : "Hay una versión nueva disponible en Documentación.",
      link: `/documentacion/${documentoId}`,
      uniqueKey: `doc-version:${documentoId}:${version}:${u.id}`,
    }).catch(() => undefined);
  }
  return usuarios.length;
}

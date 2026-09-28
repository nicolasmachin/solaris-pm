// REST endpoints del diseñador de gabinetes metálicos. Vive bajo el módulo
// INGENIERIA: es una herramienta más del workspace técnico del proyecto.
//
// Modelo de trabajo, igual que el resto de las herramientas que producen
// entregables: el diseño se edita in-place cuantas veces haga falta y "emitir"
// congela un snapshot + el PDF que se le manda al fabricante. Las láminas
// emitidas NO se pisan entre sí —cada una puede haber salido en un pedido
// distinto—, a diferencia del unifilar, que mantiene solo el plano vigente.

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { saveBufferAsAttachment } from "../services/file-storage.service.js";
import { buildGabineteSvgs, type GabineteInputs } from "../services/gabineteSvg/index.js";
import { gabineteSvgsToPdf } from "../services/gabineteSvg/pdf.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

const specExtraSchema = z.object({
  etiqueta: z.string().trim().min(1).max(60),
  valor: z.string().trim().max(120),
});

// Los rangos son generosos a propósito: un gabinete de medidor y uno de
// protecciones de obra grande no se parecen en nada. Solo atajan el error de
// tipeo (un 500 donde iban 50).
const designSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  anchoCm: z.number().positive().max(400),
  altoCm: z.number().positive().max(400),
  profundidadCm: z.number().positive().max(200),
  fondoAbierto: z.boolean().default(true),
  pestanaAmure: z.boolean().default(true),
  pestanaAnchoCm: z.number().min(0).max(30).default(3),
  // Medidas de taller: ninguna es nullable. Si el fabricante no especificó
  // algo, vale el default —una decisión tomada— y no un hueco que el taller
  // resuelva por su cuenta. Los valores tienen que coincidir con los @default
  // del schema de Prisma.
  //
  // No hay bisagras, cierre, ventilación, grado IP ni agujeros: el gabinete es
  // todo chapa plegada y se entrega sin herrajes y sin perforar.
  union: z.string().trim().min(1).max(120).default("Dos piezas en L atornilladas"),
  tornillos: z.string().trim().min(1).max(120).default("Tornillo punta mecha tipo T1"),
  solapeUnionCm: z.number().min(0).max(30).default(3),
  pasoTornillosCm: z.number().min(1).max(100).default(15),
  rebordeTapaCm: z.number().min(0).max(30).default(2),
  rebordeFrenteCm: z.number().min(0).max(30).default(2),
  solapeTapaCm: z.number().min(0).max(30).default(1),
  holguraTapaMm: z.number().min(0).max(50).default(2),
  material: z.string().trim().min(1).max(120).default("Chapa galvanizada en caliente"),
  espesorMm: z.number().positive().max(20).default(1.5),
  acabado: z.string().trim().min(1).max(120).default("Galvanizado"),
  toleranciaMm: z.number().min(0).max(50).default(2),
  cantidad: z.number().int().min(1).max(999).default(1),
  notas: z.string().trim().max(2000).optional().nullable(),
  specsExtra: z.array(specExtraSchema).max(20).default([]),
});

type DesignInput = z.infer<typeof designSchema>;

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaLarga(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Fila de la tabla (o payload del preview) → entradas del dibujo. */
export function toInputs(
  design: DesignInput & { specsExtra?: unknown },
  contexto: {
    cliente?: string | null;
    proyectoCodigo?: string | null;
    fecha?: Date;
    contacto?: GabineteInputs["contacto"];
  } = {},
): GabineteInputs {
  const specsExtra = Array.isArray(design.specsExtra)
    ? (design.specsExtra as GabineteInputs["specsExtra"])
    : [];
  return {
    titulo: design.nombre,
    anchoCm: design.anchoCm,
    altoCm: design.altoCm,
    profundidadCm: design.profundidadCm,
    fondoAbierto: design.fondoAbierto,
    pestanaAmure: design.pestanaAmure,
    pestanaAnchoCm: design.pestanaAnchoCm,
    union: design.union,
    tornillos: design.tornillos,
    solapeUnionCm: design.solapeUnionCm,
    pasoTornillosCm: design.pasoTornillosCm,
    rebordeTapaCm: design.rebordeTapaCm,
    rebordeFrenteCm: design.rebordeFrenteCm,
    solapeTapaCm: design.solapeTapaCm,
    holguraTapaMm: design.holguraTapaMm,
    material: design.material,
    espesorMm: design.espesorMm,
    acabado: design.acabado,
    toleranciaMm: design.toleranciaMm,
    cantidad: design.cantidad,
    notas: design.notas ?? null,
    specsExtra,
    cliente: contexto.cliente ?? null,
    proyectoCodigo: contexto.proyectoCodigo ?? null,
    fecha: fechaLarga(contexto.fecha ?? new Date()),
    contacto: contexto.contacto ?? null,
  };
}

function serializeDesign(d: {
  id: string;
  projectId: string;
  nombre: string;
  createdAt: Date;
  updatedAt: Date;
  versions?: { id: string; versionNumber: number; createdAt: Date; fileAttachmentId: string | null }[];
  _count?: { versions: number };
} & Record<string, unknown>) {
  const { versions, _count, createdAt, updatedAt, deletedAt: _deletedAt, ...rest } = d;
  return {
    ...rest,
    createdAt: serializeDate(createdAt),
    updatedAt: serializeDate(updatedAt),
    versionesCount: _count?.versions ?? versions?.length ?? 0,
    ultimaVersion: versions?.[0]
      ? {
          id: versions[0].id,
          versionNumber: versions[0].versionNumber,
          createdAt: serializeDate(versions[0].createdAt),
          fileAttachmentId: versions[0].fileAttachmentId,
        }
      : null,
  };
}

export async function registerGabineteRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ── Listado por proyecto ────────────────────────────────────────────────────
  app.get(
    "/projects/:projectId/gabinetes",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const designs = await prisma.cabinetDesign.findMany({
        where: { projectId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          _count: { select: { versions: true } },
        },
      });
      return designs.map(serializeDesign);
    },
  );

  // ── Detalle con historial de láminas ────────────────────────────────────────
  app.get(
    "/gabinetes/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const design = await prisma.cabinetDesign.findFirst({
        where: { id, deletedAt: null },
        include: { versions: { orderBy: { versionNumber: "desc" } } },
      });
      if (!design) throw notFound("GABINETE_NOT_FOUND", "Gabinete no encontrado");
      return {
        ...serializeDesign(design),
        versiones: design.versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          label: v.label,
          fileAttachmentId: v.fileAttachmentId,
          createdAt: serializeDate(v.createdAt),
        })),
      };
    },
  );

  // ── Alta ────────────────────────────────────────────────────────────────────
  app.post(
    "/projects/:projectId/gabinetes",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const body = designSchema.parse(request.body);

      const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const created = await prisma.cabinetDesign.create({
        data: { ...body, projectId, createdById: user.id },
        include: { _count: { select: { versions: true } } },
      });

      await createAuditEntry({
        entityType: "cabinet_design",
        entityId: created.id,
        projectId,
        userId: user.id,
        action: "created",
        description: `Creó el gabinete "${created.nombre}"`,
      });

      return serializeDesign(created);
    },
  );

  // ── Edición in-place (no versiona) ──────────────────────────────────────────
  app.patch(
    "/gabinetes/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = designSchema.partial().parse(request.body);

      const existing = await prisma.cabinetDesign.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("GABINETE_NOT_FOUND", "Gabinete no encontrado");

      const updated = await prisma.cabinetDesign.update({
        where: { id },
        data: body,
        include: { _count: { select: { versions: true } } },
      });

      await createAuditEntry({
        entityType: "cabinet_design",
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: "updated",
        description: `Editó el gabinete "${updated.nombre}"`,
      });

      return serializeDesign(updated);
    },
  );

  // ── Baja (soft) ─────────────────────────────────────────────────────────────
  app.delete(
    "/gabinetes/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.DELETE) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.cabinetDesign.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw notFound("GABINETE_NOT_FOUND", "Gabinete no encontrado");

      await prisma.cabinetDesign.update({ where: { id }, data: { deletedAt: new Date() } });
      await createAuditEntry({
        entityType: "cabinet_design",
        entityId: id,
        projectId: existing.projectId,
        userId: user.id,
        action: "deleted",
        description: `Eliminó el gabinete "${existing.nombre}"`,
      });

      // Las láminas ya emitidas quedan: son pedidos que el fabricante puede
      // tener en curso, y viven como documento del proyecto.
      return { success: true };
    },
  );

  // ── Preview en vivo ─────────────────────────────────────────────────────────
  // Devuelve el SVG sin persistir nada. Lo llama el constructor con debounce
  // mientras se cargan medidas: el dibujo se genera en un solo lugar (el
  // server), así el preview y el PDF nunca divergen.
  app.post(
    "/gabinetes/preview",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const body = z
        .object({ projectId: z.string().optional() })
        .and(designSchema)
        .parse(request.body);

      let cliente: string | null = null;
      let codigo: string | null = null;
      if (body.projectId) {
        const p = await prisma.project.findFirst({
          where: { id: body.projectId, deletedAt: null },
          select: { clientName: true, code: true },
        });
        cliente = p?.clientName ?? null;
        codigo = p?.code ?? null;
      }

      const user = ensureUser(request);
      const hojas = buildGabineteSvgs(
        toInputs(body, {
          cliente,
          proyectoCodigo: codigo,
          contacto: { nombre: user.name, email: user.email ?? null },
        }),
      );
      // JSON y no SVG suelto: la lámina tiene más de una hoja y el constructor
      // las muestra todas.
      return reply.send({ hojas });
    },
  );

  // ── Emitir lámina (versiona + PDF) ──────────────────────────────────────────
  app.post(
    "/gabinetes/:id/emitir",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const { label } = z
        .object({ label: z.string().trim().max(80).optional().nullable() })
        .parse(request.body ?? {});

      const design = await prisma.cabinetDesign.findFirst({
        where: { id, deletedAt: null },
        include: {
          project: { select: { id: true, clientName: true, code: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });
      if (!design) throw notFound("GABINETE_NOT_FOUND", "Gabinete no encontrado");

      const usuario = await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true, email: true, phone: true },
      });

      const inputs = toInputs(design as unknown as DesignInput, {
        cliente: design.project.clientName,
        proyectoCodigo: design.project.code,
        contacto: usuario
          ? { nombre: usuario.name, telefono: usuario.phone, email: usuario.email }
          : null,
      });

      let pdfBytes: Uint8Array;
      try {
        pdfBytes = await gabineteSvgsToPdf(buildGabineteSvgs(inputs));
      } catch (err) {
        request.log.error({ err }, "No se pudo generar el PDF del gabinete");
        throw badRequest("GABINETE_PDF_ERROR", "No se pudo generar la lámina");
      }

      const nextVersion = (design.versions[0]?.versionNumber ?? 0) + 1;
      const slug = design.nombre.replace(/[^\w-]+/g, "_").slice(0, 40);
      const stored = await saveBufferAsAttachment(
        Buffer.from(pdfBytes),
        `gabinete_${slug}_v${nextVersion}.pdf`,
        "application/pdf",
        design.projectId,
      );

      const attachment = await prisma.fileAttachment.create({
        data: {
          projectId: design.projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: "GABINETE",
          toolSource: "gabinete",
          toolVersion: nextVersion,
          toolEntityId: design.id,
          uploadedById: user.id,
        },
      });

      const version = await prisma.cabinetDesignVersion.create({
        data: {
          designId: design.id,
          versionNumber: nextVersion,
          label: label ?? null,
          snapshot: inputs as unknown as object,
          fileAttachmentId: attachment.id,
          createdById: user.id,
        },
      });

      await createAuditEntry({
        entityType: "cabinet_design",
        entityId: design.id,
        projectId: design.projectId,
        userId: user.id,
        action: "created",
        description: `Emitió la lámina v${nextVersion} del gabinete "${design.nombre}"`,
      });

      return {
        id: version.id,
        versionNumber: version.versionNumber,
        label: version.label,
        fileAttachmentId: attachment.id,
        createdAt: serializeDate(version.createdAt),
      };
    },
  );
}

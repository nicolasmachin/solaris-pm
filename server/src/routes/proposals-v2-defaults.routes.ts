// Endpoints de defaults del generador de propuestas v2.
// Ver docs/features/proposals-v2/SPEC.md (sección 15).
//   GET /api/proposals-v2/defaults   → VENTAS:VIEW
//   PUT /api/proposals-v2/defaults   → solo rol ADMIN
// La subida de la tapa PDF (POST .../defaults/cover) es de Fase D.

import { promises as fsPromises } from "node:fs";

import { Action, AuditAction, AuditEntityType, FileAttachmentTipo, Module, Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import {
  getStoredFilePath,
  saveBufferAsAttachment,
} from "../services/file-storage.service.js";
import { applyCoverOverlay } from "../services/proposal/coverOverlay.js";
import { badRequest, forbidden, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

const SINGLETON_ID = "singleton";

// La tapa es un PDF de Canva: 1 página, A4 vertical. Validamos contra las
// dimensiones A4 estándar (595.28 × 841.89 pt) con tolerancia, porque los
// exportadores reales raramente dan los enteros exactos 595 × 842.
const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const A4_TOLERANCE_PT = 3;
const COVER_MAX_BYTES = 5 * 1024 * 1024;

const ptToMm = (pt: number) => Math.round((pt / 72) * 25.4);

// Valida que el buffer sea un PDF de exactamente 1 página A4 vertical. Tira
// badRequest con mensaje claro si no cumple. Tiene en cuenta la rotación de la
// página (/Rotate 90|270 intercambia ancho/alto efectivos).
async function assertSingleA4PortraitPdf(buffer: Buffer): Promise<void> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch {
    throw badRequest("INVALID_PDF", "No se pudo leer el PDF. ¿Está dañado o protegido?");
  }

  const pageCount = doc.getPageCount();
  if (pageCount !== 1) {
    throw badRequest(
      "INVALID_PDF_PAGES",
      `El PDF debe tener exactamente 1 página. El subido tiene ${pageCount}.`,
    );
  }

  const page = doc.getPage(0);
  const size = page.getSize();
  const rotated = Math.abs(page.getRotation().angle % 180) === 90;
  const width = rotated ? size.height : size.width;
  const height = rotated ? size.width : size.height;

  if (width > height) {
    throw badRequest("INVALID_PDF_ORIENTATION", "La tapa debe ser A4 vertical, no horizontal.");
  }

  const okWidth = Math.abs(width - A4_WIDTH_PT) <= A4_TOLERANCE_PT;
  const okHeight = Math.abs(height - A4_HEIGHT_PT) <= A4_TOLERANCE_PT;
  if (!okWidth || !okHeight) {
    throw badRequest(
      "INVALID_PDF_SIZE",
      `La tapa debe ser A4 vertical (210 × 297 mm). El PDF subido tiene dimensiones ` +
        `${ptToMm(width)}×${ptToMm(height)} mm. Reexportá la tapa desde Canva como A4 vertical.`,
    );
  }
}

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

// Cada variable de defaults es { value, asesorCanOverride }.
const flaggedSchema = z
  .object({
    value: z.union([z.number(), z.string()]),
    asesorCanOverride: z.boolean(),
  })
  .strict();

// Subobjetos como `plazos`: record de variables flagged.
const nestedFlaggedSchema = z.record(z.string(), flaggedSchema);

// `data` completo: cada clave es una variable flagged o un subobjeto de flagged.
const dataSchema = z.record(z.string(), z.union([flaggedSchema, nestedFlaggedSchema]));

// Coordenadas del overlay de la tapa.
const overlayTextSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    fontSize: z.number(),
    color: z.string(),
    fontWeight: z.enum(["regular", "bold"]),
  })
  .strict();

const coverOverlaySchema = z
  .object({
    clientName: overlayTextSchema,
    city: overlayTextSchema,
    date: overlayTextSchema,
  })
  .strict();

const putBodySchema = z
  .object({
    data: dataSchema,
    coverOverlay: coverOverlaySchema,
  })
  .strict();

// Body de la vista previa: el overlay que el admin está probando (sin guardar).
const coverPreviewBodySchema = z.object({ config: coverOverlaySchema }).strict();

export async function registerProposalsV2DefaultsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Leer los defaults (cualquier rol con VENTAS:VIEW) ───────────────────
  app.get(
    "/proposals-v2/defaults",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async () => {
      const row = await prisma.proposalDefaults.findUnique({ where: { id: SINGLETON_ID } });
      if (!row) {
        // El seed todavía no se corrió: la UI muestra el aviso correspondiente.
        return {
          seeded: false,
          data: {},
          coverOverlay: null,
          coverPdfAttachmentId: null,
          updatedAt: null,
        };
      }
      return {
        seeded: true,
        data: row.data,
        coverOverlay: row.coverOverlay,
        coverPdfAttachmentId: row.coverPdfAttachmentId,
        updatedAt: serializeDate(row.updatedAt),
      };
    },
  );

  // ─── Actualizar los defaults (solo ADMIN) ────────────────────────────────
  app.put(
    "/proposals-v2/defaults",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      if (user.role !== "ADMIN") {
        throw forbidden("Solo un administrador puede editar los defaults de propuestas");
      }

      const body = putBodySchema.parse(request.body);

      const existing = await prisma.proposalDefaults.findUnique({ where: { id: SINGLETON_ID } });

      const row = await prisma.proposalDefaults.upsert({
        where: { id: SINGLETON_ID },
        create: {
          id: SINGLETON_ID,
          data: body.data,
          coverOverlay: body.coverOverlay,
          updatedById: user.id,
        },
        update: {
          data: body.data,
          coverOverlay: body.coverOverlay,
          updatedById: user.id,
        },
      });

      await createAuditEntry({
        entityType: AuditEntityType.setting,
        entityId: SINGLETON_ID,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "proposal_defaults",
        description: "Actualizó los defaults del generador de propuestas",
        metadata: {
          before: existing?.data ?? null,
          after: body.data,
        } as unknown as Prisma.InputJsonValue,
      });

      return {
        seeded: true,
        data: row.data,
        coverOverlay: row.coverOverlay,
        coverPdfAttachmentId: row.coverPdfAttachmentId,
        updatedAt: serializeDate(row.updatedAt),
      };
    },
  );

  // ─── Subir la tapa PDF (solo ADMIN) ──────────────────────────────────────
  // multipart/form-data { file: PDF }. Valida tipo + tamaño (5MB) + A4 vertical
  // 1 página. Crea un FileAttachment global (sin projectId) y apunta el
  // singleton a él. El attachment anterior queda huérfano a propósito.
  app.post(
    "/proposals-v2/defaults/cover",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      if (user.role !== "ADMIN") {
        throw forbidden("Solo un administrador puede subir la tapa de propuestas");
      }

      const existing = await prisma.proposalDefaults.findUnique({ where: { id: SINGLETON_ID } });
      if (!existing) {
        throw badRequest(
          "DEFAULTS_NOT_SEEDED",
          "Primero hay que inicializar los defaults de propuestas.",
        );
      }

      const part = await request.file();
      if (!part) throw badRequest("MISSING_FILE", "No se envió ningún archivo");
      if (part.mimetype !== "application/pdf") {
        throw badRequest(
          "INVALID_FILE_TYPE",
          `El archivo debe ser un PDF (application/pdf). El subido es ${part.mimetype}.`,
        );
      }

      const buffer = await part.toBuffer();
      if (buffer.length > COVER_MAX_BYTES) {
        const mb = (buffer.length / (1024 * 1024)).toFixed(1);
        throw badRequest(
          "FILE_TOO_LARGE",
          `El PDF excede el tamaño máximo de 5 MB. Tamaño actual: ${mb} MB.`,
        );
      }

      await assertSingleA4PortraitPdf(buffer);

      const safeName =
        part.filename && part.filename.toLowerCase().endsWith(".pdf") ? part.filename : "tapa.pdf";
      // projectId del storage = "proposals" (segmento de carpeta global). El
      // FileAttachment.projectId queda null: la tapa no pertenece a un proyecto.
      const stored = await saveBufferAsAttachment(buffer, safeName, "application/pdf", "proposals");

      const attachment = await prisma.fileAttachment.create({
        data: {
          projectId: null,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.OTRO,
          toolSource: "proposal-v2-cover",
          uploadedById: user.id,
        },
      });

      const row = await prisma.proposalDefaults.update({
        where: { id: SINGLETON_ID },
        data: { coverPdfAttachmentId: attachment.id, updatedById: user.id },
      });

      await createAuditEntry({
        entityType: AuditEntityType.setting,
        entityId: SINGLETON_ID,
        userId: user.id,
        action: AuditAction.file_uploaded,
        fieldChanged: "cover_pdf_attachment",
        description: "Subió un nuevo PDF de tapa para propuestas",
        metadata: {
          attachmentId: attachment.id,
          filename: stored.filename,
          sizeBytes: stored.sizeBytes,
        } as unknown as Prisma.InputJsonValue,
      });

      return {
        coverPdfAttachmentId: attachment.id,
        uploadedAt: serializeDate(row.updatedAt),
      };
    },
  );

  // ─── Descargar la tapa actual (para previsualizar en el Admin) ───────────
  app.get(
    "/proposals-v2/defaults/cover",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (_request, reply) => {
      const row = await prisma.proposalDefaults.findUnique({
        where: { id: SINGLETON_ID },
        select: { coverPdfAttachment: { select: { url: true } } },
      });
      const url = row?.coverPdfAttachment?.url;
      if (!url) {
        return reply.status(404).send({ message: "No hay tapa configurada" });
      }

      let buf: Buffer;
      try {
        buf = await fsPromises.readFile(getStoredFilePath(url));
      } catch {
        return reply.status(404).send({ message: "El archivo de tapa no está disponible" });
      }

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'inline; filename="tapa.pdf"');
      reply.header("Cache-Control", "no-store");
      return reply.send(buf);
    },
  );

  // ─── Vista previa de la tapa con overlay (solo ADMIN) ────────────────────
  // Aplica el `config` que el admin está probando (no el guardado) sobre la
  // tapa actual, con datos de ejemplo. Permite iterar coordenadas sin guardar.
  app.post(
    "/proposals-v2/defaults/cover/preview",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request, reply) => {
      const user = ensureUser(request);
      if (user.role !== "ADMIN") {
        throw forbidden("Solo un administrador puede previsualizar la tapa");
      }

      const { config } = coverPreviewBodySchema.parse(request.body);

      const row = await prisma.proposalDefaults.findUnique({
        where: { id: SINGLETON_ID },
        select: { coverPdfAttachment: { select: { url: true } } },
      });
      const url = row?.coverPdfAttachment?.url;
      if (!url) {
        return reply.status(404).send({ message: "No hay tapa configurada" });
      }

      let bytes: Buffer;
      try {
        bytes = await fsPromises.readFile(getStoredFilePath(url));
      } catch {
        return reply.status(404).send({ message: "El archivo de tapa no está disponible" });
      }

      const out = await applyCoverOverlay(bytes, config, {
        clientName: "Jose Gonzalez",
        city: "El Pinar, Uruguay.",
        date: "19 de junio de 2026",
      });

      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'inline; filename="tapa-preview.pdf"');
      reply.header("Cache-Control", "no-store");
      return reply.send(out);
    },
  );
}

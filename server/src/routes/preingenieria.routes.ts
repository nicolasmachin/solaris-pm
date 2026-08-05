// REST endpoints del generador de Pre-Ingeniería ("Resumen Técnico").
// Vive bajo el módulo INGENIERIA. Mismo patrón que `unifilar.routes.ts`:
// versionado 1:N inmutable, snapshot del cliente al crear, PDF persistido como
// FileAttachment con `toolSource="preing"`. Las fotos se suben antes via
// `upload-foto` y se asocian al crear la versión.

import { promises as fsPromises } from "node:fs";

import { Action, AuditAction, AuditEntityType, FileAttachmentTipo, Module } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { prisma } from "../lib/prisma.js";
import {
  deleteStoredFile,
  getStoredFilePath,
  saveBufferAsAttachment,
  saveUploadedFile,
} from "../services/file-storage.service.js";
import {
  generatePreIngenieriaPdf,
  type PreIngenieriaPdfFoto,
  type PreIngenieriaPdfInputs,
  type TipoTechoKey,
} from "../services/preingenieriaPdf/index.js";
import {
  extractFromMinuta,
  isMinutaExtractionEnabled,
} from "../services/minutaExtraction/index.js";
import { createAuditEntry } from "../services/audit.service.js";
import { esHeic } from "../services/heic.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

function ensureUser(request: import("fastify").FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

async function readStoredFileBuffer(absolutePath: string): Promise<Buffer> {
  return fsPromises.readFile(absolutePath);
}

const ALLOWED_PHOTO_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const tipoTechoEnum = z.enum(["ISOPANEL", "HORMIGON", "CHAPA", "TEJAS", "OTRO"]) satisfies z.ZodType<TipoTechoKey>;

const createBodySchema = z
  .object({
    label: z.string().trim().max(80).optional().nullable(),
    // Sitio
    tipoTecho: tipoTechoEnum.optional().nullable(),
    tipoTechoOtro: z.string().trim().max(100).optional().nullable(),
    infoTecho: z.string().trim().max(2000).optional().nullable(),
    alturaTecho: z.string().trim().max(50).optional().nullable(),
    // Eléctricos
    cantidadPaneles: z.string().trim().max(100).optional().nullable(),
    // Potencia por panel en Watts (entero positivo). Free-text legacy migró a
    // Int en DB (Fase A). El frontend envía number ahora.
    potenciaPaneles: z.number().int().positive().optional().nullable(),
    inversor: z.string().trim().max(150).optional().nullable(),
    stringsLineasDc: z.string().trim().max(50).optional().nullable(),
    cableAc: z.string().trim().max(100).optional().nullable(),
    termicaAc: z.string().trim().max(50).optional().nullable(),
    diferencialAc: z.string().trim().max(50).optional().nullable(),
    largoCablesAcMts: z.string().trim().max(20).optional().nullable(),
    largoCablesDcMts: z.string().trim().max(20).optional().nullable(),
    // Cliente (override editable del snapshot pre-rellenado)
    snapshotNombre: z.string().trim().min(1).max(150),
    snapshotDireccion: z.string().trim().max(200).optional().nullable(),
    snapshotCiudad: z.string().trim().max(100).optional().nullable(),
    snapshotCelular: z.string().trim().max(50).optional().nullable(),
    snapshotFechaPrevista: z.string().trim().max(80).optional().nullable(),
    // Red
    redMonofasica: z.boolean().default(false),
    redTrifasica230SN: z.boolean().default(false),
    redTrifasica400CN: z.boolean().default(false),
    // Notas
    notasAdicionales: z.string().trim().max(2000).optional().nullable(),
    // Trazabilidad
    unifilarVersionId: z.string().min(1).optional().nullable(),
    // Trazabilidad de extracción de minuta (opcional — sólo si se usó IA).
    minutaFileId: z.string().min(1).optional().nullable(),
    minutaModelUsed: z.string().max(80).optional().nullable(),
    // Fotos: orden + etiquetas indexadas por fileId
    fotosOrden: z.array(z.string().min(1)).default([]),
    fotosEtiquetas: z.record(z.string(), z.string().max(100)).optional().nullable(),
  })
  .strict();

type CreateBody = z.infer<typeof createBodySchema>;

function serializeVersionListItem(v: {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: Date;
}) {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    label: v.label,
    createdAt: serializeDate(v.createdAt),
  };
}

function inputsFromVersion(v: CreateBody & { snapshotNombre: string }): PreIngenieriaPdfInputs {
  return {
    snapshotNombre: v.snapshotNombre,
    snapshotDireccion: v.snapshotDireccion ?? null,
    snapshotCiudad: v.snapshotCiudad ?? null,
    snapshotCelular: v.snapshotCelular ?? null,
    snapshotFechaPrevista: v.snapshotFechaPrevista ?? null,
    tipoTecho: v.tipoTecho ?? null,
    tipoTechoOtro: v.tipoTechoOtro ?? null,
    infoTecho: v.infoTecho ?? null,
    alturaTecho: v.alturaTecho ?? null,
    cantidadPaneles: v.cantidadPaneles ?? null,
    // Coerce a string para el generador de PDF de pre-ingeniería (Fase A no
    // toca PDFs; el campo en PreIngenieriaPdfInputs sigue siendo string).
    potenciaPaneles: v.potenciaPaneles != null ? String(v.potenciaPaneles) : null,
    inversor: v.inversor ?? null,
    stringsLineasDc: v.stringsLineasDc ?? null,
    cableAc: v.cableAc ?? null,
    termicaAc: v.termicaAc ?? null,
    diferencialAc: v.diferencialAc ?? null,
    largoCablesAcMts: v.largoCablesAcMts ?? null,
    largoCablesDcMts: v.largoCablesDcMts ?? null,
    redMonofasica: v.redMonofasica,
    redTrifasica230SN: v.redTrifasica230SN,
    redTrifasica400CN: v.redTrifasica400CN,
    notasAdicionales: v.notasAdicionales ?? null,
  };
}

export async function registerPreIngenieriaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Subir foto (paso previo a crear versión) ────────────────────────────
  // Multipart: un solo archivo. Crea un FileAttachment "huérfano" con tipo
  // UPLOAD_MANUAL y sin toolSource — al crear la versión Pre-Ingeniería se
  // referencia desde PreIngenieriaFoto. Si la foto nunca se asocia (el usuario
  // cancela), queda como upload manual del proyecto (visible en Documentos).
  app.post(
    "/projects/:projectId/preingenieria-versions/upload-foto",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const projectId = (request.params as { projectId?: string }).projectId;
      if (!projectId) throw badRequest("MISSING_PROJECT_ID", "Falta projectId");

      const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const part = await request.file();
      if (!part) throw badRequest("MISSING_FILE", "No se envió ningún archivo");

      // El HEIC del iPhone pasa aunque no esté en la lista de mimetypes: hay
      // navegadores que no lo reconocen y mandan `application/octet-stream`, así
      // que se mira también la extensión. `saveUploadedFile` lo convierte a JPEG.
      if (!ALLOWED_PHOTO_MIMETYPES.has(part.mimetype.toLowerCase()) && !esHeic(part)) {
        throw badRequest(
          "INVALID_PHOTO_MIMETYPE",
          `Tipo de imagen no permitido: ${part.mimetype}. Usá JPG, PNG, WEBP o HEIC.`,
        );
      }

      const stored = await saveUploadedFile(part, projectId);

      const attachment = await prisma.fileAttachment.create({
        data: {
          projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          uploadedById: user.id,
        },
      });

      reply.code(201);
      return {
        fileId: attachment.id,
        filename: attachment.filename,
        size: attachment.sizeBytes,
      };
    },
  );

  // ─── Extracción IA de minuta ─────────────────────────────────────────────
  // Multipart: un PDF de minuta. 1) Persiste el PDF como FileAttachment con
  // tipo MINUTA_RELEVAMIENTO, 2) extrae texto, 3) llama Claude, 4) audita,
  // 5) devuelve campos sugeridos + minutaFileId. El frontend pre-rellena el
  // formulario con los campos y deja que el usuario edite antes de guardar.
  app.post(
    "/projects/:projectId/preingenieria/extract-from-minuta",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const projectId = (request.params as { projectId?: string }).projectId;
      if (!projectId) throw badRequest("MISSING_PROJECT_ID", "Falta projectId");

      if (!isMinutaExtractionEnabled()) {
        throw badRequest(
          "MINUTA_EXTRACTION_DISABLED",
          "ANTHROPIC_API_KEY no está configurada — la extracción IA está deshabilitada.",
        );
      }

      const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const part = await request.file();
      if (!part) throw badRequest("MISSING_FILE", "No se envió ningún archivo");

      if (part.mimetype.toLowerCase() !== "application/pdf") {
        throw badRequest(
          "INVALID_MINUTA_MIMETYPE",
          `Sólo se acepta PDF. Recibido: ${part.mimetype}.`,
        );
      }

      // 1) Persistir el PDF como FileAttachment ANTES de extraer (así si la
      //    extracción falla, el archivo queda y se puede reintentar).
      const stored = await saveUploadedFile(part, projectId);
      const attachment = await prisma.fileAttachment.create({
        data: {
          projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.MINUTA_RELEVAMIENTO,
          uploadedById: user.id,
        },
      });

      // 2) Leer el archivo del disco como buffer y extraer.
      const fileBuffer = await readStoredFileBuffer(stored.absolutePath);

      try {
        const result = await extractFromMinuta(fileBuffer);

        // 3) Auditar la extracción exitosa con métricas.
        await createAuditEntry({
          entityType: AuditEntityType.file,
          entityId: attachment.id,
          projectId,
          userId: user.id,
          action: AuditAction.file_uploaded,
          description: `Subió minuta y extrajo campos con IA (${result.metadata.modelUsed})`,
          metadata: {
            kind: "minuta_extraction",
            modelUsed: result.metadata.modelUsed,
            latencyMs: result.metadata.latencyMs,
            tokensInput: result.metadata.tokensInput,
            tokensOutput: result.metadata.tokensOutput,
            pdfSizeKb: Math.round(stored.sizeBytes / 1024),
          },
        });

        return {
          minutaFileId: attachment.id,
          extractedFields: result.extractedFields,
          metadata: result.metadata,
        };
      } catch (err) {
        // El FileAttachment queda; el cliente puede reintentar via /retry.
        request.log.error(
          { err, projectId, minutaFileId: attachment.id },
          "[minuta] error en extracción IA",
        );
        await createAuditEntry({
          entityType: AuditEntityType.file,
          entityId: attachment.id,
          projectId,
          userId: user.id,
          action: AuditAction.file_uploaded,
          description: `Subió minuta pero falló la extracción IA`,
          metadata: {
            kind: "minuta_extraction_error",
            error: err instanceof Error ? err.message : String(err),
            pdfSizeKb: Math.round(stored.sizeBytes / 1024),
          },
        });
        throw err;
      }
    },
  );

  // ─── Reintentar extracción de minuta ya subida ───────────────────────────
  // Útil si la primera llamada falló por timeout/rate limit.
  app.post(
    "/projects/:projectId/preingenieria/extract-from-minuta/retry",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const body = z.object({ minutaFileId: z.string().min(1) }).parse(request.body);

      if (!isMinutaExtractionEnabled()) {
        throw badRequest("MINUTA_EXTRACTION_DISABLED", "Extracción IA deshabilitada");
      }

      const att = await prisma.fileAttachment.findFirst({
        where: {
          id: body.minutaFileId,
          projectId: params.projectId,
          tipo: FileAttachmentTipo.MINUTA_RELEVAMIENTO,
          deletedAt: null,
        },
        select: { id: true, url: true, sizeBytes: true },
      });
      if (!att) throw notFound("MINUTA_NOT_FOUND", "Minuta no encontrada");

      const absolutePath = getStoredFilePath(att.url);
      const buffer = await readStoredFileBuffer(absolutePath);
      const result = await extractFromMinuta(buffer);

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: att.id,
        projectId: params.projectId,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Reintentó extracción IA de minuta (${result.metadata.modelUsed})`,
        metadata: {
          kind: "minuta_extraction_retry",
          modelUsed: result.metadata.modelUsed,
          latencyMs: result.metadata.latencyMs,
          tokensInput: result.metadata.tokensInput,
          tokensOutput: result.metadata.tokensOutput,
        },
      });

      return {
        minutaFileId: att.id,
        extractedFields: result.extractedFields,
        metadata: result.metadata,
      };
    },
  );

  // ─── Listar versiones de un proyecto ─────────────────────────────────────
  app.get(
    "/projects/:projectId/preingenieria-versions",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const versions = await prisma.preIngenieriaVersion.findMany({
        where: { projectId: params.projectId },
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true, label: true, createdAt: true },
      });
      return { versions: versions.map(serializeVersionListItem) };
    },
  );

  // ─── Obtener una versión completa ────────────────────────────────────────
  app.get(
    "/preingenieria-versions/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const version = await prisma.preIngenieriaVersion.findUnique({
        where: { id: params.id },
        include: {
          fotos: {
            orderBy: { orden: "asc" },
            include: {
              fileAttachment: {
                select: { id: true, filename: true, mimeType: true, sizeBytes: true, url: true },
              },
            },
          },
        },
      });
      if (!version) throw notFound("PREING_NOT_FOUND", "Versión no encontrada");
      const pdfAttachment = await prisma.fileAttachment.findFirst({
        where: {
          projectId: version.projectId,
          toolSource: "preing",
          toolEntityId: version.id,
          deletedAt: null,
        },
        select: { id: true, filename: true, sizeBytes: true, createdAt: true },
      });
      return {
        ...version,
        createdAt: serializeDate(version.createdAt),
        pdfAttachment: pdfAttachment
          ? {
              ...pdfAttachment,
              createdAt: serializeDate(pdfAttachment.createdAt),
              previewUrl: `/api/files/${pdfAttachment.id}/preview`,
              downloadUrl: `/api/files/${pdfAttachment.id}/download`,
            }
          : null,
      };
    },
  );

  // ─── Crear versión nueva ─────────────────────────────────────────────────
  // 1) Snapshot del cliente (recibido editable). 2) versionNumber correlativo.
  // 3) Crea PreIngenieriaVersion + PreIngenieriaFoto[] referenciando los
  // FileAttachment ya subidos via /upload-foto. 4) Genera PDF y lo guarda como
  // FileAttachment con toolSource="preing", toolVersion=N. 5) Soft-delete del
  // PDF anterior (las versiones de PreIngenieria quedan; sólo se reemplaza el
  // documento "vigente" en Documentos del proyecto).
  app.post(
    "/projects/:projectId/preingenieria-versions",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const body: CreateBody = createBodySchema.parse(request.body);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true, clientName: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      // Validar que las fotos referenciadas existen y pertenecen al proyecto.
      if (body.fotosOrden.length > 0) {
        const fotos = await prisma.fileAttachment.findMany({
          where: { id: { in: body.fotosOrden }, projectId: params.projectId, deletedAt: null },
          select: { id: true },
        });
        if (fotos.length !== body.fotosOrden.length) {
          throw badRequest(
            "INVALID_PHOTO_REFERENCES",
            "Alguna de las fotos referenciadas no existe o no pertenece al proyecto",
          );
        }
      }

      const last = await prisma.preIngenieriaVersion.findFirst({
        where: { projectId: params.projectId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersion = (last?.versionNumber ?? 0) + 1;

      const created = await prisma.preIngenieriaVersion.create({
        data: {
          projectId: params.projectId,
          versionNumber: nextVersion,
          label: body.label?.trim() || null,
          snapshotNombre: body.snapshotNombre,
          snapshotDireccion: body.snapshotDireccion ?? null,
          snapshotCiudad: body.snapshotCiudad ?? null,
          snapshotCelular: body.snapshotCelular ?? null,
          snapshotFechaPrevista: body.snapshotFechaPrevista ?? null,
          tipoTecho: body.tipoTecho ?? null,
          tipoTechoOtro: body.tipoTechoOtro ?? null,
          infoTecho: body.infoTecho ?? null,
          alturaTecho: body.alturaTecho ?? null,
          cantidadPaneles: body.cantidadPaneles ?? null,
          potenciaPaneles: body.potenciaPaneles ?? null,
          inversor: body.inversor ?? null,
          stringsLineasDc: body.stringsLineasDc ?? null,
          cableAc: body.cableAc ?? null,
          termicaAc: body.termicaAc ?? null,
          diferencialAc: body.diferencialAc ?? null,
          largoCablesAcMts: body.largoCablesAcMts ?? null,
          largoCablesDcMts: body.largoCablesDcMts ?? null,
          redMonofasica: body.redMonofasica,
          redTrifasica230SN: body.redTrifasica230SN,
          redTrifasica400CN: body.redTrifasica400CN,
          notasAdicionales: body.notasAdicionales ?? null,
          unifilarVersionId: body.unifilarVersionId ?? null,
          minutaFileId: body.minutaFileId ?? null,
          minutaExtractedAt: body.minutaFileId ? new Date() : null,
          minutaModelUsed: body.minutaModelUsed ?? null,
          fotos: {
            create: body.fotosOrden.map((fileId, idx) => ({
              orden: idx + 1,
              etiqueta: body.fotosEtiquetas?.[fileId]?.trim() || null,
              fileAttachmentId: fileId,
            })),
          },
        },
        include: { fotos: true },
      });

      // Generar PDF y persistir como FileAttachment.
      try {
        const fotosForPdf: PreIngenieriaPdfFoto[] = await (async () => {
          if (created.fotos.length === 0) return [];
          const attachments = await prisma.fileAttachment.findMany({
            where: { id: { in: created.fotos.map((f) => f.fileAttachmentId).filter((x): x is string => x !== null) } },
            select: { id: true, url: true },
          });
          const byId = new Map(attachments.map((a) => [a.id, a]));
          return created.fotos
            .filter((f) => f.fileAttachmentId && byId.has(f.fileAttachmentId))
            .map((f) => ({
              orden: f.orden,
              etiqueta: f.etiqueta,
              filePath: getStoredFilePath(byId.get(f.fileAttachmentId!)!.url),
            }));
        })();

        const pdfBytes = await generatePreIngenieriaPdf(inputsFromVersion(body), fotosForPdf);

        const filenameBase = `preingenieria_${project.clientName.replace(/[^\w-]+/g, "_")}_v${nextVersion}.pdf`;

        // Soft-delete del PDF de la versión anterior (sólo el archivo).
        const previousPdfs = await prisma.fileAttachment.findMany({
          where: {
            projectId: params.projectId,
            toolSource: "preing",
            deletedAt: null,
          },
          select: { id: true, url: true },
        });

        const stored = await saveBufferAsAttachment(
          pdfBytes,
          filenameBase,
          "application/pdf",
          params.projectId,
        );

        const pdfAttachment = await prisma.fileAttachment.create({
          data: {
            projectId: params.projectId,
            filename: stored.filename,
            storedFilename: stored.storedFilename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            url: stored.url,
            tipo: FileAttachmentTipo.PRE_INGENIERIA,
            toolSource: "preing",
            toolVersion: nextVersion,
            toolEntityId: created.id,
            uploadedById: user.id,
          },
        });

        if (previousPdfs.length > 0) {
          await prisma.fileAttachment.updateMany({
            where: { id: { in: previousPdfs.map((p) => p.id) } },
            data: { deletedAt: new Date() },
          });
          await Promise.all(
            previousPdfs.map((p) => deleteStoredFile(p.url).catch(() => undefined)),
          );
        }

        await createAuditEntry({
          entityType: AuditEntityType.file,
          entityId: pdfAttachment.id,
          projectId: params.projectId,
          userId: user.id,
          action: AuditAction.file_uploaded,
          description: `Generó pre-ingeniería v${nextVersion} para ${project.clientName}`,
        });

        reply.code(201);
        return {
          id: created.id,
          versionNumber: created.versionNumber,
          label: created.label,
          createdAt: serializeDate(created.createdAt),
          pdfAttachment: {
            id: pdfAttachment.id,
            filename: pdfAttachment.filename,
            sizeBytes: pdfAttachment.sizeBytes,
            previewUrl: `/api/files/${pdfAttachment.id}/preview`,
            downloadUrl: `/api/files/${pdfAttachment.id}/download`,
          },
        };
      } catch (err) {
        request.log.error(
          { err, preIngenieriaId: created.id },
          "[preingenieria] error generando PDF — la versión queda creada sin PDF",
        );
        reply.code(201);
        return {
          id: created.id,
          versionNumber: created.versionNumber,
          label: created.label,
          createdAt: serializeDate(created.createdAt),
          pdfAttachment: null,
          warning: "PDF_GENERATION_FAILED",
        };
      }
    },
  );

  // ─── Descargar PDF de la versión vigente ─────────────────────────────────
  // Devuelve el último FileAttachment con toolSource="preing" + toolEntityId
  // que matchea la versión.
  app.get(
    "/preingenieria-versions/:id/pdf",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const version = await prisma.preIngenieriaVersion.findUnique({
        where: { id: params.id },
        select: { id: true, projectId: true, versionNumber: true },
      });
      if (!version) throw notFound("PREING_NOT_FOUND", "Versión no encontrada");

      const pdf = await prisma.fileAttachment.findFirst({
        where: {
          projectId: version.projectId,
          toolSource: "preing",
          toolEntityId: version.id,
          deletedAt: null,
        },
        select: { id: true, filename: true, url: true },
      });
      if (!pdf) throw notFound("PREING_PDF_NOT_FOUND", "PDF no encontrado para esta versión");

      reply.redirect(`/api/files/${pdf.id}/preview`);
    },
  );

  // ─── Eliminar versión ────────────────────────────────────────────────────
  // Borra la PreIngenieriaVersion (cascade borra fotos relacionadas) + soft-
  // delete del FileAttachment del PDF + archivo físico best-effort. Las fotos
  // del usuario (FileAttachment con tipo UPLOAD_MANUAL) NO se borran — siguen
  // accesibles en Documentos del proyecto.
  app.delete(
    "/preingenieria-versions/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.DELETE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const version = await prisma.preIngenieriaVersion.findUnique({
        where: { id: params.id },
        select: { id: true, projectId: true, versionNumber: true, label: true },
      });
      if (!version) throw notFound("PREING_NOT_FOUND", "Versión no encontrada");

      const pdfs = await prisma.fileAttachment.findMany({
        where: {
          projectId: version.projectId,
          toolSource: "preing",
          toolEntityId: version.id,
          deletedAt: null,
        },
        select: { id: true, url: true },
      });

      await prisma.preIngenieriaVersion.delete({ where: { id: params.id } });

      if (pdfs.length > 0) {
        await prisma.fileAttachment.updateMany({
          where: { id: { in: pdfs.map((p) => p.id) } },
          data: { deletedAt: new Date() },
        });
        await Promise.all(pdfs.map((p) => deleteStoredFile(p.url).catch(() => undefined)));
      }

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: version.id,
        projectId: version.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó pre-ingeniería v${version.versionNumber}${version.label ? ` (${version.label})` : ""}`,
      });

      reply.code(204);
      return;
    },
  );
}

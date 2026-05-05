// Endpoints de Visita Técnica con IA. Permisos:
//   - VIEW para listar/leer visitas, inputs y reportes
//   - EDIT para crear visitas, subir inputs (audio/foto/nota), generar reporte
//   - DELETE para borrar visitas, inputs o reportes
//
// Audio: multipart/form-data → guardado como FileAttachment + VisitInput
//        (status PENDING). Background: transcribe con Whisper y actualiza
//        el VisitInput. Si OPENAI_API_KEY falta, status queda en FAILED con
//        mensaje claro.
// Foto: multipart/form-data → FileAttachment + VisitInput.
// Nota: JSON con noteText.

import { promises as fsPromises } from "node:fs";

import {
  Action,
  AuditAction,
  AuditEntityType,
  FileAttachmentTipo,
  Module,
  type VisitInputType,
  type VisitType,
} from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { deleteStoredFile, getStoredFilePath, saveUploadedFile } from "../services/file-storage.service.js";
import {
  consolidateVisitReport,
  generateVisitReport,
} from "../services/visit-report.service.js";
import {
  generateVisitReportPdf,
  type VisitReportPdfInputs,
} from "../services/visitReportPdf/index.js";
import { isWhisperEnabled, transcribeAudio } from "../services/whisper.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

// MIMEs aceptados para audio. Se compara por "base" (sin la parte de codecs)
// para tolerar valores como `audio/webm;codecs=opus` o `audio/mp4;codecs=mp4a.40.2`
// que devuelven Chrome y Safari respectivamente.
const ALLOWED_AUDIO_BASE_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/aac",
]);

function isAllowedAudioMime(mime: string): boolean {
  if (!mime) return false;
  const base = mime.split(";")[0].trim().toLowerCase();
  return ALLOWED_AUDIO_BASE_MIMES.has(base);
}
const ALLOWED_PHOTO_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const visitTypeEnum = z.enum(["INICIAL", "REVISION", "COMPLEMENTARIA"]) satisfies z.ZodType<VisitType>;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createVisitBodySchema = z.object({
  visitDate: z.string().min(1),
  visitType: visitTypeEnum.default("INICIAL"),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const noteBodySchema = z.object({
  noteText: z.string().trim().min(1).max(5000),
  description: z.string().trim().max(200).optional().nullable(),
});

// ─── Background transcription ───────────────────────────────────────────────

/**
 * Borra el FileAttachment del proyecto asociado al input (si tiene archivo)
 * y elimina el archivo físico. Se llama al borrar un input o la visita entera
 * para que los audios/fotos no queden huérfanos en Documentos del proyecto.
 */
async function cleanupVisitInputAttachments(inputs: { fileUrl: string | null; projectId: string }[]) {
  const filesToCleanup = inputs.filter((i) => i.fileUrl);
  if (filesToCleanup.length === 0) return;

  // Soft-delete los FileAttachments (matching por url + projectId).
  await Promise.all(
    filesToCleanup.map(async (i) => {
      const att = await prisma.fileAttachment.findFirst({
        where: { url: i.fileUrl!, projectId: i.projectId, deletedAt: null },
        select: { id: true },
      });
      if (att) {
        await prisma.fileAttachment.update({
          where: { id: att.id },
          data: { deletedAt: new Date() },
        });
      }
    }),
  );

  // Borrar los archivos físicos best-effort.
  await Promise.all(
    filesToCleanup.map((i) => deleteStoredFile(i.fileUrl!).catch(() => undefined)),
  );
}

async function runTranscriptionAsync(visitInputId: string, absolutePath: string): Promise<void> {
  if (!isWhisperEnabled()) {
    await prisma.visitInput.update({
      where: { id: visitInputId },
      data: { transcriptionStatus: "FAILED", transcription: "OPENAI_API_KEY no configurada" },
    });
    return;
  }
  await prisma.visitInput.update({
    where: { id: visitInputId },
    data: { transcriptionStatus: "PROCESSING" },
  });
  try {
    const result = await transcribeAudio(absolutePath);
    await prisma.visitInput.update({
      where: { id: visitInputId },
      data: { transcription: result.text, transcriptionStatus: "COMPLETED" },
    });
  } catch (err) {
    await prisma.visitInput.update({
      where: { id: visitInputId },
      data: {
        transcriptionStatus: "FAILED",
        transcription: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export async function registerVisitasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ── Listar visitas de un proyecto ──────────────────────────────────────
  app.get(
    "/projects/:projectId/technical-visits",
    { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const visits = await prisma.technicalVisit.findMany({
        where: { projectId: params.projectId, deletedAt: null },
        orderBy: { visitDate: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { inputs: true, reports: true } },
        },
      });

      return {
        visits: visits.map((v) => ({
          id: v.id,
          visitDate: serializeDate(v.visitDate),
          visitType: v.visitType,
          status: v.status,
          notes: v.notes,
          createdBy: v.createdBy,
          inputsCount: v._count.inputs,
          reportsCount: v._count.reports,
          createdAt: serializeDate(v.createdAt),
        })),
      };
    },
  );

  // ── Crear visita ────────────────────────────────────────────────────────
  app.post(
    "/projects/:projectId/technical-visits",
    { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ projectId: z.string().min(1) }).parse(request.params);
      const body = createVisitBodySchema.parse(request.body);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const visitDate = new Date(body.visitDate);
      if (isNaN(visitDate.getTime())) {
        throw badRequest("INVALID_DATE", "Fecha de visita inválida");
      }

      const created = await prisma.technicalVisit.create({
        data: {
          projectId: params.projectId,
          createdById: user.id,
          visitDate,
          visitType: body.visitType,
          notes: body.notes ?? null,
        },
      });

      reply.code(201);
      return {
        id: created.id,
        visitDate: serializeDate(created.visitDate),
        visitType: created.visitType,
        status: created.status,
      };
    },
  );

  // ── Detalle de visita (con inputs y reportes) ──────────────────────────
  app.get(
    "/technical-visits/:id",
    { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
    async (request) => {
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        include: {
          createdBy: { select: { id: true, name: true } },
          project: { select: { id: true, clientName: true } },
          inputs: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            include: { createdBy: { select: { id: true, name: true } } },
          },
          reports: {
            orderBy: { version: "desc" },
            include: { generatedBy: { select: { id: true, name: true } } },
          },
        },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");

      return {
        id: visit.id,
        projectId: visit.projectId,
        project: visit.project,
        visitDate: serializeDate(visit.visitDate),
        visitType: visit.visitType,
        status: visit.status,
        notes: visit.notes,
        createdBy: visit.createdBy,
        createdAt: serializeDate(visit.createdAt),
        inputs: visit.inputs.map((i) => ({
          id: i.id,
          type: i.type,
          fileUrl: i.fileUrl,
          fileMimeType: i.fileMimeType,
          fileSize: i.fileSize,
          transcription: i.transcription,
          transcriptionStatus: i.transcriptionStatus,
          noteText: i.noteText,
          description: i.description,
          createdBy: i.createdBy,
          createdAt: serializeDate(i.createdAt),
        })),
        reports: visit.reports.map((r) => ({
          id: r.id,
          version: r.version,
          content: r.content,
          summary: r.summary,
          changesFromPrevious: r.changesFromPrevious,
          projectSuggestions: r.projectSuggestions,
          inputsUsed: r.inputsUsed,
          modelUsed: r.modelUsed,
          tokensInput: r.tokensInput,
          tokensOutput: r.tokensOutput,
          costUsd: r.costUsd ? Number(r.costUsd) : null,
          generatedAt: serializeDate(r.generatedAt),
          generatedBy: r.generatedBy,
          hasPdf: !!r.pdfPath,
        })),
      };
    },
  );

  // ── Eliminar visita ────────────────────────────────────────────────────
  app.delete(
    "/technical-visits/:id",
    { preHandler: authorize(Module.OPERACIONES, Action.DELETE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        include: {
          inputs: {
            where: { deletedAt: null, fileUrl: { not: null } },
            select: { fileUrl: true },
          },
        },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");

      // Cleanup de FileAttachments y archivos físicos de los inputs.
      await cleanupVisitInputAttachments(
        visit.inputs.map((i) => ({ fileUrl: i.fileUrl, projectId: visit.projectId })),
      );

      await prisma.technicalVisit.update({
        where: { id: visit.id },
        data: { deletedAt: new Date() },
      });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: visit.id,
        projectId: visit.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó visita técnica del ${visit.visitDate.toISOString().slice(0, 10)}`,
      });

      reply.code(204);
      return;
    },
  );

  // ── Subir nota ──────────────────────────────────────────────────────────
  app.post(
    "/technical-visits/:id/inputs/note",
    { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const body = noteBodySchema.parse(request.body);

      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");

      const input = await prisma.visitInput.create({
        data: {
          visitId: visit.id,
          type: "NOTE" satisfies VisitInputType,
          noteText: body.noteText,
          description: body.description ?? null,
          createdById: user.id,
        },
      });
      reply.code(201);
      return serializeInput(input);
    },
  );

  // ── Subir audio ─────────────────────────────────────────────────────────
  app.post(
    "/technical-visits/:id/inputs/audio",
    { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, projectId: true },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");

      const part = await request.file();
      if (!part) throw badRequest("MISSING_FILE", "No se envió ningún archivo");

      if (!isAllowedAudioMime(part.mimetype)) {
        throw badRequest("INVALID_AUDIO_MIMETYPE", `Audio no soportado: ${part.mimetype}`);
      }
      const description = (part.fields.description as { value?: string } | undefined)?.value ?? null;

      // 1) Persistir archivo en storage del proyecto.
      const stored = await saveUploadedFile(part, visit.projectId);

      // 2) FileAttachment + VisitInput.
      await prisma.fileAttachment.create({
        data: {
          projectId: visit.projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          uploadedById: user.id,
        },
      });

      const input = await prisma.visitInput.create({
        data: {
          visitId: visit.id,
          type: "AUDIO" satisfies VisitInputType,
          fileUrl: stored.url,
          fileMimeType: stored.mimeType,
          fileSize: stored.sizeBytes,
          description,
          transcriptionStatus: "PENDING",
          createdById: user.id,
        },
      });

      // 3) Disparar transcripción en background. NO await — devolvemos
      //    rápido al frontend que va a hacer polling sobre el status.
      void runTranscriptionAsync(input.id, stored.absolutePath);

      reply.code(201);
      return serializeInput(input);
    },
  );

  // ── Subir foto ──────────────────────────────────────────────────────────
  app.post(
    "/technical-visits/:id/inputs/photo",
    { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, projectId: true },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");

      const part = await request.file();
      if (!part) throw badRequest("MISSING_FILE", "No se envió ningún archivo");
      if (!ALLOWED_PHOTO_MIMES.has(part.mimetype.toLowerCase())) {
        throw badRequest("INVALID_PHOTO_MIMETYPE", `Foto no soportada: ${part.mimetype}`);
      }
      const description = (part.fields.description as { value?: string } | undefined)?.value ?? null;

      const stored = await saveUploadedFile(part, visit.projectId);
      await prisma.fileAttachment.create({
        data: {
          projectId: visit.projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.UPLOAD_MANUAL,
          uploadedById: user.id,
        },
      });

      const input = await prisma.visitInput.create({
        data: {
          visitId: visit.id,
          type: "PHOTO" satisfies VisitInputType,
          fileUrl: stored.url,
          fileMimeType: stored.mimeType,
          fileSize: stored.sizeBytes,
          description,
          createdById: user.id,
        },
      });
      reply.code(201);
      return serializeInput(input);
    },
  );

  // ── Eliminar input ─────────────────────────────────────────────────────
  app.delete(
    "/technical-visits/:visitId/inputs/:inputId",
    { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
    async (request, reply) => {
      const params = z
        .object({ visitId: z.string().min(1), inputId: z.string().min(1) })
        .parse(request.params);
      const input = await prisma.visitInput.findFirst({
        where: { id: params.inputId, visitId: params.visitId, deletedAt: null },
        include: { visit: { select: { projectId: true } } },
      });
      if (!input) throw notFound("INPUT_NOT_FOUND", "Input no encontrado");

      // Cleanup del FileAttachment + archivo físico (si tiene).
      await cleanupVisitInputAttachments([
        { fileUrl: input.fileUrl, projectId: input.visit.projectId },
      ]);

      await prisma.visitInput.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      reply.code(204);
      return;
    },
  );

  // ── Recuperar audio (preview) ───────────────────────────────────────────
  app.get(
    "/technical-visits/:visitId/inputs/:inputId/audio",
    { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
    async (request, reply) => {
      const params = z
        .object({ visitId: z.string().min(1), inputId: z.string().min(1) })
        .parse(request.params);
      const input = await prisma.visitInput.findFirst({
        where: { id: params.inputId, visitId: params.visitId, deletedAt: null, type: "AUDIO" },
      });
      if (!input || !input.fileUrl) throw notFound("AUDIO_NOT_FOUND", "Audio no encontrado");

      const abs = getStoredFilePath(input.fileUrl);
      reply.header("Content-Type", input.fileMimeType ?? "audio/webm");
      reply.header("Cache-Control", "private, max-age=3600");
      const buf = await fsPromises.readFile(abs);
      return reply.send(buf);
    },
  );

  // ── Generar reporte ─────────────────────────────────────────────────────
  app.post(
    "/technical-visits/:id/generate-report",
    { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);

      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, projectId: true, _count: { select: { inputs: true } } },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");
      if (visit._count.inputs === 0) {
        throw badRequest("NO_INPUTS", "La visita no tiene inputs cargados todavía");
      }

      const result = await generateVisitReport(visit.id, user.id);

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: result.report.id,
        projectId: visit.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Generó informe v${result.report.version} de visita técnica con IA`,
        metadata: {
          kind: "visit_report_generation",
          modelUsed: result.metadata.modelUsed,
          latencyMs: result.metadata.latencyMs,
          tokensInput: result.metadata.tokensInput,
          tokensOutput: result.metadata.tokensOutput,
          costUsd: result.metadata.costUsd,
        },
      });

      reply.code(201);
      return {
        id: result.report.id,
        version: result.report.version,
        summary: result.report.summary,
        metadata: result.metadata,
      };
    },
  );

  // ── Consolidar versiones: integra todas las parciales en un super-informe ─
  // Permiso INGENIERIA.EDIT — el proyectista (no el operario) hace el merge.
  app.post(
    "/technical-visits/:id/consolidate-report",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, projectId: true },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");

      const result = await consolidateVisitReport(visit.id, user.id);

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: result.report.id,
        projectId: visit.projectId,
        userId: user.id,
        action: AuditAction.created,
        description: `Consolidó informe v${result.report.version} de visita técnica con IA`,
        metadata: {
          kind: "visit_report_consolidation",
          modelUsed: result.metadata.modelUsed,
          latencyMs: result.metadata.latencyMs,
          tokensInput: result.metadata.tokensInput,
          tokensOutput: result.metadata.tokensOutput,
          costUsd: result.metadata.costUsd,
        },
      });

      reply.code(201);
      return {
        id: result.report.id,
        version: result.report.version,
        summary: result.report.summary,
        metadata: result.metadata,
      };
    },
  );

  // ── Reset: borrar todos los reportes de la visita (mantiene los inputs) ─
  app.delete(
    "/technical-visits/:id/reports",
    { preHandler: authorize(Module.OPERACIONES, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string().min(1) }).parse(request.params);
      const visit = await prisma.technicalVisit.findFirst({
        where: { id: params.id, deletedAt: null },
        select: { id: true, projectId: true },
      });
      if (!visit) throw notFound("VISIT_NOT_FOUND", "Visita no encontrada");

      const result = await prisma.visitReport.deleteMany({ where: { visitId: visit.id } });

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: visit.id,
        projectId: visit.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Reset de informes de visita técnica (eliminó ${result.count} versiones)`,
      });

      reply.code(204);
      return;
    },
  );

  // ── Descargar PDF de un reporte (on-demand) ────────────────────────────
  app.get(
    "/technical-visits/:visitId/reports/:reportId/pdf",
    { preHandler: authorize(Module.OPERACIONES, Action.VIEW) },
    async (request, reply) => {
      const params = z
        .object({ visitId: z.string().min(1), reportId: z.string().min(1) })
        .parse(request.params);
      const report = await prisma.visitReport.findFirst({
        where: { id: params.reportId, visitId: params.visitId },
        include: {
          generatedBy: { select: { name: true } },
          visit: {
            include: {
              createdBy: { select: { name: true } },
              project: { select: { code: true, clientName: true } },
            },
          },
        },
      });
      if (!report) throw notFound("REPORT_NOT_FOUND", "Reporte no encontrado");

      const content = (report.content as Record<string, string>) ?? {};
      const suggestions = Array.isArray(report.projectSuggestions)
        ? (report.projectSuggestions as VisitReportPdfInputs["projectSuggestions"])
        : [];

      const pdfBuffer = await generateVisitReportPdf({
        cliente: report.visit.project.clientName,
        proyectoCode: report.visit.project.code,
        visitDate: report.visit.visitDate,
        visitType: report.visit.visitType,
        operario: report.visit.createdBy?.name ?? null,
        version: report.version,
        generatedAt: report.generatedAt,
        generatedBy: report.generatedBy?.name ?? null,
        summary: report.summary,
        changesFromPrevious: report.changesFromPrevious,
        content,
        projectSuggestions: suggestions,
      });

      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `inline; filename="visita-${report.visit.project.code}-v${report.version}.pdf"`,
      );
      return reply.send(pdfBuffer);
    },
  );
}

function serializeInput(input: {
  id: string;
  type: string;
  fileUrl: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  transcription: string | null;
  transcriptionStatus: string | null;
  noteText: string | null;
  description: string | null;
  createdAt: Date;
}) {
  return {
    id: input.id,
    type: input.type,
    fileUrl: input.fileUrl,
    fileMimeType: input.fileMimeType,
    fileSize: input.fileSize,
    transcription: input.transcription,
    transcriptionStatus: input.transcriptionStatus,
    noteText: input.noteText,
    description: input.description,
    createdAt: serializeDate(input.createdAt),
  };
}

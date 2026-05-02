// REST endpoints del generador de unifilares. Vive bajo el módulo INGENIERIA
// (la sección "Unifilar" es parte del flujo técnico del proyecto).

import { Action, Module, type TipoProteccionDC, type TipoRed } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { deleteStoredFile, saveBufferAsAttachment } from "../services/file-storage.service.js";
import { generateUnifilarSvg, type UnifilarInputs } from "../services/unifilarSvg/index.js";
import { svgToPdf } from "../services/unifilarSvg/pdf.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

const tipoRedEnum = z.enum(["MONO_230", "TRI_230_SN", "TRI_400_CN"]) satisfies z.ZodType<TipoRed>;
const tipoProteccionDcEnum = z.enum(["TERMOMAGNETICO", "FUSIBLE"]) satisfies z.ZodType<TipoProteccionDC>;

const formSchema = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  tipoRed: tipoRedEnum,
  cantidadPaneles: z.number().int().min(1).max(200),
  potenciaPanelW: z.number().int().min(100).max(800).default(580),
  modeloPanel: z.string().trim().max(100).optional().nullable(),
  cantidadStrings: z.number().int().min(1).max(8).default(2),
  potenciaContratadaKw: z.number().min(1).max(100),
  modeloInversor: z.string().trim().min(1).max(100),
  potenciaInversorKw: z.number().min(1).max(100),
  tipoProteccionDc: tipoProteccionDcEnum,
  calibreProteccionDc: z.string().trim().min(1).max(50).default("25A 2P"),
  modeloMedidorMonitoreo: z.string().trim().max(100).optional().nullable(),
  largoDcPanelesM: z.number().int().min(1).max(200),
  largoDcEsLargo: z.boolean().default(false),
  largoAcInversorIcpM: z.number().int().min(1).max(200),
  largoAcIcpTableroM: z.number().int().min(1).max(200),
});

type FormInput = z.infer<typeof formSchema>;

function ensureUser(request: import("fastify").FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

function fechaTexto(d: Date): string {
  // "Mes AAAA" en español (locale UY).
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const mes = meses[d.getUTCMonth()];
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getUTCFullYear()}`;
}

function inputsFromVersion(v: {
  snapshotCliente: string;
  snapshotUbicacion: string;
  snapshotFecha: Date;
  snapshotAutor: string;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel: string | null;
  cantidadStrings: number;
  potenciaContratadaKw: number;
  modeloInversor: string;
  potenciaInversorKw: number;
  tipoProteccionDc: TipoProteccionDC;
  calibreProteccionDc: string;
  modeloMedidorMonitoreo: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
}): UnifilarInputs {
  return {
    cliente: v.snapshotCliente,
    ubicacion: v.snapshotUbicacion,
    fecha: fechaTexto(v.snapshotFecha),
    autor: v.snapshotAutor,
    tipoRed: v.tipoRed,
    cantidadPaneles: v.cantidadPaneles,
    potenciaPanelW: v.potenciaPanelW,
    modeloPanel: v.modeloPanel,
    cantidadStrings: v.cantidadStrings,
    potenciaContratadaKw: v.potenciaContratadaKw,
    modeloInversor: v.modeloInversor,
    potenciaInversorKw: v.potenciaInversorKw,
    tipoProteccionDc: v.tipoProteccionDc,
    calibreProteccionDc: v.calibreProteccionDc,
    modeloMedidorMonitoreo: v.modeloMedidorMonitoreo,
    largoDcPanelesM: v.largoDcPanelesM,
    largoDcEsLargo: v.largoDcEsLargo,
    largoAcInversorIcpM: v.largoAcInversorIcpM,
    largoAcIcpTableroM: v.largoAcIcpTableroM,
  };
}

function serializeVersionListItem(v: {
  id: string;
  versionNumber: number;
  label: string | null;
  createdAt: Date;
  tipoRed: TipoRed;
  potenciaInversorKw: number;
  cantidadPaneles: number;
}) {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    label: v.label,
    createdAt: serializeDate(v.createdAt),
    tipoRed: v.tipoRed,
    potenciaInversorKw: v.potenciaInversorKw,
    cantidadPaneles: v.cantidadPaneles,
  };
}

function serializeVersionFull(v: {
  id: string;
  projectId: string;
  versionNumber: number;
  label: string | null;
  createdAt: Date;
  snapshotCliente: string;
  snapshotUbicacion: string;
  snapshotFecha: Date;
  snapshotAutor: string;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel: string | null;
  cantidadStrings: number;
  potenciaContratadaKw: number;
  modeloInversor: string;
  potenciaInversorKw: number;
  tipoProteccionDc: TipoProteccionDC;
  calibreProteccionDc: string;
  modeloMedidorMonitoreo: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
}) {
  return {
    ...v,
    createdAt: serializeDate(v.createdAt),
    snapshotFecha: serializeDate(v.snapshotFecha),
  };
}

export async function registerUnifilarRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Listar versiones de un proyecto ──────────────────────────────────────
  app.get(
    "/projects/:projectId/unifilar-versions",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string() }).parse(request.params);
      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const versions = await prisma.unifilarVersion.findMany({
        where: { projectId: params.projectId },
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          label: true,
          createdAt: true,
          tipoRed: true,
          potenciaInversorKw: true,
          cantidadPaneles: true,
        },
      });
      return { versions: versions.map(serializeVersionListItem) };
    },
  );

  // ─── Obtener una versión ──────────────────────────────────────────────────
  app.get(
    "/unifilar-versions/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const params = z.object({ id: z.string() }).parse(request.params);
      const v = await prisma.unifilarVersion.findUnique({ where: { id: params.id } });
      if (!v) throw notFound("UNIFILAR_NOT_FOUND", "Versión no encontrada");
      return serializeVersionFull(v);
    },
  );

  // ─── Crear versión ────────────────────────────────────────────────────────
  app.post(
    "/projects/:projectId/unifilar-versions",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const params = z.object({ projectId: z.string() }).parse(request.params);
      const body: FormInput = formSchema.parse(request.body);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true, clientName: true, locationCity: true, locationProvince: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      if (!project.clientName.trim()) {
        throw badRequest("PROJECT_INCOMPLETE", "El proyecto no tiene nombre de cliente");
      }

      const last = await prisma.unifilarVersion.findFirst({
        where: { projectId: params.projectId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersion = (last?.versionNumber ?? 0) + 1;

      const created = await prisma.unifilarVersion.create({
        data: {
          projectId: params.projectId,
          versionNumber: nextVersion,
          label: body.label?.trim() || null,
          snapshotCliente: project.clientName,
          snapshotUbicacion: `${project.locationCity}, ${project.locationProvince}`,
          snapshotFecha: new Date(),
          snapshotAutor: user.name,
          tipoRed: body.tipoRed,
          cantidadPaneles: body.cantidadPaneles,
          potenciaPanelW: body.potenciaPanelW,
          modeloPanel: body.modeloPanel?.trim() || null,
          cantidadStrings: body.cantidadStrings,
          potenciaContratadaKw: body.potenciaContratadaKw,
          modeloInversor: body.modeloInversor.trim(),
          potenciaInversorKw: body.potenciaInversorKw,
          tipoProteccionDc: body.tipoProteccionDc,
          calibreProteccionDc: body.calibreProteccionDc,
          modeloMedidorMonitoreo: body.modeloMedidorMonitoreo?.trim() || null,
          largoDcPanelesM: body.largoDcPanelesM,
          largoDcEsLargo: body.largoDcEsLargo,
          largoAcInversorIcpM: body.largoAcInversorIcpM,
          largoAcIcpTableroM: body.largoAcIcpTableroM,
        },
      });

      // Guardar el PDF de esta versión como FileAttachment del proyecto con
      // tipo UNIFILAR. Sólo queda la última: las versiones anteriores con
      // tipo UNIFILAR se soft-deletean (y se borra el archivo físico). Esto
      // hace que el plano vigente sea accesible desde "Documentos" del
      // proyecto para el resto del equipo (operaciones, etc.).
      try {
        const svg = generateUnifilarSvg(inputsFromVersion(created));
        const pdfBytes = await svgToPdf(svg);
        const filenameBase = `unifilar_${project.clientName.replace(/[^\w-]+/g, "_")}_v${nextVersion}.pdf`;

        const previousAttachments = await prisma.fileAttachment.findMany({
          where: { projectId: params.projectId, tipo: "UNIFILAR", deletedAt: null },
          select: { id: true, url: true },
        });

        const stored = await saveBufferAsAttachment(
          Buffer.from(pdfBytes),
          filenameBase,
          "application/pdf",
          params.projectId,
        );

        await prisma.fileAttachment.create({
          data: {
            projectId: params.projectId,
            stageId: null,
            substageId: null,
            filename: stored.filename,
            storedFilename: stored.storedFilename,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
            url: stored.url,
            tipo: "UNIFILAR",
            // Trazabilidad fina (badge "Ingeniería: Unifilar v3", filtros).
            toolSource: "unifilar",
            toolVersion: created.versionNumber,
            toolEntityId: created.id,
            uploadedById: user.id,
          },
        });

        if (previousAttachments.length > 0) {
          await prisma.fileAttachment.updateMany({
            where: { id: { in: previousAttachments.map((a) => a.id) } },
            data: { deletedAt: new Date() },
          });
          // Borrado físico best-effort.
          await Promise.all(
            previousAttachments.map((a) => deleteStoredFile(a.url).catch(() => undefined)),
          );
        }
      } catch (err) {
        // No interrumpir la creación de la versión si falla el guardado del
        // documento — el SVG/PDF on-demand siguen funcionando.
        request.log.warn(
          { err, unifilarVersionId: created.id },
          "[unifilar] no se pudo guardar el PDF como FileAttachment",
        );
      }

      reply.code(201);
      return serializeVersionFull(created);
    },
  );

  // ─── SVG on-demand ────────────────────────────────────────────────────────
  app.get(
    "/unifilar-versions/:id/svg",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);
      const v = await prisma.unifilarVersion.findUnique({ where: { id: params.id } });
      if (!v) throw notFound("UNIFILAR_NOT_FOUND", "Versión no encontrada");

      const svg = generateUnifilarSvg(inputsFromVersion(v));
      reply.header("Content-Type", "image/svg+xml; charset=utf-8");
      reply.header(
        "Content-Disposition",
        `inline; filename="unifilar_v${v.versionNumber}.svg"`,
      );
      return reply.send(svg);
    },
  );

  // ─── PDF on-demand ────────────────────────────────────────────────────────
  app.get(
    "/unifilar-versions/:id/pdf",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);
      const v = await prisma.unifilarVersion.findUnique({ where: { id: params.id } });
      if (!v) throw notFound("UNIFILAR_NOT_FOUND", "Versión no encontrada");

      const svg = generateUnifilarSvg(inputsFromVersion(v));
      const pdfBytes = await svgToPdf(svg);
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `inline; filename="unifilar_v${v.versionNumber}.pdf"`,
      );
      return reply.send(Buffer.from(pdfBytes));
    },
  );

  // ─── Preview SVG sin guardar (para form en vivo) ──────────────────────────
  app.post(
    "/projects/:projectId/unifilar-preview",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const params = z.object({ projectId: z.string() }).parse(request.params);
      const body: FormInput = formSchema.parse(request.body);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { clientName: true, locationCity: true, locationProvince: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const user = ensureUser(request);
      const inputs: UnifilarInputs = {
        cliente: project.clientName,
        ubicacion: `${project.locationCity}, ${project.locationProvince}`,
        fecha: fechaTexto(new Date()),
        autor: user.name,
        tipoRed: body.tipoRed,
        cantidadPaneles: body.cantidadPaneles,
        potenciaPanelW: body.potenciaPanelW,
        modeloPanel: body.modeloPanel ?? null,
        cantidadStrings: body.cantidadStrings,
        potenciaContratadaKw: body.potenciaContratadaKw,
        modeloInversor: body.modeloInversor,
        potenciaInversorKw: body.potenciaInversorKw,
        tipoProteccionDc: body.tipoProteccionDc,
        calibreProteccionDc: body.calibreProteccionDc,
        modeloMedidorMonitoreo: body.modeloMedidorMonitoreo ?? null,
        largoDcPanelesM: body.largoDcPanelesM,
        largoDcEsLargo: body.largoDcEsLargo,
        largoAcInversorIcpM: body.largoAcInversorIcpM,
        largoAcIcpTableroM: body.largoAcIcpTableroM,
      };
      const svg = generateUnifilarSvg(inputs);
      reply.header("Content-Type", "image/svg+xml; charset=utf-8");
      return reply.send(svg);
    },
  );

  // ─── Eliminar versión ─────────────────────────────────────────────────────
  app.delete(
    "/unifilar-versions/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.DELETE) },
    async (request, reply) => {
      const params = z.object({ id: z.string() }).parse(request.params);
      const v = await prisma.unifilarVersion.findUnique({
        where: { id: params.id },
        select: { id: true, projectId: true },
      });
      if (!v) throw notFound("UNIFILAR_NOT_FOUND", "Versión no encontrada");

      // Regla de negocio simple: no eliminar si es la única del proyecto.
      const count = await prisma.unifilarVersion.count({ where: { projectId: v.projectId } });
      if (count <= 1) {
        throw badRequest(
          "UNIFILAR_LAST_VERSION",
          "No se puede eliminar la única versión del proyecto. Creá otra primero.",
        );
      }

      await prisma.unifilarVersion.delete({ where: { id: params.id } });
      reply.code(204).send();
    },
  );
}

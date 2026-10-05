// REST endpoints del generador de unifilares. Vive bajo el módulo INGENIERIA
// (la sección "Unifilar" es parte del flujo técnico del proyecto).

import { Action, Module, type TipoProteccionDC, type TipoRed } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { deleteStoredFile, saveBufferAsAttachment } from "../services/file-storage.service.js";
import { fechaTexto, inputsFromVersion } from "../services/unifilarSvg/from-version.js";
import { generateUnifilarSvg, type UnifilarInputs } from "../services/unifilarSvg/index.js";
import { svgToPdf } from "../services/unifilarSvg/pdf.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";
import { SUMINISTRO_PRINCIPAL, datosSuministro, uteConfigKey } from "../services/suministros.service.js";

// Proyectos con varios suministros (una cuenta UTE por inversor): un unifilar
// por suministro, cada uno con su numeración. `?suministro=N`, default 1.
const suministroQuery = z.object({
  suministro: z.coerce.number().int().min(1).max(20).default(SUMINISTRO_PRINCIPAL),
});

/**
 * Cliente y ubicación del rótulo del plano. El principal, como siempre (título y
 * ciudad del proyecto). Otro suministro lleva su titular y su dirección si los
 * tiene propios, y "· Suministro N" para que no se confundan los planos.
 */
async function encabezado(
  project: { id: string; clientName: string; locationCity: string; locationProvince: string },
  suministro: number,
): Promise<{ cliente: string; ubicacion: string }> {
  const base = { cliente: project.clientName, ubicacion: `${project.locationCity}, ${project.locationProvince}` };
  if (suministro === SUMINISTRO_PRINCIPAL) return base;
  const [full, config] = await Promise.all([
    prisma.project.findUniqueOrThrow({ where: { id: project.id } }),
    prisma.uteDocumentConfig.findUnique({ where: uteConfigKey(project.id, suministro) }),
  ]);
  const d = datosSuministro(full, config, suministro);
  return {
    cliente: `${d.titularPropio ? d.titularNombre : project.clientName} · Suministro ${suministro}`,
    ubicacion: `${d.localidad}, ${d.departamento}`,
  };
}

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
  // Overrides opcionales del calibre AC. Null/undefined = usar regla server.
  termicaAcCalibre: z.string().trim().max(50).optional().nullable(),
  diferencialAcCalibre: z.string().trim().max(50).optional().nullable(),
  // Overrides opcionales de la sección de los cables (mm²). Null = regla server.
  seccionDcOverride: z.string().trim().max(20).optional().nullable(),
  seccionAcInvIcpOverride: z.string().trim().max(20).optional().nullable(),
  seccionAcCasaOverride: z.string().trim().max(20).optional().nullable(),
  seccionPeOverride: z.string().trim().max(20).optional().nullable(),
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


function serializeVersionListItem(v: {
  id: string;
  suministro: number;
  versionNumber: number;
  label: string | null;
  createdAt: Date;
  tipoRed: TipoRed;
  potenciaInversorKw: number;
  cantidadPaneles: number;
}) {
  return {
    id: v.id,
    suministro: v.suministro,
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
  termicaAcCalibre: string | null;
  diferencialAcCalibre: string | null;
  seccionDcOverride: string | null;
  seccionAcInvIcpOverride: string | null;
  seccionAcCasaOverride: string | null;
  seccionPeOverride: string | null;
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
      const { suministro } = suministroQuery.parse(request.query);

      const versions = await prisma.unifilarVersion.findMany({
        where: { projectId: params.projectId, suministro },
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          suministro: true,
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
      const { suministro } = suministroQuery.parse(request.query);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true, clientName: true, locationCity: true, locationProvince: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      if (!project.clientName.trim()) {
        throw badRequest("PROJECT_INCOMPLETE", "El proyecto no tiene nombre de cliente");
      }

      const last = await prisma.unifilarVersion.findFirst({
        where: { projectId: params.projectId, suministro },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const nextVersion = (last?.versionNumber ?? 0) + 1;
      const rotulo = await encabezado(project, suministro);

      const created = await prisma.unifilarVersion.create({
        data: {
          projectId: params.projectId,
          suministro,
          versionNumber: nextVersion,
          label: body.label?.trim() || null,
          snapshotCliente: rotulo.cliente,
          snapshotUbicacion: rotulo.ubicacion,
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
          termicaAcCalibre: body.termicaAcCalibre?.trim() || null,
          diferencialAcCalibre: body.diferencialAcCalibre?.trim() || null,
          seccionDcOverride: body.seccionDcOverride?.trim() || null,
          seccionAcInvIcpOverride: body.seccionAcInvIcpOverride?.trim() || null,
          seccionAcCasaOverride: body.seccionAcCasaOverride?.trim() || null,
          seccionPeOverride: body.seccionPeOverride?.trim() || null,
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
        const sufijo = suministro === SUMINISTRO_PRINCIPAL ? "" : `_suministro-${suministro}`;
        const filenameBase = `unifilar_${project.clientName.replace(/[^\w-]+/g, "_")}${sufijo}_v${nextVersion}.pdf`;
        const suministroArchivo = suministro === SUMINISTRO_PRINCIPAL ? null : suministro;

        // Queda el vigente de cada suministro: se reemplaza solo el de este.
        const previousAttachments = await prisma.fileAttachment.findMany({
          where: { projectId: params.projectId, tipo: "UNIFILAR", suministro: suministroArchivo, deletedAt: null },
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
            suministro: suministroArchivo,
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
      const { suministro } = suministroQuery.parse(request.query);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true, clientName: true, locationCity: true, locationProvince: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const user = ensureUser(request);
      const rotulo = await encabezado(project, suministro);
      const inputs: UnifilarInputs = {
        cliente: rotulo.cliente,
        ubicacion: rotulo.ubicacion,
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
        termicaAcCalibre: body.termicaAcCalibre ?? null,
        diferencialAcCalibre: body.diferencialAcCalibre ?? null,
        seccionDcOverride: body.seccionDcOverride ?? null,
        seccionAcInvIcpOverride: body.seccionAcInvIcpOverride ?? null,
        seccionAcCasaOverride: body.seccionAcCasaOverride ?? null,
        seccionPeOverride: body.seccionPeOverride ?? null,
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
        select: { id: true, projectId: true, suministro: true },
      });
      if (!v) throw notFound("UNIFILAR_NOT_FOUND", "Versión no encontrada");

      // Regla de negocio simple: no eliminar si es la única (del suministro).
      const count = await prisma.unifilarVersion.count({
        where: { projectId: v.projectId, suministro: v.suministro },
      });
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

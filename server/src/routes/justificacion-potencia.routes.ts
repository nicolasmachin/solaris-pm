// REST endpoints del informe "Justificación de potencia ante UTE" (módulo
// INGENIERIA). Se usa cuando UTE contesta la consulta de microgenerador con
// que el balance anual de la cuenta da para menos potencia que la pedida.
//
// Mismo patrón que Pre-Ingeniería: versiones 1:N inmutables y el PDF de la
// última versión persistido como FileAttachment (toolSource="justif-potencia")
// para que aparezca en Documentos del proyecto. Las versiones viejas no tienen
// archivo: su PDF se vuelve a generar desde `datos` al pedirlo.

import { Action, AuditAction, AuditEntityType, FileAttachmentTipo, Module, type Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { deleteStoredFile, saveBufferAsAttachment } from "../services/file-storage.service.js";
import { calcularBalance } from "../services/justificacionPotencia/calculo.js";
import { redactarTextosConIa } from "../services/justificacionPotencia/ia.js";
import { generateJustificacionPotenciaPdf } from "../services/justificacionPotencia/pdf.js";
import { datosSchema, type DatosJustificacion } from "../services/justificacionPotencia/schema.js";
import { textosAutomaticos } from "../services/justificacionPotencia/textos.js";
import { datosSuministro, SUMINISTRO_PRINCIPAL, uteConfigKey } from "../services/suministros.service.js";
import { badRequest, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

export const JUSTIFICACION_TOOL_SOURCE = "justif-potencia";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const projectParams = z.object({ projectId: z.string().min(1) });
const idParams = z.object({ id: z.string().min(1) });

function parseDatos(body: unknown): DatosJustificacion {
  const r = datosSchema.safeParse(body);
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw badRequest("JUSTIFICACION_DATOS_INVALIDOS", `Datos del informe inválidos: ${detalle}`);
  }
  return r.data;
}

async function ensureProject(projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: {
      id: true,
      clientName: true,
      nombreCliente: true,
      ciCliente: true,
      empresa: true,
      calle: true,
      numCalle: true,
      locationCity: true,
      locationProvince: true,
      facturaUtePath: true,
      cedulaPath: true,
      capacityKwp: true,
    },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
  return project;
}

function fechaUy(d: Date): string {
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Montevideo" });
}

/** "4,25" / "4.25 kW" / "" → número o null. */
function parseKw(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Lo que el formulario precarga: datos del cliente y del suministro principal
 * (los mismos que van en la consulta a UTE), la potencia del generador y el
 * técnico de la firma instaladora.
 */
async function buildContexto(projectId: string) {
  const project = await ensureProject(projectId);
  const ute = await prisma.uteDocumentConfig.findUnique({
    where: uteConfigKey(projectId, SUMINISTRO_PRINCIPAL),
    select: { cuentaUte: true, potImg: true, ti: true, ciTi: true },
  });
  const datos = datosSuministro(project, null, SUMINISTRO_PRINCIPAL);

  // Potencia del generador: la de los documentos UTE si está; si no, la suma de
  // los inversores cargados; si no, la capacidad del proyecto.
  const sistemas = await prisma.solarSystem.findMany({
    where: { projectId, deletedAt: null },
    select: { inverterPowerKw: true, inverterQuantity: true },
  });
  const kwInversores = sistemas.reduce(
    (acc, s) => acc + (s.inverterPowerKw ? Number(s.inverterPowerKw) * (s.inverterQuantity ?? 1) : 0),
    0,
  );
  const potenciaSolicitadaKw =
    parseKw(ute?.potImg) ?? (kwInversores > 0 ? kwInversores : null) ?? (Number(project.capacityKwp) || null);

  const ubicacion = [[datos.calle, datos.numCalle].filter(Boolean).join(" "), datos.localidad, datos.departamento]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");

  const tecnico = (ute?.ti ?? "Nicolás Machín").trim();
  return {
    cliente: {
      nombre: datos.titularNombre,
      documento: datos.titularCi ?? "",
      esEmpresa: datos.titularEmpresa,
      cuentaUte: ute?.cuentaUte ?? "",
      ubicacion,
    },
    firmante: {
      nombre: /^ing\.?\s/i.test(tecnico) ? tecnico : `Ing. ${tecnico}`,
      ci: ute?.ciTi ?? "4.139.492-7",
    },
    potenciaSolicitadaKw: potenciaSolicitadaKw ? Math.round(potenciaSolicitadaKw * 100) / 100 : null,
  };
}

function pdfFilename(clientName: string, version: number): string {
  return `justificacion_potencia_${clientName.replace(/[^\w-]+/g, "_")}_v${version}.pdf`;
}

export async function registerJustificacionPotenciaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Estado de la herramienta en un proyecto ────────────────────────────
  // Contexto para precargar + versiones (la última trae sus datos completos
  // para arrancar la versión nueva desde ahí).
  app.get(
    "/projects/:projectId/justificacion-potencia",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const contexto = await buildContexto(projectId);
      const versions = await prisma.justificacionPotenciaVersion.findMany({
        where: { projectId },
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          potenciaSolicitadaKw: true,
          textosConIa: true,
          createdAt: true,
          datos: true,
          createdBy: { select: { name: true } },
        },
      });
      const pdfVigente = await prisma.fileAttachment.findFirst({
        where: { projectId, toolSource: JUSTIFICACION_TOOL_SOURCE, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, toolEntityId: true },
      });
      return {
        contexto,
        ultimaVersionDatos: versions[0]?.datos ?? null,
        versions: versions.map((v) => {
          const datos = datosSchema.safeParse(v.datos);
          const balance = datos.success ? calcularBalance(datos.data) : null;
          return {
            id: v.id,
            versionNumber: v.versionNumber,
            potenciaSolicitadaKw: Number(v.potenciaSolicitadaKw),
            consumoAnualProyectadoKwh: balance?.consumoAnualProyectadoKwh ?? null,
            cumpleBalance: balance?.cumpleBalance ?? null,
            textosConIa: v.textosConIa,
            createdAt: serializeDate(v.createdAt),
            createdByName: v.createdBy.name,
            documentoId: pdfVigente?.toolEntityId === v.id ? pdfVigente.id : null,
          };
        }),
      };
    },
  );

  // ─── Textos automáticos ──────────────────────────────────────────────────
  // Sin IA ni costo: arma los textos con las frases fijas para que el
  // proyectista los vea y los edite antes de generar.
  app.post(
    "/projects/:projectId/justificacion-potencia/textos-automaticos",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      await ensureProject(projectId);
      const datos = parseDatos(request.body);
      return { textos: textosAutomaticos(datos, calcularBalance(datos)) };
    },
  );

  // ─── Redactar con IA ─────────────────────────────────────────────────────
  app.post(
    "/projects/:projectId/justificacion-potencia/redactar-ia",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      await ensureProject(projectId);
      const datos = parseDatos(request.body);
      const textos = await redactarTextosConIa(datos, { userId: user.id, projectId });
      return { textos };
    },
  );

  // ─── Generar versión nueva + PDF ─────────────────────────────────────────
  app.post(
    "/projects/:projectId/justificacion-potencia",
    { preHandler: authorize(Module.INGENIERIA, Action.EDIT) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const body = z.object({ datos: z.unknown(), textosConIa: z.boolean().default(false) }).parse(request.body);
      const datos = parseDatos(body.datos);
      const project = await ensureProject(projectId);

      const last = await prisma.justificacionPotenciaVersion.findFirst({
        where: { projectId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      });
      const versionNumber = (last?.versionNumber ?? 0) + 1;

      const created = await prisma.justificacionPotenciaVersion.create({
        data: {
          projectId,
          versionNumber,
          datos: datos as unknown as Prisma.InputJsonValue,
          potenciaSolicitadaKw: datos.potenciaSolicitadaKw,
          textosConIa: body.textosConIa,
          createdById: user.id,
        },
      });

      const pdf = await generateJustificacionPotenciaPdf(datos, { fecha: fechaUy(created.createdAt) });
      const anteriores = await prisma.fileAttachment.findMany({
        where: { projectId, toolSource: JUSTIFICACION_TOOL_SOURCE, deletedAt: null },
        select: { id: true, url: true },
      });
      const stored = await saveBufferAsAttachment(pdf, pdfFilename(project.clientName, versionNumber), "application/pdf", projectId);
      const attachment = await prisma.fileAttachment.create({
        data: {
          projectId,
          filename: stored.filename,
          storedFilename: stored.storedFilename,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          url: stored.url,
          tipo: FileAttachmentTipo.JUSTIFICACION_POTENCIA,
          toolSource: JUSTIFICACION_TOOL_SOURCE,
          toolVersion: versionNumber,
          toolEntityId: created.id,
          uploadedById: user.id,
        },
      });
      // En Documentos queda solo el informe vigente (mismo criterio que
      // Pre-Ingeniería); las versiones viejas se regeneran a pedido.
      if (anteriores.length > 0) {
        await prisma.fileAttachment.updateMany({
          where: { id: { in: anteriores.map((a) => a.id) } },
          data: { deletedAt: new Date() },
        });
        await Promise.all(anteriores.map((a) => deleteStoredFile(a.url).catch(() => undefined)));
      }

      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: attachment.id,
        projectId,
        userId: user.id,
        action: AuditAction.file_uploaded,
        description: `Generó la justificación de potencia ante UTE v${versionNumber} (${datos.potenciaSolicitadaKw} kW) para ${project.clientName}`,
      });

      reply.code(201);
      return {
        id: created.id,
        versionNumber,
        documentoId: attachment.id,
        previewUrl: `/api/files/${attachment.id}/preview`,
        downloadUrl: `/api/files/${attachment.id}/download`,
      };
    },
  );

  // ─── PDF de cualquier versión (regenerado desde sus datos) ───────────────
  app.get(
    "/justificacion-potencia/:id/pdf",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request, reply) => {
      const { id } = idParams.parse(request.params);
      const version = await prisma.justificacionPotenciaVersion.findUnique({
        where: { id },
        select: { versionNumber: true, datos: true, createdAt: true, project: { select: { clientName: true, deletedAt: true } } },
      });
      if (!version || version.project.deletedAt) throw notFound("JUSTIFICACION_NOT_FOUND", "Versión no encontrada");
      const datos = parseDatos(version.datos);
      const pdf = await generateJustificacionPotenciaPdf(datos, { fecha: fechaUy(version.createdAt) });
      const download = (request.query as { download?: string } | undefined)?.download === "1";
      reply
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `${download ? "attachment" : "inline"}; filename="${pdfFilename(version.project.clientName, version.versionNumber)}"`,
        );
      return reply.send(pdf);
    },
  );

  // ─── Eliminar versión ────────────────────────────────────────────────────
  app.delete(
    "/justificacion-potencia/:id",
    { preHandler: authorize(Module.INGENIERIA, Action.DELETE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const version = await prisma.justificacionPotenciaVersion.findUnique({
        where: { id },
        select: { id: true, projectId: true, versionNumber: true },
      });
      if (!version) throw notFound("JUSTIFICACION_NOT_FOUND", "Versión no encontrada");

      const pdfs = await prisma.fileAttachment.findMany({
        where: { projectId: version.projectId, toolSource: JUSTIFICACION_TOOL_SOURCE, toolEntityId: version.id, deletedAt: null },
        select: { id: true, url: true },
      });
      await prisma.justificacionPotenciaVersion.delete({ where: { id } });
      if (pdfs.length > 0) {
        await prisma.fileAttachment.updateMany({ where: { id: { in: pdfs.map((p) => p.id) } }, data: { deletedAt: new Date() } });
        await Promise.all(pdfs.map((p) => deleteStoredFile(p.url).catch(() => undefined)));
      }
      await createAuditEntry({
        entityType: AuditEntityType.file,
        entityId: version.id,
        projectId: version.projectId,
        userId: user.id,
        action: AuditAction.deleted,
        description: `Eliminó la justificación de potencia ante UTE v${version.versionNumber}`,
      });
      reply.code(204);
      return;
    },
  );
}

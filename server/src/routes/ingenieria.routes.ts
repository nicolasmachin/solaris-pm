// Endpoints del módulo Ingeniería: dashboard del módulo + workspace por
// proyecto. La identidad de "etapa Ingeniería de un proyecto" se determina
// por `Stage.name === StageType.INGENIERIA`. El estado del workspace se
// computa desde esa stage (status, progressPercent, substages count).
//
// Permiso: `Module.INGENIERIA, Action.VIEW` gobierna todo el módulo.
// (Sin granularidad por herramienta — decisión consensuada con el usuario.)

import { Action, FileAttachmentTipo, Module, StageStatus, StageType } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { notFound } from "../utils/errors.js";
import { serializeDate, serializeDateOnly } from "../utils/serialization.js";

type EngineeringStageSlim = {
  id: string;
  status: StageStatus;
  progressPercent: number;
  plannedStartDate: Date | null;
  plannedEndDate: Date | null;
  actualStartDate: Date | null;
  actualEndDate: Date | null;
  responsibleUserId: string | null;
  substages: { id: string; status: string }[];
};

// Etapas que constituyen "Ingeniería" de un proyecto. El pipeline viejo usaba
// una sola etapa `INGENIERIA`; el nuevo la divide en `PRE_INGENIERIA` +
// `INGENIERIA_FINAL`. El módulo agrega el estado de todas las presentes.
const ENGINEERING_STAGE_TYPES: StageType[] = [
  StageType.INGENIERIA,
  StageType.PRE_INGENIERIA,
  StageType.INGENIERIA_FINAL,
];

// Estado agregado de la ingeniería de un proyecto a partir de sus etapas de
// ingeniería (0, 1 o 2). null = el proyecto no tiene ninguna etapa de
// ingeniería (no debería pasar en proyectos con pipeline).
function aggregateEngineeringStatus(stages: { status: StageStatus }[]): StageStatus | null {
  if (stages.length === 0) return null;
  if (stages.every((s) => s.status === StageStatus.COMPLETED)) return StageStatus.COMPLETED;
  if (stages.some((s) => s.status === StageStatus.IN_PROGRESS)) return StageStatus.IN_PROGRESS;
  // Alguna completada + alguna pendiente ⇒ ingeniería arrancó pero no terminó.
  if (stages.some((s) => s.status === StageStatus.COMPLETED)) return StageStatus.IN_PROGRESS;
  return StageStatus.PENDING;
}

function estadoFromStatus(status: StageStatus | null): "Sin etapa" | "Sin iniciar" | "En proceso" | "Completada" {
  if (!status) return "Sin etapa";
  if (status === StageStatus.COMPLETED) return "Completada";
  if (status === StageStatus.IN_PROGRESS) return "En proceso";
  return "Sin iniciar";
}

// Agrega métricas de las etapas de ingeniería en un único "stage virtual".
function aggregateEngineeringStages(stages: EngineeringStageSlim[]) {
  if (stages.length === 0) return null;
  const substages = stages.flatMap((s) => s.substages);
  const minDate = (dates: (Date | null)[]) =>
    dates.filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const maxDate = (dates: (Date | null)[]) =>
    dates.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return {
    // stageId representativo: la etapa en proceso, si no la primera.
    id: (stages.find((s) => s.status === StageStatus.IN_PROGRESS) ?? stages[0]).id,
    status: aggregateEngineeringStatus(stages)!,
    progressPercent: Math.round(
      stages.reduce((acc, s) => acc + s.progressPercent, 0) / stages.length,
    ),
    plannedStartDate: minDate(stages.map((s) => s.plannedStartDate)),
    plannedEndDate: maxDate(stages.map((s) => s.plannedEndDate)),
    actualStartDate: minDate(stages.map((s) => s.actualStartDate)),
    actualEndDate: maxDate(stages.map((s) => s.actualEndDate)),
    responsibleUserId:
      (stages.find((s) => s.status === StageStatus.IN_PROGRESS) ?? stages[0]).responsibleUserId,
    substages,
  };
}

function countCompletedSubstages(substages: { status: string }[]) {
  return substages.filter((s) => s.status === "COMPLETED").length;
}

/**
 * Devuelve el label del badge para un documento generado por una herramienta
 * (ver tabla en `api.routes.ts /projects/:projectId/documents`). Mantener
 * sincronizado entre ambos endpoints.
 */
function buildToolSourceLabel(toolSource: string | null, toolVersion: number | null): string | null {
  if (toolSource === "unifilar") {
    return toolVersion ? `Ingeniería · Unifilar v${toolVersion}` : "Ingeniería · Unifilar";
  }
  if (toolSource === "materiales-con-precios") {
    return toolVersion
      ? `Ingeniería · Materiales v${toolVersion} (con precios)`
      : "Ingeniería · Materiales (con precios)";
  }
  if (toolSource === "materiales-sin-precios") {
    return toolVersion
      ? `Ingeniería · Materiales v${toolVersion} (sin precios)`
      : "Ingeniería · Materiales (sin precios)";
  }
  if (toolSource === "triangulos") {
    return toolVersion ? `Ingeniería · Triángulos v${toolVersion}` : "Ingeniería · Triángulos";
  }
  if (toolSource === "preing") {
    return toolVersion
      ? `Ingeniería · Pre-ingeniería v${toolVersion}`
      : "Ingeniería · Pre-ingeniería";
  }
  if (toolSource === "efp-attach") {
    return "Ingeniería · Anexo de Proyecto Final";
  }
  return null;
}

export async function registerIngenieriaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Dashboard del módulo ────────────────────────────────────────────────
  // Lista todos los proyectos con su etapa Ingeniería + stats agregadas.
  // No filtramos por estado: el cliente decide qué mostrar (filtros locales).
  app.get(
    "/ingenieria/dashboard",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async () => {
      const projects = await prisma.project.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          clientName: true,
          locationCity: true,
          locationProvince: true,
          capacityKwp: true,
          status: true,
          stages: {
            where: { name: { in: ENGINEERING_STAGE_TYPES }, deletedAt: null },
            select: {
              id: true,
              status: true,
              progressPercent: true,
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              responsibleUserId: true,
              substages: {
                where: { deletedAt: null, isActive: true },
                select: { id: true, status: true },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { code: "desc" },
      });

      const rows = projects.map((p) => {
        const stage = aggregateEngineeringStages(p.stages);
        const completed = stage ? countCompletedSubstages(stage.substages) : 0;
        const total = stage ? stage.substages.length : 0;
        return {
          projectId: p.id,
          projectCode: p.code,
          cliente: p.clientName,
          ubicacion: `${p.locationCity}, ${p.locationProvince}`,
          potenciaKwp: Number(p.capacityKwp),
          subetapasCompletas: completed,
          subetapasTotales: total,
          progressPercent: stage?.progressPercent ?? 0,
          stageStatus: stage?.status ?? null,
          estado: estadoFromStatus(stage?.status ?? null),
          actualStartDate: serializeDateOnly(stage?.actualStartDate ?? null),
          actualEndDate: serializeDateOnly(stage?.actualEndDate ?? null),
          plannedEndDate: serializeDateOnly(stage?.plannedEndDate ?? null),
        };
      });

      // Stats: usamos el mismo conjunto. "Completadas últimos 30d" filtra por
      // actualEndDate dentro del rango.
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const enCola = rows.filter((r) => r.stageStatus === StageStatus.PENDING).length;
      const enProceso = rows.filter((r) => r.stageStatus === StageStatus.IN_PROGRESS).length;
      const completadas30d = rows.filter((r) => {
        if (r.stageStatus !== StageStatus.COMPLETED) return false;
        if (!r.actualEndDate) return false;
        return new Date(r.actualEndDate) >= thirtyDaysAgo;
      }).length;

      return {
        stats: { enCola, enProceso, completadas30d },
        projects: rows,
      };
    },
  );

  // ─── Workspace de un proyecto ────────────────────────────────────────────
  // Datos del proyecto + estado de la etapa + lista de herramientas (estado
  // dinámico por proyecto) + documentos generados por herramientas (lectura).
  app.get(
    "/ingenieria/proyecto/:projectId",
    { preHandler: authorize(Module.INGENIERIA, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string() }).parse(request.params);

      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: {
          id: true,
          code: true,
          clientName: true,
          locationCity: true,
          locationProvince: true,
          capacityKwp: true,
          status: true,
          stages: {
            where: { name: { in: ENGINEERING_STAGE_TYPES }, deletedAt: null },
            select: {
              id: true,
              status: true,
              progressPercent: true,
              plannedStartDate: true,
              plannedEndDate: true,
              actualStartDate: true,
              actualEndDate: true,
              responsibleUserId: true,
              substages: {
                where: { deletedAt: null, isActive: true },
                select: { id: true, status: true },
              },
            },
            orderBy: { order: "asc" },
          },
        },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const stage = aggregateEngineeringStages(project.stages);
      const completed = stage ? countCompletedSubstages(stage.substages) : 0;
      const total = stage ? stage.substages.length : 0;

      // Estado dinámico de cada herramienta por proyecto.
      const unifilarCount = await prisma.unifilarVersion.count({
        where: { projectId: project.id },
      });
      const materialesCount = await prisma.projectMaterial.count({
        where: { projectId: project.id },
      });
      // Última versión de PDF de triángulos (incluye soft-deleted para mostrar
      // "vN" del último guardado, no "0 versiones" después de regenerar).
      const lastTriangulosVersion = await prisma.fileAttachment.findFirst({
        where: { projectId: project.id, toolSource: "triangulos", deletedAt: null },
        orderBy: { toolVersion: "desc" },
        select: { toolVersion: true },
      });
      const preIngenieriaCount = await prisma.preIngenieriaVersion.count({
        where: { projectId: project.id },
      });
      const visitasInfo = await prisma.technicalVisit.aggregate({
        where: { projectId: project.id, deletedAt: null },
        _count: { id: true },
      });
      const visitasCount = visitasInfo._count.id;
      const reportesCount = await prisma.visitReport.count({
        where: { visit: { projectId: project.id, deletedAt: null } },
      });
      const efpInfo = await prisma.engineeringFinalProject.findFirst({
        where: { projectId: project.id, deletedAt: null },
        select: {
          status: true,
          versions: { orderBy: { version: "desc" }, take: 1, select: { version: true } },
          _count: { select: { versions: true } },
        },
      });
      const efpVersionsCount = efpInfo?._count.versions ?? 0;
      const efpLastVersion = efpInfo?.versions[0]?.version ?? null;
      const efpStatus = efpInfo?.status ?? null;

      type ToolCard = {
        key: string;
        nombre: string;
        icono: string;
        estado: string;
        disponible: boolean;
        ruta: string | null;
      };
      const herramientas: ToolCard[] = [
        {
          key: "unifilar",
          nombre: "Generador de unifilar",
          icono: "lightning",
          estado:
            unifilarCount === 0
              ? "0 versiones generadas"
              : `${unifilarCount} ${unifilarCount === 1 ? "versión" : "versiones"} generada${unifilarCount === 1 ? "" : "s"}`,
          disponible: true,
          ruta: `/ingenieria/proyecto/${project.id}/unifilar`,
        },
        {
          key: "materiales",
          nombre: "Lista de materiales",
          icono: "package",
          estado:
            materialesCount === 0
              ? "Sin ítems cargados"
              : `${materialesCount} ${materialesCount === 1 ? "ítem" : "ítems"}`,
          disponible: true,
          ruta: null,
        },
        {
          key: "triangulos",
          nombre: "Cálculos estructurales (triángulos)",
          icono: "triangle",
          estado: lastTriangulosVersion?.toolVersion
            ? `Última versión guardada: v${lastTriangulosVersion.toolVersion}`
            : "Sin cálculos guardados",
          disponible: true,
          ruta: null,
        },
        {
          key: "preing",
          nombre: "Pre-ingeniería",
          icono: "clipboard",
          estado:
            preIngenieriaCount === 0
              ? "Sin versiones generadas"
              : `${preIngenieriaCount} ${preIngenieriaCount === 1 ? "versión" : "versiones"} generada${preIngenieriaCount === 1 ? "" : "s"}`,
          disponible: true,
          ruta: null,
        },
        {
          key: "visitas",
          nombre: "Visita técnica (operario)",
          icono: "mic",
          estado:
            visitasCount === 0
              ? "Sin visitas registradas"
              : `${visitasCount} visita${visitasCount === 1 ? "" : "s"} · ${reportesCount} informe${reportesCount === 1 ? "" : "s"}`,
          disponible: true,
          ruta: null,
        },
        {
          key: "efp",
          nombre: "Proyecto Final de Ingeniería",
          icono: "book",
          estado:
            efpVersionsCount === 0
              ? "Sin versiones generadas"
              : `v${efpLastVersion ?? "?"} · ${efpVersionsCount} ${efpVersionsCount === 1 ? "versión" : "versiones"}${efpStatus ? ` · ${efpStatus}` : ""}`,
          disponible: true,
          ruta: `/ingenieria/proyecto/${project.id}/proyecto-final`,
        },
        {
          key: "memoria",
          nombre: "Memoria técnica",
          icono: "doc",
          estado: "Próximamente",
          disponible: false,
          ruta: null,
        },
      ];

      // Documentos generados por herramientas del módulo (toolSource != null).
      const docs = await prisma.fileAttachment.findMany({
        where: {
          projectId: project.id,
          deletedAt: null,
          toolSource: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          tipo: true,
          toolSource: true,
          toolVersion: true,
          toolEntityId: true,
          createdAt: true,
        },
      });

      const documentos = docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        tipo: d.tipo,
        toolSource: d.toolSource,
        toolVersion: d.toolVersion,
        toolEntityId: d.toolEntityId,
        sourceLabel: buildToolSourceLabel(d.toolSource, d.toolVersion),
        createdAt: serializeDate(d.createdAt),
        downloadUrl: `/api/files/${d.id}/download`,
        previewUrl: `/api/files/${d.id}/preview`,
      }));

      return {
        project: {
          id: project.id,
          code: project.code,
          cliente: project.clientName,
          ubicacion: `${project.locationCity}, ${project.locationProvince}`,
          potenciaKwp: Number(project.capacityKwp),
          status: project.status,
        },
        etapa: {
          stageId: stage?.id ?? null,
          status: stage?.status ?? null,
          progressPercent: stage?.progressPercent ?? 0,
          subetapasCompletas: completed,
          subetapasTotales: total,
          estado: estadoFromStatus(stage?.status ?? null),
          plannedStartDate: serializeDateOnly(stage?.plannedStartDate ?? null),
          plannedEndDate: serializeDateOnly(stage?.plannedEndDate ?? null),
          actualStartDate: serializeDateOnly(stage?.actualStartDate ?? null),
          actualEndDate: serializeDateOnly(stage?.actualEndDate ?? null),
          responsibleUserId: stage?.responsibleUserId ?? null,
        },
        herramientas,
        documentos,
      };
    },
  );

  // Suprimir warning de import no usado (quedan para futuras herramientas).
  void FileAttachmentTipo;
}

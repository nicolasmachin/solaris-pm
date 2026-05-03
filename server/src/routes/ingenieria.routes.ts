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

function computeEstado(stage: EngineeringStageSlim | null): "Sin etapa" | "Sin iniciar" | "En proceso" | "Completada" {
  if (!stage) return "Sin etapa";
  if (stage.status === StageStatus.COMPLETED) return "Completada";
  if (stage.status === StageStatus.IN_PROGRESS) return "En proceso";
  return "Sin iniciar";
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
            where: { name: StageType.INGENIERIA, deletedAt: null },
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
            take: 1,
          },
        },
        orderBy: { code: "desc" },
      });

      const rows = projects.map((p) => {
        const stage = p.stages[0] ?? null;
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
          estado: computeEstado(stage),
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
            where: { name: StageType.INGENIERIA, deletedAt: null },
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
            take: 1,
          },
        },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const stage = project.stages[0] ?? null;
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
          estado: computeEstado(stage),
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

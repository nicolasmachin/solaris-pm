// Precarga del documento del plan desde el proyecto y su plan de granizo (si ya
// existe). Todo es editable en el formulario.

import { prisma } from "../../../lib/prisma.js";
import { getAnclaMantenimiento } from "../../../utils/aniversario.js";
import { notFound } from "../../../utils/errors.js";
import { precioPlanPorPanelUsd, resolverCantidadPaneles, TOOL_SOURCE_FOTOS_INICIO } from "../polizas.service.js";

export const EMPRESA_DEFAULT = {
  razonSocial: "Voltia SAS",
  rut: "221075240012",
  domicilio: "Av. Gral. Rondeau 2110, Montevideo",
};

export interface PlanGranizoDocContext {
  cliente: { nombre?: string; documento?: string; direccion?: string; telefono?: string; email?: string };
  plan: {
    cantidadPaneles?: number;
    precioPorPanelUsd: number;
    instalacion: "NUEVA" | "EXISTENTE";
    inversorSerie?: string;
    fotosAdjuntas: boolean | null;
  };
  empresa: typeof EMPRESA_DEFAULT;
  // Si el proyecto es una ampliación, el plan es el de la obra original.
  esAmpliacionDe: { projectId: string; clientName: string } | null;
}

function nonEmpty(s: string | null | undefined): string | undefined {
  return s && s.trim() ? s.trim() : undefined;
}

export async function buildPlanGranizoDocContext(projectId: string): Promise<PlanGranizoDocContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      clientName: true,
      nombreCliente: true,
      ciCliente: true,
      calle: true,
      numCalle: true,
      locationCity: true,
      locationProvince: true,
      clientAddress: true,
      clientPhone: true,
      clientEmail: true,
      postHabilitacionInicioEn: true,
      actualUteEnd: true,
      parentProject: { select: { id: true, clientName: true } },
      seguroGranizoPoliza: {
        select: { id: true, cantidadPaneles: true, precioPorPanelUsd: true, sinCarencia: true, inversorSerie: true },
      },
    },
  });
  if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe.");

  const calle = [project.calle, project.numCalle].map((x) => x?.trim()).filter(Boolean).join(" ");
  const direccion =
    [nonEmpty(calle), nonEmpty(project.locationCity), nonEmpty(project.locationProvince)].filter(Boolean).join(", ") ||
    nonEmpty(project.clientAddress);

  const poliza = project.seguroGranizoPoliza;
  const [paneles, precio] = await Promise.all([resolverCantidadPaneles(projectId), precioPlanPorPanelUsd()]);
  const puestaEnMarcha = getAnclaMantenimiento(project);

  // Instalación nueva (adhesión con la obra) si ya lo dice el plan; si no hay
  // plan, si la obra todavía no está en marcha.
  const instalacion = (poliza ? poliza.sinCarencia : !puestaEnMarcha) ? "NUEVA" : "EXISTENTE";
  const fotos = poliza
    ? await prisma.fileAttachment.count({
        where: { toolSource: TOOL_SOURCE_FOTOS_INICIO, toolEntityId: poliza.id, deletedAt: null },
      })
    : 0;

  return {
    cliente: {
      nombre: nonEmpty(project.nombreCliente) ?? nonEmpty(project.clientName),
      documento: nonEmpty(project.ciCliente),
      direccion,
      telefono: nonEmpty(project.clientPhone),
      email: nonEmpty(project.clientEmail),
    },
    plan: {
      cantidadPaneles: poliza?.cantidadPaneles ?? paneles.cantidad ?? undefined,
      precioPorPanelUsd: poliza ? Number(poliza.precioPorPanelUsd) : precio,
      instalacion,
      inversorSerie: nonEmpty(poliza?.inversorSerie),
      fotosAdjuntas: instalacion === "EXISTENTE" ? fotos > 0 : null,
    },
    empresa: EMPRESA_DEFAULT,
    esAmpliacionDe: project.parentProject ? { projectId: project.parentProject.id, clientName: project.parentProject.clientName } : null,
  };
}

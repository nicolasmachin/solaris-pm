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

// Tipos de `device/list` de Growatt que son inversores (el 3 es el medidor).
const TIPOS_INVERSOR_GROWATT = [1, 4, 5, 7];

/**
 * Serie de los inversores del proyecto según Growatt, de lo que guardó la última
 * ingesta. Con varios (un inversor por suministro) van todos, separados por " / ".
 * Solo Growatt: las plantas Huawei no se miran acá.
 */
async function seriesInversorGrowatt(projectId: string): Promise<string | undefined> {
  const equipos = await prisma.growattDevice.findMany({
    where: { tipo: { in: TIPOS_INVERSOR_GROWATT }, plant: { projectId } },
    orderBy: { primeraVezEn: "asc" },
    select: { deviceSn: true },
  });
  const series = [...new Set(equipos.map((e) => e.deviceSn.trim()).filter(Boolean))];
  return series.length ? series.join(" / ") : undefined;
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
  // Número de serie del inversor. Instalación nueva: queda en blanco, porque el
  // documento se genera en el onboarding y el inversor todavía no existe.
  // Instalación que ya funciona: si el plan no lo tiene cargado, se toma de
  // Growatt (los equipos de sus plantas, que guarda la ingesta).
  const serieGrowatt =
    instalacion === "EXISTENTE" && !nonEmpty(poliza?.inversorSerie)
      ? await seriesInversorGrowatt(projectId)
      : undefined;
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
      inversorSerie: nonEmpty(poliza?.inversorSerie) ?? serieGrowatt,
      fotosAdjuntas: instalacion === "EXISTENTE" ? fotos > 0 : null,
    },
    empresa: EMPRESA_DEFAULT,
    esAmpliacionDe: project.parentProject ? { projectId: project.parentProject.id, clientName: project.parentProject.clientName } : null,
  };
}

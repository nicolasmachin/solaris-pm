// Catálogo de plantas Growatt: sincronización con la API + vinculación a
// proyectos. El plantId es la entidad canónica; el matching por nombre queda
// sólo como SUGERENCIA en la UI, nunca en runtime.

import { prisma } from "../../../lib/prisma.js";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { createAuditEntry } from "../../audit.service.js";
import { notFound } from "../../../utils/errors.js";
import { listarPlantas } from "./client.js";

/** Normaliza un nombre para comparar (sin tildes, minúsculas, sin "~"/espacios). */
function normalizar(v: string): string {
  return v
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[~"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trae el inventario de la API y lo upsertea en GrowattPlant. Las plantas nuevas
 * quedan sin vincular; las conocidas actualizan nombre y `ultimaVezEn`. No toca
 * las vinculaciones existentes.
 */
export async function sincronizarPlantas(): Promise<{ total: number; nuevas: number }> {
  const plantas = await listarPlantas();
  const existentes = new Set(
    (await prisma.growattPlant.findMany({ select: { plantId: true } })).map((p) => p.plantId.toString()),
  );

  let nuevas = 0;
  for (const p of plantas) {
    const esNueva = !existentes.has(p.plantId);
    if (esNueva) nuevas++;
    await prisma.growattPlant.upsert({
      where: { plantId: BigInt(p.plantId) },
      create: {
        plantId: BigInt(p.plantId),
        name: p.name,
        status: p.status ?? null,
        peakPowerKw: p.peakPowerKw ?? null,
        city: p.city ?? null,
        country: p.country ?? null,
      },
      update: {
        name: p.name,
        status: p.status ?? null,
        ultimaVezEn: new Date(),
      },
    });
  }
  return { total: plantas.length, nuevas };
}

/**
 * Catálogo de plantas para la UI de vinculación. Para las no vinculadas, sugiere
 * proyectos por similitud de nombre (sólo sugerencia; el usuario confirma).
 */
export async function listarPlantasConSugerencias() {
  const plantas = await prisma.growattPlant.findMany({
    orderBy: [{ ignorada: "asc" }, { projectId: "asc" }, { name: "asc" }],
    include: { project: { select: { id: true, clientName: true } } },
  });

  // Proyectos candidatos (los mismos del universo del panel).
  const proyectos = await prisma.project.findMany({
    where: {
      deletedAt: null,
      OR: [{ importedFromCsv: true }, { postHabilitacionInicioEn: { not: null } }, { actualUteEnd: { not: null } }],
    },
    select: { id: true, clientName: true },
  });
  const proyectosNorm = proyectos.map((p) => ({ ...p, norm: normalizar(p.clientName) }));

  return plantas.map((pl) => {
    let sugerencias: Array<{ id: string; clientName: string }> = [];
    if (!pl.projectId && !pl.ignorada) {
      const n = normalizar(pl.name);
      sugerencias = proyectosNorm
        .filter((p) => p.norm === n || p.norm.includes(n) || n.includes(p.norm))
        .slice(0, 3)
        .map((p) => ({ id: p.id, clientName: p.clientName }));
    }
    return {
      plantId: pl.plantId.toString(),
      name: pl.name,
      status: pl.status,
      peakPowerKw: pl.peakPowerKw ? Number(pl.peakPowerKw) : null,
      ignorada: pl.ignorada,
      projectId: pl.projectId,
      projectName: pl.project?.clientName ?? null,
      sugerencias,
    };
  });
}

/**
 * Vincula (o desvincula, o marca ignorada) una planta a un proyecto. Denormaliza
 * el plantId en la config del proyecto para las consultas rápidas del panel.
 */
export async function vincularPlanta(
  plantId: string,
  input: { projectId: string | null; ignorada?: boolean },
  userId: string,
): Promise<void> {
  const planta = await prisma.growattPlant.findUnique({ where: { plantId: BigInt(plantId) } });
  if (!planta) throw notFound("PLANTA_NO_ENCONTRADA", "La planta Growatt no existe");

  await prisma.$transaction(async (tx) => {
    // Si la planta estaba vinculada a otro proyecto, limpiar su denormalizado.
    if (planta.projectId && planta.projectId !== input.projectId) {
      await tx.reporteFvConfig
        .updateMany({ where: { projectId: planta.projectId, growattPlantId: BigInt(plantId) }, data: { growattPlantId: null } })
        .catch(() => undefined);
    }

    await tx.growattPlant.update({
      where: { plantId: BigInt(plantId) },
      data: {
        projectId: input.projectId,
        ignorada: input.ignorada ?? (input.projectId ? false : planta.ignorada),
        vinculadaPorId: input.projectId ? userId : null,
        vinculadaEn: input.projectId ? new Date() : null,
      },
    });

    // Denormalizar en la config del proyecto (si tiene config).
    if (input.projectId) {
      await tx.reporteFvConfig
        .updateMany({
          where: { projectId: input.projectId },
          data: { growattPlantId: BigInt(plantId), origenDatos: "GROWATT" },
        })
        .catch(() => undefined);
    }
  });

  await createAuditEntry({
    entityType: AuditEntityType.reporte_fv_config,
    entityId: input.projectId ?? plantId,
    projectId: input.projectId ?? undefined,
    userId,
    action: AuditAction.updated,
    description: input.projectId
      ? `Vinculó la planta Growatt ${plantId} a un proyecto`
      : input.ignorada
        ? `Marcó la planta Growatt ${plantId} como ignorada`
        : `Desvinculó la planta Growatt ${plantId}`,
  });
}

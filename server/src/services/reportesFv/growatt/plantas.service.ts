// Catálogo de plantas Growatt: sincronización con la API + vinculación a
// proyectos. El plantId es la entidad canónica; el matching por nombre queda
// sólo como SUGERENCIA en la UI, nunca en runtime.

import { prisma } from "../../../lib/prisma.js";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { createAuditEntry } from "../../audit.service.js";
import { notFound } from "../../../utils/errors.js";
import { detallePlanta, growattDormir, growattPausaMs, listarPlantas } from "./client.js";

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
 * Cuenta de Growatt propia. Si está configurada, la sincronización descarta las
 * plantas de otras cuentas.
 *
 * Hace falta porque el token de la Open API no está acotado a una cuenta:
 * alcanza a todas las que cuelgan de la misma jerarquía. En el catálogo real,
 * 87 de 152 plantas visibles son de otra empresa instaladora — nombres de
 * personas que no son clientes nuestros y que no tenemos por qué guardar.
 */
function cuentaPropia(): number | null {
  const v = Number(process.env.GROWATT_USER_ID);
  return Number.isFinite(v) && v > 0 ? v : null;
}

export interface ResultadoSincronizacion {
  total: number;
  nuevas: number;
  /** Descartadas por pertenecer a otra cuenta de Growatt. */
  ajenas: number;
  /** Plantas propias que todavía no están vinculadas a un proyecto. */
  sinVincular: number;
}

/**
 * Trae el inventario de la API y lo upsertea en GrowattPlant. Las plantas nuevas
 * quedan sin vincular; las conocidas actualizan nombre y `ultimaVezEn`. No toca
 * las vinculaciones existentes.
 *
 * Para saber de qué cuenta es cada planta hay que pedir `plant/details`, porque
 * `plant/list` no trae el dueño. Se hace UNA sola vez por planta (las que ya
 * tienen `ownerUserId` no se vuelven a consultar), así que el costo se paga
 * sólo la primera vez y no en cada corrida.
 */
export async function sincronizarPlantas(): Promise<ResultadoSincronizacion> {
  const plantas = await listarPlantas();
  const conocidas = new Map(
    (await prisma.growattPlant.findMany({ select: { plantId: true, ownerUserId: true } })).map((p) => [
      p.plantId.toString(),
      p.ownerUserId,
    ]),
  );
  const propia = cuentaPropia();

  let nuevas = 0;
  let ajenas = 0;

  for (const p of plantas) {
    const yaConocida = conocidas.has(p.plantId);
    let owner = conocidas.get(p.plantId) ?? null;

    // Sólo se averigua el dueño si todavía no se sabe.
    if (owner == null) {
      try {
        owner = (await detallePlanta(p.plantId)).userId;
        await growattDormir(growattPausaMs);
      } catch {
        // Si la API no responde, se sigue sin el dato: se completa la próxima vez.
      }
    }

    if (propia != null && owner != null && owner !== propia) {
      ajenas++;
      // No se crea ni se actualiza: no es nuestra y no la queremos en la base.
      // Si ya existía (migrada de la planilla vieja), se la marca para que no
      // aparezca como pendiente de vincular, pero no se borra: borrar datos es
      // una decisión aparte y explícita.
      if (yaConocida) {
        await prisma.growattPlant.updateMany({
          where: { plantId: BigInt(p.plantId), projectId: null },
          data: { ownerUserId: owner, ignorada: true },
        });
      }
      continue;
    }

    if (!yaConocida) nuevas++;
    await prisma.growattPlant.upsert({
      where: { plantId: BigInt(p.plantId) },
      create: {
        plantId: BigInt(p.plantId),
        name: p.name,
        status: p.status ?? null,
        peakPowerKw: p.peakPowerKw ?? null,
        city: p.city ?? null,
        country: p.country ?? null,
        ownerUserId: owner,
      },
      update: {
        name: p.name,
        status: p.status ?? null,
        ultimaVezEn: new Date(),
        // Se completan los que faltaban sin pisar lo que ya estaba cargado.
        ...(owner != null ? { ownerUserId: owner } : {}),
        ...(p.peakPowerKw != null ? { peakPowerKw: p.peakPowerKw } : {}),
        ...(p.city != null ? { city: p.city } : {}),
      },
    });
  }

  const sinVincular = await contarPendientesDeVincular();
  return { total: plantas.length, nuevas, ajenas, sinVincular };
}

/**
 * Plantas propias listas para vincular a un proyecto. Es el número que se
 * muestra en el panel: si nadie lo ve, las plantas nuevas se acumulan sin que
 * nadie las vincule, que es exactamente lo que venía pasando.
 */
export async function contarPendientesDeVincular(): Promise<number> {
  return prisma.growattPlant.count({ where: { projectId: null, ignorada: false } });
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

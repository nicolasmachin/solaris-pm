// Catálogo de plantas de FusionSolar: sincronización y vinculación a proyectos.
//
// Mucho más simple que el de Growatt porque el usuario Northbound está acotado a
// la empresa Voltia: TODO lo que devuelve la API es nuestro. En Growatt el token
// alcanza plantas de otras instaladoras (87 de 152 medidas) y hay que filtrar por
// ownerUserId; acá no hace falta, y las plantas nuevas entran solas.

import { ReporteFvOrigenDatos } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { listarPlantas } from "./client.js";

export interface ResumenSyncHuawei {
  total: number;
  nuevas: number;
  actualizadas: number;
}

/** Trae el catálogo y lo espeja en `huawei_plants`. Idempotente. */
export async function sincronizarPlantasHuawei(): Promise<ResumenSyncHuawei> {
  const plantas = await listarPlantas();
  let nuevas = 0;
  let actualizadas = 0;

  for (const p of plantas) {
    const existente = await prisma.huaweiPlant.findUnique({ where: { plantCode: p.plantCode } });
    const datos = {
      name: p.name,
      // FusionSolar deja la capacidad en 0 cuando no la cargaron (Estilo, Sosa).
      // 0 no es un dato, es un campo vacío: se guarda null para no pisar lo que
      // el proyecto ya sabe de la instalación.
      capacityKwp: p.capacityKwp && p.capacityKwp > 0 ? p.capacityKwp : null,
      gridConnectionDate: p.gridConnectionDate,
      address: p.address,
      ultimaVezEn: new Date(),
    };

    if (existente) {
      await prisma.huaweiPlant.update({ where: { id: existente.id }, data: datos });
      actualizadas++;
    } else {
      await prisma.huaweiPlant.create({ data: { plantCode: p.plantCode, ...datos } });
      nuevas++;
    }
  }

  return { total: plantas.length, nuevas, actualizadas };
}

/** Plantas listas para ingerir: vinculadas a un proyecto y no ignoradas. */
export async function plantasHuaweiVinculadas() {
  return prisma.huaweiPlant.findMany({
    where: { projectId: { not: null }, ignorada: false },
    select: { id: true, plantCode: true, name: true, projectId: true, gridConnectionDate: true },
  });
}

export async function vincularPlantaHuawei(
  plantCode: string,
  projectId: string | null,
  userId: string,
) {
  const planta = await prisma.huaweiPlant.update({
    where: { plantCode },
    data: {
      projectId,
      vinculadaPorId: projectId ? userId : null,
      vinculadaEn: projectId ? new Date() : null,
    },
  });
  if (projectId) await marcarOrigenHuawei(projectId);
  return planta;
}

/**
 * Deja la config del proyecto en origen HUAWEI. Sin esto el generador queda
 * marcado como Growatt (el default del modelo) y el panel lo muestra esperando
 * datos de una API que nunca lo va a tener.
 *
 * Sólo actúa si la config existe: crearla acá sería inventar potencia contratada
 * y reparto de franjas, que son datos de la factura del cliente.
 */
export async function marcarOrigenHuawei(projectId: string): Promise<void> {
  await prisma.reporteFvConfig.updateMany({
    where: { projectId },
    data: { origenDatos: ReporteFvOrigenDatos.HUAWEI },
  });
}

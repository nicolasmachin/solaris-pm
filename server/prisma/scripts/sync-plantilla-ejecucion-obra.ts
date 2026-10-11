/**
 * Pasa la etapa Ejecución de Obra de la plantilla guardada (settings →
 * PIPELINE_TEMPLATE) a las subetapas nuevas del código (10-oct-2026):
 * Planificación y logística · Realización de la obra · Retiro de sobrantes ·
 * Control de obra.
 *
 *   docker compose exec server npx tsx prisma/scripts/sync-plantilla-ejecucion-obra.ts          # muestra qué haría
 *   docker compose exec server npx tsx prisma/scripts/sync-plantilla-ejecucion-obra.ts --apply  # aplica
 *
 * Solo toca la plantilla: la usan los proyectos que se crean de acá en adelante.
 * Las obras que ya existen conservan sus subetapas, a propósito (decisión de
 * Nicolás: la estructura nueva es para las obras nuevas). Sin plantilla guardada
 * no hace nada, porque ya se usa la del código. Idempotente.
 */

import { PrismaClient, SettingKey, SettingLevel, StageType } from "@prisma/client";

import { getStageDefinition, type SubstageTemplate } from "../../src/services/pipeline-definitions.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const def = getStageDefinition(StageType.EJECUCION_OBRA);
  if (!def) throw new Error("Ejecución de Obra no está en PIPELINE_DEFINITIONS");

  const setting = await prisma.setting.findFirst({
    where: { key: SettingKey.PIPELINE_TEMPLATE, level: SettingLevel.SYSTEM },
  });
  if (!setting?.value) {
    console.log("No hay plantilla guardada: se usa la del código. Nada que hacer.");
    return;
  }

  const parsed = JSON.parse(setting.value) as { stages?: Array<{ name: string; substages: SubstageTemplate[] }> };
  const etapa = parsed.stages?.find((s) => s.name === StageType.EJECUCION_OBRA);
  if (!etapa) {
    console.log("La plantilla guardada no tiene Ejecución de Obra; no se toca.");
    return;
  }

  const antes = etapa.substages.map((s) => `${s.order}. ${s.name}${s.isActive === false ? " (inactiva)" : ""}`);
  const despues = def.substages.map((s) => `${s.order}. ${s.name}`);
  if (JSON.stringify(etapa.substages) === JSON.stringify(def.substages)) {
    console.log("La plantilla ya tiene las subetapas nuevas.");
    return;
  }

  console.log("Antes:\n  " + antes.join("\n  "));
  console.log("Después:\n  " + despues.join("\n  "));
  if (!APPLY) {
    console.log("\nSimulación: agregá --apply para guardarlo.");
    return;
  }
  etapa.substages = def.substages;
  await prisma.setting.update({ where: { id: setting.id }, data: { value: JSON.stringify(parsed) } });
  console.log("\nPlantilla actualizada.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

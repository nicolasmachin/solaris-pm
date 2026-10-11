/**
 * El contrato firmado no frena el onboarding (decisión del 11-oct-2026).
 *
 *   docker compose exec server npx tsx prisma/scripts/contrato-firmado-no-bloquea.ts          # muestra qué haría
 *   docker compose exec server npx tsx prisma/scripts/contrato-firmado-no-bloquea.ts --apply  # aplica
 *
 * 1. En la plantilla guardada (settings → PIPELINE_TEMPLATE), los ítems "Recibido
 *    firmado" (Contrato) y "Crédito aprobado" (Modalidad de pago) del Onboarding
 *    pasan a no obligatorios ni bloqueantes, y se saca la subetapa "Registro en planilla de operaciones" si
 *    sigue ahí.
 * 2. En los proyectos con el Onboarding sin completar, los mismos ítems pasan a
 *    no obligatorios ni bloqueantes.
 * Idempotente.
 */

import { PrismaClient, SettingKey, SettingLevel, StageStatus, StageType } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
// Ítems del Onboarding que dejaron de frenarlo: el contrato firmado y la
// aprobación del crédito bancario (los sigue el asesor aparte).
const LABELS = ["Recibido firmado", "Crédito aprobado"];

type Item = { label: string; isRequired?: boolean; isBlocker?: boolean };
type Sub = { name: string; checklist?: Item[] };

async function main() {
  console.log(APPLY ? "== APLICANDO ==\n" : "== Simulación (agregá --apply) ==\n");

  const setting = await prisma.setting.findFirst({
    where: { key: SettingKey.PIPELINE_TEMPLATE, level: SettingLevel.SYSTEM },
  });
  if (setting?.value) {
    const parsed = JSON.parse(setting.value) as { stages?: Array<{ name: string; substages: Sub[] }> };
    const etapa = parsed.stages?.find((s) => s.name === StageType.ONBOARDING);
    let cambios = 0;
    if (etapa) {
      const antes = etapa.substages.length;
      etapa.substages = etapa.substages.filter((s) => s.name !== "Registro en planilla de operaciones");
      if (etapa.substages.length !== antes) cambios++;
      for (const sub of etapa.substages) {
        for (const it of sub.checklist ?? []) {
          if (LABELS.includes(it.label) && (it.isRequired || it.isBlocker)) {
            it.isRequired = false;
            it.isBlocker = false;
            cambios++;
          }
        }
      }
    }
    console.log(`Plantilla guardada: ${cambios} cambio(s).`);
    if (cambios && APPLY) {
      await prisma.setting.update({ where: { id: setting.id }, data: { value: JSON.stringify(parsed) } });
    }
  } else {
    console.log("Plantilla guardada: no hay.");
  }

  const items = await prisma.checklistItem.findMany({
    where: {
      label: { in: LABELS },
      OR: [{ isRequired: true }, { isBlocker: true }],
      substage: {
        stage: { name: StageType.ONBOARDING, status: { not: StageStatus.COMPLETED } },
        project: { deletedAt: null },
      },
    },
    select: { id: true },
  });
  console.log(`Ítems en proyectos con Onboarding abierto: ${items.length}.`);
  if (APPLY && items.length) {
    await prisma.checklistItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { isRequired: false, isBlocker: false },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

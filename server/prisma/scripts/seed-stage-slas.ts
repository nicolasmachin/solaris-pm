// Siembra los plazos por etapa (StageSla, en días hábiles) con valores por
// defecto razonables, SIN correr el seed completo. Idempotente: NO pisa filas
// existentes (upsert con update vacío), así los valores que el admin ya ajustó
// en la app se respetan. Corré esto una vez en prod tras migrar:
//
//   docker compose exec server npx tsx prisma/scripts/seed-stage-slas.ts
//
// Después, invalidá el cache (reiniciar server) o esperá los 5 min de TTL.

import { PrismaClient, StageType } from "@prisma/client";

const prisma = new PrismaClient();

// Defaults en días hábiles. Placeholders sensatos; el admin los ajusta desde
// "Plazos por etapa". Las etapas paralelas/indefinidas no llevan SLA.
export const DEFAULT_STAGE_SLAS: Array<{ stageType: StageType; diasHabiles: number }> = [
  { stageType: StageType.ONBOARDING, diasHabiles: 15 },
  { stageType: StageType.PRE_INGENIERIA, diasHabiles: 10 },
  { stageType: StageType.VALIDACION_OPERACIONES, diasHabiles: 5 },
  { stageType: StageType.INGENIERIA, diasHabiles: 10 },
  { stageType: StageType.INGENIERIA_FINAL, diasHabiles: 10 },
  { stageType: StageType.COMPRAS, diasHabiles: 10 },
  { stageType: StageType.EJECUCION_OBRA, diasHabiles: 10 },
  { stageType: StageType.TRAMITACION_UTE, diasHabiles: 20 },
  { stageType: StageType.HABILITACION_UTE, diasHabiles: 20 },
  { stageType: StageType.OPERACIONES, diasHabiles: 10 },
];

export async function seedStageSlas(client: PrismaClient = prisma): Promise<number> {
  let created = 0;
  for (const sla of DEFAULT_STAGE_SLAS) {
    const existing = await client.stageSla.findUnique({ where: { stageType: sla.stageType } });
    if (existing) continue; // no pisar lo ya configurado
    await client.stageSla.create({
      data: { stageType: sla.stageType, diasHabiles: sla.diasHabiles, activo: true },
    });
    created++;
  }
  return created;
}

// Ejecución directa como script.
if (process.argv[1] && process.argv[1].endsWith("seed-stage-slas.ts")) {
  seedStageSlas()
    .then((n) => {
      console.log(`[seed-stage-slas] plazos creados: ${n} (existentes respetados)`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

// Siembra el plazo objetivo (días HÁBILES) de cada tramo del embudo comercial
// (SalesStageSla) con placeholders sensatos, SIN correr el seed completo.
// Idempotente: NO pisa filas existentes, así se respetan los valores que el
// admin ya ajustó. Corré esto una vez en prod tras migrar:
//
//   docker compose exec server npx tsx prisma/scripts/seed-sales-stage-slas.ts
//
// Después, invalidá el cache (reiniciar server) o esperá el TTL de 5 min.

import { PrismaClient, SalesFunnelStep } from "@prisma/client";

const prisma = new PrismaClient();

// Defaults en días hábiles. Placeholders; el admin los ajusta desde
// "Plazos del embudo comercial".
export const DEFAULT_SALES_SLAS: Array<{ step: SalesFunnelStep; diasHabiles: number }> = [
  { step: SalesFunnelStep.LEAD_TO_QUOTE, diasHabiles: 2 }, // Lead → Cotización
  { step: SalesFunnelStep.QUOTE_TO_SCHEDULED, diasHabiles: 3 }, // Cotización → Visita agendada
  { step: SalesFunnelStep.SCHEDULED_TO_VISIT, diasHabiles: 5 }, // Agendada → Visita realizada
  { step: SalesFunnelStep.VISIT_TO_CLOSE, diasHabiles: 5 }, // Visita → Cierre ganado
  { step: SalesFunnelStep.CLOSE_TO_PROJECT, diasHabiles: 2 }, // Cierre ganado → Proyecto
];

export async function seedSalesStageSlas(client: PrismaClient = prisma): Promise<number> {
  let created = 0;
  for (const s of DEFAULT_SALES_SLAS) {
    const existing = await client.salesStageSla.findUnique({ where: { step: s.step } });
    if (existing) continue; // no pisar lo ya configurado
    await client.salesStageSla.create({
      data: { step: s.step, diasHabiles: s.diasHabiles, activo: true },
    });
    created++;
  }
  return created;
}

// Ejecución directa como script.
if (process.argv[1] && process.argv[1].endsWith("seed-sales-stage-slas.ts")) {
  seedSalesStageSlas()
    .then((n) => {
      console.log(`[seed-sales-stage-slas] plazos creados: ${n} (existentes respetados)`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

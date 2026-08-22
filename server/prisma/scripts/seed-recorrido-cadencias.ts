// Siembra la cadencia objetivo de contacto por recorrido del cliente
// (RecorridoCadencia, en días calendario) con valores por defecto razonables,
// SIN correr el seed completo. Idempotente: NO pisa filas existentes, así los
// valores que el admin ya ajustó en la app se respetan. Corré esto una vez en
// prod tras migrar:
//
//   docker compose exec server npx tsx prisma/scripts/seed-recorrido-cadencias.ts
//
// Después, invalidá el cache (reiniciar server) o esperá el TTL.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Defaults en días calendario. Placeholders sensatos; el admin los ajusta desde
// "Cadencia de contacto (E1/E2/E3)".
export const DEFAULT_RECORRIDO_CADENCIAS: Array<{ recorrido: string; diasObjetivo: number }> = [
  { recorrido: "E1", diasObjetivo: 3 },
  { recorrido: "E2", diasObjetivo: 5 },
  { recorrido: "E3", diasObjetivo: 10 },
];

export async function seedRecorridoCadencias(client: PrismaClient = prisma): Promise<number> {
  let created = 0;
  for (const c of DEFAULT_RECORRIDO_CADENCIAS) {
    const existing = await client.recorridoCadencia.findUnique({ where: { recorrido: c.recorrido } });
    if (existing) continue; // no pisar lo ya configurado
    await client.recorridoCadencia.create({
      data: { recorrido: c.recorrido, diasObjetivo: c.diasObjetivo, activo: true },
    });
    created++;
  }
  return created;
}

// Ejecución directa como script.
if (process.argv[1] && process.argv[1].endsWith("seed-recorrido-cadencias.ts")) {
  seedRecorridoCadencias()
    .then((n) => {
      console.log(`[seed-recorrido-cadencias] cadencias creadas: ${n} (existentes respetadas)`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

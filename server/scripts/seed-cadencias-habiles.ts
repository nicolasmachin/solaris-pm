/**
 * One-shot: la cadencia del recorrido pasa a una semana hábil, y E3 deja de
 * tener cadencia.
 *
 * - E1: 3 → 5 días hábiles.
 * - E2: 5 días hábiles (ya estaba en 5; ahora el conteo excluye fines de semana).
 * - E3: se DESACTIVA. Un cliente habilitado no tiene de qué hablar cada diez
 *   días: sus cuatro pasos de E3 se cierran en las primeras semanas y después
 *   el contacto recurrente lo dan el reporte mensual y el aniversario. Con la
 *   regla vieja, 17 de los 22 clientes habilitados figuraban en rojo sin tener
 *   nada pendiente, y eso solo podía empeorar porque E3 no termina nunca.
 *
 * El aviso de habilitación NO se toca: ese paso vive en E2 y tiene su propio
 * plazo de 24-48 h.
 *
 * Idempotente. `getCadenciaMap()` cachea 5 minutos, así que el cambio se ve
 * como mucho 5 minutos después (o reiniciando el server).
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-cadencias-habiles.ts
 */

import { prisma } from "../src/lib/prisma.js";

async function main() {
  const objetivo = [
    { recorrido: "E1", diasObjetivo: 5, activo: true },
    { recorrido: "E2", diasObjetivo: 5, activo: true },
    { recorrido: "E3", diasObjetivo: 10, activo: false },
  ];

  for (const o of objetivo) {
    const actual = await prisma.recorridoCadencia.findFirst({ where: { recorrido: o.recorrido } });
    if (!actual) {
      await prisma.recorridoCadencia.create({ data: o });
      console.log(`${o.recorrido}: creada (${o.diasObjetivo} días hábiles, activo=${o.activo})`);
      continue;
    }
    if (actual.diasObjetivo === o.diasObjetivo && actual.activo === o.activo) {
      console.log(`${o.recorrido}: ya estaba como corresponde`);
      continue;
    }
    await prisma.recorridoCadencia.update({
      where: { id: actual.id },
      data: { diasObjetivo: o.diasObjetivo, activo: o.activo },
    });
    console.log(
      `${o.recorrido}: ${actual.diasObjetivo}d activo=${actual.activo} → ${o.diasObjetivo}d activo=${o.activo}`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

/**
 * One-shot: habilita el permiso que faltaba para poder ENVIAR los reportes
 * fotovoltaicos al cliente.
 *
 * El problema que arregla: las rutas de envío
 * (`/reportes-fv/emisiones/:id/enviar` y `/reportes-fv/envios/lote`) exigen
 * EXPERIENCIA_CLIENTES.COMPLETE, pero esa acción nunca se dio de alta para
 * ningún rol —ni para ADMIN— ni figuraba en el catálogo de la matriz, así que
 * tampoco se podía tildar desde Admin → Permisos. Resultado: el envío estaba
 * roto para todo el mundo desde que existe el módulo.
 *
 * Sólo ADMIN y EXPERIENCIA_SOLAR: mandar el reporte es la única acción del
 * módulo que le llega al cliente, y no tiene vuelta atrás. Los demás roles se
 * habilitan desde Admin → Permisos, que ahora sí muestra la columna.
 *
 * Idempotente: chequea existencia antes de crear y nunca borra.
 *
 *   docker compose exec server npx tsx scripts/seed-envio-reportes-permission.ts
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-envio-reportes-permission.ts
 *
 * El middleware cachea permisos 5 minutos: reiniciar el server después.
 */

import { Action, Module } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";

const ROLES = ["ADMIN", "EXPERIENCIA_SOLAR"];

async function main() {
  console.log("=== Permiso de envío de reportes FV (EXPERIENCIA_CLIENTES.COMPLETE) ===\n");

  const roles = await prisma.role.findMany({
    where: { name: { in: ROLES } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const faltantes = ROLES.filter((r) => !roles.some((x) => x.name === r));
  if (faltantes.length) console.log(`  ⚠️  Roles inexistentes, se ignoran: ${faltantes.join(", ")}\n`);

  let creados = 0;
  let existentes = 0;

  for (const role of roles) {
    const existe = await prisma.permission.findUnique({
      where: {
        roleId_module_action: {
          roleId: role.id,
          module: Module.EXPERIENCIA_CLIENTES,
          action: Action.COMPLETE,
        },
      },
      select: { id: true },
    });

    if (existe) {
      console.log(`  ⏭  ${role.name} ya lo tenía`);
      existentes++;
      continue;
    }

    await prisma.permission.create({
      data: { roleId: role.id, module: Module.EXPERIENCIA_CLIENTES, action: Action.COMPLETE },
    });
    console.log(`  ✅ ${role.name} — ahora puede enviar reportes`);
    creados++;
  }

  console.log(`\n${creados} creados · ${existentes} ya existían`);
  console.log("Reiniciá el server para saltear el cache de permisos (5 min).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

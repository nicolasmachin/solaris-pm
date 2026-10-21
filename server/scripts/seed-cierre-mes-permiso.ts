/**
 * One-shot: habilita el cierre de mes de Finanzas (FINANZAS.COMPLETE): cerrar
 * un mes y reabrirlo. Solo ADMIN y FINANZAS (el encargado de Finanzas, que es
 * quien cierra). Los demás, desde Admin → Permisos, que ahora muestra la columna.
 *
 * Idempotente: chequea existencia antes de crear y nunca borra.
 *
 *   docker compose exec server npx tsx scripts/seed-cierre-mes-permiso.ts
 *   docker compose -f docker-compose.prod.yml exec server npx tsx scripts/seed-cierre-mes-permiso.ts
 *
 * El middleware cachea permisos 5 minutos: reiniciar el server después.
 */

import { Action, Module } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";

const ROLES = ["ADMIN", "FINANZAS"];

async function main() {
  console.log("=== Permiso de cierre de mes (FINANZAS.COMPLETE) ===\n");

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
          module: Module.FINANZAS,
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
      data: { roleId: role.id, module: Module.FINANZAS, action: Action.COMPLETE },
    });
    console.log(`  ✅ ${role.name} — ahora puede cerrar y reabrir meses`);
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

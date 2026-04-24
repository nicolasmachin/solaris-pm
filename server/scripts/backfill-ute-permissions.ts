/**
 * One-shot: asigna los permisos del módulo TRAMITES_UTE a los roles
 * correspondientes si aún no los tenían.
 *
 * Idempotente: usa el índice único (roleId, module, action) de la tabla
 * Permission. Re-correrlo no duplica permisos.
 *
 * Roles desconocidos (que no estén en PERMISSIONS_BY_ROLE) no se tocan.
 *
 * Uso en producción:
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/backfill-ute-permissions.ts
 *
 * Uso en local:
 *   docker compose exec server npx tsx scripts/backfill-ute-permissions.ts
 *
 * IMPORTANTE: el middleware de autorización cachea los permisos por 5 minutos
 * en memoria. Tras correr este script, esperar ~5 min o reiniciar el server
 * para que los nuevos permisos tomen efecto:
 *   docker compose -f docker-compose.prod.yml restart server
 */

import { Action, Module } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const PERMISSIONS_BY_ROLE: Record<string, Action[]> = {
  ADMIN:            [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE],
  OPERACIONES:      [Action.VIEW, Action.CREATE, Action.EDIT],
  INGENIERIA:       [Action.VIEW, Action.EDIT],
  ASESOR_COMERCIAL: [Action.VIEW],
  FINANZAS:         [Action.VIEW],
};

async function main() {
  console.log("=== Backfill Permisos TRAMITES_UTE ===\n");

  const roles = await prisma.role.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let rolesIgnored = 0;

  for (const role of roles) {
    const actions = PERMISSIONS_BY_ROLE[role.name];
    if (!actions) {
      console.log(`  ⚠  Rol "${role.name}" no está en el mapa, se ignora`);
      rolesIgnored++;
      continue;
    }

    for (const action of actions) {
      const label = `${role.name} - TRAMITES_UTE.${action}`;
      try {
        const existing = await prisma.permission.findUnique({
          where: {
            roleId_module_action: {
              roleId: role.id,
              module: Module.TRAMITES_UTE,
              action,
            },
          },
          select: { id: true },
        });

        if (existing) {
          console.log(`  ⏭  ${label} (ya existía)`);
          skipped++;
          continue;
        }

        await prisma.permission.create({
          data: {
            roleId: role.id,
            module: Module.TRAMITES_UTE,
            action,
          },
        });

        console.log(`  ✓  ${label} (creado)`);
        created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗  ${label}: ${msg}`);
        errors++;
      }
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`Roles procesados:   ${roles.length - rolesIgnored}`);
  console.log(`Roles ignorados:    ${rolesIgnored}`);
  console.log(`Permisos creados:   ${created}`);
  console.log(`Permisos existentes:${skipped}`);
  console.log(`Errores:            ${errors}`);

  if (created > 0) {
    console.log(
      "\n⚠  El middleware cachea permisos 5 min en memoria.",
    );
    console.log(
      "   Reiniciá el server para aplicar los nuevos permisos de inmediato:",
    );
    console.log(
      "   docker compose -f docker-compose.prod.yml restart server",
    );
  }

  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

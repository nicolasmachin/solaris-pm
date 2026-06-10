/**
 * One-shot: da de alta los permisos del módulo INFORMES a los roles del mapa
 * de abajo si aún no los tenían.
 *
 * Idempotente: usa el índice único (roleId, module, action) de la tabla
 * Permission (chequea existencia antes de crear). Re-correrlo no duplica.
 * NO usa deleteMany: nunca borra permisos existentes. Producción es la fuente
 * de verdad; este script solo AGREGA.
 *
 * Roles desconocidos (que no estén en PERMISSIONS_BY_ROLE) no se tocan.
 * Decisión confirmada: por ahora solo ADMIN. Los demás roles se habilitan
 * desde Admin → Permisos (INFORMES ya está en el catálogo de la matriz).
 *
 * Uso en local:
 *   docker compose exec server npx tsx scripts/seed-informes-permissions.ts
 *
 * Uso en producción (tras migrate deploy):
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-informes-permissions.ts
 *
 * IMPORTANTE: el middleware de autorización cachea los permisos por 5 minutos
 * en memoria. Tras correr este script, esperar ~5 min o reiniciar el server
 * para que los nuevos permisos tomen efecto:
 *   docker compose restart server
 */

import { Action, Module } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

const PERMISSIONS_BY_ROLE: Record<string, Action[]> = {
  ADMIN: [Action.VIEW, Action.CREATE, Action.EDIT],
};

async function main() {
  console.log("=== Seed Permisos INFORMES ===\n");

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
      rolesIgnored++;
      continue;
    }

    for (const action of actions) {
      const label = `${role.name} - INFORMES.${action}`;
      try {
        const existing = await prisma.permission.findUnique({
          where: {
            roleId_module_action: {
              roleId: role.id,
              module: Module.INFORMES,
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
          data: { roleId: role.id, module: Module.INFORMES, action },
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
  console.log(`Permisos saltados:  ${skipped}`);
  console.log(`Errores:            ${errors}`);
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

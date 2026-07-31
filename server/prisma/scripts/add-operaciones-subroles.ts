/**
 * Script ad-hoc idempotente: provisiona los sub-roles operativos COMPRAS y
 * CAPATAZ en una base ya migrada (local o producción).
 *
 * Cada uno arranca como CLON de los permisos actuales de OPERACIONES (se leen
 * de la DB en vez de hardcodearlos, para quedar siempre en sync). Después se
 * ajustan por separado desde Admin → Permisos.
 *
 * - Idempotente: upsert por `name` (rol) y por la key compuesta
 *   `roleId_module_action` (permiso). Se puede correr varias veces.
 * - NO crea usuarios. NO toca los permisos de OPERACIONES ni de otros roles.
 * - Si el rol ya existe, respeta su label/description (no los pisa).
 *
 * Correr con:
 *   docker compose exec server npx tsx prisma/scripts/add-operaciones-subroles.ts
 *   (prod: docker compose -f docker-compose.prod.yml exec server npx tsx prisma/scripts/add-operaciones-subroles.ts)
 *
 * El cache de permisos (5 min) NO se invalida desde acá: reiniciar el server
 * después para que los nuevos permisos tomen efecto de inmediato.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_ROLE = "OPERACIONES";
const NEW_ROLES: Array<{ name: string; label: string }> = [
  { name: "COMPRAS", label: "Compras" },
  { name: "CAPATAZ", label: "Capataz" },
];

async function main(): Promise<void> {
  const base = await prisma.role.findUnique({
    where: { name: BASE_ROLE },
    include: { permissions: { select: { module: true, action: true } } },
  });
  if (!base) throw new Error(`El rol base ${BASE_ROLE} no existe`);
  console.log(`Base ${BASE_ROLE}: ${base.permissions.length} permisos a clonar.`);

  for (const def of NEW_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: def.name },
      create: { name: def.name, label: def.label, isSystem: true },
      update: { isSystem: true },
    });

    for (const p of base.permissions) {
      await prisma.permission.upsert({
        where: { roleId_module_action: { roleId: role.id, module: p.module, action: p.action } },
        create: { roleId: role.id, module: p.module, action: p.action },
        update: {},
      });
    }

    const total = await prisma.permission.count({ where: { roleId: role.id } });
    console.log(`Rol ${def.name} (id=${role.id}) listo: ${total} permisos.`);
    if (total < base.permissions.length) {
      throw new Error(`${def.name} tiene ${total} permisos; se esperaban al menos ${base.permissions.length}.`);
    }
  }

  console.log("OK");
}

main()
  .catch((error: unknown) => {
    console.error("Error provisionando sub-roles de Operaciones:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * Grant idempotente: otorga la acción VENTAS:ACCESS_MEMORIA al rol ADMIN.
 * Gatea la memoria de cálculo de propuestas (/admin/propuestas/memoria-calculo).
 *
 * Correr (local / prod):
 *   docker compose exec server npx tsx prisma/scripts/grant-permission-access-memoria.ts
 *
 * Idempotente: si la relación (rol, módulo, acción) ya existe, no la duplica.
 * Nota: el authorize middleware cachea permisos 5 min; reiniciar el server (o
 * esperar el TTL) para que el permiso nuevo tenga efecto inmediato.
 */

import { PrismaClient, Module, Action } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE = "ADMIN";

async function main() {
  const role = await prisma.role.findUnique({ where: { name: ROLE } });
  if (!role) {
    throw new Error(`No existe el rol "${ROLE}". Corré el seed primero.`);
  }

  const existing = await prisma.permission.findUnique({
    where: {
      roleId_module_action: { roleId: role.id, module: Module.VENTAS, action: Action.ACCESS_MEMORIA },
    },
  });

  if (existing) {
    console.log(`= ${ROLE}:VENTAS:ACCESS_MEMORIA ya existe (sin cambios).`);
    return;
  }

  await prisma.permission.create({
    data: { roleId: role.id, module: Module.VENTAS, action: Action.ACCESS_MEMORIA },
  });
  console.log(`+ ${ROLE}:VENTAS:ACCESS_MEMORIA otorgado. ✅ (reiniciá el server para efecto inmediato)`);
}

main()
  .catch((err) => {
    console.error("❌ Error en grant-permission-access-memoria:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

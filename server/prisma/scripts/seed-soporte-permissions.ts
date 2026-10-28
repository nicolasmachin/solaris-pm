// Permisos del módulo Soporte (mesa de monitoreo de plantas). Por ahora solo
// ADMIN: todavía no hay un rol de Soporte. Cuando exista, se le da SOPORTE
// VIEW y EDIT desde Administración → Roles y permisos.
// Idempotente (createMany skipDuplicates).
//
//   docker compose exec server npx tsx prisma/scripts/seed-soporte-permissions.ts
//
// Después, reiniciar el server para vaciar el caché de permisos.

import { Action, Module, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.role.findUnique({ where: { name: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No existe el rol ADMIN");
  const r = await prisma.permission.createMany({
    data: [Action.VIEW, Action.EDIT].map((action) => ({ roleId: admin.id, module: Module.SOPORTE, action })),
    skipDuplicates: true,
  });
  console.log(`[seed-soporte] permisos creados: ${r.count}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

/**
 * Grant idempotente: otorga la acción COMISIONES:VIEW a los roles ADMIN,
 * FINANZAS y ASESOR_COMERCIAL, y asegura la subcategoría de finanzas
 * "Comisiones ventas" (VARIABLE) usada por el pendiente de comisión.
 *
 * Correr (local / prod), tras `migrate deploy`:
 *   docker compose exec server npx tsx prisma/scripts/grant-comisiones-permissions.ts
 *
 * Idempotente: no duplica permisos ni la subcategoría.
 * Nota: el authorize middleware cachea permisos 5 min; reiniciar el server (o
 * esperar el TTL) para que los permisos nuevos tengan efecto inmediato.
 */

import { PrismaClient, Module, Action, CategoriaPrincipal } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = ["ADMIN", "FINANZAS", "ASESOR_COMERCIAL"];

async function grantView(roleName: string) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.warn(`! Rol "${roleName}" no existe (se saltea).`);
    return;
  }

  const existing = await prisma.permission.findUnique({
    where: {
      roleId_module_action: { roleId: role.id, module: Module.COMISIONES, action: Action.VIEW },
    },
  });

  if (existing) {
    console.log(`= ${roleName}:COMISIONES:VIEW ya existe (sin cambios).`);
    return;
  }

  await prisma.permission.create({
    data: { roleId: role.id, module: Module.COMISIONES, action: Action.VIEW },
  });
  console.log(`+ ${roleName}:COMISIONES:VIEW otorgado. ✅`);
}

async function ensureSubcategoria() {
  const nombre = "Comisiones ventas";
  const categoria = CategoriaPrincipal.VARIABLE;
  await prisma.financeSubcategory.upsert({
    where: { nombre_categoria: { nombre, categoria } },
    create: { nombre, categoria },
    update: {},
  });
  console.log(`= Subcategoría "${nombre}" (${categoria}) asegurada.`);
}

async function main() {
  for (const roleName of ROLES) {
    await grantView(roleName);
  }
  await ensureSubcategoria();
  console.log("Listo. Reiniciá el server para efecto inmediato de los permisos.");
}

main()
  .catch((err) => {
    console.error("❌ Error en grant-comisiones-permissions:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

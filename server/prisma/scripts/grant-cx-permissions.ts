// Otorga SOLO los permisos del módulo Experiencia de Clientes
// (Module.EXPERIENCIA_CLIENTES) con las acciones VIEW + CREATE para los roles
// ADMIN, POSTVENTA y ASESOR_COMERCIAL.
//
// Es idempotente (upsert) y NO toca nada más: no borra, no recrea, no corre el
// resto del seed. Pensado como alternativa quirúrgica a `npm run db:seed` para
// habilitar el módulo sin efectos colaterales.
//
// Uso:
//   docker compose exec server npx tsx prisma/scripts/grant-cx-permissions.ts
//   # o, desde server/ con la DB accesible:  npx tsx prisma/scripts/grant-cx-permissions.ts

import { Action, Module, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLES = ["ADMIN", "POSTVENTA", "ASESOR_COMERCIAL"] as const;
// VIEW (listado/ficha/export/bitácora) · CREATE (registrar interacción) ·
// EDIT (edición inline de mail/teléfono/fecha de entrega).
const ACTIONS: Action[] = [Action.VIEW, Action.CREATE, Action.EDIT];
const MODULE = Module.EXPERIENCIA_CLIENTES;

async function main() {
  let granted = 0;

  for (const roleName of ROLES) {
    const role = await prisma.role.findUnique({ where: { name: roleName }, select: { id: true } });
    if (!role) {
      console.warn(`⚠️  Rol "${roleName}" no encontrado — se omite.`);
      continue;
    }

    for (const action of ACTIONS) {
      await prisma.permission.upsert({
        where: { roleId_module_action: { roleId: role.id, module: MODULE, action } },
        create: { roleId: role.id, module: MODULE, action },
        update: {},
      });
      granted++;
      console.log(`  ✓ ${roleName} · ${MODULE} · ${action}`);
    }
  }

  console.log(`\nListo: ${granted} permiso(s) asegurado(s) (upsert idempotente, nada más se tocó).`);
  console.log(
    "Nota: el caché de permisos del server expira solo en ~5 min; si querés verlo al toque, reiniciá el server.",
  );
}

main()
  .catch((e) => {
    console.error("Error otorgando permisos:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

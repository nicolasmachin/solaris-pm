// Permiso para ENVIAR reportes fotovoltaicos al cliente.
//
// El envío es la acción irreversible del módulo, así que usa COMPLETE en
// EXPERIENCIA_CLIENTES. El rol EXPERIENCIA_SOLAR ya tiene VIEW/CREATE/EDIT/DELETE
// (dar de alta, editar, calcular, generar PDF); este script le agrega COMPLETE.
// ADMIN ya tiene todo.
//
// Idempotente (createMany skipDuplicates). Correr:
//   docker compose exec server npx tsx prisma/scripts/seed-reportes-fv-permissions.ts
// Después reiniciar el server (o invalidar el cache de permisos de 5 min).

import { Action, Module, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Roles que pueden aprobar y enviar reportes al cliente.
const ROLES_ENVIO = ["ADMIN", "EXPERIENCIA_SOLAR"];

async function main() {
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const idByName = new Map(roles.map((r) => [r.name, r.id]));

  const rows: Array<{ roleId: string; module: Module; action: Action }> = [];
  for (const roleName of ROLES_ENVIO) {
    const roleId = idByName.get(roleName);
    if (!roleId) {
      console.warn(`rol ${roleName} no encontrado, se saltea`);
      continue;
    }
    rows.push({ roleId, module: Module.EXPERIENCIA_CLIENTES, action: Action.COMPLETE });
  }

  const created = await prisma.permission.createMany({ data: rows, skipDuplicates: true });
  console.log(`permisos COMPLETE creados: ${created.count} (de ${rows.length} intentados)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

// Permiso para VER TODAS las comisiones del equipo (no solo las propias).
//
// La señal "ver todas" en el backend es COMISIONES:EDIT (ver commission.routes.ts
// canSeeAll). Finanzas y admin ya la ven vía FINANZAS:VIEW; este script le agrega
// COMISIONES:EDIT a GERENTE_COMERCIAL para que la gerencia comercial vea (y filtre
// por persona) las comisiones de todos los asesores. Los asesores siguen viendo
// solo las suyas (tienen COMISIONES:VIEW, no EDIT).
//
// Idempotente (createMany skipDuplicates). Correr:
//   docker compose exec server npx tsx prisma/scripts/seed-comisiones-ver-todas.ts
// Después reiniciar el server (o invalidar el cache de permisos de 5 min).

import { Action, Module, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Roles con oversight de las comisiones del equipo comercial.
const ROLES_VER_TODAS = ["ADMIN", "GERENTE_COMERCIAL"];

async function main() {
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const idByName = new Map(roles.map((r) => [r.name, r.id]));

  const rows: Array<{ roleId: string; module: Module; action: Action }> = [];
  for (const roleName of ROLES_VER_TODAS) {
    const roleId = idByName.get(roleName);
    if (!roleId) {
      console.warn(`rol ${roleName} no encontrado, se saltea`);
      continue;
    }
    rows.push({ roleId, module: Module.COMISIONES, action: Action.EDIT });
  }

  const created = await prisma.permission.createMany({ data: rows, skipDuplicates: true });
  console.log(`permisos COMISIONES:EDIT creados: ${created.count} (de ${rows.length} intentados)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

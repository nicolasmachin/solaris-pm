// Aplica SOLO los permisos del módulo Tickets (fase E3) sin correr el seed
// completo (que reescribe data demo y no aplica contra una base ya migrada).
// Idempotente: usa createMany skipDuplicates + set explícito para CLIENT.
//
//   docker compose exec server npx tsx prisma/scripts/seed-tickets-permissions.ts
//
// En prod, después de correrlo hay que invalidar el cache de permisos (reiniciar
// el server o llamar clearPermissionCache()).

import { Action, Module, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INTERNAL_ROLES = [
  "ADMIN",
  "ASESOR_COMERCIAL",
  "FINANZAS",
  "INGENIERIA",
  "OPERACIONES",
  "POSTVENTA",
  "TRAMITACION_UTE",
  "EXPERIENCIA_SOLAR",
];

async function main() {
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const idByName = new Map(roles.map((r) => [r.name, r.id]));

  // 1) TICKETS: VIEW/CREATE/EDIT para cada rol interno.
  const rows: Array<{ roleId: string; module: Module; action: Action }> = [];
  for (const roleName of INTERNAL_ROLES) {
    const roleId = idByName.get(roleName);
    if (!roleId) {
      console.warn(`[seed-tickets] rol ${roleName} no encontrado, se saltea`);
      continue;
    }
    for (const action of [Action.VIEW, Action.CREATE, Action.EDIT]) {
      rows.push({ roleId, module: Module.TICKETS, action });
    }
  }
  const created = await prisma.permission.createMany({ data: rows, skipDuplicates: true });
  console.log(`[seed-tickets] permisos TICKETS creados: ${created.count} (de ${rows.length} intentados)`);

  // 2) CLIENT: extender PORTAL_CLIENTE con CREATE y COMMENT (para abrir/comentar
  //    tickets desde el portal). VIEW ya lo tiene.
  const clientId = idByName.get("CLIENT");
  if (clientId) {
    const clientAdds = await prisma.permission.createMany({
      data: [
        { roleId: clientId, module: Module.PORTAL_CLIENTE, action: Action.CREATE },
        { roleId: clientId, module: Module.PORTAL_CLIENTE, action: Action.COMMENT },
      ],
      skipDuplicates: true,
    });
    console.log(`[seed-tickets] permisos CLIENT/PORTAL_CLIENTE agregados: ${clientAdds.count}`);
  } else {
    console.warn("[seed-tickets] rol CLIENT no encontrado");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

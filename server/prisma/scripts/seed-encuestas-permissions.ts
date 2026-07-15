// Aplica SOLO los permisos del módulo Encuestas (Ola 3a) sin correr el seed
// completo (que reescribe data demo y no aplica contra una base ya migrada).
// Idempotente: usa createMany skipDuplicates.
//
//   docker compose exec server npx tsx prisma/scripts/seed-encuestas-permissions.ts
//
// En prod, después de correrlo hay que invalidar el cache de permisos (reiniciar
// el server o llamar clearPermissionCache()).
//
// El rol CLIENT NO necesita permisos nuevos: responde encuestas con las acciones
// PORTAL_CLIENTE [VIEW, COMMENT] que ya tiene desde el módulo de Tickets.

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

  // ENCUESTAS: VIEW (solo lectura) para cada rol interno.
  const rows: Array<{ roleId: string; module: Module; action: Action }> = [];
  for (const roleName of INTERNAL_ROLES) {
    const roleId = idByName.get(roleName);
    if (!roleId) {
      console.warn(`[seed-encuestas] rol ${roleName} no encontrado, se saltea`);
      continue;
    }
    rows.push({ roleId, module: Module.ENCUESTAS, action: Action.VIEW });
  }
  const created = await prisma.permission.createMany({ data: rows, skipDuplicates: true });
  console.log(`[seed-encuestas] permisos ENCUESTAS creados: ${created.count} (de ${rows.length} intentados)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

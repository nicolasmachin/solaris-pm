/**
 * Script ad-hoc idempotente: provisiona el rol POSTVENTA en producción.
 *
 * Crea el rol `POSTVENTA` (label "Postventa", isSystem=true) y le asigna una
 * matriz de permisos que es clon 1:1 de OPERACIONES (mismas filas, mismas
 * acciones, incluido Action.ACCESS en INGENIERIA), tal como quedó en el seed.
 *
 * - Es idempotente: se puede correr múltiples veces sin duplicar nada (usa
 *   upsert por `name` para el rol y por la key compuesta `roleId_module_action`
 *   para cada permiso).
 * - NO crea usuarios.
 * - NO modifica permisos de OPERACIONES ni de ningún otro rol.
 * - Si el rol ya existe, NO pisa su label/description (respeta ediciones del
 *   admin desde la UI).
 *
 * Correr en producción con:
 *   docker exec -it voltia-server npx tsx prisma/scripts/add-postventa-role.ts
 */

import { Action, Module, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ROLE_NAME = "POSTVENTA";
const ROLE_LABEL = "Postventa";

// Clon 1:1 de la matriz de OPERACIONES en server/prisma/seed.ts (seedPermissions).
// 9 filas de módulo / 27 permisos a nivel acción.
const POSTVENTA_MATRIX: Array<{ module: Module; actions: Action[] }> = [
  { module: Module.VENTAS,       actions: [Action.VIEW] },
  { module: Module.ONBOARDING,   actions: [Action.VIEW, Action.COMMENT] },
  { module: Module.INGENIERIA,   actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE, Action.COMPLETE, Action.COMMENT, Action.ACCESS] },
  { module: Module.OPERACIONES,  actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
  { module: Module.HABILITACION, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
  { module: Module.POSTVENTA,    actions: [Action.VIEW, Action.COMMENT] },
  { module: Module.METRICAS,     actions: [Action.VIEW] },
  { module: Module.STOCK,        actions: [Action.VIEW] },
  { module: Module.TRAMITES_UTE, actions: [Action.VIEW, Action.CREATE, Action.EDIT] },
];

async function main(): Promise<void> {
  // 1) Upsert del rol por `name`. Si existe, no toca label/description.
  const role = await prisma.role.upsert({
    where: { name: ROLE_NAME },
    create: { name: ROLE_NAME, label: ROLE_LABEL, isSystem: true },
    update: { isSystem: true },
  });
  console.log(`Rol ${ROLE_NAME} listo (id=${role.id}).`);

  // 2) Upsert de cada permiso por la key compuesta roleId_module_action.
  const expectedPermissions = POSTVENTA_MATRIX.reduce((sum, row) => sum + row.actions.length, 0);
  for (const entry of POSTVENTA_MATRIX) {
    for (const action of entry.actions) {
      await prisma.permission.upsert({
        where: {
          roleId_module_action: { roleId: role.id, module: entry.module, action },
        },
        create: { roleId: role.id, module: entry.module, action },
        update: {},
      });
    }
  }

  // 3) Verificación: contar permisos reales del rol POSTVENTA en la DB.
  const totalPermissions = await prisma.permission.count({ where: { roleId: role.id } });
  console.log(`Permisos del rol ${ROLE_NAME} en la DB: ${totalPermissions} (esperados: ${expectedPermissions}).`);

  if (totalPermissions >= expectedPermissions) {
    console.log("OK");
  } else {
    throw new Error(
      `Cantidad de permisos inesperada: hay ${totalPermissions}, se esperaban al menos ${expectedPermissions}.`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error("Error provisionando el rol POSTVENTA:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

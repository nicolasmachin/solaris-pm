/**
 * One-shot: restringe quién puede fijar a mano la etapa de un proyecto.
 *
 * Contexto: hasta ahora ese control se gobernaba con `OPERACIONES:EDIT`, que en
 * producción lo tienen 13 roles —incluidos asesores comerciales, logística y los
 * instaladores tercerizados—. Un instalador movió la obra de Santiago Pereyra a
 * "Ejecución de Obra" y, al posponerse, quedó mostrando una etapa que no era.
 *
 * A partir de la acción `OPERACIONES:FIJAR_ETAPA`, solo la tienen ADMIN y
 * GERENTE_OPERACIONES.
 *
 * Idempotente: chequea antes de crear y NUNCA borra. Correr después de
 * `migrate deploy` (la migración agrega el valor al enum Action) y reiniciar el
 * server para invalidar la cache de permisos (5 min).
 *
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-permiso-fijar-etapa.ts
 */

import { Action, Module } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";

const CON_PERMISO = ["ADMIN", "GERENTE_OPERACIONES"];

async function main() {
  let creados = 0;

  for (const nombre of CON_PERMISO) {
    const rol = await prisma.role.findUnique({ where: { name: nombre }, select: { id: true } });
    if (!rol) {
      console.warn(`⚠️  El rol ${nombre} no existe, se saltea.`);
      continue;
    }
    const yaEsta = await prisma.permission.findUnique({
      where: {
        roleId_module_action: {
          roleId: rol.id,
          module: Module.OPERACIONES,
          action: Action.FIJAR_ETAPA,
        },
      },
      select: { id: true },
    });
    if (yaEsta) {
      console.log(`${nombre}: ya lo tenía.`);
      continue;
    }
    await prisma.permission.create({
      data: { roleId: rol.id, module: Module.OPERACIONES, action: Action.FIJAR_ETAPA },
    });
    creados++;
    console.log(`${nombre}: puede fijar la etapa a mano.`);
  }

  // Quién más quedó con la posibilidad, para que no haya sorpresas.
  const otros = await prisma.permission.findMany({
    where: { module: Module.OPERACIONES, action: Action.FIJAR_ETAPA },
    select: { role: { select: { name: true } } },
  });
  console.log(`\nRoles que pueden fijar la etapa: ${otros.map((o) => o.role.name).join(", ")}`);
  console.log(`${creados} permisos creados. Reiniciá el server para invalidar la cache.`);
}

main()
  .catch((error) => {
    console.error("Falló:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

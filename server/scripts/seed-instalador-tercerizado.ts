/**
 * One-shot: da de alta el rol INSTALADOR_TERCERIZADO y sus permisos.
 *
 * El capataz tercerizado hace exactamente lo mismo que el propio dentro de
 * Operaciones. La única diferencia es que a él se le paga por obra, así que suma
 * `PAGOS_INSTALADOR:VIEW` para ver sus cobros —los pendientes y los ya cobrados—
 * sin entrar a Finanzas ni ver los de otros instaladores.
 *
 * Los permisos se copian de la matriz REAL de CAPATAZ leída de la base, no del
 * seed: en producción la matriz suele estar ajustada a mano y clonar el seed
 * pisaría esos ajustes. Si CAPATAZ no existe, cae a OPERACIONES.
 *
 * Idempotente: chequea existencia antes de crear y NUNCA borra. Re-correrlo solo
 * agrega lo que falte, así que es seguro si alguien ya ajustó permisos a mano.
 *
 * Uso en local:
 *   docker compose exec server npx tsx scripts/seed-instalador-tercerizado.ts
 *
 * Uso en producción (después de `migrate deploy`, que agrega el valor
 * PAGOS_INSTALADOR al enum Module):
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-instalador-tercerizado.ts
 *
 * IMPORTANTE: el middleware de autorización cachea los permisos 5 minutos en
 * memoria. Después de correrlo hay que reiniciar el server para que tomen efecto:
 *   docker compose restart server
 */

import { Action, Module } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";

const ROLE_NAME = "INSTALADOR_TERCERIZADO";
const ROLE_LABEL = "Instalador tercerizado";
const BASE_PREFERIDA = "CAPATAZ";
const BASE_FALLBACK = "OPERACIONES";

/** Lo que suma por encima de su base. */
const EXTRA: Array<{ module: Module; actions: Action[] }> = [
  { module: Module.PAGOS_INSTALADOR, actions: [Action.VIEW] },
];

/**
 * Quién gestiona los pagos. Sin esto nadie ve la pantalla completa: el módulo es
 * nuevo, así que NADIE lo tiene todavía — ni siquiera ADMIN, porque la
 * autorización se resuelve contra filas reales de la tabla `permissions`, sin
 * atajo para el administrador.
 *
 * VIEW deja pasar el preHandler; EDIT es lo que además habilita ver los pagos de
 * TODOS los instaladores en vez de solo los propios (ver `canSeeAll` en
 * installer-payment.routes.ts).
 */
const GESTORES: Array<{ role: string; actions: Action[] }> = [
  { role: "ADMIN", actions: [Action.VIEW, Action.EDIT] },
  { role: "FINANZAS", actions: [Action.VIEW, Action.EDIT] },
  { role: "GERENTE_FINANZAS", actions: [Action.VIEW, Action.EDIT] },
];

let creados = 0;
let existentes = 0;

async function asegurarPermiso(roleId: string, module: Module, action: Action) {
  const yaEsta = await prisma.permission.findUnique({
    where: { roleId_module_action: { roleId, module, action } },
    select: { id: true },
  });
  if (yaEsta) {
    existentes++;
    return;
  }
  await prisma.permission.create({ data: { roleId, module, action } });
  creados++;
}

async function main() {
  // 1. El rol.
  const role = await prisma.role.upsert({
    where: { name: ROLE_NAME },
    create: { name: ROLE_NAME, label: ROLE_LABEL, isSystem: true },
    // No pisa el label: si un admin lo renombró desde la UI, se respeta.
    update: {},
    select: { id: true, name: true, label: true },
  });
  console.log(`Rol ${role.name} ("${role.label}") listo.`);

  // 2. Base de la que clonar, leída de la matriz real.
  const base =
    (await prisma.role.findUnique({ where: { name: BASE_PREFERIDA }, select: { id: true, name: true } })) ??
    (await prisma.role.findUnique({ where: { name: BASE_FALLBACK }, select: { id: true, name: true } }));

  if (!base) {
    throw new Error(
      `No existe ni ${BASE_PREFERIDA} ni ${BASE_FALLBACK}: no hay de dónde copiar los permisos.`,
    );
  }
  if (base.name !== BASE_PREFERIDA) {
    console.warn(`⚠️  ${BASE_PREFERIDA} no existe; copiando de ${base.name}.`);
  }

  const permisosBase = await prisma.permission.findMany({
    where: { roleId: base.id },
    select: { module: true, action: true },
  });
  console.log(`Copiando ${permisosBase.length} permisos de ${base.name}…`);

  for (const p of permisosBase) {
    await asegurarPermiso(role.id, p.module, p.action);
  }

  // 3. Lo propio del tercerizado.
  for (const extra of EXTRA) {
    for (const action of extra.actions) {
      await asegurarPermiso(role.id, extra.module, action);
    }
  }

  // 4. Los que gestionan los pagos.
  for (const gestor of GESTORES) {
    const rol = await prisma.role.findUnique({ where: { name: gestor.role }, select: { id: true } });
    if (!rol) {
      console.warn(`⚠️  El rol ${gestor.role} no existe, se saltea.`);
      continue;
    }
    for (const action of gestor.actions) {
      await asegurarPermiso(rol.id, Module.PAGOS_INSTALADOR, action);
    }
    console.log(`${gestor.role}: gestión de pagos habilitada.`);
  }

  console.log(`\nListo: ${creados} permisos creados, ${existentes} ya estaban.`);
  console.log("Reiniciá el server para invalidar la cache de permisos (5 min).");
}

main()
  .catch((error) => {
    console.error("Falló:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

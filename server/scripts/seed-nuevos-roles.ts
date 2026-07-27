/**
 * One-shot: da de alta los roles nuevos y sus permisos.
 *
 *   - GERENTE_OPERACIONES  (base: OPERACIONES)
 *   - GERENTE_COMERCIAL    (base: ASESOR_COMERCIAL)
 *   - GERENTE_INGENIERIA   (base: INGENIERIA)
 *   - GERENTE_FINANZAS     (base: FINANZAS)
 *   - LOGISTICA            (matriz explícita: Stock + Operaciones + materiales)
 *
 * Cada rol GERENTE_* arranca como COPIA de los permisos actuales de su rol base
 * (leídos de la DB, así respeta la matriz real de prod). A partir de ahí se
 * ajustan desde Admin → Permisos ("permisos propios" de cada gerencia).
 *
 * Idempotente: usa el índice único (roleId, module, action). Chequea existencia
 * antes de crear; NUNCA borra. Re-correrlo no duplica ni pisa ediciones del admin
 * (si el gerente ya tenía permisos propios, solo agrega los que falten de la base).
 *
 * Uso en local:
 *   docker compose exec server npx tsx scripts/seed-nuevos-roles.ts
 *
 * Uso en producción (tras migrate deploy — acá NO hay migración, es solo data):
 *   docker compose -f docker-compose.prod.yml exec server \
 *     npx tsx scripts/seed-nuevos-roles.ts
 *
 * IMPORTANTE: el middleware de autorización cachea los permisos 5 min en memoria.
 * Tras correr el script, reiniciar el server para que tomen efecto:
 *   docker compose restart server   (o el equivalente en prod)
 */

import { Action, Module } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

// Rol gerente → rol base del que copia los permisos como punto de partida.
const GERENTE_BASE: Array<{ name: string; label: string; base: string }> = [
  { name: "GERENTE_OPERACIONES", label: "Gerente de Operaciones", base: "OPERACIONES" },
  { name: "GERENTE_COMERCIAL", label: "Gerente Comercial", base: "ASESOR_COMERCIAL" },
  { name: "GERENTE_INGENIERIA", label: "Gerente de Ingeniería", base: "INGENIERIA" },
  { name: "GERENTE_FINANZAS", label: "Gerente de Finanzas", base: "FINANZAS" },
];

// LOGISTICA — matriz explícita. Núcleo en Stock; lectura de Operaciones y de
// Ingeniería (materiales consolidados / compras viven ahí).
const LOGISTICA_MATRIX: Array<{ module: Module; actions: Action[] }> = [
  { module: Module.STOCK, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
  { module: Module.OPERACIONES, actions: [Action.VIEW] },
  { module: Module.INGENIERIA, actions: [Action.VIEW] },
];

let created = 0;
let skipped = 0;
let errors = 0;

async function ensureRole(name: string, label: string): Promise<string> {
  const role = await prisma.role.upsert({
    where: { name },
    // isSystem: rol oficial protegido de borrado. No pisa label si ya existía.
    create: { name, label, isSystem: true },
    update: { isSystem: true },
  });
  return role.id;
}

async function grant(roleId: string, module: Module, action: Action, label: string): Promise<void> {
  try {
    const existing = await prisma.permission.findUnique({
      where: { roleId_module_action: { roleId, module, action } },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      return;
    }
    await prisma.permission.create({ data: { roleId, module, action } });
    console.log(`  ✓  ${label}`);
    created++;
  } catch (err) {
    console.error(`  ✗  ${label}: ${err instanceof Error ? err.message : String(err)}`);
    errors++;
  }
}

async function main() {
  console.log("=== Seed roles nuevos (Gerencias + Logística) ===\n");

  // ── Gerencias: copia de los permisos del rol base ──────────────────────────
  for (const g of GERENTE_BASE) {
    console.log(`▸ ${g.name}  (copia de ${g.base})`);
    const baseRole = await prisma.role.findUnique({
      where: { name: g.base },
      select: { id: true },
    });
    if (!baseRole) {
      console.error(`  ✗  Rol base ${g.base} no existe — se saltea ${g.name}`);
      errors++;
      continue;
    }
    const roleId = await ensureRole(g.name, g.label);
    const basePerms = await prisma.permission.findMany({
      where: { roleId: baseRole.id },
      select: { module: true, action: true },
    });
    for (const p of basePerms) {
      await grant(roleId, p.module, p.action, `${g.name} - ${p.module}.${p.action}`);
    }
  }

  // ── Logística: matriz explícita ────────────────────────────────────────────
  console.log(`▸ LOGISTICA`);
  const logisticaId = await ensureRole("LOGISTICA", "Logística");
  for (const row of LOGISTICA_MATRIX) {
    for (const action of row.actions) {
      await grant(logisticaId, row.module, action, `LOGISTICA - ${row.module}.${action}`);
    }
  }

  console.log("\n=== Resumen ===");
  console.log(`Permisos creados:   ${created}`);
  console.log(`Permisos saltados:  ${skipped}`);
  console.log(`Errores:            ${errors}`);
  if (errors > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Error fatal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Setup de datos para v8.0 en PRODUCCIÓN. Idempotente. Se corre UNA vez, después
// de `prisma migrate deploy` (que agrega los enums nuevos: Module.TRASPASOS, etc.).
// El seed normal no corre en prod (guard NODE_ENV=production), por eso este script
// hace solo las adiciones necesarias, sin tocar nada más.
//
// Hace:
//   1. Roles nuevos EXPERIENCIA_SOLAR + TRAMITACION_UTE (con sus permisos).
//   2. Permisos del módulo TRASPASOS para los roles internos.
//   3. Label del rol CLIENT → "Generador".
//   4. Elimina el setting PIPELINE_TEMPLATE (para que los proyectos nuevos tomen
//      el pipeline de 8+2 etapas del código, no el viejo de 5).
//
// Después de correrlo: REINICIAR el server (para limpiar la cache de permisos).

import { Action, Module } from "@prisma/client";
import { prisma } from "../../src/lib/prisma.js";

async function main() {
  // ── 1. Roles nuevos (upsert por name; no pisa label si ya existe) ──────────
  const nuevosRoles = [
    { name: "EXPERIENCIA_SOLAR", label: "Responsable de Experiencia Solar" },
    { name: "TRAMITACION_UTE", label: "Tramitación UTE" },
  ];
  for (const r of nuevosRoles) {
    await prisma.role.upsert({
      where: { name: r.name },
      create: { name: r.name, label: r.label, isSystem: true },
      update: { isSystem: true },
    });
  }

  // ── 2. Permisos (mismas filas que el seed) ─────────────────────────────────
  const matrix: Array<{ roleName: string; module: Module; actions: Action[] }> = [
    // Módulo TRASPASOS para los roles internos que participan del ciclo.
    { roleName: "ADMIN", module: Module.TRASPASOS, actions: [Action.VIEW, Action.CONFIRM, Action.ADMIN_REPORT] },
    { roleName: "ASESOR_COMERCIAL", module: Module.TRASPASOS, actions: [Action.VIEW, Action.CONFIRM] },
    { roleName: "INGENIERIA", module: Module.TRASPASOS, actions: [Action.VIEW, Action.CONFIRM] },
    { roleName: "OPERACIONES", module: Module.TRASPASOS, actions: [Action.VIEW, Action.CONFIRM] },
    { roleName: "POSTVENTA", module: Module.TRASPASOS, actions: [Action.VIEW, Action.CONFIRM] },
    // TRAMITACION_UTE — base funcional + traspasos.
    { roleName: "TRAMITACION_UTE", module: Module.VENTAS, actions: [Action.VIEW] },
    { roleName: "TRAMITACION_UTE", module: Module.TRAMITES_UTE, actions: [Action.VIEW, Action.CREATE, Action.EDIT] },
    { roleName: "TRAMITACION_UTE", module: Module.HABILITACION, actions: [Action.VIEW, Action.EDIT, Action.COMPLETE, Action.COMMENT] },
    { roleName: "TRAMITACION_UTE", module: Module.POSTVENTA, actions: [Action.VIEW] },
    { roleName: "TRAMITACION_UTE", module: Module.METRICAS, actions: [Action.VIEW] },
    { roleName: "TRAMITACION_UTE", module: Module.TRASPASOS, actions: [Action.VIEW, Action.CONFIRM] },
    // EXPERIENCIA_SOLAR — hub post-venta + traspasos.
    { roleName: "EXPERIENCIA_SOLAR", module: Module.VENTAS, actions: [Action.VIEW] },
    { roleName: "EXPERIENCIA_SOLAR", module: Module.EXPERIENCIA_CLIENTES, actions: [Action.VIEW, Action.CREATE, Action.EDIT, Action.DELETE] },
    { roleName: "EXPERIENCIA_SOLAR", module: Module.PORTAL_CLIENTE, actions: [Action.VIEW, Action.CREATE, Action.EDIT] },
    { roleName: "EXPERIENCIA_SOLAR", module: Module.POSTVENTA, actions: [Action.VIEW, Action.COMMENT] },
    { roleName: "EXPERIENCIA_SOLAR", module: Module.TRAMITES_UTE, actions: [Action.VIEW] },
    { roleName: "EXPERIENCIA_SOLAR", module: Module.METRICAS, actions: [Action.VIEW] },
    { roleName: "EXPERIENCIA_SOLAR", module: Module.TRASPASOS, actions: [Action.VIEW, Action.CONFIRM] },
  ];

  const roleIdByName = new Map(
    (await prisma.role.findMany({ select: { id: true, name: true } })).map((r) => [r.name, r.id]),
  );

  let permsCreados = 0;
  for (const entry of matrix) {
    const roleId = roleIdByName.get(entry.roleName);
    if (!roleId) {
      console.warn(`  ⚠ rol ${entry.roleName} no existe — se omite`);
      continue;
    }
    for (const action of entry.actions) {
      const res = await prisma.permission.upsert({
        where: { roleId_module_action: { roleId, module: entry.module, action } },
        create: { roleId, module: entry.module, action },
        update: {},
      });
      if (res) permsCreados++;
    }
  }

  // ── 3. Label del rol CLIENT → Generador (el seed no pisa labels existentes) ─
  await prisma.role.updateMany({ where: { name: "CLIENT" }, data: { label: "Generador" } });

  // ── 4. Eliminar el override PIPELINE_TEMPLATE (para que los proyectos nuevos
  //       usen el pipeline de 8+2 etapas del código) ──────────────────────────
  const del = await prisma.setting.deleteMany({ where: { key: "PIPELINE_TEMPLATE" } });

  console.log("✅ prod-setup-v8 OK");
  console.log(`   roles nuevos asegurados: EXPERIENCIA_SOLAR, TRAMITACION_UTE`);
  console.log(`   permisos upserted: ${permsCreados}`);
  console.log(`   label CLIENT → "Generador"`);
  console.log(`   setting PIPELINE_TEMPLATE eliminado: ${del.count}`);
  console.log("\n⚠ AHORA reiniciá el server para limpiar la cache de permisos.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

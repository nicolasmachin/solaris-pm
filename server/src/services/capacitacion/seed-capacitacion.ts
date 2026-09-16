// Permisos y secciones iniciales del módulo Capacitación. Lo usan el seed
// (`prisma/seed.ts`) y el one-shot de prod (`scripts/seed-capacitacion.ts`).
// Idempotente: nunca borra ni pisa lo que se haya ajustado desde la app.

import { Action, Module, type PrismaClient } from "@prisma/client";

// Rol del portal de clientes: no entra a Capacitación.
const ROLES_EXCLUIDOS = new Set(["CLIENT"]);
const ROLES_GESTION = ["ADMIN"];

export const SECCIONES_INICIALES: Array<{ nombre: string; roles: string[] | "TODOS" }> = [
  { nombre: "Ventas", roles: ["ASESOR_COMERCIAL", "GERENTE_COMERCIAL"] },
  { nombre: "Ingeniería y Tramitación", roles: ["INGENIERIA", "GERENTE_INGENIERIA", "TRAMITACION_UTE"] },
  {
    nombre: "Operaciones",
    roles: ["OPERACIONES", "GERENTE_OPERACIONES", "LOGISTICA", "CAPATAZ", "INSTALADOR_TERCERIZADO"],
  },
  { nombre: "Experiencia Solar", roles: ["EXPERIENCIA_SOLAR", "POSTVENTA"] },
  { nombre: "Finanzas", roles: ["FINANZAS", "GERENTE_FINANZAS"] },
  { nombre: "Otros", roles: "TODOS" },
];

export async function seedCapacitacion(prisma: PrismaClient, log: (msg: string) => void = () => undefined) {
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  const internos = roles.filter((r) => !ROLES_EXCLUIDOS.has(r.name));
  const idPorNombre = new Map(roles.map((r) => [r.name, r.id]));

  // 1. Permisos: VIEW para todos los internos, EDIT para gestión.
  const permisos = [
    ...internos.map((r) => ({ roleId: r.id, action: Action.VIEW })),
    ...ROLES_GESTION.flatMap((n) => (idPorNombre.has(n) ? [{ roleId: idPorNombre.get(n)!, action: Action.EDIT }] : [])),
  ];
  const creados = await prisma.permission.createMany({
    data: permisos.map((p) => ({ roleId: p.roleId, module: Module.CAPACITACION, action: p.action })),
    skipDuplicates: true,
  });
  log(`Permisos CAPACITACION creados: ${creados.count} (VIEW a ${internos.length} roles, EDIT a ${ROLES_GESTION.join(", ")}).`);

  // 2. Secciones: solo si todavía no hay ninguna (una vez armadas, se gestionan
  //    desde la app y re-correr esto no las recrea aunque se hayan renombrado).
  const existentes = await prisma.capacitacionSeccion.count();
  if (existentes > 0) {
    log(`Ya hay ${existentes} secciones de capacitación: no se crean las iniciales.`);
    return;
  }
  for (const [orden, s] of SECCIONES_INICIALES.entries()) {
    const roleIds =
      s.roles === "TODOS"
        ? internos.map((r) => r.id)
        : s.roles.flatMap((n) => {
            const id = idPorNombre.get(n);
            if (!id) log(`⚠️  Rol ${n} no existe: se omite en la sección ${s.nombre}.`);
            return id ? [id] : [];
          });
    await prisma.capacitacionSeccion.create({
      data: { nombre: s.nombre, orden, roles: { create: roleIds.map((roleId) => ({ roleId })) } },
    });
    log(`Sección '${s.nombre}' creada con ${roleIds.length} roles.`);
  }
}

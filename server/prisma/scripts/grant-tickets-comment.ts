// Habilita comentar tickets de soporte a un rol que hoy solo los ve.
//
// Por qué existe: la pantalla de permisos ofrece TICKETS:COMMENT desde que
// existe el módulo, pero la ruta POST /tickets/:id/comentarios pedía EDIT, así
// que tildar "Comentar" no servía de nada. Ahora la ruta acepta COMMENT o EDIT
// (ver tickets.routes.ts), y este script deja el permiso puesto en la base.
//
// En producción, al 21-sep-2026, LOGISTICA ya tenía TICKETS:COMMENT tildado a
// mano (y VIEW y CREATE, no EDIT): el permiso estaba, lo que faltaba era que la
// ruta lo aceptara. Así que acá no hubo nada que aplicar; el script queda por el
// diagnóstico y para el próximo rol que haya que sumar.
//
// Diagnóstico (no escribe nada) — lista la matriz TICKETS por rol y, si se le
// pasa un texto, los usuarios que coincidan con su nombre o mail:
//
//   docker compose -f docker-compose.prod.yml exec server \
//     npx tsx prisma/scripts/grant-tickets-comment.ts --usuario gonzalo
//
// Aplicar (idempotente, se puede correr varias veces):
//
//   docker compose -f docker-compose.prod.yml exec server \
//     npx tsx prisma/scripts/grant-tickets-comment.ts --rol LOGISTICA
//
// Da TICKETS:VIEW + TICKETS:COMMENT al rol. NO da EDIT: comentar no habilita
// derivar, poner en progreso, resolver ni cerrar.
//
// Después de aplicarlo hay que invalidar el cache de permisos del server
// (5 minutos de TTL): reiniciarlo, o esperar.

import { Action, Module, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ACCIONES = [Action.VIEW, Action.COMMENT];

function leerArg(nombre: string): string | null {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1) return null;
  const valor = process.argv[i + 1];
  if (!valor || valor.startsWith("--")) return null;
  return valor;
}

async function matrizTickets() {
  const roles = await prisma.role.findMany({
    where: { permissions: { some: { module: Module.TICKETS } } },
    select: {
      name: true,
      permissions: { where: { module: Module.TICKETS }, select: { action: true } },
      _count: { select: { users: true } },
    },
    orderBy: { name: "asc" },
  });
  for (const rol of roles) {
    const acciones = rol.permissions.map((p) => p.action).sort().join(", ");
    console.log(`  ${rol.name.padEnd(24)} ${acciones}   (${rol._count.users} usuario/s)`);
  }
  const sinTickets = await prisma.role.findMany({
    where: { permissions: { none: { module: Module.TICKETS } } },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  if (sinTickets.length > 0) {
    console.log(`  sin ningún permiso de TICKETS: ${sinTickets.map((r) => r.name).join(", ")}`);
  }
}

async function main() {
  const rolPedido = leerArg("rol");
  const usuarioPedido = leerArg("usuario");

  if (usuarioPedido) {
    const usuarios = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: usuarioPedido, mode: "insensitive" } },
          { email: { contains: usuarioPedido, mode: "insensitive" } },
        ],
      },
      select: { name: true, email: true, deletedAt: true, role: { select: { name: true } } },
    });
    console.log(`\nUsuarios que coinciden con "${usuarioPedido}":`);
    if (usuarios.length === 0) console.log("  (ninguno)");
    for (const u of usuarios) {
      const estado = u.deletedAt ? "DADO DE BAJA" : "activo";
      console.log(`  ${u.name} <${u.email ?? "sin mail"}>  rol=${u.role.name}  ${estado}`);
    }
  }

  console.log("\nPermisos del módulo TICKETS, por rol:");
  await matrizTickets();

  if (!rolPedido) {
    console.log("\nSin --rol no se escribe nada. Para aplicar: --rol NOMBRE_DEL_ROL");
    return;
  }

  const rol = await prisma.role.findUnique({
    where: { name: rolPedido },
    select: { id: true, name: true, label: true },
  });
  if (!rol) {
    throw new Error(`No existe el rol "${rolPedido}". Ver la lista de arriba.`);
  }

  const creados = await prisma.permission.createMany({
    data: ACCIONES.map((action) => ({ roleId: rol.id, module: Module.TICKETS, action })),
    skipDuplicates: true,
  });
  console.log(
    `\n${rol.name} (${rol.label}): permisos nuevos ${creados.count} de ${ACCIONES.length} ` +
      `(${ACCIONES.join(", ")}); los que ya estaban se saltearon.`,
  );

  console.log("\nComo quedó TICKETS:");
  await matrizTickets();
  console.log("\nReiniciar el server para invalidar el cache de permisos.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

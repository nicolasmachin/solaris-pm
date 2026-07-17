import { SubRolOperaciones, TraspasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { ROLE, TRASPASO_CATALOGO } from "./catalogo.js";

export type DestinatarioCalculado = {
  usuarioId: string;
  esCopia: boolean;
  roleName: string;
  nombre: string;
};

// Persona concreta para listar en el popup/bandeja (sin exponer el id).
export type DestinatarioListado = {
  nombre: string;
  roleName: string;
  esCopia: boolean;
};

type CalcularOpts = {
  // Payload del traspaso. Para T8 se lee `areaDerivada` (INGENIERIA | OPERACIONES).
  payload?: unknown;
  // Usuario a excluir de la lista (típicamente el actor que confirma, para no
  // notificarse a sí mismo cuando además cae en la copia de ADMIN).
  excludeUserId?: string;
};

function getAreaDerivada(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "areaDerivada" in payload) {
    const v = (payload as Record<string, unknown>).areaDerivada;
    if (v === ROLE.INGENIERIA || v === ROLE.OPERACIONES) return v;
  }
  return null;
}

// `name` es opcional para que los fakes de test (que devuelven solo id+roleName)
// sigan tipando; en producción los fetchers de Prisma siempre lo traen.
type UsuarioMin = { id: string; roleName: string; name?: string };

async function usuariosPorRoles(roles: string[]): Promise<UsuarioMin[]> {
  if (roles.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: { in: roles } } },
    select: { id: true, name: true, role: { select: { name: true } } },
  });
  return users.map((u) => ({ id: u.id, name: u.name, roleName: u.role.name }));
}

async function usuariosOperacionesConSubRol(
  subRol: SubRolOperaciones,
): Promise<UsuarioMin[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: { name: ROLE.OPERACIONES },
      subRolesOperaciones: { has: subRol },
    },
    select: { id: true, name: true, role: { select: { name: true } } },
  });
  return users.map((u) => ({ id: u.id, name: u.name, roleName: u.role.name }));
}

// Fetchers de usuarios inyectables (para tests unitarios sin DB). En producción
// se usan los que consultan Prisma; los tests pasan implementaciones falsas.
export type DestinatarioDeps = {
  usuariosPorRoles: (roles: string[]) => Promise<UsuarioMin[]>;
  usuariosOperacionesConSubRol: (subRol: SubRolOperaciones) => Promise<UsuarioMin[]>;
};

const DEFAULT_DEPS: DestinatarioDeps = { usuariosPorRoles, usuariosOperacionesConSubRol };

// Calcula los destinatarios de un traspaso aplicando, en orden:
//   1. Roles primarios del catálogo.
//   2. Sub-roles de Operaciones primarios (Capatacía/Compras).
//   3. Gerente de Operaciones en copia (si la entrada lo indica).
//   4. ADMIN siempre en copia.
//   5. Deduplicar: un usuario aparece una sola vez; esCopia=true solo si entra
//      únicamente por regla 3 o 4.
//
// Nota: la notificación va a TODOS los usuarios del rol/sub-rol (red de
// seguridad), sin filtrar por asignación al proyecto — decisión del MVP.
export async function calcularDestinatarios(
  tipo: TraspasoTipo,
  opts: CalcularOpts = {},
  deps: DestinatarioDeps = DEFAULT_DEPS,
): Promise<DestinatarioCalculado[]> {
  const entry = TRASPASO_CATALOGO[tipo];

  // T8 resuelve el rol primario desde el payload (área derivada).
  let rolesPrimarios = entry.rolesPrimarios;
  const areaDerivada = getAreaDerivada(opts.payload);
  if (tipo === TraspasoTipo.T9_TICKET_DERIVADO && areaDerivada) {
    rolesPrimarios = [areaDerivada];
  }

  // Gerente en copia también si T8 se derivó a Operaciones.
  const gerenteCopia =
    entry.gerenteCopia ||
    (tipo === TraspasoTipo.T9_TICKET_DERIVADO && areaDerivada === ROLE.OPERACIONES);

  type UserInfo = { roleName: string; nombre: string };
  const primary = new Map<string, UserInfo>();
  for (const u of await deps.usuariosPorRoles(rolesPrimarios)) primary.set(u.id, { roleName: u.roleName, nombre: u.name ?? "" });
  for (const subRol of entry.subRolesPrimarios) {
    for (const u of await deps.usuariosOperacionesConSubRol(subRol)) primary.set(u.id, { roleName: u.roleName, nombre: u.name ?? "" });
  }

  const copia = new Map<string, UserInfo>();
  if (gerenteCopia) {
    for (const u of await deps.usuariosOperacionesConSubRol(SubRolOperaciones.GERENTE)) copia.set(u.id, { roleName: u.roleName, nombre: u.name ?? "" });
  }
  for (const u of await deps.usuariosPorRoles([ROLE.ADMIN])) copia.set(u.id, { roleName: u.roleName, nombre: u.name ?? "" });

  const result: DestinatarioCalculado[] = [];
  const seen = new Set<string>();
  for (const [id, info] of primary) {
    if (id === opts.excludeUserId) continue;
    result.push({ usuarioId: id, esCopia: false, roleName: info.roleName, nombre: info.nombre });
    seen.add(id);
  }
  for (const [id, info] of copia) {
    if (id === opts.excludeUserId || seen.has(id)) continue;
    result.push({ usuarioId: id, esCopia: true, roleName: info.roleName, nombre: info.nombre });
    seen.add(id);
  }
  return result;
}

// Resumen por rol con conteo a partir de una lista ya calculada.
// Ej: ["INGENIERIA (2)", "ADMIN (copia) (1)"]. Función pura (sin DB).
export function resumirPorRol(dests: DestinatarioCalculado[]): string[] {
  const counts = new Map<string, number>();
  for (const d of dests) {
    const key = d.esCopia ? `${d.roleName} (copia)` : d.roleName;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([rol, n]) => `${rol} (${n})`);
}

// Lista de personas concretas (nombre + rol + esCopia), ordenada: primero los
// destinatarios directos, luego las copias; dentro de cada grupo por rol y
// nombre. Función pura (sin DB).
export function listarPersonas(dests: DestinatarioCalculado[]): DestinatarioListado[] {
  return dests
    .map((d) => ({ nombre: d.nombre, roleName: d.roleName, esCopia: d.esCopia }))
    .sort((a, b) =>
      Number(a.esCopia) - Number(b.esCopia) ||
      a.roleName.localeCompare(b.roleName) ||
      a.nombre.localeCompare(b.nombre),
    );
}

// Resumen legible de destinatarios para la preview del modal / bandeja,
// agrupado por rol con conteo. Ej: ["Ingeniería (2)", "ADMIN (1)"].
export async function previewDestinatarios(
  tipo: TraspasoTipo,
  opts: CalcularOpts = {},
  deps: DestinatarioDeps = DEFAULT_DEPS,
): Promise<string[]> {
  return resumirPorRol(await calcularDestinatarios(tipo, opts, deps));
}

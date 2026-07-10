import { SubRolOperaciones, TraspasoTipo } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { ROLE, TRASPASO_CATALOGO } from "./catalogo.js";

export type DestinatarioCalculado = {
  usuarioId: string;
  esCopia: boolean;
  roleName: string;
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

async function usuariosPorRoles(roles: string[]): Promise<Array<{ id: string; roleName: string }>> {
  if (roles.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { deletedAt: null, role: { name: { in: roles } } },
    select: { id: true, role: { select: { name: true } } },
  });
  return users.map((u) => ({ id: u.id, roleName: u.role.name }));
}

async function usuariosOperacionesConSubRol(
  subRol: SubRolOperaciones,
): Promise<Array<{ id: string; roleName: string }>> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      role: { name: ROLE.OPERACIONES },
      subRolesOperaciones: { has: subRol },
    },
    select: { id: true, role: { select: { name: true } } },
  });
  return users.map((u) => ({ id: u.id, roleName: u.role.name }));
}

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

  const primary = new Map<string, string>();
  for (const u of await usuariosPorRoles(rolesPrimarios)) primary.set(u.id, u.roleName);
  for (const subRol of entry.subRolesPrimarios) {
    for (const u of await usuariosOperacionesConSubRol(subRol)) primary.set(u.id, u.roleName);
  }

  const copia = new Map<string, string>();
  if (gerenteCopia) {
    for (const u of await usuariosOperacionesConSubRol(SubRolOperaciones.GERENTE)) copia.set(u.id, u.roleName);
  }
  for (const u of await usuariosPorRoles([ROLE.ADMIN])) copia.set(u.id, u.roleName);

  const result: DestinatarioCalculado[] = [];
  const seen = new Set<string>();
  for (const [id, roleName] of primary) {
    if (id === opts.excludeUserId) continue;
    result.push({ usuarioId: id, esCopia: false, roleName });
    seen.add(id);
  }
  for (const [id, roleName] of copia) {
    if (id === opts.excludeUserId || seen.has(id)) continue;
    result.push({ usuarioId: id, esCopia: true, roleName });
    seen.add(id);
  }
  return result;
}

// Resumen legible de destinatarios para la preview del modal / bandeja,
// agrupado por rol con conteo. Ej: ["Ingeniería (2)", "ADMIN (1)"].
export async function previewDestinatarios(tipo: TraspasoTipo, opts: CalcularOpts = {}): Promise<string[]> {
  const dests = await calcularDestinatarios(tipo, opts);
  const counts = new Map<string, number>();
  for (const d of dests) {
    const key = d.esCopia ? `${d.roleName} (copia)` : d.roleName;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([rol, n]) => `${rol} (${n})`);
}

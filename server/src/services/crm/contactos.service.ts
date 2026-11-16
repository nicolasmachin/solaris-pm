/**
 * CRM de Ventas: Contactos (personas) y Empresas, y el vínculo entre ellos.
 * Los leads y proyectos apuntan a un contacto y, si el cliente es una empresa,
 * también a la empresa (campos contactoId / empresaId).
 *
 * Ver docs/manual/ (capítulo de Ventas) y scripts/crm-pasar-contactos.ts.
 */

import { AuditAction, AuditEntityType, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { telefonosDe } from "../whatsapp-cloud/bandejas.service.js";
import { normalizarTelefono as normalizarWhatsApp } from "../whatsapp-cloud/api.service.js";

/**
 * El primer teléfono del campo, solo dígitos y con código de país
 * ("099 123 456" → "59899123456"). null si no hay uno usable.
 */
export function normalizarTelefono(campo: string | null | undefined): string | null {
  if (!campo) return null;
  const primero = telefonosDe(campo)[0];
  if (primero) return primero;
  const d = normalizarWhatsApp(campo);
  return d.length >= 8 ? d : null;
}

const SUFIJOS_EMPRESA =
  /\b(s\.?\s?a\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?\s?s\.?|ltda\.?|sociedad|cooperativa|club|hotel|colegio|escuela|liceo|instituto|iglesia|asociaci[oó]n|fundaci[oó]n|barraca|bodega|ferreter[ií]a|inmobiliaria|consorcio|estancia|sanatorio|policl[ií]nico|c[ií]rculo)\b/i;

/** ¿El nombre es de una empresa? (S.A., S.R.L., hotel, club…). Heurística para el pasaje. */
export function esNombreDeEmpresa(nombre: string): boolean {
  return SUFIJOS_EMPRESA.test(nombre);
}

const TIPO_SOCIETARIO = /^(.*?\b(?:s\.?\s?a\.?\s?s\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?|ltda\.?))(?=\s|$)/i;

/**
 * Del nombre de un lead u obra, la empresa y la persona, si se pueden separar:
 * "Frigorífico del Sur S.A. — Marcelo Ríos" → empresa + persona;
 * "FEDORIL SA Garzón" → empresa "FEDORIL SA" (lo que sigue es la obra).
 */
export function separarEmpresaPersona(nombre: string): { empresa: string | null; persona: string | null } {
  const limpio = nombre.replace(/\s+/g, " ").trim();
  const partes = limpio.split(/\s+[—–-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (partes.length === 2) {
    const [a, b] = partes;
    if (esNombreDeEmpresa(a) && !esNombreDeEmpresa(b) && !/\d{5,}/.test(b)) return { empresa: razonSocialDe(a), persona: b };
    if (esNombreDeEmpresa(b) && !esNombreDeEmpresa(a)) return { empresa: razonSocialDe(b), persona: a };
  }
  if (esNombreDeEmpresa(limpio)) return { empresa: razonSocialDe(limpio), persona: null };
  return { empresa: null, persona: limpio };
}

/** "FEDORIL SA Garzón" → "FEDORIL SA". Sin tipo societario, el nombre tal cual. */
export function razonSocialDe(nombre: string): string {
  const m = nombre.match(TIPO_SOCIETARIO);
  return (m ? m[1] : nombre).replace(/[.,\s]+$/, (x) => (x.includes(".") ? x.trim() : "")).trim();
}

// ─── Contactos ───────────────────────────────────────────────────────────────

const CONTACTO_LISTA = {
  id: true,
  nombre: true,
  telefono: true,
  email: true,
  documento: true,
  empresas: { select: { cargo: true, principal: true, empresa: { select: { id: true, razonSocial: true } } } },
  _count: { select: { leads: { where: { deletedAt: null } }, projects: { where: { deletedAt: null } } } },
} satisfies Prisma.ContactoSelect;

export async function listarContactos(q?: string) {
  const texto = q?.trim();
  const digitos = texto?.replace(/\D/g, "") ?? "";
  const where: Prisma.ContactoWhereInput = { deletedAt: null };
  if (texto) {
    where.OR = [
      { nombre: { contains: texto, mode: "insensitive" } },
      { email: { contains: texto, mode: "insensitive" } },
      { documento: { contains: texto } },
      ...(digitos.length >= 3 ? [{ telefono: { contains: digitos } }] : []),
      { empresas: { some: { empresa: { razonSocial: { contains: texto, mode: "insensitive" } } } } },
    ];
  }
  return prisma.contacto.findMany({ where, select: CONTACTO_LISTA, orderBy: { nombre: "asc" }, take: 300 });
}

export async function fichaContacto(id: string) {
  const c = await prisma.contacto.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...CONTACTO_LISTA,
      notas: true,
      createdAt: true,
      leads: {
        where: { deletedAt: null },
        select: { id: true, clientName: true, stage: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      projects: {
        where: { deletedAt: null },
        select: { id: true, code: true, clientName: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!c) throw notFound("CONTACTO_NO_ENCONTRADO", "El contacto no existe");
  return c;
}

export type DatosContacto = {
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  documento?: string | null;
  notas?: string | null;
};

function limpiarContacto(d: Partial<DatosContacto>) {
  return {
    ...(d.nombre !== undefined ? { nombre: d.nombre.trim() } : {}),
    ...(d.telefono !== undefined ? { telefono: normalizarTelefono(d.telefono) } : {}),
    ...(d.email !== undefined ? { email: d.email?.trim().toLowerCase() || null } : {}),
    ...(d.documento !== undefined ? { documento: d.documento?.trim() || null } : {}),
    ...(d.notas !== undefined ? { notas: d.notas?.trim() || null } : {}),
  };
}

/** Regla del CRM: un teléfono es de un contacto. */
async function exigirTelefonoLibre(telefono: string | null, salvoId?: string) {
  if (!telefono) return;
  const otro = await prisma.contacto.findFirst({
    where: { telefono, deletedAt: null, ...(salvoId ? { id: { not: salvoId } } : {}) },
    select: { nombre: true },
  });
  if (otro) throw badRequest("TELEFONO_EN_USO", `Ese teléfono ya es de ${otro.nombre}.`);
}

export async function crearContacto(d: DatosContacto, userId: string) {
  const data = limpiarContacto(d) as DatosContacto & { nombre: string };
  if (!data.nombre) throw badRequest("NOMBRE_REQUERIDO", "El contacto necesita un nombre.");
  await exigirTelefonoLibre(data.telefono ?? null);
  const c = await prisma.contacto.create({ data: { ...data, createdById: userId } });
  await createAuditEntry({
    entityType: AuditEntityType.contacto,
    entityId: c.id,
    userId,
    action: AuditAction.created,
    description: `Creó el contacto ${c.nombre}`,
  });
  return c;
}

export async function editarContacto(id: string, d: Partial<DatosContacto>, userId: string) {
  const antes = await prisma.contacto.findFirst({ where: { id, deletedAt: null } });
  if (!antes) throw notFound("CONTACTO_NO_ENCONTRADO", "El contacto no existe");
  const data = limpiarContacto(d);
  if (data.nombre === "") throw badRequest("NOMBRE_REQUERIDO", "El contacto necesita un nombre.");
  if (data.telefono !== undefined) await exigirTelefonoLibre(data.telefono, id);
  const c = await prisma.contacto.update({ where: { id }, data });
  await createAuditEntry({
    entityType: AuditEntityType.contacto,
    entityId: id,
    userId,
    action: AuditAction.updated,
    description: `Editó el contacto ${c.nombre}`,
  });
  return c;
}

/** Baja lógica. No se puede si tiene leads o proyectos: primero se reasignan. */
export async function borrarContacto(id: string, userId: string) {
  const c = await prisma.contacto.findFirst({
    where: { id, deletedAt: null },
    select: { nombre: true, _count: { select: { leads: { where: { deletedAt: null } }, projects: { where: { deletedAt: null } } } } },
  });
  if (!c) throw notFound("CONTACTO_NO_ENCONTRADO", "El contacto no existe");
  if (c._count.leads + c._count.projects > 0) {
    throw badRequest("CONTACTO_EN_USO", "El contacto tiene leads o proyectos: no se puede borrar.");
  }
  await prisma.contacto.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditEntry({
    entityType: AuditEntityType.contacto,
    entityId: id,
    userId,
    action: AuditAction.deleted,
    description: `Borró el contacto ${c.nombre}`,
  });
}

// ─── Empresas ────────────────────────────────────────────────────────────────

const EMPRESA_LISTA = {
  id: true,
  razonSocial: true,
  nombreFantasia: true,
  rut: true,
  telefono: true,
  email: true,
  contactos: {
    where: { contacto: { deletedAt: null } },
    select: { cargo: true, principal: true, contacto: { select: { id: true, nombre: true, telefono: true } } },
    orderBy: [{ principal: "desc" as const }, { createdAt: "asc" as const }],
  },
  _count: { select: { leads: { where: { deletedAt: null } }, projects: { where: { deletedAt: null } } } },
} satisfies Prisma.EmpresaSelect;

export async function listarEmpresas(q?: string) {
  const texto = q?.trim();
  const where: Prisma.EmpresaWhereInput = { deletedAt: null };
  if (texto) {
    where.OR = [
      { razonSocial: { contains: texto, mode: "insensitive" } },
      { nombreFantasia: { contains: texto, mode: "insensitive" } },
      { rut: { contains: texto.replace(/\D/g, "") || texto } },
      { contactos: { some: { contacto: { nombre: { contains: texto, mode: "insensitive" } } } } },
    ];
  }
  return prisma.empresa.findMany({ where, select: EMPRESA_LISTA, orderBy: { razonSocial: "asc" }, take: 300 });
}

export async function fichaEmpresa(id: string) {
  const e = await prisma.empresa.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...EMPRESA_LISTA,
      direccion: true,
      notas: true,
      createdAt: true,
      leads: {
        where: { deletedAt: null },
        select: { id: true, clientName: true, stage: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      projects: {
        where: { deletedAt: null },
        select: { id: true, code: true, clientName: true, status: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!e) throw notFound("EMPRESA_NO_ENCONTRADA", "La empresa no existe");
  return e;
}

export type DatosEmpresa = {
  razonSocial: string;
  nombreFantasia?: string | null;
  rut?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  notas?: string | null;
};

function limpiarEmpresa(d: Partial<DatosEmpresa>) {
  const opcional = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
  return {
    ...(d.razonSocial !== undefined ? { razonSocial: d.razonSocial.trim() } : {}),
    ...(d.nombreFantasia !== undefined ? { nombreFantasia: opcional(d.nombreFantasia) } : {}),
    ...(d.rut !== undefined ? { rut: d.rut ? d.rut.replace(/\D/g, "") || null : null } : {}),
    ...(d.telefono !== undefined ? { telefono: normalizarTelefono(d.telefono) } : {}),
    ...(d.email !== undefined ? { email: d.email?.trim().toLowerCase() || null } : {}),
    ...(d.direccion !== undefined ? { direccion: opcional(d.direccion) } : {}),
    ...(d.notas !== undefined ? { notas: opcional(d.notas) } : {}),
  };
}

export async function crearEmpresa(d: DatosEmpresa, userId: string) {
  const data = limpiarEmpresa(d) as DatosEmpresa;
  if (!data.razonSocial) throw badRequest("RAZON_SOCIAL_REQUERIDA", "La empresa necesita un nombre.");
  const e = await prisma.empresa.create({ data: { ...data, createdById: userId } });
  await createAuditEntry({
    entityType: AuditEntityType.empresa,
    entityId: e.id,
    userId,
    action: AuditAction.created,
    description: `Creó la empresa ${e.razonSocial}`,
  });
  return e;
}

export async function editarEmpresa(id: string, d: Partial<DatosEmpresa>, userId: string) {
  const antes = await prisma.empresa.findFirst({ where: { id, deletedAt: null } });
  if (!antes) throw notFound("EMPRESA_NO_ENCONTRADA", "La empresa no existe");
  const data = limpiarEmpresa(d);
  if (data.razonSocial === "") throw badRequest("RAZON_SOCIAL_REQUERIDA", "La empresa necesita un nombre.");
  const e = await prisma.empresa.update({ where: { id }, data });
  await createAuditEntry({
    entityType: AuditEntityType.empresa,
    entityId: id,
    userId,
    action: AuditAction.updated,
    description: `Editó la empresa ${e.razonSocial}`,
  });
  return e;
}

export async function borrarEmpresa(id: string, userId: string) {
  const e = await prisma.empresa.findFirst({
    where: { id, deletedAt: null },
    select: { razonSocial: true, _count: { select: { leads: { where: { deletedAt: null } }, projects: { where: { deletedAt: null } } } } },
  });
  if (!e) throw notFound("EMPRESA_NO_ENCONTRADA", "La empresa no existe");
  if (e._count.leads + e._count.projects > 0) {
    throw badRequest("EMPRESA_EN_USO", "La empresa tiene leads o proyectos: no se puede borrar.");
  }
  await prisma.empresa.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditEntry({
    entityType: AuditEntityType.empresa,
    entityId: id,
    userId,
    action: AuditAction.deleted,
    description: `Borró la empresa ${e.razonSocial}`,
  });
}

// ─── Vínculo contacto ↔ empresa ──────────────────────────────────────────────

export async function vincular(
  empresaId: string,
  contactoId: string,
  d: { cargo?: string | null; principal?: boolean },
  userId: string,
) {
  const [e, c] = await Promise.all([
    prisma.empresa.findFirst({ where: { id: empresaId, deletedAt: null }, select: { razonSocial: true } }),
    prisma.contacto.findFirst({ where: { id: contactoId, deletedAt: null }, select: { nombre: true } }),
  ]);
  if (!e) throw notFound("EMPRESA_NO_ENCONTRADA", "La empresa no existe");
  if (!c) throw notFound("CONTACTO_NO_ENCONTRADO", "El contacto no existe");
  const cargo = d.cargo === undefined ? undefined : d.cargo?.trim() || null;
  await prisma.$transaction(async (tx) => {
    // Un solo principal por empresa.
    if (d.principal) await tx.contactoEmpresa.updateMany({ where: { empresaId }, data: { principal: false } });
    await tx.contactoEmpresa.upsert({
      where: { contactoId_empresaId: { contactoId, empresaId } },
      create: { contactoId, empresaId, cargo: cargo ?? null, principal: d.principal ?? false },
      update: { ...(cargo !== undefined ? { cargo } : {}), ...(d.principal !== undefined ? { principal: d.principal } : {}) },
    });
  });
  await createAuditEntry({
    entityType: AuditEntityType.empresa,
    entityId: empresaId,
    userId,
    action: AuditAction.updated,
    description: `Vinculó a ${c.nombre} con ${e.razonSocial}${cargo ? ` (${cargo})` : ""}`,
  });
}

export async function desvincular(empresaId: string, contactoId: string, userId: string) {
  const v = await prisma.contactoEmpresa.findUnique({
    where: { contactoId_empresaId: { contactoId, empresaId } },
    select: { contacto: { select: { nombre: true } }, empresa: { select: { razonSocial: true } } },
  });
  if (!v) return;
  await prisma.contactoEmpresa.delete({ where: { contactoId_empresaId: { contactoId, empresaId } } });
  await createAuditEntry({
    entityType: AuditEntityType.empresa,
    entityId: empresaId,
    userId,
    action: AuditAction.updated,
    description: `Desvinculó a ${v.contacto.nombre} de ${v.empresa.razonSocial}`,
  });
}

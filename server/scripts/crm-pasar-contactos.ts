/**
 * CRM de Ventas, fase 1: arma Contactos y Empresas a partir de los leads y
 * proyectos que ya existen, y los vincula.
 *
 * Reglas (aprobadas por Nicolás el 15-nov-2026):
 *  1. El lead y el proyecto conservan su nombre (es la oportunidad u obra) y
 *     apuntan a un contacto y, si corresponde, a una empresa.
 *  2. Un teléfono es de un contacto. Si el nombre es de empresa, se crea la
 *     empresa y la persona queda como su contacto.
 *  3. Los leads sin teléfono ni mail también generan un contacto (solo nombre).
 *  4. Los teléfonos compartidos por nombres distintos y las empresas detectadas
 *     por el nombre se listan para revisar antes de pasar.
 *
 * Se agrupa por teléfono (últimos 8 dígitos) y por mail. Es idempotente: lo que
 * ya tiene contacto o empresa no se toca.
 *
 * Uso:
 *   npx tsx scripts/crm-pasar-contactos.ts             → resumen + lista a revisar, no guarda
 *   npx tsx scripts/crm-pasar-contactos.ts --aplicar --por nicolas@voltia.com.uy   → guarda
 *   npx tsx scripts/crm-pasar-contactos.ts --json datos.json   → arma la lista con datos
 *     exportados de otra base (fuente, id, nombre, tel, email, doc, fecha); nunca guarda
 */

import { readFileSync } from "node:fs";

import { AuditAction, AuditEntityType } from "@prisma/client";

import { prisma } from "../src/lib/prisma.js";
import { createAuditEntry } from "../src/services/audit.service.js";
import { normalizarTelefono, separarEmpresaPersona } from "../src/services/crm/contactos.service.js";

type Registro = {
  fuente: "lead" | "proyecto";
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  documento: string | null;
  fecha: Date;
};

const clave8 = (t: string | null) => (t && t.length >= 8 ? t.slice(-8) : null);


/** personas: una por nombre distinto; la primera se queda con el teléfono y el mail. */
type Plan = { registros: Registro[]; personas: string[]; empresa: string | null; revisar: string | null };

/** Empresas que el nombre no delata (sin S.A. ni rubro): nombre de la obra → empresa. */
const EMPRESAS_A_MANO: Array<[RegExp, string]> = [
  [/^coviteja\b/i, "COVITEJA"],
  [/^hotel lamas\b/i, "Hotel Lamas"],
];

/** Nombres de obra que en realidad son de otra persona (revisión del 15-nov-2026). */
const PERSONA_A_MANO: Array<[RegExp, string]> = [[/^evelyn irvi[ñn]o\s*\/\s*gustavo correa$/i, "Gustavo Correa"]];

function separar(nombre: string) {
  for (const [patron, persona] of PERSONA_A_MANO) if (patron.test(nombre.trim())) return { empresa: null, persona };
  for (const [patron, empresa] of EMPRESAS_A_MANO) if (patron.test(nombre.trim())) return { empresa, persona: null };
  return separarEmpresaPersona(nombre);
}

const clave = (x: string) => x.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

/** Agrupa los registros, decide contacto y empresa de cada grupo e imprime el resumen y la lista a revisar. */
function planear(registros: Registro[], nLeads: number, nProy: number): { planes: Plan[]; conEmpresa: number } {
  // Unión por teléfono o mail (union-find).
  const padre = registros.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  const unir = (a: number, b: number) => (padre[raiz(a)] = raiz(b));
  const porClave = new Map<string, number>();
  registros.forEach((r, i) => {
    for (const k of [clave8(r.telefono) && `t${clave8(r.telefono)}`, r.email?.includes("@") && `m${r.email}`]) {
      if (!k) continue;
      const otro = porClave.get(k);
      if (otro === undefined) porClave.set(k, i);
      else unir(i, otro);
    }
  });
  const grupos = new Map<number, Registro[]>();
  registros.forEach((r, i) => grupos.set(raiz(i), [...(grupos.get(raiz(i)) ?? []), r]));

  const planes: Plan[] = [];
  for (const g of grupos.values()) {
    // Los proyectos primero (datos más curados), después lo más nuevo.
    g.sort((a, b) => (a.fuente === b.fuente ? b.fecha.getTime() - a.fecha.getTime() : a.fuente === "proyecto" ? -1 : 1));
    const sep = g.map((r) => separar(r.nombre));
    // Mismo nombre escrito distinto ("Silvina González / Gonzalo" y "… Gonzalo
    // Nicola"): si uno empieza como el otro, es la misma persona.
    const unicos = (xs: (string | null)[]) => {
      const vistos = new Map<string, string>();
      for (const x of xs) {
        if (!x) continue;
        const k = clave(x);
        const igual = [...vistos.keys()].find((v) => v.startsWith(k) || k.startsWith(v));
        if (!igual) vistos.set(k, x);
      }
      return [...vistos.values()];
    };
    const personas = unicos(sep.map((x) => x.persona));
    const empresas = unicos(sep.map((x) => x.empresa));
    let revisar: string | null = null;
    if (empresas.length > 0) revisar = "empresa detectada por el nombre";
    if (personas.length > 1 || empresas.length > 1) revisar = "teléfono o mail compartido por nombres distintos";
    planes.push({ registros: g, personas, empresa: empresas[0] ?? null, revisar });
  }

  const conEmpresa = planes.filter((p) => p.empresa).length;
  const aRevisar = planes.filter((p) => p.revisar);
  console.log(
    `Registros sin contacto: ${nLeads} leads y ${nProy} proyectos.\n` +
      `Contactos a crear: ${planes.reduce((n, p) => n + (p.personas.length || (p.empresa ? 0 : 1)), 0)} · empresas a crear: ${conEmpresa} · a revisar: ${aRevisar.length}\n`,
  );
  console.log("## Para revisar\n");
  for (const p of aRevisar) {
    const tel = p.registros.find((r) => r.telefono)?.telefono ?? "sin teléfono";
    console.log(`- ${tel} (${p.revisar})`);
    for (const r of p.registros) console.log(`    ${r.fuente}: ${r.nombre}`);
    const contactos = p.personas.length
      ? p.personas.map((n, i) => (i === 0 ? n : `${n} (sin teléfono)`)).join(", ")
      : "falta (la empresa queda con el teléfono y el mail)";
    console.log(`    → ${p.personas.length > 1 ? "contactos" : "contacto"}: ${contactos}${p.empresa ? ` · empresa: ${p.empresa}` : ""}`);
  }
  return { planes, conEmpresa };
}


/**
 * Correcciones de la revisión con Nicolás (15-nov-2026), después del pasaje:
 * teléfonos, nombres y contactos de empresas que el pasaje no podía saber.
 */
type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function ajustesRevisados(tx: Tx, porId: string): Promise<string[]> {
  const hechos: string[] = [];
  const contacto = (nombre: string) =>
    tx.contacto.findFirst({ where: { nombre: { equals: nombre, mode: "insensitive" }, deletedAt: null }, orderBy: { createdAt: "asc" } });
  const telefonoLibre = async (tel: string, salvoId?: string) =>
    !(await tx.contacto.findFirst({ where: { telefono: tel, deletedAt: null, ...(salvoId ? { id: { not: salvoId } } : {}) } }));

  const ponerTelefono = async (nombre: string, tel: string, nuevoNombre?: string) => {
    const c = await contacto(nombre);
    if (!c) return hechos.push(`NO ENCONTRÉ el contacto ${nombre}`);
    // Si el teléfono lo tenía un pariente del mismo grupo, se lo saca primero.
    await tx.contacto.updateMany({ where: { telefono: tel, id: { not: c.id } }, data: { telefono: null } });
    await tx.contacto.update({ where: { id: c.id }, data: { telefono: tel, ...(nuevoNombre ? { nombre: nuevoNombre } : {}) } });
    hechos.push(`${nuevoNombre ?? nombre}: ${tel}`);
  };
  await ponerTelefono("Cristian Sosa", "59897082566", "Cristhian Sosa");
  await ponerTelefono("Rodolfo Sosa", "59896299825");
  await ponerTelefono("Nicolás Fripp", "59899393236");
  await ponerTelefono("Gustavo Correa", "59894491023");
  await ponerTelefono("Felipe Ciaran", "59891410026");
  await ponerTelefono("Fernando Ciaran", "59899641899");

  if (!(await contacto("Evelyn Irviño"))) {
    await tx.contacto.create({ data: { nombre: "Evelyn Irviño", createdById: porId } });
    hechos.push("Evelyn Irviño: contacto aparte, sin teléfono");
  }

  // Empresas a las que se les conocen los contactos.
  const contactosDeEmpresa = async (razonSocial: string, personas: Array<{ nombre: string; tel: string; principal?: boolean }>) => {
    const e = await tx.empresa.findFirst({ where: { razonSocial: { equals: razonSocial, mode: "insensitive" }, deletedAt: null } });
    if (!e) return hechos.push(`NO ENCONTRÉ la empresa ${razonSocial}`);
    let principalId: string | null = null;
    for (const p of personas) {
      if (!(await telefonoLibre(p.tel))) {
        hechos.push(`${p.nombre}: el ${p.tel} ya es de otro contacto, no se cargó`);
        continue;
      }
      const c = await tx.contacto.create({ data: { nombre: p.nombre, telefono: p.tel, createdById: porId } });
      await tx.contactoEmpresa.create({ data: { contactoId: c.id, empresaId: e.id, principal: !!p.principal } });
      if (p.principal) principalId = c.id;
      hechos.push(`${razonSocial}: contacto ${p.nombre} (${p.tel})`);
    }
    // El teléfono de la empresa era el del contacto: queda en el contacto.
    await tx.empresa.update({ where: { id: e.id }, data: { telefono: null } });
    if (principalId) {
      await tx.salesLead.updateMany({ where: { empresaId: e.id, contactoId: null }, data: { contactoId: principalId } });
      await tx.project.updateMany({ where: { empresaId: e.id, contactoId: null }, data: { contactoId: principalId } });
    }
  };
  await contactosDeEmpresa("BARENOF SA", [
    { nombre: "Mariana", tel: "59899109684", principal: true },
    { nombre: "Alejandro", tel: "59898308900" },
  ]);
  await contactosDeEmpresa("Hotel Lamas", [{ nombre: "Miguel Borrell", tel: "59898591082", principal: true }]);
  return hechos;
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const iPor = process.argv.indexOf("--por");
  const porEmail = iPor >= 0 ? process.argv[iPor + 1] : undefined;
  const por = porEmail ? await prisma.user.findUnique({ where: { email: porEmail }, select: { id: true } }) : null;
  if (aplicar && !por) {
    console.error("Con --aplicar hace falta --por <email del usuario que hace el pasaje>.");
    process.exitCode = 1;
    return;
  }

  const iJson = process.argv.indexOf("--json");
  if (iJson >= 0) {
    const filas = JSON.parse(readFileSync(process.argv[iJson + 1], "utf8")) as Array<{
      fuente: "lead" | "proyecto"; id: string; nombre: string; tel: string | null; email: string | null; doc: string | null; fecha: string;
    }>;
    planear(
      filas.map((f) => ({
        fuente: f.fuente,
        id: f.id,
        nombre: f.nombre.trim(),
        telefono: normalizarTelefono(f.tel),
        email: f.email?.trim().toLowerCase() || null,
        documento: f.doc,
        fecha: new Date(f.fecha),
      })),
      filas.filter((f) => f.fuente === "lead").length,
      filas.filter((f) => f.fuente === "proyecto").length,
    );
    console.log("\nCon --json nunca se guarda.");
    return;
  }

  const [leads, proyectos] = await Promise.all([
    prisma.salesLead.findMany({
      where: { deletedAt: null, contactoId: null, empresaId: null },
      select: { id: true, clientName: true, clientPhone: true, clientEmail: true, createdAt: true },
    }),
    prisma.project.findMany({
      where: { deletedAt: null, contactoId: null, empresaId: null },
      select: { id: true, clientName: true, clientPhone: true, clientEmail: true, ciCliente: true, createdAt: true },
    }),
  ]);
  const registros: Registro[] = [
    ...leads.map((l) => ({
      fuente: "lead" as const,
      id: l.id,
      nombre: l.clientName.trim(),
      telefono: normalizarTelefono(l.clientPhone),
      email: l.clientEmail?.trim().toLowerCase() || null,
      documento: null,
      fecha: l.createdAt,
    })),
    ...proyectos.map((p) => ({
      fuente: "proyecto" as const,
      id: p.id,
      nombre: p.clientName.trim(),
      telefono: normalizarTelefono(p.clientPhone),
      email: p.clientEmail?.trim().toLowerCase() || null,
      documento: p.ciCliente?.trim() || null,
      fecha: p.createdAt,
    })),
  ];

  const { planes, conEmpresa } = planear(registros, leads.length, proyectos.length);
  if (!aplicar) {
    console.log("\nSin --aplicar: no se guardó nada.");
    return;
  }

  let creados = 0;
  for (const p of planes) {
    const base = p.registros[0];
    const telefono = p.registros.find((r) => r.telefono)?.telefono ?? null;
    const email = p.registros.find((r) => r.email?.includes("@"))?.email ?? null;
    const documento = p.registros.find((r) => r.documento)?.documento ?? null;
    await prisma.$transaction(async (tx) => {
      // Una persona, un contacto; el teléfono y el mail, al primero (un teléfono
      // es de un contacto). Sin nombre de persona no se inventa un contacto: la
      // empresa se queda con el teléfono y el mail.
      const nombres = p.personas.length ? p.personas : p.empresa ? [] : [base.nombre];
      const contactos = new Map<string, string>();
      for (const [i, nombre] of nombres.entries()) {
        const c = await tx.contacto.create({
          data: { nombre, ...(i === 0 ? { telefono, email, documento } : {}), createdById: por!.id },
        });
        contactos.set(clave(nombre), c.id);
        creados++;
      }
      const primero = nombres[0] ? contactos.get(clave(nombres[0]))! : null;
      const empresa = p.empresa
        ? await tx.empresa.create({
            data: {
              razonSocial: p.empresa,
              createdById: por!.id,
              ...(nombres.length
                ? { contactos: { create: [...contactos.values()].map((contactoId) => ({ contactoId, principal: contactoId === primero })) } }
                : { telefono, email }),
            },
          })
        : null;
      for (const r of p.registros) {
        const persona = separar(r.nombre).persona;
        const k = persona ? clave(persona) : null;
        const propio = k ? [...contactos.entries()].find(([v]) => v.startsWith(k) || k.startsWith(v))?.[1] : undefined;
        const contactoId = propio ?? primero;
        const datos = { contactoId, empresaId: empresa?.id ?? null };
        if (r.fuente === "lead") await tx.salesLead.update({ where: { id: r.id }, data: datos });
        else await tx.project.update({ where: { id: r.id }, data: datos });
      }
    });
  }
  const hechos = await prisma.$transaction((tx) => ajustesRevisados(tx, por!.id));
  console.log("\n## Correcciones de la revisión\n" + hechos.map((h) => `- ${h}`).join("\n"));
  await createAuditEntry({
    entityType: AuditEntityType.contacto,
    entityId: "migracion-crm",
    userId: por!.id,
    action: AuditAction.created,
    description: `Pasaje inicial del CRM: ${creados} contactos y ${conEmpresa} empresas a partir de leads y proyectos`,
  });
  console.log(`\nGuardado: ${creados} contactos y ${conEmpresa} empresas.`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

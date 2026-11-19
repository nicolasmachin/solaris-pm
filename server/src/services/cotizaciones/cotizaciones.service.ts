/**
 * Cotizaciones a medida (Ventas): cotizaciones armadas a mano, fuera del
 * cotizador solar, y la lista de artículos de venta que las alimenta.
 *
 * Ver docs/manual/02-ventas.md, sección "Cotizaciones a medida".
 */

import { AuditAction, AuditEntityType, CotizacionEstado, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { crearContacto } from "../crm/contactos.service.js";
import type { Contenido, Destino, Renglon } from "./cotizaciones.schema.js";
import type { CotizacionPdfData } from "./template.js";

// Las cotizaciones 2026-001 a 2026-005 se hicieron fuera de Voltia PM: la
// numeración del sistema arranca después para no repetirlas.
const PRIMER_CORRELATIVO: Record<number, number> = { 2026: 6 };

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Subtotal, IVA y total a partir de los renglones (precios sin IVA). */
export function calcularTotales(items: Renglon[], ivaTasa: number) {
  const subtotal = redondear(items.reduce((s, r) => (r.tipo === "item" ? s + redondear(r.cantidad * r.precioUnitario) : s), 0));
  const iva = redondear((subtotal * ivaTasa) / 100);
  return { subtotal, iva, total: redondear(subtotal + iva) };
}

/** "59899123456" → "099 123 456"; cualquier otra cosa, tal cual. */
export function telefonoParaPdf(t: string | null | undefined): string | null {
  if (!t) return null;
  const m = t.match(/^598(\d{2})(\d{3})(\d{3})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : t;
}

const vacioANull = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

function datosContenido(c: Contenido) {
  const totales = calcularTotales(c.items, c.ivaTasa);
  return {
    clienteNombre: c.clienteNombre.trim(),
    clienteDireccion: vacioANull(c.clienteDireccion),
    clienteCiudad: vacioANull(c.clienteCiudad),
    clienteTelefono: vacioANull(c.clienteTelefono),
    clienteEmail: vacioANull(c.clienteEmail),
    fecha: new Date(`${c.fecha}T00:00:00Z`),
    validaHasta: new Date(`${c.validaHasta}T00:00:00Z`),
    moneda: c.moneda,
    vendedorId: c.vendedorId || null,
    formaTrabajo: vacioANull(c.formaTrabajo),
    alcanceTitulo: vacioANull(c.alcanceTitulo),
    alcanceTexto: vacioANull(c.alcanceTexto),
    items: c.items as unknown as Prisma.InputJsonValue,
    ivaTasa: c.ivaTasa,
    ...totales,
    condicionesPago: vacioANull(c.condicionesPago),
    plazoEntrega: vacioANull(c.plazoEntrega),
    incluye: vacioANull(c.incluye),
    noIncluye: vacioANull(c.noIncluye),
    observaciones: vacioANull(c.observaciones),
  };
}

/**
 * Resuelve para quién es: si viene un cliente nuevo lo crea como contacto; si
 * viene un lead o un proyecto, completa el contacto y la empresa que ya tengan.
 */
async function resolverDestino(d: Destino, userId: string) {
  const v = {
    leadId: d.leadId || null,
    contactoId: d.contactoId || null,
    empresaId: d.empresaId || null,
    projectId: d.projectId || null,
  };
  if (d.clienteNuevo) {
    const c = await crearContacto({ nombre: d.clienteNuevo.nombre, telefono: d.clienteNuevo.telefono ?? null, email: d.clienteNuevo.email ?? null }, userId);
    v.contactoId = c.id;
  }
  if (v.projectId) {
    const p = await prisma.project.findFirst({ where: { id: v.projectId, deletedAt: null }, select: { contactoId: true, empresaId: true } });
    if (!p) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe.");
    v.contactoId ??= p.contactoId;
    v.empresaId ??= p.empresaId;
  }
  if (v.leadId) {
    const l = await prisma.salesLead.findFirst({ where: { id: v.leadId, deletedAt: null }, select: { contactoId: true, empresaId: true } });
    if (!l) throw notFound("LEAD_NO_ENCONTRADO", "El lead no existe.");
    v.contactoId ??= l.contactoId;
    v.empresaId ??= l.empresaId;
  }
  if (!v.leadId && !v.contactoId && !v.empresaId && !v.projectId) {
    throw badRequest("SIN_DESTINATARIO", "Elegí para quién es la cotización: un lead, un contacto, una empresa o un proyecto, o cargá un cliente nuevo.");
  }
  return v;
}

const INCLUDE = {
  lead: { select: { id: true, code: true, clientName: true } },
  contacto: { select: { id: true, nombre: true } },
  empresa: { select: { id: true, razonSocial: true } },
  project: { select: { id: true, code: true, clientName: true } },
  vendedor: { select: { id: true, name: true } },
} satisfies Prisma.CotizacionInclude;

export async function listarCotizaciones(f: { q?: string; estado?: CotizacionEstado }) {
  const texto = f.q?.trim();
  const where: Prisma.CotizacionWhereInput = { deletedAt: null };
  if (f.estado) where.estado = f.estado;
  if (texto) {
    where.OR = [
      { numero: { contains: texto, mode: "insensitive" } },
      { clienteNombre: { contains: texto, mode: "insensitive" } },
      { contacto: { nombre: { contains: texto, mode: "insensitive" } } },
      { lead: { clientName: { contains: texto, mode: "insensitive" } } },
      { empresa: { razonSocial: { contains: texto, mode: "insensitive" } } },
      { project: { code: { contains: texto, mode: "insensitive" } } },
      { project: { clientName: { contains: texto, mode: "insensitive" } } },
    ];
  }
  const filas = await prisma.cotizacion.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ anio: "desc" }, { correlativo: "desc" }],
    take: 300,
  });
  return filas.map(({ items, ...c }) => ({ ...c, primerItem: primerItemDe(items) }));
}

function primerItemDe(items: Prisma.JsonValue): string | null {
  const r = (items as unknown as Renglon[] | null)?.find((x) => x.tipo === "item");
  return r?.descripcion ?? null;
}

export async function fichaCotizacion(id: string) {
  const c = await prisma.cotizacion.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
  if (!c) throw notFound("COTIZACION_NO_ENCONTRADA", "La cotización no existe.");
  return c;
}

async function siguienteNumero(tx: Prisma.TransactionClient, anio: number) {
  const ultima = await tx.cotizacion.findFirst({ where: { anio }, orderBy: { correlativo: "desc" }, select: { correlativo: true } });
  const correlativo = Math.max((ultima?.correlativo ?? 0) + 1, PRIMER_CORRELATIVO[anio] ?? 1);
  return { anio, correlativo, numero: `${anio}-${String(correlativo).padStart(3, "0")}` };
}

export async function crearCotizacion(c: Contenido & Destino, userId: string) {
  const destino = await resolverDestino(c, userId);
  const datos = datosContenido(c);
  const anio = Number(c.fecha.slice(0, 4));
  // Dos personas creando a la vez pueden pedir el mismo número: se reintenta.
  for (let intento = 0; ; intento++) {
    try {
      const creada = await prisma.$transaction(async (tx) => {
        const n = await siguienteNumero(tx, anio);
        return tx.cotizacion.create({ data: { ...n, ...datos, ...destino, createdById: userId }, include: INCLUDE });
      });
      await createAuditEntry({
        entityType: AuditEntityType.cotizacion,
        entityId: creada.id,
        projectId: creada.projectId,
        userId,
        action: AuditAction.created,
        description: `Creó la cotización ${creada.numero} para ${creada.clienteNombre}`,
      });
      return creada;
    } catch (e) {
      if (intento < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
}

export async function editarCotizacion(id: string, c: Contenido & Destino, userId: string) {
  const previa = await fichaCotizacion(id);
  const destino = await resolverDestino(c, userId);
  const editada = await prisma.cotizacion.update({ where: { id }, data: { ...datosContenido(c), ...destino }, include: INCLUDE });
  await createAuditEntry({
    entityType: AuditEntityType.cotizacion,
    entityId: id,
    projectId: editada.projectId,
    userId,
    action: AuditAction.updated,
    description: `Editó la cotización ${previa.numero}`,
    metadata: { totalAntes: Number(previa.total), totalDespues: Number(editada.total) },
  });
  return editada;
}

export async function cambiarEstado(id: string, estado: CotizacionEstado, userId: string) {
  const previa = await fichaCotizacion(id);
  if (previa.estado === estado) return previa;
  const c = await prisma.cotizacion.update({ where: { id }, data: { estado }, include: INCLUDE });
  await createAuditEntry({
    entityType: AuditEntityType.cotizacion,
    entityId: id,
    projectId: c.projectId,
    userId,
    action: AuditAction.status_changed,
    fieldChanged: "estado",
    oldValue: previa.estado,
    newValue: estado,
    description: `Cotización ${c.numero}: ${previa.estado} → ${estado}`,
  });
  return c;
}

/** Copia con número nuevo, en borrador y con fecha de hoy (misma validez en días). */
export async function duplicarCotizacion(id: string, userId: string) {
  const o = await fichaCotizacion(id);
  const hoy = new Date().toISOString().slice(0, 10);
  const dias = Math.round((o.validaHasta.getTime() - o.fecha.getTime()) / 86_400_000);
  const valida = new Date(Date.parse(`${hoy}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
  return crearCotizacion(
    {
      ...contenidoDe(o),
      fecha: hoy,
      validaHasta: valida,
      leadId: o.leadId,
      contactoId: o.contactoId,
      empresaId: o.empresaId,
      projectId: o.projectId,
    },
    userId,
  );
}

type CotizacionDb = Awaited<ReturnType<typeof fichaCotizacion>>;

/** El registro de la base, en la forma que edita el constructor. */
export function contenidoDe(o: CotizacionDb): Contenido {
  return {
    clienteNombre: o.clienteNombre,
    clienteDireccion: o.clienteDireccion,
    clienteCiudad: o.clienteCiudad,
    clienteTelefono: o.clienteTelefono,
    clienteEmail: o.clienteEmail,
    fecha: o.fecha.toISOString().slice(0, 10),
    validaHasta: o.validaHasta.toISOString().slice(0, 10),
    moneda: o.moneda,
    vendedorId: o.vendedorId,
    formaTrabajo: o.formaTrabajo,
    alcanceTitulo: o.alcanceTitulo,
    alcanceTexto: o.alcanceTexto,
    items: o.items as unknown as Renglon[],
    ivaTasa: Number(o.ivaTasa),
    condicionesPago: o.condicionesPago,
    plazoEntrega: o.plazoEntrega,
    incluye: o.incluye,
    noIncluye: o.noIncluye,
    observaciones: o.observaciones,
  };
}

export async function borrarCotizacion(id: string, userId: string) {
  const c = await fichaCotizacion(id);
  await prisma.cotizacion.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditEntry({
    entityType: AuditEntityType.cotizacion,
    entityId: id,
    projectId: c.projectId,
    userId,
    action: AuditAction.deleted,
    description: `Borró la cotización ${c.numero}`,
  });
}

/** Datos del PDF: de una cotización guardada o de lo que está en pantalla (vista previa). */
export async function datosPdf(c: Contenido, numero: string | null): Promise<CotizacionPdfData> {
  const vendedor = c.vendedorId ? await prisma.user.findUnique({ where: { id: c.vendedorId }, select: { name: true } }) : null;
  return { ...c, numero, vendedorNombre: vendedor?.name ?? null, clienteTelefono: telefonoParaPdf(c.clienteTelefono), ...calcularTotales(c.items, c.ivaTasa) };
}

// ─── Para quién: búsqueda unificada ──────────────────────────────────────────

export type Destinatario = {
  tipo: "lead" | "contacto" | "empresa" | "proyecto";
  id: string;
  titulo: string;
  subtitulo: string | null;
  vinculo: { leadId?: string; contactoId?: string; empresaId?: string; projectId?: string };
  cliente: { nombre: string; direccion: string | null; ciudad: string | null; telefono: string | null; email: string | null };
};

export async function buscarDestinatarios(q: string): Promise<Destinatario[]> {
  const t = q.trim();
  if (t.length < 2) return [];
  const ci = { contains: t, mode: "insensitive" as const };
  const [leads, contactos, empresas, proyectos] = await Promise.all([
    prisma.salesLead.findMany({
      where: { deletedAt: null, OR: [{ clientName: ci }, { code: ci }] },
      select: { id: true, code: true, clientName: true, clientPhone: true, clientEmail: true, address: true, stage: true, contactoId: true, empresaId: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.contacto.findMany({
      where: { deletedAt: null, OR: [{ nombre: ci }, { email: ci }, ...(t.replace(/\D/g, "").length >= 4 ? [{ telefono: { contains: t.replace(/\D/g, "") } }] : [])] },
      select: { id: true, nombre: true, telefono: true, email: true },
      orderBy: { nombre: "asc" },
      take: 6,
    }),
    prisma.empresa.findMany({
      where: { deletedAt: null, OR: [{ razonSocial: ci }, { nombreFantasia: ci }, { rut: ci }] },
      select: { id: true, razonSocial: true, telefono: true, email: true, direccion: true, rut: true },
      orderBy: { razonSocial: "asc" },
      take: 6,
    }),
    prisma.project.findMany({
      where: { deletedAt: null, OR: [{ clientName: ci }, { code: ci }] },
      select: { id: true, code: true, clientName: true, clientPhone: true, clientEmail: true, clientAddress: true, locationCity: true, locationProvince: true, contactoId: true, empresaId: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);
  const ciudad = (c: string | null, p: string | null) => [c, p].filter((x) => x && x.trim()).join(", ") || null;
  return [
    ...proyectos.map<Destinatario>((p) => ({
      tipo: "proyecto",
      id: p.id,
      titulo: p.clientName,
      subtitulo: `Proyecto ${p.code}`,
      vinculo: { projectId: p.id },
      cliente: { nombre: p.clientName, direccion: p.clientAddress, ciudad: ciudad(p.locationCity, p.locationProvince), telefono: telefonoParaPdf(p.clientPhone), email: p.clientEmail },
    })),
    ...leads.map<Destinatario>((l) => ({
      tipo: "lead",
      id: l.id,
      titulo: l.clientName,
      subtitulo: `Lead ${l.code}`,
      vinculo: { leadId: l.id },
      cliente: { nombre: l.clientName, direccion: l.address, ciudad: null, telefono: telefonoParaPdf(l.clientPhone), email: l.clientEmail },
    })),
    ...contactos.map<Destinatario>((c) => ({
      tipo: "contacto",
      id: c.id,
      titulo: c.nombre,
      subtitulo: "Contacto",
      vinculo: { contactoId: c.id },
      cliente: { nombre: c.nombre, direccion: null, ciudad: null, telefono: telefonoParaPdf(c.telefono), email: c.email },
    })),
    ...empresas.map<Destinatario>((e) => ({
      tipo: "empresa",
      id: e.id,
      titulo: e.razonSocial,
      subtitulo: e.rut ? `Empresa · RUT ${e.rut}` : "Empresa",
      vinculo: { empresaId: e.id },
      cliente: { nombre: e.razonSocial, direccion: e.direccion, ciudad: null, telefono: telefonoParaPdf(e.telefono), email: e.email },
    })),
  ];
}

// ─── Artículos de venta ──────────────────────────────────────────────────────

export async function listarArticulos(incluirInactivos: boolean) {
  return prisma.articuloVenta.findMany({ where: incluirInactivos ? {} : { activo: true }, orderBy: [{ activo: "desc" }, { nombre: "asc" }] });
}

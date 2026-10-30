/**
 * Base de contactos de Instagram de @voltia_uy, con etiquetas (lo que cobraba
 * ManyChat). Pedido de Nicolás del 29-oct-2026: guardar a toda persona que
 * escribe o comenta y etiquetarla según lo que hizo.
 *
 * Un contacto se conoce por su id de Instagram (el de los privados) o, si solo
 * comentó, por su usuario; cuando aparece el id, se une.
 *
 * Los contactos de la carga del historial (ManyChat, antes del 30-oct-2026)
 * quedan como `importado`: sirven para saber quién vuelve, pero no cuentan para
 * las métricas (decisión de Nicolás del 30-oct). Las métricas salen de
 * `instagram_eventos`, no de acá.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export const ETIQUETA = {
  ESCRIBIO: "Escribió por privado",
  ANUNCIO: "Vino de un anuncio",
  SPEECH: "Speech enviado",
  RECLAMADO: "Reclamado speech",
  MAS_INFO: "Pidió más info",
  LEAD: "Lead (mandó factura o techo)",
  DERIVADO: "Derivado al comercial",
  COMENTO: "Comentó",
  SIGUE: "Sigue a @voltia_uy",
} as const;

export const TEMAS = [
  "precio",
  "funcionamiento",
  "ahorro",
  "apartamento o alquiler",
  "empresa o campo",
  "decreto",
  "financiación",
  "baterías",
  "trabajo",
  "cliente de Voltia",
  "otro",
] as const;

type Datos = {
  persona?: string | null;
  usuario?: string | null;
  nombre?: string | null;
  sigue?: boolean | null;
  momento?: Date;
  /** Carga del historial: el contacto y sus etiquetas quedan marcados. */
  importado?: boolean;
};

type Tx = Prisma.TransactionClient;

async function buscarOcrear(tx: Tx, d: Datos, momento: Date) {
  const persona = d.persona && /^\d+$/.test(d.persona) ? d.persona : null;
  const usuario = d.usuario?.replace(/^@/, "").toLowerCase() || null;
  if (!persona && !usuario) return null;

  const porId = persona ? await tx.instagramContacto.findUnique({ where: { persona } }) : null;
  const porUsuario = usuario ? await tx.instagramContacto.findUnique({ where: { usuario } }) : null;

  if (porId && porUsuario && porId.id !== porUsuario.id) {
    // Se lo conocía por los dos lados: se unen las etiquetas en el del id.
    const etiquetas = await tx.instagramContactoEtiqueta.findMany({ where: { contactoId: porUsuario.id } });
    await tx.instagramContacto.delete({ where: { id: porUsuario.id } });
    for (const e of etiquetas) await sumarEtiqueta(tx, porId.id, e.nombre, e.primera, e.importada, e.ultima, e.veces);
    return tx.instagramContacto.update({
      where: { id: porId.id },
      data: {
        usuario,
        primeraVez: porUsuario.primeraVez < porId.primeraVez ? porUsuario.primeraVez : porId.primeraVez,
        importado: porId.importado && porUsuario.importado,
      },
    });
  }
  const existente = porId ?? porUsuario;
  if (existente) {
    return tx.instagramContacto.update({
      where: { id: existente.id },
      data: {
        ...(persona && !existente.persona ? { persona } : {}),
        ...(usuario && !existente.usuario ? { usuario } : {}),
      },
    });
  }
  return tx.instagramContacto.create({
    data: { persona, usuario, primeraVez: momento, ultimaVez: momento, importado: Boolean(d.importado) },
  });
}

async function sumarEtiqueta(
  tx: Tx,
  contactoId: string,
  nombre: string,
  momento: Date,
  importada: boolean,
  ultima: Date = momento,
  veces = 1,
) {
  const e = await tx.instagramContactoEtiqueta.findUnique({ where: { contactoId_nombre: { contactoId, nombre } } });
  if (!e) {
    await tx.instagramContactoEtiqueta.create({
      data: { contactoId, nombre, primera: momento, ultima, veces, importada },
    });
    return;
  }
  await tx.instagramContactoEtiqueta.update({
    where: { id: e.id },
    data: {
      primera: momento < e.primera ? momento : e.primera,
      ultima: ultima > e.ultima ? ultima : e.ultima,
      veces: e.veces + veces,
      // Si Voltia PM la vuelve a poner, deja de ser solo del historial.
      importada: e.importada && importada,
    },
  });
}

/**
 * Guarda o actualiza un contacto y le pone etiquetas. Nunca tira error: guardar
 * el contacto no puede cortar una respuesta a un cliente.
 */
export async function etiquetar(d: Datos, etiquetas: string[] = []): Promise<string | null> {
  const momento = d.momento ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await buscarOcrear(tx, d, momento);
      if (!c) return null;
      const lista = [...etiquetas];
      if (d.sigue) lista.push(ETIQUETA.SIGUE);
      await tx.instagramContacto.update({
        where: { id: c.id },
        data: {
          ...(d.nombre ? { nombre: d.nombre } : {}),
          ...(d.sigue !== undefined && d.sigue !== null ? { sigue: d.sigue } : {}),
          primeraVez: momento < c.primeraVez ? momento : c.primeraVez,
          ultimaVez: momento > c.ultimaVez ? momento : c.ultimaVez,
          // Un contacto del historial que vuelve a aparecer ya es de los nuestros.
          ...(c.importado && !d.importado ? { importado: false } : {}),
        },
      });
      for (const nombre of new Set(lista.filter(Boolean))) {
        await sumarEtiqueta(tx, c.id, nombre, momento, Boolean(d.importado));
      }
      return c.id;
    });
  } catch (err) {
    console.error("[instagram] no se pudo guardar el contacto:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function vincularLead(persona: string, usuario: string | null, leadId: string): Promise<void> {
  await prisma.instagramContacto.updateMany({
    where: { OR: [{ persona }, ...(usuario ? [{ usuario: usuario.toLowerCase() }] : [])] },
    data: { leadId },
  });
}

export async function conteoPorEtiqueta(incluirImportadas = true) {
  const filas = await prisma.instagramContactoEtiqueta.groupBy({
    by: ["nombre"],
    _count: { _all: true },
    where: incluirImportadas ? {} : { importada: false },
    orderBy: { _count: { nombre: "desc" } },
  });
  return filas.map((f) => ({ etiqueta: f.nombre, contactos: f._count._all }));
}

export async function buscarContactos(f: { etiqueta?: string; texto?: string; desde?: Date; cuantos?: number }) {
  const texto = f.texto?.replace(/^@/, "").trim();
  const contactos = await prisma.instagramContacto.findMany({
    where: {
      ...(f.etiqueta ? { etiquetas: { some: { nombre: { contains: f.etiqueta, mode: "insensitive" } } } } : {}),
      ...(texto
        ? {
            OR: [
              { usuario: { contains: texto, mode: "insensitive" } },
              { nombre: { contains: texto, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(f.desde ? { ultimaVez: { gte: f.desde } } : {}),
    },
    include: { etiquetas: { orderBy: { primera: "asc" } }, lead: { select: { id: true, code: true } } },
    orderBy: { ultimaVez: "desc" },
    take: Math.min(f.cuantos ?? 100, 500),
  });
  const total = await prisma.instagramContacto.count();
  return { total, contactos };
}

// Facturas que los proveedores le emiten a Voltia, traídas desde Biller.
//
// Biller las da por dos caminos y acá se juntan en una fila de FacturaRecibida
// por comprobante (RUT emisor + tipo + serie + número):
//
//  - `GET /v2/comprobantes/recibidos/obtener` — lo que DGI tiene registrado.
//    Están TODOS los CFE emitidos a nuestro RUT, pero solo con totales. Es el
//    control de que no falte ninguno.
//  - `GET /v2/comprobantes/obtener?recibidos=1` — lo que llegó por mail a la
//    casilla publicada en DGI. Trae el vencimiento.
//
// Nada de esto toca la deuda: la bandeja se confirma a mano (ver
// confirmarFacturaRecibida en cuentas-por-pagar.routes.ts).
//
// Sin webhooks en Biller: se consulta por ventana de fechas y se hace upsert, así
// que correrlo dos veces no duplica.

import { EstadoFacturaRecibida, Moneda, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { addDays, parseDateOnly, toDateOnlyString, todayUtc } from "../../utils/dates.js";

const BASE_URL = process.env.BILLER_URL ?? "https://test.biller.uy";

export function billerConfigurado(): boolean {
  return Boolean(process.env.BILLER_TOKEN);
}

async function billerGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.BILLER_TOKEN}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Biller ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  // `recibidos/obtener` responde JSON con content-type text/plain.
  return text.trim() ? JSON.parse(text) : [];
}

// ── Tipos de CFE ─────────────────────────────────────────────────────────────
// Facturas y notas de débito suman deuda; las notas de crédito la restan.
// Remitos (181) y resguardos (182) no son deuda y no se importan.
const TIPOS_FACTURA = new Set([101, 103, 111, 113, 121, 123, 201, 203, 211, 213, 221, 223]);
const TIPOS_NOTA_CREDITO = new Set([102, 112, 122, 202, 212, 222]);

export function esNotaCredito(tipo: number) {
  return TIPOS_NOTA_CREDITO.has(tipo);
}

export const TIPO_CFE_LABEL: Record<number, string> = {
  101: "e-Ticket", 102: "NC e-Ticket", 103: "ND e-Ticket",
  111: "e-Factura", 112: "NC e-Factura", 113: "ND e-Factura",
  121: "e-Factura exportación", 122: "NC exportación", 123: "ND exportación",
  201: "e-Ticket contingencia", 211: "e-Factura contingencia", 212: "NC contingencia",
};

// ── Normalización ────────────────────────────────────────────────────────────

export type CfeRecibido = {
  rutEmisor: string;
  razonSocialEmisor: string | null;
  tipoCfe: number;
  serie: string;
  numero: number;
  fechaEmision: Date;
  fechaVencimiento: Date | null;
  moneda: Moneda;
  totalNeto: number | null;
  totalIva: number | null;
  total: number;
  estadoDgi: string | null;
  billerId: string | null;
  fuente: "DGI" | "MAIL";
  raw: unknown;
};

type Obj = Record<string, unknown>;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fecha(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  // aaaa-mm-dd (con o sin hora) o dd/mm/aaaa.
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return parseDateOnly(`${iso[1]}-${iso[2]}-${iso[3]}`);
  const uy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (uy) return parseDateOnly(`${uy[3]}-${uy[2]}-${uy[1]}`);
  return null;
}
function moneda(v: unknown): Moneda | null {
  const s = str(v)?.toUpperCase();
  if (s === "USD") return Moneda.USD;
  if (s === "UYU") return Moneda.UYU;
  return null;
}
/** Un RUT se compara sin puntos, guiones ni espacios. */
export function normalizarRut(v: unknown): string | null {
  const s = str(v)?.replace(/[^0-9]/g, "");
  return s ? s : null;
}

/**
 * Una fila de `recibidos/obtener` (DGI). Forma documentada:
 * `{tipo, serie, numero, estado, fecha, rut_emisor, moneda, total_neto, total_iva, monto_total}`.
 */
export function desdeDgi(row: Obj): CfeRecibido | null {
  const tipo = num(row.tipo);
  const rut = normalizarRut(row.rut_emisor);
  const serie = str(row.serie);
  const numero = num(row.numero);
  const f = fecha(row.fecha);
  const m = moneda(row.moneda);
  const total = num(row.monto_total);
  if (!tipo || !rut || !serie || !numero || !f || !m || total === null) return null;
  return {
    rutEmisor: rut, razonSocialEmisor: null, tipoCfe: tipo, serie, numero,
    fechaEmision: f, fechaVencimiento: null, moneda: m,
    totalNeto: num(row.total_neto), totalIva: num(row.total_iva), total,
    estadoDgi: str(row.estado), billerId: null, fuente: "DGI", raw: row,
  };
}

/**
 * Una fila de `obtener?recibidos=1` (mail). La documentación muestra solo el
 * ejemplo de emitidos, sin el emisor: el RUT se busca en los nombres posibles y,
 * si no está, la fila se completa después con la de DGI (mismo tipo/serie/número).
 */
export function desdeMail(row: Obj): (Omit<CfeRecibido, "rutEmisor"> & { rutEmisor: string | null }) | null {
  const emisor = (row.emisor ?? {}) as Obj;
  const tipo = num(row.tipo_comprobante ?? row.tipo);
  const serie = str(row.serie);
  const numero = num(row.numero);
  const f = fecha(row.fecha_emision ?? row.fecha);
  const m = moneda(row.moneda);
  const total = num(row.total ?? row.monto_total);
  if (!tipo || !serie || !numero || !f || !m || total === null) return null;
  return {
    rutEmisor: normalizarRut(emisor.rut ?? row.rut_emisor ?? row.emisor_rut),
    razonSocialEmisor: str(emisor.razon_social ?? emisor.nombre ?? row.razon_social_emisor),
    tipoCfe: tipo, serie, numero,
    fechaEmision: f, fechaVencimiento: fecha(row.fecha_vencimiento), moneda: m,
    totalNeto: null,
    totalIva: [row.tot_iva_tasa_min, row.tot_iva_tasa_bas, row.tot_iva_tasa_otra]
      .map(num).reduce<number | null>((a, b) => (b === null ? a : (a ?? 0) + b), null),
    total, estadoDgi: null, billerId: str(row.id), fuente: "MAIL", raw: row,
  };
}

/** Razón social (o nombre de la persona) registrada en DGI para un RUT. */
export async function buscarRazonSocial(rut: string): Promise<string | null> {
  if (!billerConfigurado()) return null;
  try {
    const r = (await billerGet(`/v2/dgi/empresas/nombre-entidad?documento=${encodeURIComponent(rut)}&tipoDocumento=2`)) as Obj;
    const razon = str(typeof r.RazonSocial === "string" ? r.RazonSocial : null);
    if (razon) return razon;
    const partes = [r.PrimerNombre, r.SegundoNombre, r.PrimerApellido, r.SegundoApellido]
      .map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
    return partes.length ? partes.join(" ") : null;
  } catch {
    return null; // Sin nombre no se frena la importación: queda el RUT.
  }
}

// ── Sincronización ───────────────────────────────────────────────────────────

export type ResultadoSync = { nuevas: number; actualizadas: number; ignoradas: number; desde: string; hasta: string };

const clave = (tipo: number, serie: string, numero: number) => `${tipo}|${serie}|${numero}`;

/**
 * Trae los comprobantes de los últimos `dias` y los deja en la bandeja.
 * Una fila ya confirmada o descartada no cambia de estado: solo se le completan
 * datos que faltaban (el vencimiento que llegó por mail después, por ejemplo).
 */
export async function sincronizarRecibidos(dias = 45): Promise<ResultadoSync> {
  const hasta = todayUtc();
  const desde = addDays(hasta, -dias);
  const d = toDateOnlyString(desde)!;
  const h = toDateOnlyString(hasta)!;

  const [dgiRaw, mailRaw] = await Promise.all([
    billerGet(`/v2/comprobantes/recibidos/obtener?fecha_desde=${d}&fecha_hasta=${h}`),
    billerGet(`/v2/comprobantes/obtener?recibidos=1&desde=${encodeURIComponent(`${d} 00:00:00`)}&hasta=${encodeURIComponent(`${h} 23:59:59`)}`),
  ]);
  return guardarRecibidos(
    Array.isArray(dgiRaw) ? (dgiRaw as Obj[]) : [],
    Array.isArray(mailRaw) ? (mailRaw as Obj[]) : [],
    { desde: d, hasta: h },
  );
}

/** Separado de la llamada HTTP para poder probarlo con datos armados. */
export async function guardarRecibidos(
  dgiRows: Obj[],
  mailRows: Obj[],
  ventana: { desde: string; hasta: string },
): Promise<ResultadoSync> {
  let ignoradas = 0;
  const porClave = new Map<string, CfeRecibido & { enDgi: boolean; enMail: boolean }>();

  for (const row of dgiRows) {
    const c = desdeDgi(row);
    if (!c || !(TIPOS_FACTURA.has(c.tipoCfe) || TIPOS_NOTA_CREDITO.has(c.tipoCfe))) { ignoradas++; continue; }
    porClave.set(clave(c.tipoCfe, c.serie, c.numero) + `|${c.rutEmisor}`, { ...c, enDgi: true, enMail: false });
  }
  for (const row of mailRows) {
    const c = desdeMail(row);
    if (!c || !(TIPOS_FACTURA.has(c.tipoCfe) || TIPOS_NOTA_CREDITO.has(c.tipoCfe))) { ignoradas++; continue; }
    // Sin RUT en la fila de mail: se busca su par de DGI por tipo/serie/número.
    let k = c.rutEmisor ? clave(c.tipoCfe, c.serie, c.numero) + `|${c.rutEmisor}` : null;
    if (!k) {
      const pref = clave(c.tipoCfe, c.serie, c.numero) + "|";
      const candidatas = [...porClave.keys()].filter((x) => x.startsWith(pref));
      if (candidatas.length === 1) k = candidatas[0];
    }
    if (!k) { ignoradas++; continue; }
    const previo = porClave.get(k);
    if (previo) {
      previo.enMail = true;
      previo.fechaVencimiento = c.fechaVencimiento ?? previo.fechaVencimiento;
      previo.razonSocialEmisor = c.razonSocialEmisor ?? previo.razonSocialEmisor;
      previo.billerId = c.billerId;
    } else {
      porClave.set(k, { ...c, rutEmisor: c.rutEmisor!, enDgi: false, enMail: true });
    }
  }

  // DGI no trae el nombre del emisor: se pide por RUT, una vez por RUT, para
  // que en el registro ninguna factura quede como "sin identificar".
  const sinNombre = [...new Set([...porClave.values()].filter((c) => !c.razonSocialEmisor).map((c) => c.rutEmisor))];
  for (const rut of sinNombre) {
    const yaConocido = await prisma.facturaRecibida.findFirst({
      where: { rutEmisor: rut, razonSocialEmisor: { not: null } },
      select: { razonSocialEmisor: true },
    });
    const nombre = yaConocido?.razonSocialEmisor ?? (await buscarRazonSocial(rut));
    if (nombre) for (const c of porClave.values()) if (c.rutEmisor === rut && !c.razonSocialEmisor) c.razonSocialEmisor = nombre;
  }

  // Proveedor por RUT, nunca por nombre.
  const ruts = [...new Set([...porClave.values()].map((c) => c.rutEmisor))];
  const proveedores = await prisma.supplier.findMany({
    where: { deletedAt: null, rut: { not: null } },
    select: { id: true, rut: true },
  });
  const proveedorPorRut = new Map<string, string>();
  for (const p of proveedores) {
    const r = normalizarRut(p.rut);
    if (r && ruts.includes(r)) proveedorPorRut.set(r, p.id);
  }

  let nuevas = 0;
  let actualizadas = 0;
  for (const c of porClave.values()) {
    const where = {
      rutEmisor_tipoCfe_serie_numero: { rutEmisor: c.rutEmisor, tipoCfe: c.tipoCfe, serie: c.serie, numero: c.numero },
    };
    const existente = await prisma.facturaRecibida.findUnique({ where });
    if (!existente) {
      await prisma.facturaRecibida.create({
        data: {
          rutEmisor: c.rutEmisor, razonSocialEmisor: c.razonSocialEmisor,
          tipoCfe: c.tipoCfe, serie: c.serie, numero: c.numero,
          fechaEmision: c.fechaEmision, fechaVencimiento: c.fechaVencimiento,
          moneda: c.moneda, total: new Prisma.Decimal(c.total),
          totalNeto: c.totalNeto != null ? new Prisma.Decimal(c.totalNeto) : null,
          totalIva: c.totalIva != null ? new Prisma.Decimal(c.totalIva) : null,
          estadoDgi: c.estadoDgi, enDgi: c.enDgi, enMail: c.enMail, billerId: c.billerId,
          supplierId: proveedorPorRut.get(c.rutEmisor) ?? null,
          raw: c.raw as Prisma.InputJsonValue,
        },
      });
      nuevas++;
      continue;
    }
    const cambios: Prisma.FacturaRecibidaUpdateInput = {};
    if (c.enDgi && !existente.enDgi) cambios.enDgi = true;
    if (c.enMail && !existente.enMail) cambios.enMail = true;
    if (c.fechaVencimiento && !existente.fechaVencimiento) cambios.fechaVencimiento = c.fechaVencimiento;
    if (c.razonSocialEmisor && !existente.razonSocialEmisor) cambios.razonSocialEmisor = c.razonSocialEmisor;
    if (c.estadoDgi && c.estadoDgi !== existente.estadoDgi) cambios.estadoDgi = c.estadoDgi;
    if (c.billerId && !existente.billerId) cambios.billerId = c.billerId;
    if (!existente.supplierId && existente.estado === EstadoFacturaRecibida.PENDIENTE) {
      const sid = proveedorPorRut.get(c.rutEmisor);
      if (sid) cambios.supplier = { connect: { id: sid } };
    }
    if (Object.keys(cambios).length > 0) {
      await prisma.facturaRecibida.update({ where: { id: existente.id }, data: cambios });
      actualizadas++;
    }
  }

  return { nuevas, actualizadas, ignoradas, ...ventana };
}

// Resultado de la última corrida, en memoria: se pierde al reiniciar, y está
// bien — es solo para mostrar en la bandeja cuándo se miró Biller por última vez.
export type EstadoSync = { at: string; ok: boolean; resultado?: ResultadoSync; error?: string };
let ultimaSync: EstadoSync | null = null;

export function getUltimaSync(): EstadoSync | null {
  return ultimaSync;
}

/** Corre la sincronización y deja anotado cómo salió. */
export async function sincronizarYRegistrar(dias?: number): Promise<EstadoSync> {
  try {
    const resultado = await sincronizarRecibidos(dias);
    ultimaSync = { at: new Date().toISOString(), ok: true, resultado };
  } catch (err) {
    ultimaSync = { at: new Date().toISOString(), ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return ultimaSync;
}

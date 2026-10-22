// "¿Ya está cargada?": para cada factura recibida por revisar, los gastos ya
// cargados a mano que más se le parecen, del más probable al menos.
//
// No pide coincidencia exacta: se cargan gastos sin proveedor, con el monto
// sin IVA, en la otra moneda o unos días antes o después. Cada parecido suma
// puntos y se muestra el porqué ("mismo monto", "a 2 días"…), para que una
// persona decida. Solo se proponen gastos sin factura vinculada, del mismo
// proveedor de la factura o cargados sin proveedor.

import { Moneda, TipoMovimiento, type FinanceMovementStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { toDateOnlyString } from "../../utils/dates.js";

const DIAS_MAX = 30;
const PUNTAJE_MINIMO = 55;
const MAX_SUGERENCIAS = 3;

export type GastoSugerido = {
  id: string;
  descripcion: string;
  invoiceNumber: string | null;
  monto: number;
  moneda: Moneda;
  fecha: string | null;
  status: FinanceMovementStatus;
  sinProveedor: boolean;
  /** 0–100: qué tan probable es que sea la misma compra. */
  puntaje: number;
  motivos: string[];
};

type Factura = {
  id: string;
  supplierId: string | null;
  razonSocialEmisor: string | null;
  serie: string;
  numero: number;
  fechaEmision: Date;
  moneda: Moneda;
  total: unknown;
  totalNeto: unknown;
};

type Gasto = {
  id: string;
  supplierId: string | null;
  descripcion: string;
  invoiceNumber: string | null;
  monto: unknown;
  moneda: Moneda;
  fecha: Date;
  status: FinanceMovementStatus;
};

// Palabras que delatan el rubro cuando el gasto se cargó sin proveedor.
const RUBROS: Array<{ emisor: RegExp; gasto: RegExp }> = [
  { emisor: /ancap|axion|disa|petrobras|esso|shell|estaci[oó]n|servicentro/i, gasto: /combustible|nafta|gasoil|gas ?oil|diesel|surtidor|carga/i },
  { emisor: /abitab|red ?pagos/i, gasto: /abitab|redpagos|pago|tr[aá]mite|timbre/i },
  { emisor: /barraca|ferret|tornillo|hierro/i, gasto: /ferret|tornill|hierro|bul[oó]n|material|perfil|barraca/i },
  { emisor: /imprenta|press/i, gasto: /imprenta|impres|folleto|tarjeta|cartel/i },
];

const PALABRAS_VACIAS = new Set(["sociedad", "anonima", "anomina", "limitada", "srl", "s.r.l.", "sa", "s.a.", "sas", "ltda", "uruguay", "del", "los", "las", "y", "cia", "u"]);

function palabras(t: string): string[] {
  return t
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !PALABRAS_VACIAS.has(w));
}

const cerca = (a: number, b: number, tol: number) => b > 0 && Math.abs(a - b) / b <= tol;

export function puntuar(f: Factura, g: Gasto, usdToUyu: number): { puntaje: number; motivos: string[] } | null {
  const dias = Math.round(Math.abs(g.fecha.getTime() - f.fechaEmision.getTime()) / 86_400_000);
  const numero = (g.invoiceNumber ?? "").replace(/\D/g, "");
  const mismoNumero = numero.length > 0 && numero.endsWith(String(f.numero));
  if (dias > DIAS_MAX && !mismoNumero) return null;

  const motivos: string[] = [];
  let p = 0;
  if (mismoNumero) { p += 60; motivos.push("mismo número de factura"); }

  // Monto: en la misma moneda o convertido a la otra.
  const total = Number(f.total);
  const neto = f.totalNeto != null ? Number(f.totalNeto) : total / 1.22;
  let monto = Number(g.monto);
  let otraMoneda = false;
  if (g.moneda !== f.moneda && usdToUyu > 0) {
    monto = f.moneda === Moneda.UYU ? monto * usdToUyu : monto / usdToUyu;
    otraMoneda = true;
  }
  const tolMoneda = otraMoneda ? 0.025 : 0; // la cotización del día nunca da exacto
  if (cerca(monto, total, Math.max(tolMoneda, 0.0005))) {
    p += otraMoneda ? 25 : 45;
    motivos.push(otraMoneda ? "mismo monto en la otra moneda" : "mismo monto");
  } else if (cerca(monto, neto, Math.max(tolMoneda, 0.002))) {
    p += 30;
    motivos.push("igual al monto sin IVA");
  } else if (cerca(monto, total, 0.03)) {
    p += 22;
    motivos.push("monto parecido");
  } else if (cerca(monto, total, 0.1)) {
    p += 8;
    motivos.push("monto cercano");
  } else if (!mismoNumero) {
    return null; // sin número que coincida, un monto muy distinto no es la misma compra
  }

  if (dias <= 2) { p += 20; motivos.push(dias === 0 ? "mismo día" : `a ${dias} día${dias > 1 ? "s" : ""}`); }
  else if (dias <= 7) { p += 12; motivos.push(`a ${dias} días`); }
  else if (dias <= 15) { p += 5; motivos.push(`a ${dias} días`); }

  if (g.supplierId && g.supplierId === f.supplierId) { p += 15; motivos.push("mismo proveedor"); }

  // Descripción: palabras del emisor o del rubro.
  const desc = g.descripcion.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const emisor = f.razonSocialEmisor ?? "";
  const comunes = palabras(emisor).filter((w) => desc.includes(w.slice(0, 5)));
  if (comunes.length) { p += 15; motivos.push("la descripción nombra al proveedor"); }
  else if (RUBROS.some((r) => r.emisor.test(emisor) && r.gasto.test(desc))) { p += 10; motivos.push("la descripción es del rubro"); }

  return { puntaje: Math.min(100, p), motivos };
}

/** Sugerencias por factura (id de la factura → gastos, del más probable al menos). */
export async function sugerirGastos(facturas: Factura[]): Promise<Map<string, GastoSugerido[]>> {
  const out = new Map<string, GastoSugerido[]>();
  if (!facturas.length) return out;
  const fechas = facturas.map((f) => f.fechaEmision.getTime());
  const proveedores = [...new Set(facturas.filter((f) => f.supplierId).map((f) => f.supplierId!))];
  const [gastos, tc] = await Promise.all([
    prisma.financeMovement.findMany({
      where: {
        deletedAt: null,
        tipoMovimiento: TipoMovimiento.GASTO,
        facturaRecibida: null,
        OR: [
          // Del mismo proveedor: cualquier fecha (el número puede coincidir).
          ...(proveedores.length ? [{ supplierId: { in: proveedores } }] : []),
          {
            supplierId: null,
            fecha: {
              gte: new Date(Math.min(...fechas) - DIAS_MAX * 86_400_000),
              lte: new Date(Math.max(...fechas) + DIAS_MAX * 86_400_000),
            },
          },
        ],
      },
      select: { id: true, supplierId: true, descripcion: true, invoiceNumber: true, monto: true, moneda: true, fecha: true, status: true },
    }),
    prisma.exchangeRate.findFirst({ orderBy: { createdAt: "desc" }, select: { usdToUyu: true } }),
  ]);
  const usdToUyu = tc ? Number(tc.usdToUyu) : 0;

  for (const f of facturas) {
    const sugeridos: GastoSugerido[] = [];
    for (const g of gastos) {
      if (g.supplierId && g.supplierId !== f.supplierId) continue;
      const r = puntuar(f, g, usdToUyu);
      if (!r || r.puntaje < PUNTAJE_MINIMO) continue;
      sugeridos.push({
        id: g.id, descripcion: g.descripcion, invoiceNumber: g.invoiceNumber,
        monto: Number(g.monto), moneda: g.moneda, fecha: toDateOnlyString(g.fecha), status: g.status,
        sinProveedor: !g.supplierId, puntaje: r.puntaje, motivos: r.motivos,
      });
    }
    sugeridos.sort((a, b) => b.puntaje - a.puntaje);
    if (sugeridos.length) out.set(f.id, sugeridos.slice(0, MAX_SUGERENCIAS));
  }
  return out;
}

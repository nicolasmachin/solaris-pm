// Conciliación contra el estado de cuenta que manda un proveedor.
//
// Dos pasos separados a propósito:
//   1. `extraerEstadoDeCuenta()` — la IA pasa el documento (PDF, Excel o foto) a
//      renglones. Se hace una sola vez por archivo: cuesta plata.
//   2. `compararConVoltia()` — determinística, contra lo cargado en Voltia PM.
//      Se puede repetir gratis (por ejemplo, después de cargar lo que faltaba).
//
// Lado Voltia: facturas = GASTO con ese proveedor (de COMPROMETIDO a PAGADO) y
// pagos = `Payment` del proveedor, en la moneda del estado de cuenta. El saldo
// de Voltia a la fecha de corte es facturas − pagos hasta esa fecha.

import fs from "node:fs/promises";

import Anthropic from "@anthropic-ai/sdk";
import { FinanceMovementStatus, Moneda, TipoMovimiento } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { createMessage } from "../ai/usage.js";
import { costoAnthropic } from "../ai/pricing.js";
import { leerContenidoAdjunto } from "../documentos/lectura.service.js";
import { getStoredFilePath } from "../file-storage.service.js";
import { diffInDays, parseDateOnly, toDateOnlyString } from "../../utils/dates.js";

const MODEL_ID = process.env.CONCILIACION_MODEL ?? "claude-sonnet-4-5-20250929";

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");
  _client = new Anthropic({ apiKey });
  return _client;
}

// ── 1. Extracción ────────────────────────────────────────────────────────────

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const LineaEstadoSchema = z.object({
  fecha: fecha.nullable(),
  tipo: z.enum(["FACTURA", "NOTA_CREDITO", "PAGO", "OTRO"]),
  numero: z.string().nullable(),
  descripcion: z.string().nullable(),
  importe: z.number(),
});
export type LineaEstado = z.infer<typeof LineaEstadoSchema>;

export const EstadoDeCuentaSchema = z.object({
  proveedor: z.string().nullable(),
  rut: z.string().nullable(),
  moneda: z.enum(["USD", "UYU"]).nullable(),
  fechaCorte: fecha.nullable(),
  saldoInicial: z.number().nullable(),
  saldoFinal: z.number().nullable(),
  lineas: z.array(LineaEstadoSchema),
});
export type EstadoDeCuenta = z.infer<typeof EstadoDeCuentaSchema>;

const PROMPT = `Este documento es un estado de cuenta que un proveedor le mandó a su cliente, la empresa Voltia (Uruguay). Pasalo a datos.

Devolvé ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown) con esta forma:
{
  "proveedor": "nombre del proveedor que emite el estado de cuenta, o null",
  "rut": "RUT del proveedor si figura, solo dígitos, o null",
  "moneda": "USD" o "UYU" (la del estado de cuenta; dólares = USD, pesos = UYU) o null,
  "fechaCorte": "aaaa-mm-dd: la fecha a la que está hecho el estado de cuenta, o la del último movimiento, o null",
  "saldoInicial": número o null (saldo anterior / saldo al inicio, si figura),
  "saldoFinal": número o null (saldo final que el proveedor dice que Voltia le debe; positivo = Voltia debe),
  "lineas": [
    {
      "fecha": "aaaa-mm-dd o null",
      "tipo": "FACTURA" | "NOTA_CREDITO" | "PAGO" | "OTRO",
      "numero": "número del comprobante tal como figura (con serie si la tiene) o null",
      "descripcion": "texto del renglón, corto, o null",
      "importe": número SIEMPRE positivo
    }
  ]
}

Reglas:
- Un renglón por movimiento. No incluyas renglones de saldo, subtotales ni totales como líneas.
- FACTURA: lo que aumenta la deuda de Voltia (facturas, notas de débito). NOTA_CREDITO: lo que la baja sin ser un pago. PAGO: pagos o recibos de Voltia. OTRO: cualquier otra cosa.
- "importe" siempre positivo: el sentido lo da "tipo".
- Fechas en formato aaaa-mm-dd (en Uruguay se escriben dd/mm/aaaa).
- Montos con punto decimal y sin separador de miles.
- Si algo no figura, null. No inventes datos.`;

export async function extraerEstadoDeCuenta(args: {
  archivoUrl: string;
  archivoNombre: string;
  mimeType: string;
  userId: string;
  supplierId: string;
}): Promise<{ data: EstadoDeCuenta; model: string; tokensInput: number; tokensOutput: number; costUsd: number }> {
  const esPdf = args.mimeType === "application/pdf" || /\.pdf$/i.test(args.archivoNombre);
  let bloques: Anthropic.ContentBlockParam[];

  if (esPdf) {
    // El PDF va entero: Claude lee también los escaneados.
    const buf = await fs.readFile(getStoredFilePath(args.archivoUrl));
    bloques = [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } }];
  } else {
    const contenido = await leerContenidoAdjunto({ filename: args.archivoNombre, mimeType: args.mimeType, url: args.archivoUrl });
    if (contenido.tipo === "no-legible") throw new Error(`No se pudo leer el archivo: ${contenido.motivo}`);
    bloques = contenido.tipo === "texto"
      ? [{ type: "text", text: `Contenido del archivo "${args.archivoNombre}":\n\n${contenido.texto}` }]
      : contenido.imagenes.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.mediaType, data: i.base64 } }));
  }

  const response = await createMessage(getClient(), "conciliacion_proveedor", {
    model: MODEL_ID,
    max_tokens: 16000,
    messages: [{ role: "user", content: [...bloques, { type: "text", text: PROMPT }] }],
  }, { userId: args.userId, entityId: args.supplierId });

  const raw = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const limpio = raw.replace(/```json|```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(limpio);
  } catch {
    throw new Error("La IA no devolvió un resultado legible. Probá de nuevo o con otro formato del archivo.");
  }
  const data = EstadoDeCuentaSchema.parse(parsed);
  const uso = {
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    cacheRead: response.usage.cache_read_input_tokens ?? 0,
    cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
  };
  return { data, model: MODEL_ID, tokensInput: uso.input, tokensOutput: uso.output, costUsd: costoAnthropic(MODEL_ID, uso) ?? 0 };
}

// ── 2. Comparación ───────────────────────────────────────────────────────────

/** Solo los dígitos, sin ceros adelante: "A-000123" y "123" son el mismo número. */
export function numeroComparable(n: string | null | undefined): string | null {
  const d = (n ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return d.length >= 3 ? d : null;
}

function mismoNumero(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const TOL = 0.01;

export type ItemVoltia = {
  id: string;
  clase: "FACTURA" | "PAGO";
  fecha: string;
  numero: string | null;
  descripcion: string;
  importe: number;
};

export type ResultadoConciliacion = {
  moneda: Moneda;
  desde: string | null;
  fechaCorte: string;
  saldoProveedor: number | null;
  saldoVoltia: number;
  diferenciaSaldo: number | null;
  coinciden: Array<{ linea: LineaEstado; voltia: ItemVoltia }>;
  diferenciasMonto: Array<{ linea: LineaEstado; voltia: ItemVoltia; diferencia: number }>;
  soloProveedor: LineaEstado[];
  soloVoltia: ItemVoltia[];
  otras: LineaEstado[];
  calculadoAt: string;
};

/**
 * Empareja cada renglón del proveedor con lo de Voltia:
 *  - facturas y notas de crédito: por número; si no hay número que coincida,
 *    por importe exacto y fecha a ±7 días;
 *  - pagos: por importe exacto y fecha a ±5 días.
 * Lo de Voltia se mira solo dentro del período que cubre el estado de cuenta.
 */
export function emparejar(
  lineas: LineaEstado[],
  facturas: ItemVoltia[],
  pagos: ItemVoltia[],
): Pick<ResultadoConciliacion, "coinciden" | "diferenciasMonto" | "soloProveedor" | "soloVoltia" | "otras"> {
  const usados = new Set<string>();
  const coinciden: ResultadoConciliacion["coinciden"] = [];
  const diferenciasMonto: ResultadoConciliacion["diferenciasMonto"] = [];
  const soloProveedor: LineaEstado[] = [];
  const otras: LineaEstado[] = [];

  const cerca = (a: string | null, b: string, dias: number) =>
    !a || Math.abs(diffInDays(parseDateOnly(a), parseDateOnly(b))) <= dias;

  for (const l of lineas) {
    if (l.tipo === "OTRO") { otras.push(l); continue; }
    const pool = l.tipo === "PAGO" ? pagos : facturas;
    const libres = pool.filter((v) => !usados.has(v.id));
    const importe = l.tipo === "NOTA_CREDITO" ? -l.importe : l.importe;

    let match: ItemVoltia | undefined;
    if (l.tipo !== "PAGO") {
      const num = numeroComparable(l.numero);
      match = libres.find((v) => mismoNumero(num, numeroComparable(v.numero)));
      if (match) {
        usados.add(match.id);
        const dif = r2(importe - match.importe);
        if (Math.abs(dif) <= TOL) coinciden.push({ linea: l, voltia: match });
        else diferenciasMonto.push({ linea: l, voltia: match, diferencia: dif });
        continue;
      }
    }
    match = libres.find((v) => Math.abs(v.importe - importe) <= TOL && cerca(l.fecha, v.fecha, l.tipo === "PAGO" ? 5 : 7));
    if (match) {
      usados.add(match.id);
      coinciden.push({ linea: l, voltia: match });
    } else {
      soloProveedor.push(l);
    }
  }

  // Segunda pasada: una factura del proveedor que quedó suelta y una de Voltia
  // suelta del mismo día (±2) son, casi seguro, la misma con otro monto. Mejor
  // mostrarla como diferencia que como "falta cargar" + "el proveedor no la tiene".
  const sueltas: LineaEstado[] = [];
  for (const l of soloProveedor) {
    if (l.tipo !== "FACTURA" || !l.fecha) { sueltas.push(l); continue; }
    const par = facturas.find((v) => !usados.has(v.id) && cerca(l.fecha, v.fecha, 2));
    if (par) {
      usados.add(par.id);
      diferenciasMonto.push({ linea: l, voltia: par, diferencia: r2(l.importe - par.importe) });
    } else {
      sueltas.push(l);
    }
  }

  const soloVoltia = [...facturas, ...pagos].filter((v) => !usados.has(v.id));
  return { coinciden, diferenciasMonto, soloProveedor: sueltas, soloVoltia, otras };
}

export async function compararConVoltia(args: {
  supplierId: string;
  moneda: Moneda;
  fechaCorte: Date;
  estado: EstadoDeCuenta;
}): Promise<ResultadoConciliacion> {
  const { supplierId, moneda, fechaCorte, estado } = args;
  const fechasLineas = estado.lineas.map((l) => l.fecha).filter((f): f is string => !!f).sort();
  const desde = fechasLineas[0] ? parseDateOnly(fechasLineas[0]) : null;

  const [movs, pays] = await Promise.all([
    prisma.financeMovement.findMany({
      where: {
        deletedAt: null, supplierId, moneda,
        tipoMovimiento: TipoMovimiento.GASTO,
        status: { in: [
          FinanceMovementStatus.COMPROMETIDO, FinanceMovementStatus.A_PAGAR,
          FinanceMovementStatus.PARCIALMENTE_PAGADO, FinanceMovementStatus.PAGADO,
        ] },
        fecha: { lte: fechaCorte },
      },
      select: { id: true, fecha: true, invoiceNumber: true, descripcion: true, monto: true },
    }),
    prisma.payment.findMany({
      where: { deletedAt: null, supplierId, moneda, fecha: { lte: fechaCorte } },
      select: { id: true, fecha: true, referencia: true, notas: true, monto: true },
    }),
  ]);

  const facturasTodas: ItemVoltia[] = movs.map((m) => ({
    id: m.id, clase: "FACTURA", fecha: toDateOnlyString(m.fecha)!, numero: m.invoiceNumber,
    descripcion: m.descripcion, importe: r2(Number(m.monto)),
  }));
  const pagosTodos: ItemVoltia[] = pays.map((p) => ({
    id: p.id, clase: "PAGO", fecha: toDateOnlyString(p.fecha)!, numero: p.referencia,
    descripcion: p.notas ?? p.referencia ?? "Pago", importe: r2(Number(p.monto)),
  }));

  const saldoVoltia = r2(
    facturasTodas.reduce((a, f) => a + f.importe, 0) - pagosTodos.reduce((a, p) => a + p.importe, 0),
  );

  // Para emparejar se mira solo el período del estado de cuenta: lo anterior
  // está resumido en su saldo inicial.
  const enPeriodo = (v: ItemVoltia) => !desde || parseDateOnly(v.fecha) >= desde;
  const r = emparejar(estado.lineas, facturasTodas.filter(enPeriodo), pagosTodos.filter(enPeriodo));

  const saldoProveedor = estado.saldoFinal ?? (estado.saldoInicial != null
    ? r2(estado.lineas.reduce((a, l) =>
        a + (l.tipo === "FACTURA" ? l.importe : l.tipo === "OTRO" ? 0 : -l.importe), estado.saldoInicial))
    : null);

  return {
    moneda,
    desde: desde ? toDateOnlyString(desde) : null,
    fechaCorte: toDateOnlyString(fechaCorte)!,
    saldoProveedor,
    saldoVoltia,
    diferenciaSaldo: saldoProveedor != null ? r2(saldoProveedor - saldoVoltia) : null,
    ...r,
    calculadoAt: new Date().toISOString(),
  };
}

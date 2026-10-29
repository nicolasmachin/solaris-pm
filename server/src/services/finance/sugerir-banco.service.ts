// "¿Qué es este movimiento del banco?": para cada movimiento que falta cargar,
// lo más parecido que ya está en Voltia PM, del más probable al menos.
//
// El banco casi nunca dice a quién: "TRF E-BROU OTROS". El robot trae además el
// asunto del detalle ("RIBOX S.A. - alquiler del elevado"), y con eso, el monto
// y la fecha se compara contra cinco cosas:
//   MOVIMIENTO  un gasto o cobro ya pagado, cargado sin cuenta (o en esta)
//   DEUDA       una factura de proveedor que sigue a pagar (o el saldo del proveedor)
//   COSTO_FIJO  un costo fijo del mes que todavía no se pagó
//   COBRO       un cobro previsto a un cliente
//   FACTURA     una factura recibida por revisar (compra que nadie cargó)
// Cada parecido suma puntos y se dice el porqué. Lo que no alcanza, lo
// interpreta la IA (interpretarConIa) eligiendo entre los mismos candidatos.

import Anthropic from "@anthropic-ai/sdk";
import {
  CategoriaPrincipal,
  EstadoFacturaRecibida,
  FinanceMovementStatus,
  FixedCostPeriodicity,
  Moneda,
  type Prisma,
  TipoMovimiento,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { createMessage } from "../ai/usage.js";
import { toDateOnlyString } from "../../utils/dates.js";

export type TipoSugerencia = "MOVIMIENTO" | "DEUDA" | "DEUDA_PROVEEDOR" | "COSTO_FIJO" | "COBRO" | "FACTURA";

export type SugerenciaBanco = {
  /** `${tipo}:${refId}` (COSTO_FIJO lleva además `:${anio}-${mes}`). */
  clave: string;
  tipo: TipoSugerencia;
  refId: string;
  titulo: string;
  detalle: string | null;
  monto: number;
  moneda: Moneda;
  fecha: string | null;
  puntaje: number;
  motivos: string[];
  /** Qué hace "Es este" en una frase, para mostrarlo antes de tocar. */
  accion: string;
};

export type FilaBanco = {
  id: string;
  accountId: string;
  moneda: Moneda;
  fecha: Date;
  tipo: TipoMovimiento;
  monto: number;
  descripcion: string;
  asunto: string | null;
};

const DIAS = 25;
const MINIMO = 45;
const MAX = 3;
const dia = 86_400_000;

// Palabras que no distinguen a nadie.
const VACIAS = new Set([
  "pago", "pagos", "cuota", "cuotas", "saldo", "factura", "facturas", "transferencia", "otros", "brou", "ebrou",
  "sociedad", "anonima", "limitada", "srl", "sas", "ltda", "uruguay", "entre", "cuentas", "enviada", "recibida",
  "para", "por", "del", "los", "las", "con", "obra", "voltia", "comision", "servicios", "trf", "spi",
  "sueldo", "sueldos", "ahorro", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "setiembre", "septiembre", "octubre", "noviembre", "diciembre",
]);

export function palabras(t: string | null | undefined): string[] {
  return (t ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !VACIAS.has(w));
}

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** Misma palabra aunque esté mal escrita ("Macchiavello" / "Machiavello") o abreviada. */
function parecida(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.slice(0, 3) !== b.slice(0, 3)) return false;
  if (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
  return Math.min(a.length, b.length) >= 5 && distancia(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1);
}

/** Qué palabras de `nombre` aparecen en el texto del banco. */
function coinciden(textoBanco: string[], nombre: string | null | undefined): string[] {
  return [...new Set(palabras(nombre).filter((w) => textoBanco.some((t) => parecida(t, w))))];
}

function puntuar(f: FilaBanco, c: { monto: number; fecha: Date | null; nombres: Array<string | null | undefined> }) {
  const motivos: string[] = [];
  let p = 0;
  const dif = Math.abs(c.monto - f.monto) / Math.max(f.monto, 0.01);
  // El nombre propio pesa más que el monto: dos sueldos pueden valer lo mismo.
  if (dif <= 0.005) { p += 35; motivos.push("mismo monto"); }
  else if (dif <= 0.03) { p += 25; motivos.push("monto parecido"); }
  else if (dif <= 0.12) { p += 8; motivos.push("monto cercano"); }
  const texto = palabras(`${f.descripcion} ${f.asunto ?? ""}`);
  const iguales = [...new Set(c.nombres.flatMap((n) => coinciden(texto, n)))];
  if (iguales.length) { p += iguales.length > 1 ? 55 : 45; motivos.push(`el asunto dice «${iguales.slice(0, 2).join(" ")}»`); }
  if (c.fecha) {
    const d = Math.round(Math.abs(c.fecha.getTime() - f.fecha.getTime()) / dia);
    if (d <= 3) { p += 15; motivos.push(d === 0 ? "mismo día" : `a ${d} día${d > 1 ? "s" : ""}`); }
    else if (d <= 10) { p += 8; motivos.push(`a ${d} días`); }
    else if (d <= DIAS) p += 2;
  }
  // Sin parecido de nombre, un monto distinto no es la misma cosa; con nombre,
  // tampoco si es menos de la mitad o más del doble (una comisión de 1,70 con el
  // asunto de un sueldo no es el sueldo).
  if (!iguales.length && dif > 0.03) return null;
  if (dif > 0.5) p -= 30;
  return { puntaje: Math.min(100, p), motivos };
}

const fmt = (n: number, m: Moneda) => `${m === Moneda.USD ? "USD" : "$"} ${n.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function aplica(fc: { periodicidad: FixedCostPeriodicity; mesesPares: boolean | null; mesAnual: number | null }, mes: number) {
  if (fc.periodicidad === FixedCostPeriodicity.MENSUAL) return true;
  if (fc.periodicidad === FixedCostPeriodicity.BIMENSUAL) return fc.mesesPares === (mes % 2 === 0);
  if (fc.periodicidad === FixedCostPeriodicity.ANUAL) return fc.mesAnual === mes;
  return false;
}

/** Todos los candidatos de una cuenta, con su puntaje contra cada fila (sin umbral). */
async function candidatosPorFila(filas: FilaBanco[], relajado: boolean): Promise<Map<string, SugerenciaBanco[]>> {
  const out = new Map<string, SugerenciaBanco[]>();
  if (!filas.length) return out;
  const moneda = filas[0].moneda;
  const accountId = filas[0].accountId;
  const fechas = filas.map((f) => f.fecha.getTime());
  const desde = new Date(Math.min(...fechas) - DIAS * dia);
  const hasta = new Date(Math.max(...fechas) + DIAS * dia);

  const [movs, deudas, fijos, pagosFijos, cobros, facturas] = await Promise.all([
    // Ya pagados o cobrados, sin banco y sin cuenta (o en esta cuenta).
    prisma.financeMovement.findMany({
      where: {
        deletedAt: null, moneda, fecha: { gte: desde, lte: hasta }, bankMovement: null,
        // Sin cuenta, en esta, o en una cuenta sin lector del banco (cargado en la
        // cuenta equivocada: la seña que se anotó en BBVA y entró al BROU).
        OR: [{ accountId: null }, { accountId }, { account: { numeroCuentaBanco: null } }],
        status: FinanceMovementStatus.PAGADO,
        categoriaPrincipal: { notIn: [CategoriaPrincipal.TRANSFERENCIA, CategoriaPrincipal.AJUSTE_CONCILIACION] },
        paymentApplications: { none: { payment: { deletedAt: null } } },
      },
      select: {
        id: true, tipoMovimiento: true, descripcion: true, monto: true, fecha: true, accountId: true,
        account: { select: { nombre: true } },
        supplier: { select: { nombre: true } }, project: { select: { clientName: true, code: true } },
      },
    }),
    // Facturas de proveedor a pagar.
    prisma.financeMovement.findMany({
      where: {
        deletedAt: null, moneda, tipoMovimiento: TipoMovimiento.GASTO, supplierId: { not: null },
        status: { in: [FinanceMovementStatus.A_PAGAR, FinanceMovementStatus.PARCIALMENTE_PAGADO, FinanceMovementStatus.COMPROMETIDO] },
      },
      select: {
        id: true, descripcion: true, monto: true, fecha: true, dueDate: true, supplierId: true, invoiceNumber: true,
        supplier: { select: { nombre: true } },
        paymentApplications: { where: { payment: { deletedAt: null } }, select: { montoAplicado: true } },
      },
    }),
    prisma.fixedCost.findMany({ where: { activo: true, deletedAt: null, moneda } }),
    prisma.financeMovement.findMany({
      where: { deletedAt: null, fixedCostId: { not: null }, status: FinanceMovementStatus.PAGADO },
      select: { fixedCostId: true, mes: true, anio: true, monto: true, fecha: true },
      orderBy: { fecha: "desc" },
    }),
    prisma.financeMovement.findMany({
      where: {
        deletedAt: null, moneda, tipoMovimiento: TipoMovimiento.INGRESO, status: FinanceMovementStatus.PREVISTO,
        project: { deletedAt: null },
      },
      select: { id: true, descripcion: true, monto: true, fecha: true, dueDate: true, project: { select: { clientName: true, code: true } } },
    }),
    prisma.facturaRecibida.findMany({
      where: { estado: EstadoFacturaRecibida.PENDIENTE, moneda, fechaEmision: { gte: new Date(desde.getTime() - 30 * dia), lte: hasta } },
      select: { id: true, serie: true, numero: true, total: true, fechaEmision: true, razonSocialEmisor: true, supplierId: true, supplier: { select: { nombre: true } } },
    }),
  ]);

  const saldoDeuda = (d: (typeof deudas)[number]) => Number(d.monto) - d.paymentApplications.reduce((a, x) => a + Number(x.montoAplicado), 0);
  // Saldo total por proveedor (un pago puede cancelar varias facturas: "saldo MGI").
  const porProveedor = new Map<string, { nombre: string; razon: string | null; saldo: number; n: number }>();
  for (const d of deudas) {
    const r = porProveedor.get(d.supplierId!) ?? { nombre: d.supplier!.nombre, razon: null, saldo: 0, n: 0 };
    r.saldo += saldoDeuda(d); r.n++;
    porProveedor.set(d.supplierId!, r);
  }
  const ultimoFijo = new Map<string, { monto: number }>();
  const pagadoFijo = new Set<string>();
  for (const p of pagosFijos) {
    if (!ultimoFijo.has(p.fixedCostId!)) ultimoFijo.set(p.fixedCostId!, { monto: Number(p.monto) });
    pagadoFijo.add(`${p.fixedCostId}:${p.anio}-${p.mes}`);
  }

  for (const f of filas) {
    const lista: SugerenciaBanco[] = [];
    const add = (s: Omit<SugerenciaBanco, "puntaje" | "motivos">, r: { puntaje: number; motivos: string[] } | null) => {
      if (r && (relajado || r.puntaje >= MINIMO)) lista.push({ ...s, ...r });
    };

    for (const m of movs) {
      if (m.tipoMovimiento !== f.tipo) continue;
      const nombre = m.supplier?.nombre ?? m.project?.clientName ?? null;
      const otraCuenta = m.accountId && m.accountId !== accountId ? m.account?.nombre ?? "otra cuenta" : null;
      const r = puntuar(f, { monto: Number(m.monto), fecha: m.fecha, nombres: [m.descripcion, nombre] });
      if (r && otraCuenta) { r.puntaje -= 10; r.motivos.push(`está cargado en ${otraCuenta}`); }
      add({
        clave: `MOVIMIENTO:${m.id}`, tipo: "MOVIMIENTO", refId: m.id, titulo: m.descripcion,
        detalle: [nombre, otraCuenta ? `cargado en ${otraCuenta}` : m.accountId ? null : "cargado sin cuenta"].filter(Boolean).join(" · ") || null,
        monto: Number(m.monto), moneda, fecha: toDateOnlyString(m.fecha),
        accion: otraCuenta
          ? `Es este movimiento, cargado en ${otraCuenta}: se pasa a esta cuenta y queda emparejado.`
          : "Es este movimiento ya cargado: se le pone esta cuenta y queda emparejado.",
      }, r);
    }

    if (f.tipo === TipoMovimiento.GASTO) {
      for (const d of deudas) {
        const saldo = saldoDeuda(d);
        if (saldo <= 0.005) continue;
        const r = puntuar(f, { monto: saldo, fecha: d.dueDate ?? d.fecha, nombres: [d.supplier?.nombre, d.descripcion] });
        add({
          clave: `DEUDA:${d.id}`, tipo: "DEUDA", refId: d.id,
          titulo: `${d.supplier?.nombre}: ${d.descripcion}`, detalle: `le falta pagar ${fmt(saldo, moneda)}`,
          monto: saldo, moneda, fecha: toDateOnlyString(d.dueDate ?? d.fecha),
          accion: `Es el pago de esta factura: se registra el pago a ${d.supplier?.nombre} desde esta cuenta.`,
        }, r);
      }
      for (const [supplierId, p] of porProveedor) {
        if (p.n < 2 || p.saldo <= 0.005) continue;
        add({
          clave: `DEUDA_PROVEEDOR:${supplierId}`, tipo: "DEUDA_PROVEEDOR", refId: supplierId,
          titulo: `${p.nombre}: todo lo que se le debe`, detalle: `${p.n} facturas`,
          monto: p.saldo, moneda, fecha: null,
          accion: `Es un pago a ${p.nombre}: se registra desde esta cuenta y se descuenta de sus facturas más viejas.`,
        }, puntuar(f, { monto: p.saldo, fecha: null, nombres: [p.nombre, p.razon] }));
      }
      // Costos fijos del mes del movimiento y del anterior, todavía sin pagar.
      for (const delta of [0, -1]) {
        const ref = new Date(Date.UTC(f.fecha.getUTCFullYear(), f.fecha.getUTCMonth() + delta, 1));
        const mes = ref.getUTCMonth() + 1;
        const anio = ref.getUTCFullYear();
        for (const fc of fijos) {
          if (!aplica(fc, mes) || pagadoFijo.has(`${fc.id}:${anio}-${mes}`)) continue;
          const monto = ultimoFijo.get(fc.id)?.monto ?? Number(fc.montoReferencia);
          const vence = new Date(Date.UTC(anio, mes - 1, Math.min(fc.diaDelMes, 28)));
          // Si el asunto nombra un mes ("Sueldo Emir Septiembre"), es ese.
          const texto = `${f.descripcion} ${f.asunto ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const mesDicho = MESES.findIndex((nm, i) => texto.includes(nm) || (i === 8 && texto.includes("setiembre"))) + 1;
          const r = puntuar(f, { monto, fecha: vence, nombres: [fc.nombre, fc.descripcion] });
          if (r && mesDicho) {
            if (mesDicho === mes) { r.puntaje = Math.min(100, r.puntaje + 10); r.motivos.push(`dice ${MESES[mes - 1]}`); }
            else r.puntaje -= 20;
          }
          add({
            clave: `COSTO_FIJO:${fc.id}:${anio}-${mes}`, tipo: "COSTO_FIJO", refId: fc.id,
            titulo: `${fc.nombre} de ${MESES[mes - 1]}`, detalle: "costo fijo sin pagar",
            monto, moneda, fecha: toDateOnlyString(vence),
            accion: `Es el pago de ${fc.nombre} de ${MESES[mes - 1]}: se registra pagado desde esta cuenta.`,
          }, r);
        }
      }
      for (const fr of facturas) {
        const nombre = fr.supplier?.nombre ?? fr.razonSocialEmisor;
        add({
          clave: `FACTURA:${fr.id}`, tipo: "FACTURA", refId: fr.id,
          titulo: `Factura de ${nombre}`, detalle: `por revisar · ${fr.serie}-${fr.numero}`,
          monto: Number(fr.total), moneda, fecha: toDateOnlyString(fr.fechaEmision),
          accion: fr.supplierId
            ? `Es la compra de esta factura: se crea el gasto pagado desde esta cuenta, con la factura vinculada.`
            : `Es la compra de esta factura (primero hay que elegir su proveedor en Facturas).`,
        }, puntuar(f, { monto: Number(fr.total), fecha: fr.fechaEmision, nombres: [fr.razonSocialEmisor, fr.supplier?.nombre] }));
      }
    } else {
      for (const c of cobros) {
        add({
          clave: `COBRO:${c.id}`, tipo: "COBRO", refId: c.id,
          titulo: `${c.project?.clientName}: ${c.descripcion.replace(/^\[PLAN\]\s*/, "")}`, detalle: `cobro previsto · ${c.project?.code}`,
          monto: Number(c.monto), moneda, fecha: toDateOnlyString(c.dueDate ?? c.fecha),
          accion: "Es este cobro: se marca cobrado en esta cuenta, con la fecha y el monto del banco.",
        }, puntuar(f, { monto: Number(c.monto), fecha: c.dueDate, nombres: [c.project?.clientName] }));
      }
    }
    lista.sort((a, b) => b.puntaje - a.puntaje);
    out.set(f.id, lista);
  }
  return out;
}

/** Las sugerencias que se muestran (puntaje mínimo, hasta 3). */
export async function sugerenciasBanco(filas: FilaBanco[]): Promise<Map<string, SugerenciaBanco[]>> {
  const res = new Map<string, SugerenciaBanco[]>();
  const porCuenta = new Map<string, FilaBanco[]>();
  for (const f of filas) porCuenta.set(f.accountId, [...(porCuenta.get(f.accountId) ?? []), f]);
  for (const lista of porCuenta.values()) {
    for (const [id, s] of await candidatosPorFila(lista, false)) res.set(id, s.slice(0, MAX));
  }
  return res;
}

/** ¿Es una comisión, un impuesto o un cargo del banco? (se cargan todos juntos). */
export function esCargoBancario(f: { descripcion: string; asunto: string | null }) {
  // Por la descripción del banco (el asunto de una comisión SPI repite el de la transferencia).
  return /comisi[oó]n|^iva\b|i\.v\.a|cargo|impuesto|inter[eé]s|mantenimiento|tarjeta de d[eé]bito/i.test(f.descripcion);
}

// ─── IA ─────────────────────────────────────────────────────────────────────

const MODEL_ID = process.env.CONCILIACION_MODEL ?? "claude-sonnet-4-5-20250929";
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado");
  _client = new Anthropic({ apiKey });
  return _client;
}

const RespuestaIa = z.object({
  resultados: z.array(z.object({
    id: z.string(),
    opcion: z.string().nullable(),
    queEs: z.string(),
    confianza: z.enum(["alta", "media", "baja"]),
  })),
});

export type SugerenciaIa = { opcion: SugerenciaBanco | null; queEs: string; confianza: "alta" | "media" | "baja"; at: string };

/**
 * Para los movimientos sin una sugerencia clara, la IA lee descripción, asunto,
 * monto y fecha, y elige entre los candidatos más cercanos (o ninguno, diciendo
 * qué cree que es: "transferencia entre cuentas propias", "comisión"...). Se
 * guarda en el movimiento del banco.
 */
export async function interpretarConIa(filas: FilaBanco[], userId: string): Promise<number> {
  if (!filas.length) return 0;
  const porCuenta = new Map<string, FilaBanco[]>();
  for (const f of filas) porCuenta.set(f.accountId, [...(porCuenta.get(f.accountId) ?? []), f]);
  let hechas = 0;
  for (const lista of porCuenta.values()) {
    const cands = await candidatosPorFila(lista, true);
    // De a 15 por llamada para que la respuesta no se corte.
    for (let i = 0; i < lista.length; i += 15) {
      const tanda = lista.slice(i, i + 15);
      const opcionesDe = new Map(tanda.map((f) => [f.id, (cands.get(f.id) ?? []).slice(0, 8)]));
      const entrada = tanda.map((f) => ({
        id: f.id,
        fecha: toDateOnlyString(f.fecha),
        sentido: f.tipo === TipoMovimiento.INGRESO ? "entra plata" : "sale plata",
        monto: fmt(f.monto, f.moneda),
        descripcionBanco: f.descripcion,
        asunto: f.asunto,
        candidatos: opcionesDe.get(f.id)!.map((c) => ({ opcion: c.clave, que: c.titulo, detalle: c.detalle, monto: fmt(c.monto, c.moneda), fecha: c.fecha })),
      }));
      const prompt = `Sos el asistente de Finanzas de Voltia (empresa uruguaya de energía solar). Para cada movimiento del banco que todavía no está registrado en el sistema, decidí a qué registro corresponde entre sus "candidatos" (pagos de facturas de proveedores, costos fijos del mes como sueldos o alquiler, cobros a clientes, gastos ya cargados sin cuenta, facturas recibidas).

Pistas: el "asunto" suele traer el nombre del destinatario o de quien transfiere y un concepto ("RIBOX S.A. - alquiler del elevado", "SEBASTIAN CALLEROS RONDAN - Pago cuota 1", "NICOLAS ... - sueldo CEO Nico"). Los nombres pueden venir abreviados, en otro orden o sin tildes. Un monto distinto puede ser un pago parcial o con descuento; una fecha unos días corrida es normal. Si el asunto dice "Entre cuentas" o el destinatario es el titular sin concepto, es una transferencia entre cuentas propias.

Elegí "opcion" SOLO si estás razonablemente seguro de que es ese registro; si no, null. En "queEs" explicá en una frase corta, en castellano rioplatense, qué es el movimiento y por qué elegiste (o qué creés que es si no hay candidato: "transferencia entre cuentas propias", "comisión bancaria", "pago a un proveedor que no está cargado: X"...).

Movimientos:
${JSON.stringify(entrada, null, 1)}

Respondé SOLO un JSON: {"resultados":[{"id":"...","opcion":"<clave del candidato o null>","queEs":"...","confianza":"alta|media|baja"}]}`;
      const r = await createMessage(getClient(), "conciliacion_banco", {
        model: MODEL_ID,
        max_tokens: 8000,
        messages: [{ role: "user", content: prompt }],
      }, { userId });
      const raw = r.content.map((b) => (b.type === "text" ? b.text : "")).join("").replace(/```json|```/g, "").trim();
      let parsed: z.infer<typeof RespuestaIa>;
      try { parsed = RespuestaIa.parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1))); } catch { continue; }
      for (const res of parsed.resultados) {
        const opciones = opcionesDe.get(res.id);
        if (!opciones) continue;
        const opcion = res.opcion ? opciones.find((o) => o.clave === res.opcion) ?? null : null;
        const valor: SugerenciaIa = { opcion, queEs: res.queEs, confianza: res.confianza, at: new Date().toISOString() };
        await prisma.bankMovement.update({
          where: { id: res.id },
          data: { sugerenciaIa: valor as unknown as Prisma.InputJsonValue, sugerenciaIaAt: new Date() },
        });
        hechas++;
      }
    }
  }
  return hechas;
}

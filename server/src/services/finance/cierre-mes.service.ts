// Cierre de mes de Finanzas.
//
// - Fecha de cierre: el último día del mes cerrado más reciente (sin reabrir).
//   Nada con fecha hasta ese día se carga, edita ni borra (`assertFechaAbierta`).
// - Lista de control: se calcula sola sobre el mes (lo del banco sin cargar, lo
//   cargado que el banco no muestra, facturas por revisar, posibles duplicados,
//   costos fijos sin pagar) más los tildes que solo puede dar una persona.
// - Archivo para la contadora: libro de compras, libro de ventas, notas de
//   crédito, ajustes y movimientos del mes, en un Excel.

import ExcelJS from "exceljs";
import { EstadoCfeEmitido, EstadoFacturaRecibida, FinanceMovementStatus, MetodoPago, TipoMovimiento } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/errors.js";
import { toDateOnlyString } from "../../utils/dates.js";
import { pendientesPorCuenta, sinBancoPorCuenta } from "./bank-reconciliation.service.js";

export const rangoMes = (anio: number, mes: number) => ({
  inicio: new Date(Date.UTC(anio, mes - 1, 1)),
  fin: new Date(Date.UTC(anio, mes, 1)), // exclusivo
});

/** Último día cerrado (inclusive), o null si no hay meses cerrados. */
export async function fechaDeCierre(): Promise<Date | null> {
  const c = await prisma.cierreMes.findFirst({
    where: { reabiertoAt: null },
    orderBy: [{ anio: "desc" }, { mes: "desc" }],
  });
  if (!c) return null;
  return new Date(Date.UTC(c.anio, c.mes, 0)); // último día del mes
}

/** Corta si la fecha cae en un mes cerrado. */
export async function assertFechaAbierta(...fechas: Array<Date | null | undefined>) {
  const cierre = await fechaDeCierre();
  if (!cierre) return;
  for (const f of fechas) {
    if (f && f.getTime() <= cierre.getTime()) {
      throw new AppError(
        409,
        "MES_CERRADO",
        `El mes está cerrado hasta el ${toDateOnlyString(cierre)!.split("-").reverse().join("/")}: no se puede cargar, editar ni borrar nada con esa fecha. Si hace falta, se reabre desde Finanzas → Cierre.`,
      );
    }
  }
}

export type ItemControl = { clave: string; texto: string; ok: boolean; detalle?: string; manual?: boolean };

/** Tildes que solo puede dar una persona (no hay forma de saberlo solo). */
export const CONTROLES_MANUALES: Array<{ clave: string; texto: string }> = [
  { clave: "estados_cuenta", texto: "Estados de cuenta de los proveedores principales subidos y comparados" },
  { clave: "tarjetas", texto: "Tarjetas rendidas: cada gasto marcado de Voltia o personal, y el pago cierra" },
  { clave: "sueldos", texto: "Descuentos a empleados y cuenta del socio revisados" },
  { clave: "revision", texto: "Revisión del dueño" },
];

export async function listaDeControl(anio: number, mes: number): Promise<ItemControl[]> {
  const { inicio, fin } = rangoMes(anio, mes);
  const enMes = (iso: string | null) => !!iso && iso >= toDateOnlyString(inicio)! && iso < toDateOnlyString(fin)!;

  const [cuentas, sinBanco, porRevisar, fijosSinPagar, facturasSinEmitir] = await Promise.all([
    pendientesPorCuenta(),
    sinBancoPorCuenta(),
    prisma.facturaRecibida.count({ where: { estado: EstadoFacturaRecibida.PENDIENTE, fechaEmision: { gte: inicio, lt: fin } } }),
    prisma.financeMovement.count({
      where: {
        deletedAt: null, fixedCostId: { not: null }, tipoMovimiento: TipoMovimiento.GASTO,
        pagado: false, fecha: { gte: inicio, lt: fin },
        status: { not: FinanceMovementStatus.PREVISTO },
      },
    }),
    prisma.project.count({ where: { deletedAt: null, llevaFactura: true, facturaEmitida: false, saleDate: { lt: fin } } }),
  ]);
  const faltaCargar = cuentas.reduce((n, c) => n + c.pendientes.filter((p) => enMes(p.fecha)).length, 0);
  const sinLectura = cuentas.filter((c) => !c.bancoLeidoEn).map((c) => c.nombre);
  const sinBancoMes = sinBanco.filter((s) => enMes(s.fecha)).length;

  return [
    {
      clave: "banco", texto: "Todo lo del banco está cargado en Voltia PM",
      ok: faltaCargar === 0 && sinLectura.length === 0,
      detalle: faltaCargar ? `${faltaCargar} movimiento(s) del banco sin cargar` : sinLectura.length ? `Sin lectura del banco: ${sinLectura.join(", ")}` : undefined,
    },
    {
      clave: "sin_banco", texto: "Lo cargado como pagado o cobrado aparece en el banco",
      ok: sinBancoMes === 0, detalle: sinBancoMes ? `${sinBancoMes} sin aparecer en el banco` : undefined,
    },
    {
      clave: "facturas", texto: "Facturas de proveedores del mes revisadas",
      ok: porRevisar === 0, detalle: porRevisar ? `${porRevisar} por revisar` : undefined,
    },
    {
      clave: "fijos", texto: "Costos fijos del mes pagados",
      ok: fijosSinPagar === 0, detalle: fijosSinPagar ? `${fijosSinPagar} sin pagar` : undefined,
    },
    {
      clave: "facturacion", texto: "Obras vendidas que llevan factura, facturadas",
      ok: facturasSinEmitir === 0, detalle: facturasSinEmitir ? `${facturasSinEmitir} sin factura emitida` : undefined,
    },
    ...CONTROLES_MANUALES.map((c) => ({ ...c, ok: false, manual: true })),
  ];
}

// ─── Archivo para la contadora ──────────────────────────────────────────────

export async function archivoContadora(anio: number, mes: number): Promise<Buffer> {
  const { inicio, fin } = rangoMes(anio, mes);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Voltia PM";
  const d = (x: Date | null | undefined) => (x ? toDateOnlyString(x)!.split("-").reverse().join("/") : "");
  const n = (x: unknown) => (x == null ? null : Number(x));

  // Libro de compras: facturas y notas de crédito recibidas (no descartadas).
  const compras = await prisma.facturaRecibida.findMany({
    where: { fechaEmision: { gte: inicio, lt: fin }, estado: { not: EstadoFacturaRecibida.DESCARTADA } },
    include: { supplier: { select: { nombre: true } } },
    orderBy: [{ fechaEmision: "asc" }, { numero: "asc" }],
  });
  const sc = wb.addWorksheet("Compras");
  sc.columns = [
    { header: "Fecha", key: "fecha", width: 12 }, { header: "RUT", key: "rut", width: 14 },
    { header: "Proveedor", key: "prov", width: 34 }, { header: "Comprobante", key: "tipo", width: 10 },
    { header: "Serie", key: "serie", width: 7 }, { header: "Número", key: "num", width: 10 },
    { header: "Moneda", key: "mon", width: 8 }, { header: "Neto", key: "neto", width: 12 },
    { header: "IVA", key: "iva", width: 12 }, { header: "Total", key: "total", width: 12 },
    { header: "Estado en Voltia PM", key: "estado", width: 18 },
  ];
  const signo = (tipo: number) => ([102, 112, 122, 202, 212, 222].includes(tipo) ? -1 : 1);
  for (const f of compras) {
    const s = signo(f.tipoCfe);
    sc.addRow({
      fecha: d(f.fechaEmision), rut: f.rutEmisor, prov: f.supplier?.nombre ?? f.razonSocialEmisor ?? "",
      tipo: f.tipoCfe, serie: f.serie, num: f.numero, mon: f.moneda,
      neto: f.totalNeto != null ? s * Number(f.totalNeto) : null, iva: f.totalIva != null ? s * Number(f.totalIva) : null,
      total: s * Number(f.total), estado: f.estado === EstadoFacturaRecibida.CONFIRMADA ? "Cargada" : "Por revisar",
    });
  }

  // Libro de ventas: lo emitido por Biller.
  const ventas = await prisma.cfeEmitido.findMany({
    where: { fechaEmision: { gte: inicio, lt: fin }, estado: { in: [EstadoCfeEmitido.ACEPTADO, EstadoCfeEmitido.ESPERANDO_DGI] } },
    include: { project: { select: { code: true } } },
    orderBy: [{ fechaEmision: "asc" }, { numero: "asc" }],
  });
  const sv = wb.addWorksheet("Ventas");
  sv.columns = [
    { header: "Fecha", key: "fecha", width: 12 }, { header: "Comprobante", key: "tipo", width: 10 },
    { header: "Serie", key: "serie", width: 7 }, { header: "Número", key: "num", width: 10 },
    { header: "Documento", key: "doc", width: 14 }, { header: "Cliente", key: "cli", width: 34 },
    { header: "Obra", key: "obra", width: 14 }, { header: "Moneda", key: "mon", width: 8 },
    { header: "Total con IVA", key: "total", width: 14 }, { header: "Tasa de cambio", key: "tasa", width: 12 },
    { header: "Estado DGI", key: "dgi", width: 16 },
  ];
  for (const c of ventas) {
    sv.addRow({
      fecha: d(c.fechaEmision), tipo: c.tipoCfe, serie: c.serie, num: c.numero, doc: c.clienteDocumento,
      cli: c.clienteNombre, obra: c.project.code, mon: c.moneda,
      total: (c.referenciaId ? -1 : 1) * Number(c.total), tasa: n(c.tasaCambio), dgi: c.estadoDgi ?? c.estado,
    });
  }

  // Ajustes de deuda (no son plata): para que tengan respaldo.
  const ajustes = await prisma.payment.findMany({
    where: { metodo: MetodoPago.AJUSTE, deletedAt: null, fecha: { gte: inicio, lt: fin } },
    include: { supplier: { select: { nombre: true, rut: true } }, createdBy: { select: { name: true } } },
    orderBy: { fecha: "asc" },
  });
  const sa = wb.addWorksheet("Ajustes");
  sa.columns = [
    { header: "Fecha", key: "fecha", width: 12 }, { header: "Proveedor", key: "prov", width: 30 },
    { header: "RUT", key: "rut", width: 14 }, { header: "Moneda", key: "mon", width: 8 },
    { header: "Monto", key: "monto", width: 12 }, { header: "Motivo", key: "motivo", width: 60 },
    { header: "Hecho por", key: "por", width: 20 },
  ];
  for (const a of ajustes) {
    sa.addRow({ fecha: d(a.fecha), prov: a.supplier.nombre, rut: a.supplier.rut, mon: a.moneda, monto: Number(a.monto), motivo: a.notas, por: a.createdBy?.name });
  }

  // Movimientos del mes (lo que entró y salió).
  const movs = await prisma.financeMovement.findMany({
    where: { deletedAt: null, fecha: { gte: inicio, lt: fin }, status: { not: FinanceMovementStatus.PREVISTO } },
    include: {
      supplier: { select: { nombre: true } }, project: { select: { code: true } },
      account: { select: { nombre: true } }, subcategoria: { select: { nombre: true } },
    },
    orderBy: { fecha: "asc" },
  });
  const sm = wb.addWorksheet("Movimientos");
  sm.columns = [
    { header: "Fecha", key: "fecha", width: 12 }, { header: "Tipo", key: "tipo", width: 9 },
    { header: "Categoría", key: "cat", width: 18 }, { header: "Subcategoría", key: "sub", width: 18 },
    { header: "Descripción", key: "desc", width: 40 }, { header: "Proveedor", key: "prov", width: 24 },
    { header: "Obra", key: "obra", width: 14 }, { header: "Cuenta", key: "cta", width: 18 },
    { header: "Moneda", key: "mon", width: 8 }, { header: "Monto", key: "monto", width: 12 },
    { header: "Estado", key: "estado", width: 20 }, { header: "Factura", key: "fact", width: 14 },
  ];
  for (const m of movs) {
    sm.addRow({
      fecha: d(m.fecha), tipo: m.tipoMovimiento === TipoMovimiento.INGRESO ? "Entra" : "Sale", cat: m.categoriaPrincipal,
      sub: m.subcategoria?.nombre, desc: m.descripcion, prov: m.supplier?.nombre, obra: m.project?.code,
      cta: m.account?.nombre, mon: m.moneda, monto: Number(m.monto), estado: m.status, fact: m.invoiceNumber,
    });
  }

  for (const ws of wb.worksheets) {
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Conciliación diaria contra el banco.
//
// El lector del banco (proyecto aparte, ~/Dev/lector-banco) entra a eBROU, lee
// los movimientos de los últimos días y los manda acá (`registrarLectura`). Se
// guardan en BankMovement sin repetir, y `pendientesPorCuenta` los compara
// contra lo cargado en Voltia PM en la misma cuenta.
//
// Reglas de la pareja (pedidas por Nicolás el 20-oct-2026):
// - mismo sentido (entra / sale) y misma cuenta;
// - diferencia de monto hasta MARGEN[moneda] (USD 5 en la cuenta en dólares,
//   $10 en la de pesos: se compara en la moneda de la cuenta, sin convertir);
// - fecha a no más de DIAS_TOLERANCIA días (se carga con otra fecha a veces).
// Cada movimiento se usa una sola vez; ante varias parejas posibles gana la
// más parecida (monto y después fecha).
//
// La pareja propuesta no se guarda: se recalcula en cada consulta, así lo que se
// carga, edita o borra después se refleja solo. Se guarda lo que decide una
// persona: el "No va" y la pareja confirmada (BankMovement.movementId/paymentId),
// que queda fija y el emparejador no la mueve.

import { createHash } from "node:crypto";

import { Moneda, Prisma, TipoMovimiento } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { addDays, diffInDays, parseDateOnly, toDateOnlyString } from "../../utils/dates.js";

export const MARGEN: Record<Moneda, number> = { USD: 5, UYU: 10 };
export const DIAS_TOLERANCIA = 3;
// Desde cuándo se compara. Lo anterior en el banco no está cargado en Voltia PM
// y llenaría el cuadro de pendientes viejos.
export const CONCILIAR_DESDE = process.env.BANCO_CONCILIAR_DESDE || "2026-10-01";

// ─── Lectura que manda el robot ─────────────────────────────────────────────

export type LecturaCuenta = {
  numeroCuenta: string;
  saldo?: number | null;
  movimientos: Array<{
    fecha: string; // YYYY-MM-DD
    descripcion: string;
    documento?: string | null;
    dependencia?: string | null;
    debito?: number | null;
    credito?: number | null;
  }>;
};

export type ResultadoLectura = {
  numeroCuenta: string;
  cuenta: string | null;
  nuevos: number;
  repetidos: number;
  error?: string;
};

function normalizarTexto(t: string) {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

export async function registrarLectura(cuentas: LecturaCuenta[], leidoEn: Date): Promise<ResultadoLectura[]> {
  const out: ResultadoLectura[] = [];
  for (const c of cuentas) {
    const account = await prisma.account.findFirst({
      where: { numeroCuentaBanco: c.numeroCuenta, deletedAt: null },
    });
    if (!account) {
      out.push({ numeroCuenta: c.numeroCuenta, cuenta: null, nuevos: 0, repetidos: 0, error: "Ninguna cuenta tiene ese número de banco" });
      continue;
    }

    // Ordinal entre movimientos idénticos del mismo día: dos comisiones iguales
    // son dos movimientos, y releer la misma ventana da las mismas claves.
    const vistos = new Map<string, number>();
    const filas: Prisma.BankMovementCreateManyInput[] = [];
    for (const m of c.movimientos) {
      const debito = Number(m.debito ?? 0);
      const credito = Number(m.credito ?? 0);
      if (!debito && !credito) continue;
      const tipo = credito > 0 ? TipoMovimiento.INGRESO : TipoMovimiento.GASTO;
      const monto = Math.round((credito > 0 ? credito : debito) * 100) / 100;
      const descripcion = m.descripcion.trim();
      const documento = m.documento?.trim() || null;
      // La llave usa el texto normalizado: un espacio o un acento de diferencia
      // entre dos lecturas no puede convertir el mismo movimiento en dos.
      const base = [account.id, m.fecha, normalizarTexto(descripcion), normalizarTexto(documento ?? ""), tipo, monto.toFixed(2)].join("|");
      const n = (vistos.get(base) ?? 0) + 1;
      vistos.set(base, n);
      filas.push({
        accountId: account.id,
        fecha: parseDateOnly(m.fecha),
        descripcion,
        documento,
        dependencia: m.dependencia?.trim() || null,
        tipo,
        monto: new Prisma.Decimal(monto),
        claveUnica: createHash("sha256").update(`${base}|${n}`).digest("hex"),
      });
    }
    const { count } = await prisma.bankMovement.createMany({ data: filas, skipDuplicates: true });
    await prisma.account.update({
      where: { id: account.id },
      data: {
        bancoLeidoEn: leidoEn,
        ...(c.saldo != null ? { bancoSaldo: new Prisma.Decimal(c.saldo) } : {}),
      },
    });
    out.push({ numeroCuenta: c.numeroCuenta, cuenta: account.nombre, nuevos: count, repetidos: filas.length - count });
  }
  return out;
}

// ─── Comparación ────────────────────────────────────────────────────────────

type Lado = { id: string; fecha: Date; tipo: TipoMovimiento; monto: number; descripcion: string };

/** Lo que coincide del lado de Voltia PM: un movimiento (m-…) o un pago a proveedor (p-…). */
export type ParejaPm = { id: string; tipo: "MOVIMIENTO" | "PAGO"; fecha: string; descripcion: string; monto: number };

export type PendienteBanco = {
  id: string;
  fecha: string;
  descripcion: string;
  documento: string | null;
  tipo: TipoMovimiento;
  monto: number;
};

export type CuentaConciliada = {
  accountId: string;
  nombre: string;
  moneda: Moneda;
  numeroCuentaBanco: string;
  bancoLeidoEn: string | null;
  bancoSaldo: number | null;
  margen: number;
  conciliados: number;
  pendientes: PendienteBanco[];
};

/** Parejas una a una entre banco y Voltia PM: id del banco → lado de Voltia PM. */
function emparejar(banco: Lado[], pm: Lado[], margen: number): Map<string, Lado> {
  const candidatos: Array<{ b: string; p: Lado; dif: number; dias: number }> = [];
  for (const b of banco) {
    for (const p of pm) {
      if (p.tipo !== b.tipo) continue;
      const dif = Math.abs(p.monto - b.monto);
      const dias = Math.abs(diffInDays(b.fecha, p.fecha));
      if (dif <= margen + 0.001 && dias <= DIAS_TOLERANCIA) candidatos.push({ b: b.id, p, dif, dias });
    }
  }
  // Desempate fijo (por id) para que la misma consulta dé siempre las mismas parejas.
  candidatos.sort((x, y) => x.dif - y.dif || x.dias - y.dias || x.b.localeCompare(y.b) || x.p.id.localeCompare(y.p.id));
  const parejas = new Map<string, Lado>();
  const usadosP = new Set<string>();
  for (const c of candidatos) {
    if (parejas.has(c.b) || usadosP.has(c.p.id)) continue;
    parejas.set(c.b, c.p);
    usadosP.add(c.p.id);
  }
  return parejas;
}

type AccountConBanco = { id: string; moneda: Moneda };

/**
 * Compara los movimientos del banco de una cuenta (desde CONCILIAR_DESDE, sin
 * los "No va") contra Voltia PM. Del lado de Voltia PM va lo mismo que mueve el
 * saldo de la cuenta (computeAccountBalance): ingresos cobrados, gastos pagados
 * sin Payment (los que tienen Payment se cuentan por el Payment) y los Payments.
 */
async function conciliarCuenta(a: AccountConBanco) {
  const desde = parseDateOnly(CONCILIAR_DESDE);
  const bankRows = await prisma.bankMovement.findMany({
    where: { accountId: a.id, fecha: { gte: desde }, ignoradoAt: null },
    orderBy: { fecha: "desc" },
    include: {
      movement: { select: { id: true, fecha: true, tipoMovimiento: true, monto: true, descripcion: true, deletedAt: true } },
      payment: { select: { id: true, fecha: true, monto: true, montoCuenta: true, referencia: true, deletedAt: true, supplier: { select: { nombre: true } } } },
    },
  });
  // Parejas confirmadas por una persona: quedan fijas.
  const fijas = new Map<string, Lado>();
  for (const r of bankRows) {
    if (r.movement && !r.movement.deletedAt) {
      fijas.set(r.id, { id: `m-${r.movement.id}`, fecha: r.movement.fecha, tipo: r.movement.tipoMovimiento, monto: Number(r.movement.monto), descripcion: r.movement.descripcion });
    } else if (r.payment && !r.payment.deletedAt) {
      fijas.set(r.id, {
        id: `p-${r.payment.id}`, fecha: r.payment.fecha,
        tipo: Number(r.payment.monto) < 0 ? TipoMovimiento.INGRESO : TipoMovimiento.GASTO,
        monto: Math.abs(Number(r.payment.montoCuenta ?? r.payment.monto)),
        descripcion: `Pago a ${r.payment.supplier.nombre}${r.payment.referencia ? ` (${r.payment.referencia})` : ""}`,
      });
    }
  }
  const usadosFijos = new Set([...fijas.values()].map((l) => l.id));
  const pmDesde = addDays(desde, -DIAS_TOLERANCIA);
  const [movs, pagos] = await Promise.all([
    prisma.financeMovement.findMany({
      where: {
        accountId: a.id,
        deletedAt: null,
        fecha: { gte: pmDesde },
        OR: [
          { tipoMovimiento: TipoMovimiento.INGRESO, cobrado: true },
          {
            tipoMovimiento: TipoMovimiento.GASTO,
            pagado: true,
            paymentApplications: { none: { payment: { deletedAt: null } } },
          },
        ],
      },
      select: { id: true, fecha: true, tipoMovimiento: true, monto: true, descripcion: true },
    }),
    prisma.payment.findMany({
      where: { accountId: a.id, deletedAt: null, fecha: { gte: pmDesde } },
      select: { id: true, fecha: true, monto: true, montoCuenta: true, referencia: true, supplier: { select: { nombre: true } } },
    }),
  ]);
  const pm: Lado[] = [
    ...movs.map((m) => ({ id: `m-${m.id}`, fecha: m.fecha, tipo: m.tipoMovimiento, monto: Number(m.monto), descripcion: m.descripcion })),
    // Un Payment con monto negativo es una devolución del proveedor: entra plata.
    // Desde una cuenta de otra moneda, en el banco se ve lo que salió de la cuenta.
    ...pagos.map((p) => ({
      id: `p-${p.id}`,
      fecha: p.fecha,
      tipo: Number(p.monto) < 0 ? TipoMovimiento.INGRESO : TipoMovimiento.GASTO,
      monto: Math.abs(Number(p.montoCuenta ?? p.monto)),
      descripcion: `Pago a ${p.supplier.nombre}${p.referencia ? ` (${p.referencia})` : ""}`,
    })),
  ];
  const banco: Lado[] = bankRows
    .filter((r) => !fijas.has(r.id))
    .map((r) => ({ id: r.id, fecha: r.fecha, tipo: r.tipo, monto: Number(r.monto), descripcion: r.descripcion }));
  const propuestas = emparejar(banco, pm.filter((l) => !usadosFijos.has(l.id)), MARGEN[a.moneda]);
  const parejas = new Map([...fijas, ...propuestas]);
  const usadosPm = new Set([...parejas.values()].map((l) => l.id));
  // La otra punta: lo pagado/cobrado en Voltia PM desde que se compara y que no
  // aparece en el banco (se deja un margen de días: el banco acredita después).
  const limite = addDays(new Date(), -DIAS_TOLERANCIA);
  const sinBanco = pm.filter((l) => !usadosPm.has(l.id) && l.fecha >= desde && l.fecha <= limite);
  return { bankRows, parejas, confirmadas: new Set(fijas.keys()), sinBanco };
}

function aParejaPm(l: Lado): ParejaPm {
  return {
    id: l.id.slice(2),
    tipo: l.id.startsWith("p-") ? "PAGO" : "MOVIMIENTO",
    fecha: toDateOnlyString(l.fecha)!,
    descripcion: l.descripcion,
    monto: l.monto,
  };
}

export async function pendientesPorCuenta(): Promise<CuentaConciliada[]> {
  const accounts = await prisma.account.findMany({
    where: { deletedAt: null, numeroCuentaBanco: { not: null } },
    orderBy: { nombre: "asc" },
  });

  const out: CuentaConciliada[] = [];
  for (const a of accounts) {
    const { bankRows, parejas } = await conciliarCuenta(a);
    out.push({
      accountId: a.id,
      nombre: a.nombre,
      moneda: a.moneda,
      numeroCuentaBanco: a.numeroCuentaBanco!,
      bancoLeidoEn: a.bancoLeidoEn?.toISOString() ?? null,
      bancoSaldo: a.bancoSaldo != null ? Number(a.bancoSaldo) : null,
      margen: MARGEN[a.moneda],
      conciliados: parejas.size,
      pendientes: bankRows
        .filter((r) => !parejas.has(r.id))
        .map((r) => ({
          id: r.id,
          fecha: toDateOnlyString(r.fecha)!,
          descripcion: r.descripcion,
          documento: r.documento,
          tipo: r.tipo,
          monto: Number(r.monto),
        })),
    });
  }
  return out;
}

// ─── Registro: todos los movimientos leídos del banco ───────────────────────

// COINCIDE = pareja propuesta (se recalcula al mirar); CONFIRMADA = una persona la fijó.
export type EstadoBanco = "CONFIRMADA" | "COINCIDE" | "FALTA_CARGAR" | "NO_VA" | "NO_SE_COMPARA";

export type MovimientoBancoRegistro = PendienteBanco & {
  accountId: string;
  cuenta: string;
  moneda: Moneda;
  dependencia: string | null;
  estado: EstadoBanco;
  pareja: ParejaPm | null;
  noVaMotivo: string | null;
  noVaPor: string | null;
};

export async function registroBanco(filtro: { accountId?: string; desde: string; hasta: string }): Promise<MovimientoBancoRegistro[]> {
  const accounts = await prisma.account.findMany({
    where: { deletedAt: null, numeroCuentaBanco: { not: null }, ...(filtro.accountId ? { id: filtro.accountId } : {}) },
  });
  const desde = parseDateOnly(filtro.desde);
  const hasta = parseDateOnly(filtro.hasta);
  const conciliarDesde = parseDateOnly(CONCILIAR_DESDE);

  const out: MovimientoBancoRegistro[] = [];
  for (const a of accounts) {
    const [{ parejas, confirmadas }, rows] = await Promise.all([
      conciliarCuenta(a),
      prisma.bankMovement.findMany({
        where: { accountId: a.id, fecha: { gte: desde, lte: hasta } },
        include: { ignoradoPor: { select: { name: true } } },
      }),
    ]);
    for (const r of rows) {
      const pareja = parejas.get(r.id);
      const estado: EstadoBanco = r.ignoradoAt
        ? "NO_VA"
        : r.fecha < conciliarDesde
          ? "NO_SE_COMPARA"
          : pareja ? (confirmadas.has(r.id) ? "CONFIRMADA" : "COINCIDE") : "FALTA_CARGAR";
      out.push({
        id: r.id,
        accountId: a.id,
        cuenta: a.nombre,
        moneda: a.moneda,
        fecha: toDateOnlyString(r.fecha)!,
        descripcion: r.descripcion,
        documento: r.documento,
        dependencia: r.dependencia,
        tipo: r.tipo,
        monto: Number(r.monto),
        estado,
        pareja: pareja ? aParejaPm(pareja) : null,
        noVaMotivo: r.ignoradoMotivo,
        noVaPor: r.ignoradoPor?.name ?? null,
      });
    }
  }
  return out.sort((x, y) => y.fecha.localeCompare(x.fecha) || x.cuenta.localeCompare(y.cuenta));
}

// ─── Fijar o soltar una pareja ──────────────────────────────────────────────

/**
 * Fija la pareja de un movimiento del banco: con un movimiento de Voltia PM o
 * con un pago a proveedor de la misma cuenta y el mismo sentido. Queda fija:
 * el emparejador ya no la mueve.
 */
export async function vincularBanco(bankId: string, destino: { movementId?: string; paymentId?: string }, userId: string) {
  const b = await prisma.bankMovement.findUnique({ where: { id: bankId } });
  if (!b) throw new Error("BANK_MOVEMENT_NOT_FOUND");
  if (destino.movementId) {
    const m = await prisma.financeMovement.findFirst({ where: { id: destino.movementId, deletedAt: null } });
    if (!m) throw new Error("MOVEMENT_NOT_FOUND");
    if (m.accountId !== b.accountId) throw new Error("CUENTA_DISTINTA");
    if (m.tipoMovimiento !== b.tipo) throw new Error("SENTIDO_DISTINTO");
  } else if (destino.paymentId) {
    const p = await prisma.payment.findFirst({ where: { id: destino.paymentId, deletedAt: null } });
    if (!p) throw new Error("PAYMENT_NOT_FOUND");
    if (p.accountId !== b.accountId) throw new Error("CUENTA_DISTINTA");
  } else {
    throw new Error("DESTINO_REQUERIDO");
  }
  // Si ese movimiento ya estaba fijado a otra línea del banco, se suelta de ahí.
  await prisma.$transaction([
    prisma.bankMovement.updateMany({
      where: destino.movementId ? { movementId: destino.movementId } : { paymentId: destino.paymentId },
      data: { movementId: null, paymentId: null, vinculadoAt: null, vinculadoPorId: null },
    }),
    prisma.bankMovement.update({
      where: { id: bankId },
      data: {
        movementId: destino.movementId ?? null,
        paymentId: destino.paymentId ?? null,
        vinculadoAt: new Date(),
        vinculadoPorId: userId,
        ignoradoAt: null, ignoradoMotivo: null, ignoradoPorId: null,
      },
    }),
  ]);
}

export async function desvincularBanco(bankId: string) {
  await prisma.bankMovement.update({
    where: { id: bankId },
    data: { movementId: null, paymentId: null, vinculadoAt: null, vinculadoPorId: null },
  });
}

/** Lo cargado en Voltia PM (pagado o cobrado desde una cuenta del banco) que no aparece en el banco. */
export async function sinBancoPorCuenta() {
  const accounts = await prisma.account.findMany({ where: { deletedAt: null, numeroCuentaBanco: { not: null } } });
  const out: Array<ParejaPm & { accountId: string; cuenta: string; moneda: Moneda; sentido: TipoMovimiento }> = [];
  for (const a of accounts) {
    // Sin ninguna lectura del banco no hay contra qué comparar.
    if (!a.bancoLeidoEn) continue;
    const { sinBanco } = await conciliarCuenta(a);
    for (const l of sinBanco) out.push({ ...aParejaPm(l), accountId: a.id, cuenta: a.nombre, moneda: a.moneda, sentido: l.tipo });
  }
  return out.sort((x, y) => y.fecha.localeCompare(x.fecha));
}

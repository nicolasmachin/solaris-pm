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
// La pareja no se guarda: se recalcula en cada consulta, así lo que se carga,
// edita o borra después se refleja solo. Solo se guarda el "No va".

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
      const base = [account.id, m.fecha, descripcion, documento ?? "", tipo, monto.toFixed(2)].join("|");
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

type Lado = { id: string; fecha: Date; tipo: TipoMovimiento; monto: number };

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

/** Parejas una a una entre banco y Voltia PM; devuelve los ids del banco que quedaron sin pareja. */
function sinPareja(banco: Lado[], pm: Lado[], margen: number): Set<string> {
  const candidatos: Array<{ b: string; p: string; dif: number; dias: number }> = [];
  for (const b of banco) {
    for (const p of pm) {
      if (p.tipo !== b.tipo) continue;
      const dif = Math.abs(p.monto - b.monto);
      const dias = Math.abs(diffInDays(b.fecha, p.fecha));
      if (dif <= margen + 0.001 && dias <= DIAS_TOLERANCIA) candidatos.push({ b: b.id, p: p.id, dif, dias });
    }
  }
  candidatos.sort((x, y) => x.dif - y.dif || x.dias - y.dias);
  const usadosB = new Set<string>();
  const usadosP = new Set<string>();
  for (const c of candidatos) {
    if (usadosB.has(c.b) || usadosP.has(c.p)) continue;
    usadosB.add(c.b);
    usadosP.add(c.p);
  }
  return new Set(banco.filter((b) => !usadosB.has(b.id)).map((b) => b.id));
}

export async function pendientesPorCuenta(): Promise<CuentaConciliada[]> {
  const desde = parseDateOnly(CONCILIAR_DESDE);
  const accounts = await prisma.account.findMany({
    where: { deletedAt: null, numeroCuentaBanco: { not: null } },
    orderBy: { nombre: "asc" },
  });

  const out: CuentaConciliada[] = [];
  for (const a of accounts) {
    const bankRows = await prisma.bankMovement.findMany({
      where: { accountId: a.id, fecha: { gte: desde }, ignoradoAt: null },
      orderBy: { fecha: "desc" },
    });
    // Del lado de Voltia PM, lo mismo que mueve el saldo de la cuenta
    // (computeAccountBalance): ingresos cobrados, gastos pagados sin Payment
    // (los que tienen Payment se cuentan por el Payment) y los Payments.
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
        select: { id: true, fecha: true, tipoMovimiento: true, monto: true },
      }),
      prisma.payment.findMany({
        where: { accountId: a.id, deletedAt: null, fecha: { gte: pmDesde } },
        select: { id: true, fecha: true, monto: true },
      }),
    ]);
    const pm: Lado[] = [
      ...movs.map((m) => ({ id: `m-${m.id}`, fecha: m.fecha, tipo: m.tipoMovimiento, monto: Number(m.monto) })),
      // Un Payment con monto negativo es una devolución del proveedor: entra plata.
      ...pagos.map((p) => ({
        id: `p-${p.id}`,
        fecha: p.fecha,
        tipo: Number(p.monto) < 0 ? TipoMovimiento.INGRESO : TipoMovimiento.GASTO,
        monto: Math.abs(Number(p.monto)),
      })),
    ];
    const banco: Lado[] = bankRows.map((r) => ({ id: r.id, fecha: r.fecha, tipo: r.tipo, monto: Number(r.monto) }));
    const faltan = sinPareja(banco, pm, MARGEN[a.moneda]);

    out.push({
      accountId: a.id,
      nombre: a.nombre,
      moneda: a.moneda,
      numeroCuentaBanco: a.numeroCuentaBanco!,
      bancoLeidoEn: a.bancoLeidoEn?.toISOString() ?? null,
      bancoSaldo: a.bancoSaldo != null ? Number(a.bancoSaldo) : null,
      margen: MARGEN[a.moneda],
      conciliados: bankRows.length - faltan.size,
      pendientes: bankRows
        .filter((r) => faltan.has(r.id))
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

import { Moneda } from "@prisma/client";

// Saldo a favor de un proveedor = pagos registrados NO imputados a una factura
// puntual (crédito disponible con ese proveedor), separado por moneda (no se
// convierte UYU↔USD: netear cruzando monedas requeriría una conversión que hoy
// no existe en ningún lado).
//
// Fuente ÚNICA de verdad: la usan tanto la ficha del proveedor
// (GET /finance/suppliers?withBalance=true) como el flujo de fondos
// (GET /finance/cashflow), para que ambos calculen el saldo a favor igual.

export interface SaldoAFavorByCurrency {
  USD: number;
  UYU: number;
}

export interface PaymentForSaldo {
  supplierId: string;
  monto: unknown; // Prisma.Decimal | number | string
  moneda: Moneda;
  applications: { montoAplicado: unknown }[];
}

// Acumula el saldo a favor por proveedor y moneda a partir de los pagos del
// proveedor. Pura (sin DB): el caller trae los `payment` con sus `applications`.
export function accumulateSupplierSaldoAFavor(
  payments: PaymentForSaldo[],
): Map<string, SaldoAFavorByCurrency> {
  const map = new Map<string, SaldoAFavorByCurrency>();
  for (const p of payments) {
    const monto = Number(p.monto);
    const aplicado = p.applications.reduce((s, a) => s + Number(a.montoAplicado), 0);
    const saldoAFavor = Math.max(0, monto - aplicado);
    if (saldoAFavor <= 0.005) continue;
    const cur = map.get(p.supplierId) ?? { USD: 0, UYU: 0 };
    if (p.moneda === Moneda.USD) cur.USD += saldoAFavor;
    else cur.UYU += saldoAFavor;
    map.set(p.supplierId, cur);
  }
  return map;
}

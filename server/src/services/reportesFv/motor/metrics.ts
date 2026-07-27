// Port literal de `src/metrics.py` del sistema Python original.
//
// "Literal" es una decisión, no una casualidad: estos números ya se le
// comunicaron a los clientes en reportes enviados. El criterio de aceptación del
// port es reproducir las 282 filas de `historico_clientes.xlsx` — ver
// `serie.golden.test.ts`. Cualquier "mejora" acá desalinea el histórico.
//
// Los quirks conocidos del original están marcados con QUIRK y documentados.
// No corregirlos sin decidir antes qué se hace con los meses ya comunicados.

import type {
  CargosTarifa,
  DesgloseBeneficio,
  Factura,
  FacturaAjustada,
  TramoEscalonado,
} from "./types.js";

/**
 * Replica `round(x, 2)` de Python.
 *
 * Python usa redondeo bancario (half-to-even) sobre el valor decimal EXACTO del
 * float, no sobre su representación corta. `Math.round` de JS es half-up, y
 * `Number("2.675")` no vale como desempate porque el float real es
 * 2.67499999999999982…, que Python redondea a 2.67 y half-up daría 2.68.
 *
 * Por eso se materializa el valor exacto con `toFixed(20)` y se decide sobre los
 * dígitos: es la única forma de que el port coincida en los empates.
 *
 * NO reemplazar por `Math.round(x * 100) / 100` sin volver a correr el golden test.
 */
export function round2(x: number): number {
  if (!Number.isFinite(x)) return x;
  if (Math.abs(x) >= 1e15) return x; // fuera de rango útil; toFixed dejaría de ser exacto

  const negativo = x < 0;
  const abs = Math.abs(x);

  const [entero, decimales = ""] = abs.toFixed(20).split(".");
  const conservados = decimales.slice(0, 2).padEnd(2, "0");
  const resto = decimales.slice(2);

  let subir: boolean;
  const primerDescartado = resto.charAt(0) || "0";
  if (primerDescartado > "5") {
    subir = true;
  } else if (primerDescartado < "5") {
    subir = false;
  } else {
    // Empate exacto (…50000) sólo si todo lo que sigue es cero: ahí half-even.
    // Si hay algo distinto de cero después, el valor supera el medio y sube.
    const empateExacto = /^0*$/.test(resto.slice(1));
    subir = empateExacto ? Number(conservados.charAt(1)) % 2 === 1 : true;
  }

  let centavos = BigInt(entero) * 100n + BigInt(conservados);
  if (subir) centavos += 1n;

  const resultado = Number(centavos) / 100;
  return negativo ? -resultado : resultado;
}

/**
 * `max(a, b)` de Python. NO es `Math.max`.
 *
 * Python compara `b > a` y se queda con `a` si la comparación es False, así que
 * `max(nan, 0)` devuelve `nan` pero `max(0, nan)` devuelve `0`. JS propaga NaN
 * siempre. La diferencia importa de verdad: los meses anteriores a la
 * instalación tienen consumo vacío, y de esta asimetría depende que el saldo de
 * la cuenta corriente arranque en 0 en vez de quedar NaN para siempre.
 */
export function pyMax(a: number, b: number): number {
  return b > a ? b : a;
}

/** `min(a, b)` de Python. Misma asimetría con NaN que pyMax. */
export function pyMin(a: number, b: number): number {
  return b < a ? b : a;
}

/** Energía generada que el cliente consumió en el momento, sin pasar por la red. */
export function calcularAutoconsumo(generacion: number, exportacion: number): number {
  return pyMax(generacion - exportacion, 0);
}

/** Energía que igual hubo que comprarle a UTE. */
export function calcularImportacionRed(
  consumo: number,
  generacion: number,
  exportacion: number,
): number {
  return pyMax(consumo - calcularAutoconsumo(generacion, exportacion), 0);
}

export function calcularCobertura(consumo: number, autoconsumo: number): number {
  if (consumo <= 0) return 0;
  return round2Decimal1((autoconsumo / consumo) * 100);
}

/** `round(x, 1)` de Python — mismo criterio half-even que round2. */
export function round2Decimal1(x: number): number {
  return round2(x * 10) / 10;
}

/**
 * Costo de la energía en la tarifa simple, por tramos escalonados.
 *
 * QUIRK: `capacidadTramo = hasta - desde + 1`. Con los tramos reales
 * (0-100, 101-600, 601-∞) el primer tramo cubre 101 kWh y no 100. Se conserva
 * porque así se facturaron todos los reportes emitidos hasta hoy.
 */
export function calcularCostoEnergiaSimple(kwh: number, tramos: TramoEscalonado[]): number {
  let restante = kwh;
  let costo = 0;

  for (const tramo of tramos) {
    const capacidadTramo = tramo.hastaKwh - tramo.desdeKwh + 1;
    if (restante <= 0) break;

    const consumoEnTramo = pyMin(restante, capacidadTramo);
    costo += consumoEnTramo * tramo.precioKwh;
    restante -= consumoEnTramo;
  }

  return round2(costo);
}

export function calcularCostoEnergiaDoble(
  kwhTotal: number,
  pctPunta: number,
  precioPunta: number,
  precioFueraPunta: number,
): number {
  const kwhPunta = kwhTotal * pctPunta;
  const kwhFueraPunta = kwhTotal - kwhPunta;
  return round2(kwhPunta * precioPunta + kwhFueraPunta * precioFueraPunta);
}

export function calcularCostoEnergiaTriple(
  kwhTotal: number,
  pctPunta: number,
  pctLlano: number,
  pctValle: number,
  precioPunta: number,
  precioLlano: number,
  precioValle: number,
): number {
  return round2(
    kwhTotal * pctPunta * precioPunta +
      kwhTotal * pctLlano * precioLlano +
      kwhTotal * pctValle * precioValle,
  );
}

// Los créditos por exportación se valúan con lo exportado el mes ANTERIOR: UTE
// acredita con un mes de desfase.

export function calcularCreditoExportacionSimple(
  kwhExportadosMesAnterior: number,
  tramos: TramoEscalonado[],
): number {
  return calcularCostoEnergiaSimple(kwhExportadosMesAnterior, tramos);
}

/** Supuesto del original: toda la exportación ocurre fuera de punta. */
export function calcularCreditoExportacionDoble(
  kwhExportadosMesAnterior: number,
  precioFueraPunta: number,
): number {
  return round2(kwhExportadosMesAnterior * precioFueraPunta);
}

/** Supuesto del original: toda la exportación ocurre en llano. */
export function calcularCreditoExportacionTriple(
  kwhExportadosMesAnterior: number,
  precioLlano: number,
): number {
  return round2(kwhExportadosMesAnterior * precioLlano);
}

export function calcularFactura(params: {
  cargoFijo: number;
  cargoPotencia: number;
  cargoEnergia: number;
  creditoExportacion?: number;
  tasaIva?: number;
  tasaIrpf?: number;
}): Factura {
  const {
    cargoFijo,
    cargoPotencia,
    cargoEnergia,
    creditoExportacion = 0,
    tasaIva = 0.22,
    tasaIrpf = 0.12,
  } = params;

  // Solo potencia + energía gravan IVA (el cargo fijo no).
  const baseGravada = cargoPotencia + cargoEnergia;
  const iva = round2(baseGravada * tasaIva);

  // La energía vendida no grava IVA, pero sí IRPF.
  const irpf = round2(creditoExportacion * tasaIrpf);

  const totalBruto = cargoFijo + cargoPotencia + cargoEnergia + iva;
  let totalNeto = round2(totalBruto + irpf - creditoExportacion);

  let saldoAFavor = 0;
  if (totalNeto < 0) {
    saldoAFavor = round2(Math.abs(totalNeto));
    totalNeto = 0;
  }

  return {
    cargoFijo: round2(cargoFijo),
    cargoPotencia: round2(cargoPotencia),
    cargoEnergia: round2(cargoEnergia),
    baseGravada: round2(baseGravada),
    iva,
    creditoExportacion: round2(creditoExportacion),
    irpf,
    totalBruto: round2(totalBruto),
    totalNeto,
    saldoAFavor,
  };
}

/**
 * Cuenta corriente UTE: cuando la generación supera al consumo, el excedente
 * queda como saldo a favor y se descuenta de las facturas siguientes.
 * Es acumulativo, por eso la serie se recalcula entera y no mes a mes.
 */
export function aplicarSaldoCuentaCorriente(
  factura: Factura,
  saldoInicialRaw = 0,
): FacturaAjustada {
  const saldoInicial = round2(saldoInicialRaw);

  const totalNetoPrevioCc = round2(factura.totalNeto);
  const saldoGeneradoMes = round2(factura.saldoAFavor);
  const saldoAplicado = round2(pyMin(saldoInicial, pyMax(totalNetoPrevioCc, 0)));
  const totalNetoFinal = round2(pyMax(totalNetoPrevioCc - saldoAplicado, 0));
  const saldoFinal = round2(pyMax(saldoInicial - saldoAplicado + saldoGeneradoMes, 0));

  return {
    ...factura,
    totalNetoPrevioCc,
    saldoInicial,
    saldoAplicado,
    saldoGeneradoMes,
    saldoFinal,
    totalNeto: totalNetoFinal,
  };
}

/**
 * Descompone el ahorro en sus dos fuentes:
 *   - autoconsumo: energía que no hubo que comprar
 *   - venta: crédito por lo exportado, neto de IRPF
 */
export function calcularDesgloseBeneficio(
  facturaSin: Factura,
  facturaCon: Factura,
): DesgloseBeneficio {
  const ahorroAutoconsumo = round2(facturaSin.totalNeto - facturaCon.totalBruto);
  const ahorroVenta = round2(facturaCon.creditoExportacion - facturaCon.irpf);
  const ahorroTotal = round2(ahorroAutoconsumo + ahorroVenta);

  let pctAutoconsumo = 0;
  let pctVenta = 0;
  if (ahorroTotal > 0) {
    pctAutoconsumo = round2Decimal1((ahorroAutoconsumo / ahorroTotal) * 100);
    pctVenta = round2Decimal1((ahorroVenta / ahorroTotal) * 100);
  }

  return { ahorroAutoconsumo, ahorroVenta, ahorroTotal, pctAutoconsumo, pctVenta };
}

/** Cargo por potencia contratada del mes. */
export function calcularCargoPotencia(potenciaKw: number, cargos: CargosTarifa): number {
  return potenciaKw * cargos.cargoPotenciaKw;
}

/** Porcentaje con 1 decimal, 0 si el total no es positivo (helper `pct` del original). */
export function pct(parte: number, total: number): number {
  if (total <= 0) return 0;
  return round2Decimal1((parte / total) * 100);
}

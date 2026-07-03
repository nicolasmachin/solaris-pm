import { obtenerPrecioInversor } from "./inversorPricing.js";
import type { ProposalCalculated, ProposalData, ProposalDefaultsResolved } from "./types.js";

const IVA = 0.22;

// Factores estacionales de generación (SPEC §6.9). Suman 1.0.
const GENERACION_FACTORES = [
  0.105, 0.095, 0.092, 0.08, 0.07, 0.062, 0.066, 0.074, 0.082, 0.09, 0.092, 0.092,
];

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// Formatea una fecha ISO (date-only) sin corrimiento de zona horaria.
function formatFecha(iso: string): { fechaTextoLargo: string; mesYAnio: string } {
  const [y, m, d] = iso.slice(0, 10).split("-").map((p) => Number.parseInt(p, 10));
  const mesNombre = MESES_ES[(m ?? 1) - 1] ?? "";
  const mesCapitalizado = mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1);
  return {
    fechaTextoLargo: `${d} de ${mesNombre} de ${y}`,
    mesYAnio: `${mesCapitalizado} ${y}`,
  };
}

// Escalón de cuadrilla por cantidad de paneles (Excel CALCULADORA, celda U3 /
// función IFS). Representa la cantidad de operarios/jornadas que escalan de
// forma discreta con el tamaño del sistema. Función pura, testeable.
export function getCuadrillaEscalon(cantidadPaneles: number): number {
  if (cantidadPaneles <= 12) return 2;
  if (cantidadPaneles <= 18) return 3;
  if (cantidadPaneles <= 30) return 4;
  if (cantidadPaneles <= 50) return 5;
  if (cantidadPaneles <= 75) return 6;
  if (cantidadPaneles <= 100) return 7;
  return 8;
}

// Cuota de un préstamo francés (equivalente a PMT del Excel, con signo
// positivo). `tasaMensual` es la tasa por período; si es 0, es capital/cuotas.
export function pmt(principal: number, tasaMensual: number, cuotas: number): number {
  if (tasaMensual === 0) return principal / cuotas;
  const factor = Math.pow(1 + tasaMensual, -cuotas);
  return (principal * tasaMensual) / (1 - factor);
}

// Cálculo puro del negocio. No hace I/O; recibe todo por parámetro. Fórmulas
// reconstruidas de la hoja CALCULADORA del Excel (validadas contra el caso
// Jose Gonzalez). Ver docs/features/proposals-v2/SPEC.md §6.
export function calculate(
  data: ProposalData,
  defaults: ProposalDefaultsResolved,
): ProposalCalculated {
  const dolar = data.cotizacion.cotizacionDolar;
  const { cantidadPaneles, potenciaPanelW, potenciaInversorKw } = data.sistema;
  const suministro = data.factura.suministro;

  // ── 1. Helpers básicos ──
  const potenciaTotalKwp = (cantidadPaneles * potenciaPanelW) / 1000;
  const potenciaTotalW = potenciaTotalKwp * 1000;
  const energiaMensualKwh = potenciaTotalKwp * 900;
  const energiaAnualKwh = potenciaTotalKwp * 1479;
  const metrosCuadradosPaneles = cantidadPaneles * 3;

  // ── 2. Costos en USD sin IVA ──
  const precioElectrica =
    suministro === "monofásico"
      ? defaults.precioElectricaMonoUsdSinIva
      : defaults.precioElectricaTriUsdSinIva;
  const precioMeter =
    suministro === "monofásico" ? defaults.precioMeterMonoUsd : defaults.precioMeterTriUsd;
  const precioInversor = obtenerPrecioInversor(
    suministro,
    potenciaInversorKw,
    cantidadPaneles,
    defaults,
  );

  const costoEquipamientoSinIva =
    defaults.precioPanelUsdSinIva * cantidadPaneles +
    defaults.precioEstructuraUsdSinIva * cantidadPaneles +
    precioElectrica +
    precioInversor +
    precioMeter;
  const costoEquipamientoConIva = costoEquipamientoSinIva * (1 + IVA);

  const costoFijoAsignadoUsdSinIva =
    defaults.costoFijoTotalPesosMes / dolar / defaults.negociosPromedioMes;
  // Los costos fijos (sueldos / BPS / IRAE) son mayormente exentos de IVA, así
  // que con IVA ≈ sin IVA. (Tenemos un único total en el seed.)
  const costoFijoAsignadoUsdConIva = costoFijoAsignadoUsdSinIva;

  const costoVariablePesos =
    defaults.costoFletePorKm * data.cotizacion.distanciaInstalacionKm +
    defaults.costoNaftaTotalPesos +
    defaults.costoAlojamientoPesos +
    defaults.costoViaticosPesos +
    defaults.costoOtrosPesos;
  const costoVariableUsdSinIva = costoVariablePesos / dolar;
  const costoVariableUsdConIva = costoVariableUsdSinIva * (1 + IVA);

  const costoTotalSinIva =
    costoEquipamientoSinIva + costoFijoAsignadoUsdSinIva + costoVariableUsdSinIva;
  const costoTotalConIva =
    costoEquipamientoConIva + costoFijoAsignadoUsdConIva + costoVariableUsdConIva;

  // ── 3. Mano de obra (modelo Excel J4: cuadrilla × horas × tarifas/hora) ──
  // (tarifaElec + tarifaCapataz + tarifaCatD) [$/h] × horas fijas × cuadrilla,
  // donde la cuadrilla escala por cantidad de paneles (escalón discreto). No
  // escala por kWp. Resultado en pesos → USD dividiendo por el dólar.
  const cuadrilla = getCuadrillaEscalon(cantidadPaneles);
  const manoDeObraPesos =
    (defaults.tarifaCatAPorHora + defaults.tarifaCatCPorHora + defaults.tarifaCatDPorHora) *
    defaults.horasManoDeObraPorInstalacion *
    cuadrilla;
  const manoDeObraUsdSinIva = manoDeObraPesos / dolar;

  // ── 4. Pricing ──
  const markupUsdSinIva =
    (costoTotalSinIva + manoDeObraUsdSinIva) * data.cotizacion.markupPorcentaje;
  const baseComision = costoTotalSinIva + manoDeObraUsdSinIva + markupUsdSinIva;
  const comisionVentasUsdSinIva = baseComision * defaults.comisionVendedorPorcentaje;
  const comisionBbvaUsdSinIva = baseComision * defaults.comisionBbvaPorcentaje;
  const subtotalSinIva =
    costoTotalSinIva +
    manoDeObraUsdSinIva +
    markupUsdSinIva +
    comisionVentasUsdSinIva +
    comisionBbvaUsdSinIva;
  const iva = subtotalSinIva * IVA;
  const totalConIva = subtotalSinIva * (1 + IVA);
  const usdPorWatt = totalConIva / potenciaTotalW;

  // ── 5. Ítems adicionales ──
  const itemsAdicionalesTotalSinIva = data.itemsAdicionales.reduce(
    (sum, it) => sum + it.precioSinIvaUsd,
    0,
  );
  const itemsAdicionalesIva = itemsAdicionalesTotalSinIva * IVA;
  const itemsAdicionalesTotalConIva = itemsAdicionalesTotalSinIva * (1 + IVA);
  const totalFinalConIva = totalConIva + itemsAdicionalesTotalConIva;

  // ── 6. Económico para el cliente ──
  // Factor de ahorro por tarifa (Excel J16). Discrimina las tres tarifas vía
  // defaults editables; hoy Doble = Triple = 0.88 (Triple es placeholder).
  const factoresPorTarifa: Record<ProposalData["factura"]["tarifa"], number> = {
    Simple: defaults.factorAhorroSimple,
    Doble: defaults.factorAhorroDoble,
    Triple: defaults.factorAhorroTriple,
  };
  const factorAhorro = factoresPorTarifa[data.factura.tarifa];
  const ahorroMensualPesos = potenciaTotalW * factorAhorro;
  const ahorroMensualUsd = ahorroMensualPesos / dolar;
  const ahorroAnualUsd = ahorroMensualUsd * 12;
  const pagaNuevoUtePesos = data.factura.pagaMensualPesos - ahorroMensualPesos;
  const porcentajeAhorro = ahorroMensualPesos / data.factura.pagaMensualPesos;
  const tir = ahorroAnualUsd / totalConIva;
  const priMeses = totalConIva / ahorroMensualUsd;
  const priAnios = priMeses / 12;

  // ── 7. Financiación BBVA (modelo Excel "Financiacion BBVA": UI + PMT) ──
  // El monto a financiar se expresa en Unidades Indexadas, se le suma un % de
  // gastos administrativos sobre el capital, se calcula la cuota con PMT y se
  // aplica un factor por plazo; el resultado se vuelve a pesos con el valor UI.
  const capitalLiquidoUI = (totalFinalConIva * dolar) / defaults.cotizacionUI;
  const cuotaBbvaPesos = (cuotas: number, gastosAdminCapital: number, tasaAnual: number, factorCuota: number) => {
    const capitalTotalUI = capitalLiquidoUI * (1 + gastosAdminCapital);
    const cuotaBaseUI = pmt(capitalTotalUI, tasaAnual / 12, cuotas);
    return cuotaBaseUI * factorCuota * defaults.cotizacionUI;
  };
  const cuota24m = cuotaBbvaPesos(24, defaults.bbva24mGastosAdminCapital, defaults.bbva24mInteresUI, defaults.bbva24mFactorCuota);
  const cuota36m = cuotaBbvaPesos(36, defaults.bbva36mGastosAdminCapital, defaults.bbva36mInteresUI, defaults.bbva36mFactorCuota);
  const cuota60m = cuotaBbvaPesos(60, defaults.bbva60mGastosAdminCapital, defaults.bbva60mInteresUI, defaults.bbva60mFactorCuota);

  // ── 8. Flujo de caja del negocio (USD) ──
  const cobroAdelantoCliente = totalConIva / 2;
  const cobroSaldoCliente = totalConIva / 2;
  const pagoAlProveedor = -costoTotalConIva;
  const pagoManoDeObra = -manoDeObraUsdSinIva;
  const pagoIva = -iva;
  const devolucionIva = costoTotalConIva - costoTotalSinIva;
  const pagoVendedor = -comisionVentasUsdSinIva;
  const pagoBbva = -comisionBbvaUsdSinIva;
  const gananciaFinal =
    cobroAdelantoCliente +
    cobroSaldoCliente +
    pagoAlProveedor +
    pagoManoDeObra +
    pagoIva +
    devolucionIva +
    pagoVendedor +
    pagoBbva;
  const margen = gananciaFinal / subtotalSinIva;

  // ── 9. Gráficos ──
  const generacionMensualKwh = GENERACION_FACTORES.map((f) => Math.round(energiaAnualKwh * f));
  const retornoInversion16Anios: number[] = [];
  for (let anio = 0; anio <= 15; anio++) {
    retornoInversion16Anios.push(Math.round(-totalFinalConIva + anio * ahorroAnualUsd));
  }

  // ── 10. Formateados ──
  const { fechaTextoLargo, mesYAnio } = formatFecha(data.fecha);

  return {
    potenciaTotalKwp,
    energiaMensualKwh,
    energiaAnualKwh,
    metrosCuadradosPaneles,

    costoEquipamientoSinIva,
    costoEquipamientoConIva,
    costoFijoAsignadoUsdSinIva,
    costoFijoAsignadoUsdConIva,
    costoVariableUsdSinIva,
    costoVariableUsdConIva,
    costoTotalSinIva,
    costoTotalConIva,

    manoDeObraUsdSinIva,
    markupUsdSinIva,
    comisionVentasUsdSinIva,
    comisionBbvaUsdSinIva,
    subtotalSinIva,
    iva,
    totalConIva,
    usdPorWatt,
    margen,

    itemsAdicionalesTotalSinIva,
    itemsAdicionalesIva,
    itemsAdicionalesTotalConIva,
    totalFinalConIva,

    ahorroMensualPesos,
    ahorroMensualUsd,
    ahorroAnualUsd,
    pagaNuevoUtePesos,
    porcentajeAhorro,
    tir,
    priMeses,
    priAnios,

    cuota24m,
    cuota36m,
    cuota60m,

    cobroAdelantoCliente,
    pagoAlProveedor,
    cobroSaldoCliente,
    pagoManoDeObra,
    pagoIva,
    devolucionIva,
    pagoVendedor,
    pagoBbva,
    gananciaFinal,

    generacionMensualKwh,
    retornoInversion16Anios,

    fechaTextoLargo,
    mesYAnio,
  };
}

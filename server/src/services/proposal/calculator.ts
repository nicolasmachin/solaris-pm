import { obtenerPrecioInversor } from "./inversorPricing.js";
import type { ProposalCalculated, ProposalData, ProposalDefaultsResolved } from "./types.js";

const IVA = 0.22;

// Factores estacionales de generación (SPEC §6.9). Ahora editables desde el
// singleton ProposalDefaults (defaults.factoresGeneracionMensual).

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

// Multiplicador del costo de instalación eléctrica según cantidad de paneles.
// Las instalaciones más grandes requieren más trabajo/material eléctrico, así que
// el costo base (mono/tri) se escala por tramos. Cota superior INCLUSIVA (el
// redondo cierra el tramo, <=); el 7º tramo (101+) usa el último factor. La tabla
// de multiplicadores es editable desde Admin (defaults.multiplicadorElectricaEscalones,
// 7 valores). Función pura, testeable.
export const TRAMOS_ELECTRICA_MAX_PANELES = [10, 20, 30, 40, 50, 100] as const;

export function getMultiplicadorElectrica(cantidadPaneles: number, multiplicadores: number[]): number {
  for (let i = 0; i < TRAMOS_ELECTRICA_MAX_PANELES.length; i++) {
    if (cantidadPaneles <= TRAMOS_ELECTRICA_MAX_PANELES[i]) return multiplicadores[i] ?? 1;
  }
  return multiplicadores[multiplicadores.length - 1] ?? 1;
}

// Interpreta el markup aceptando ambas unidades (compat con snapshots viejos):
// decimal (≤1, ej. 0.2 = 20%) o porcentaje (>1, ej. 20 = 20%). Devuelve SIEMPRE
// el multiplicador decimal. Los drafts nuevos guardan porcentaje (20); los
// snapshots publicados antes de la migración tienen decimal (0.2) y siguen
// dando el mismo resultado. Ver FASE_G_SPEC.md §4.1.3.
export function interpretarMarkup(valor: number): number {
  return valor > 1 ? valor / 100 : valor;
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
  const energiaAnualKwh = potenciaTotalKwp * defaults.rendimientoAnualKwhPorKwp;
  const metrosCuadradosPaneles = cantidadPaneles * defaults.metrosCuadradosPorPanel;

  // ── 2. Costos en USD sin IVA ──
  const precioElectricaBase =
    suministro === "monofásico"
      ? defaults.precioElectricaMonoUsdSinIva
      : defaults.precioElectricaTriUsdSinIva;
  const precioElectrica =
    precioElectricaBase * getMultiplicadorElectrica(cantidadPaneles, defaults.multiplicadorElectricaEscalones);
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
  const esEmpresa = data.variante === "EMPRESA";
  const baseCostoMo = costoTotalSinIva + manoDeObraUsdSinIva;
  const markupPct = interpretarMarkup(data.cotizacion.markupPorcentaje);
  const markupUsdSinIva = baseCostoMo * markupPct;
  const baseComision = baseCostoMo + markupUsdSinIva;

  // Comisión del asesor. En residencial es el porcentaje plano de siempre. En
  // las propuestas a empresas se le suma una tajada del "markup excedente": lo
  // que el asesor consiguió por encima del markup de referencia. Sin eso, quien
  // negocia el precio es casi indiferente al resultado — subir el markup 10
  // puntos le mueve la comisión menos de un 10%, mientras la ganancia de la
  // empresa (que es exactamente markupUsdSinIva) sube a la par del markup.
  //
  // La comisión sigue siendo un costo dentro del precio, no un descuento sobre
  // la ganancia: la identidad gananciaFinal ≡ markupUsdSinIva del flujo de caja
  // (§8) se mantiene intacta para cualquier comisión.
  const markupExcedenteUsdSinIva = esEmpresa
    ? Math.max(0, markupPct - defaults.b2bMarkupReferenciaPorcentaje / 100) * baseCostoMo
    : 0;
  const comisionVentasBaseUsdSinIva =
    baseComision *
    (esEmpresa ? defaults.b2bComisionBasePorcentaje : defaults.comisionVendedorPorcentaje);
  const comisionVentasExcedenteUsdSinIva = esEmpresa
    ? markupExcedenteUsdSinIva * defaults.b2bComisionExcedentePorcentaje
    : 0;
  const comisionVentasUsdSinIva =
    comisionVentasBaseUsdSinIva + comisionVentasExcedenteUsdSinIva;
  const comisionVentasPctEfectivo =
    baseComision > 0 ? comisionVentasUsdSinIva / baseComision : 0;
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
  const generacionMensualKwh = defaults.factoresGeneracionMensual.map((f) =>
    Math.round(energiaAnualKwh * f),
  );
  const retornoInversion16Anios: number[] = [];
  for (let anio = 0; anio <= 15; anio++) {
    retornoInversion16Anios.push(Math.round(-totalFinalConIva + anio * ahorroAnualUsd));
  }

  // ── 10. Formateados ──
  const { fechaTextoLargo, mesYAnio } = formatFecha(data.fecha);

  return {
    potenciaTotalKwp,
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
    markupExcedenteUsdSinIva,
    comisionVentasBaseUsdSinIva,
    comisionVentasExcedenteUsdSinIva,
    comisionVentasUsdSinIva,
    comisionVentasPctEfectivo,
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

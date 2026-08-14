// Metadata de los intermedios que expone la calculadora (`ProposalCalculated`),
// para el drawer de debug (solo admin). Única fuente de verdad de labels /
// descripciones / unidades / orden.
//
// El `satisfies Record<Exclude<keyof ProposalCalculated, ...strings>, ...>`
// garantiza EN COMPILE-TIME que todo intermedio numérico o array tenga entrada:
// si se agrega una clave nueva a ProposalCalculated y no se agrega acá (ni se
// excluye), el proyecto no compila. Los dos campos string (`fechaTextoLargo`,
// `mesYAnio`) se excluyen a propósito: son formateados, no intermedios de
// negocio.

import type { ProposalCalculated } from "./types.js";

// Enum cerrado de unidades. Agregar una nueva obliga a justificarla acá.
export type CalcUnidad = "USD" | "pesos" | "UI" | "%" | "kWh" | "unidades" | "";

export interface CalcLabelMeta {
  label: string;
  descripcion: string;
  unidad: CalcUnidad;
  orden: number;
}

// Claves de ProposalCalculated que NO se muestran en el debug (strings formateados).
type ExcludedKeys = "fechaTextoLargo" | "mesYAnio";
type CalcKey = Exclude<keyof ProposalCalculated, ExcludedKeys>;

export const calculatorLabels = {
  // ── Sistema y generación ──
  potenciaTotalKwp: {
    label: "Potencia total (kWp)",
    descripcion: "Cantidad de paneles × potencia por panel / 1000.",
    unidad: "",
    orden: 10,
  },
  energiaAnualKwh: {
    label: "Energía anual",
    descripcion: "Estimación de generación por año (potencia × 1479).",
    unidad: "kWh",
    orden: 30,
  },
  metrosCuadradosPaneles: {
    label: "Metros cuadrados de paneles (m²)",
    descripcion: "Superficie ocupada por los paneles (cantidad × 3 m²).",
    unidad: "",
    orden: 40,
  },
  generacionMensualKwh: {
    label: "Generación mensual (Ene–Dic)",
    descripcion: "Energía anual repartida por mes según factores estacionales.",
    unidad: "kWh",
    orden: 50,
  },

  // ── Costos ──
  costoEquipamientoSinIva: {
    label: "Costo equipamiento",
    descripcion: "Suma de paneles, estructuras, eléctrica, inversor y meter (sin IVA).",
    unidad: "USD",
    orden: 100,
  },
  costoEquipamientoConIva: {
    label: "Costo equipamiento (con IVA)",
    descripcion: "Costo de equipamiento con IVA incluido (× 1.22).",
    unidad: "USD",
    orden: 110,
  },
  costoFijoAsignadoUsdSinIva: {
    label: "Costo fijo asignado",
    descripcion: "Parte de los costos fijos del negocio asignada a este proyecto.",
    unidad: "USD",
    orden: 120,
  },
  costoFijoAsignadoUsdConIva: {
    label: "Costo fijo asignado (con IVA)",
    descripcion: "Costo fijo asignado con IVA (los fijos son mayormente exentos: ≈ sin IVA).",
    unidad: "USD",
    orden: 130,
  },
  costoVariableUsdSinIva: {
    label: "Costo variable",
    descripcion: "Flete, nafta, alojamiento, viáticos y otros de la instalación (sin IVA).",
    unidad: "USD",
    orden: 140,
  },
  costoVariableUsdConIva: {
    label: "Costo variable (con IVA)",
    descripcion: "Costos variables con IVA incluido (× 1.22).",
    unidad: "USD",
    orden: 150,
  },
  costoTotalSinIva: {
    label: "Costo total",
    descripcion: "Equipamiento + costos fijos + costos variables (sin IVA).",
    unidad: "USD",
    orden: 160,
  },
  costoTotalConIva: {
    label: "Costo total (con IVA)",
    descripcion: "Costo total con IVA incluido.",
    unidad: "USD",
    orden: 170,
  },
  manoDeObraUsdSinIva: {
    label: "Mano de obra",
    descripcion: "(Electricista + capataz + CAT D) × horas × escalón de cuadrilla / dólar.",
    unidad: "USD",
    orden: 180,
  },

  // ── Pricing ──
  markupUsdSinIva: {
    label: "Markup",
    descripcion: "Margen sobre (costo total + mano de obra), según % de la cotización.",
    unidad: "USD",
    orden: 200,
  },
  markupExcedenteUsdSinIva: {
    label: "Markup excedente (B2B)",
    descripcion:
      "Markup conseguido por encima de la referencia B2B, en USD. Siempre 0 en propuestas residenciales.",
    unidad: "USD",
    orden: 202,
  },
  comisionVentasBaseUsdSinIva: {
    label: "Comisión ventas — base",
    descripcion:
      "Parte porcentual de la comisión, sobre (costo + mano de obra + markup). En B2B usa el % base propio.",
    unidad: "USD",
    orden: 204,
  },
  comisionVentasExcedenteUsdSinIva: {
    label: "Comisión ventas — excedente (B2B)",
    descripcion: "Tajada del markup excedente que se lleva el asesor. Solo en propuestas a empresas.",
    unidad: "USD",
    orden: 206,
  },
  comisionVentasUsdSinIva: {
    label: "Comisión ventas",
    descripcion: "Comisión del vendedor: la parte base más, en B2B, la tajada del markup excedente.",
    unidad: "USD",
    orden: 210,
  },
  comisionVentasPctEfectivo: {
    label: "Comisión ventas — % efectivo",
    descripcion:
      "Qué porcentaje de la base terminó representando la comisión. Es el que se congela al ganar el lead.",
    unidad: "%",
    orden: 212,
  },
  comisionBbvaUsdSinIva: {
    label: "Comisión BBVA",
    descripcion: "Comisión del banco sobre la base (costo + mano de obra + markup).",
    unidad: "USD",
    orden: 220,
  },
  subtotalSinIva: {
    label: "Subtotal sin IVA",
    descripcion: "Costo total + mano de obra + markup + comisiones.",
    unidad: "USD",
    orden: 230,
  },
  iva: {
    label: "IVA",
    descripcion: "IVA sobre el subtotal (22%).",
    unidad: "USD",
    orden: 240,
  },
  totalConIva: {
    label: "Total con IVA",
    descripcion: "Subtotal × 1.22.",
    unidad: "USD",
    orden: 250,
  },
  usdPorWatt: {
    label: "USD por Watt",
    descripcion: "Total con IVA dividido por la potencia total en watts.",
    unidad: "USD",
    orden: 260,
  },
  margen: {
    label: "Margen del negocio",
    descripcion: "Ganancia final sobre el subtotal sin IVA.",
    unidad: "%",
    orden: 270,
  },

  // ── Ítems adicionales ──
  itemsAdicionalesTotalSinIva: {
    label: "Ítems adicionales",
    descripcion: "Suma de los ítems adicionales cargados (sin IVA).",
    unidad: "USD",
    orden: 300,
  },
  itemsAdicionalesIva: {
    label: "IVA de ítems adicionales",
    descripcion: "IVA sobre los ítems adicionales (22%).",
    unidad: "USD",
    orden: 310,
  },
  itemsAdicionalesTotalConIva: {
    label: "Ítems adicionales (con IVA)",
    descripcion: "Ítems adicionales con IVA incluido.",
    unidad: "USD",
    orden: 320,
  },
  totalFinalConIva: {
    label: "Total final con IVA",
    descripcion: "Total con IVA + ítems adicionales con IVA.",
    unidad: "USD",
    orden: 330,
  },

  // ── Económico para el cliente ──
  ahorroMensualPesos: {
    label: "Ahorro mensual",
    descripcion: "Ahorro estimado por mes en la factura (según tarifa).",
    unidad: "pesos",
    orden: 400,
  },
  ahorroMensualUsd: {
    label: "Ahorro mensual (USD)",
    descripcion: "Ahorro mensual convertido a dólares.",
    unidad: "USD",
    orden: 410,
  },
  ahorroAnualUsd: {
    label: "Ahorro anual (USD)",
    descripcion: "Ahorro mensual en dólares × 12.",
    unidad: "USD",
    orden: 420,
  },
  pagaNuevoUtePesos: {
    label: "Nueva factura UTE",
    descripcion: "Lo que pagaría de UTE después de instalar (paga actual − ahorro).",
    unidad: "pesos",
    orden: 430,
  },
  porcentajeAhorro: {
    label: "Porcentaje de ahorro",
    descripcion: "Ahorro mensual sobre lo que paga hoy de UTE.",
    unidad: "%",
    orden: 440,
  },
  tir: {
    label: "TIR",
    descripcion: "Tasa interna de retorno (ahorro anual / total con IVA).",
    unidad: "%",
    orden: 450,
  },
  priMeses: {
    label: "PRI (meses)",
    descripcion: "Período de recupero de la inversión, en meses.",
    unidad: "",
    orden: 460,
  },
  priAnios: {
    label: "PRI (años)",
    descripcion: "Período de recupero de la inversión, en años.",
    unidad: "",
    orden: 470,
  },

  // ── Financiación BBVA ──
  cuota24m: {
    label: "Cuota 24 meses",
    descripcion: "Cuota en pesos: capital en UI + gastos admin, PMT y factor de cuota.",
    unidad: "pesos",
    orden: 500,
  },
  cuota36m: {
    label: "Cuota 36 meses",
    descripcion: "Cuota en pesos: capital en UI + gastos admin, PMT y factor de cuota.",
    unidad: "pesos",
    orden: 510,
  },
  cuota60m: {
    label: "Cuota 60 meses",
    descripcion: "Cuota en pesos: capital en UI + gastos admin, PMT y factor de cuota (5% anual).",
    unidad: "pesos",
    orden: 520,
  },

  // ── Flujo de caja del negocio ──
  cobroAdelantoCliente: {
    label: "Cobro adelanto cliente",
    descripcion: "50% del total con IVA que cobra al inicio.",
    unidad: "USD",
    orden: 600,
  },
  cobroSaldoCliente: {
    label: "Cobro saldo cliente",
    descripcion: "50% restante del total con IVA.",
    unidad: "USD",
    orden: 610,
  },
  pagoAlProveedor: {
    label: "Pago al proveedor",
    descripcion: "Egreso por el costo total del equipamiento (con IVA).",
    unidad: "USD",
    orden: 620,
  },
  pagoManoDeObra: {
    label: "Pago mano de obra",
    descripcion: "Egreso por la mano de obra.",
    unidad: "USD",
    orden: 630,
  },
  pagoIva: {
    label: "Pago de IVA",
    descripcion: "IVA que se paga al fisco.",
    unidad: "USD",
    orden: 640,
  },
  devolucionIva: {
    label: "Devolución de IVA",
    descripcion: "IVA recuperado sobre los costos (crédito fiscal).",
    unidad: "USD",
    orden: 650,
  },
  pagoVendedor: {
    label: "Pago vendedor",
    descripcion: "Egreso por la comisión del vendedor.",
    unidad: "USD",
    orden: 660,
  },
  pagoBbva: {
    label: "Pago BBVA",
    descripcion: "Egreso por la comisión del banco.",
    unidad: "USD",
    orden: 670,
  },
  gananciaFinal: {
    label: "Ganancia final",
    descripcion: "Resultado neto del negocio tras cobros, pagos y devolución de IVA.",
    unidad: "USD",
    orden: 680,
  },

  // ── Retorno de inversión ──
  retornoInversion16Anios: {
    label: "Retorno de inversión (año 0–15)",
    descripcion: "Flujo acumulado por año: −inversión + ahorro anual acumulado.",
    unidad: "USD",
    orden: 700,
  },
} as const satisfies Record<CalcKey, CalcLabelMeta>;

// Fila ya armada para el drawer: metadata + valor. `valor` es número o array de
// números (generación mensual, retorno 16 años).
export interface CalcDebugRow extends CalcLabelMeta {
  key: string;
  valor: number | number[];
}

// Arma las filas del debug a partir del objeto calculado, ordenadas por `orden`.
export function buildCalcDebugRows(calc: ProposalCalculated): CalcDebugRow[] {
  return (Object.keys(calculatorLabels) as CalcKey[])
    .map((key) => ({ key, ...calculatorLabels[key], valor: calc[key] as number | number[] }))
    .sort((a, b) => a.orden - b.orden);
}

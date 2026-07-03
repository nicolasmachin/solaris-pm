// Tipos del calculator del generador de propuestas v2.
// Ver docs/features/proposals-v2/SPEC.md.

// Mirror de draftDataPublishSchema (schemas/draft.schema.ts) — mantener en
// sincronía. dirigidoA opcional; tipoMontaje/plazoEntrega/notas se agregaron en
// Fase F.
export interface ProposalData {
  cliente: { nombre: string; dirigidoA?: string; ciudad: string };
  factura: {
    pagaMensualPesos: number;
    tarifa: "Simple" | "Doble" | "Triple";
    suministro: "monofásico" | "trifásico";
    potenciaContratadaKw: number;
  };
  techo: { descripcion: string; tamanoM2: number };
  cotizacion: {
    distanciaInstalacionKm: number;
    cotizacionDolar: number;
    markupPorcentaje: number;
    plazoEntrega: string;
  };
  sistema: {
    cantidadPaneles: number;
    potenciaPanelW: number;
    marcaPaneles: string;
    potenciaInversorKw: number;
    marcaInversor: string;
    tipoMontaje: string;
  };
  fecha: string; // ISO date
  notas?: string;
  itemsAdicionales: ProposalItemAdicional[];
}

export interface ProposalItemAdicional {
  id: string;
  nombre: string;
  descripcion: string;
  precioSinIvaUsd: number;
  potenciaW?: number;
}

// ─── Resultado del cálculo (mirror del JSON `calculated`) ───────────────────
export interface ProposalCalculated {
  // Helpers básicos
  potenciaTotalKwp: number;
  energiaMensualKwh: number;
  energiaAnualKwh: number;
  metrosCuadradosPaneles: number;

  // Costos
  costoEquipamientoSinIva: number;
  costoEquipamientoConIva: number;
  costoFijoAsignadoUsdSinIva: number;
  costoFijoAsignadoUsdConIva: number;
  costoVariableUsdSinIva: number;
  costoVariableUsdConIva: number;
  costoTotalSinIva: number;
  costoTotalConIva: number;

  // Pricing
  manoDeObraUsdSinIva: number;
  markupUsdSinIva: number;
  comisionVentasUsdSinIva: number;
  comisionBbvaUsdSinIva: number;
  subtotalSinIva: number;
  iva: number;
  totalConIva: number;
  usdPorWatt: number;
  margen: number;

  // Ítems adicionales
  itemsAdicionalesTotalSinIva: number;
  itemsAdicionalesIva: number;
  itemsAdicionalesTotalConIva: number;
  totalFinalConIva: number; // base + adicionales

  // Económico para el cliente
  ahorroMensualPesos: number;
  ahorroMensualUsd: number;
  ahorroAnualUsd: number;
  pagaNuevoUtePesos: number;
  porcentajeAhorro: number;
  tir: number;
  priMeses: number;
  priAnios: number;

  // Financiación BBVA (sobre totalFinalConIva)
  cuota24m: number;
  cuota36m: number;
  cuota60m: number;

  // Flujo de caja del negocio (siempre calculado; gating en el endpoint)
  cobroAdelantoCliente: number;
  pagoAlProveedor: number;
  cobroSaldoCliente: number;
  pagoManoDeObra: number;
  pagoIva: number;
  devolucionIva: number;
  pagoVendedor: number;
  pagoBbva: number;
  gananciaFinal: number;

  // Gráficos
  generacionMensualKwh: number[]; // 12 valores (Ene..Dic)
  retornoInversion16Anios: number[]; // 16 valores (año 0..15)

  // Formateados
  fechaTextoLargo: string; // "19 de junio de 2026"
  mesYAnio: string; // "Junio 2026"
}

// ─── Defaults resueltos (sin los wrappers {value, asesorCanOverride}) ───────
export interface ProposalDefaultsResolved {
  // Precios USD sin IVA
  precioPanelUsdSinIva: number;
  precioEstructuraUsdSinIva: number;
  precioElectricaMonoUsdSinIva: number;
  precioElectricaTriUsdSinIva: number;
  precioInversorMonoSub7Usd: number;
  precioInversorMonoSup7Usd: number;
  precioInversorTriSub11Usd: number;
  precioInversorTri12Usd: number;
  precioInversorTri21Usd: number;
  precioInversorTri31Usd: number;
  precioInversorTri51Usd: number;
  precioInversorTriMas: number;
  precioMeterMonoUsd: number;
  precioMeterTriUsd: number;

  // Costos fijos en pesos
  costoFijoTotalPesosMes: number;
  negociosPromedioMes: number;

  // Costos variables en pesos
  costoFletePorKm: number;
  costoNaftaTotalPesos: number;
  costoAlojamientoPesos: number;
  costoViaticosPesos: number;
  costoOtrosPesos: number;

  // Mano de obra (modelo Excel: (elec+capataz+catD) × horas × cuadrilla / dólar)
  tarifaCatAPorHora: number; // Electricista ($/h)
  tarifaCatCPorHora: number; // Capataz ($/h)
  tarifaCatDPorHora: number; // CAT D ($/h)
  horasManoDeObraPorInstalacion: number;

  // Comisiones
  comisionVendedorPorcentaje: number;
  comisionBbvaPorcentaje: number;

  // Factor de ahorro por tarifa (potenciaTotalW × factor = ahorro mensual $)
  factorAhorroSimple: number;
  factorAhorroDoble: number;
  factorAhorroTriple: number;

  // Financiación BBVA (modelo UI + PMT)
  bbva24mInteresUI: number; // tasa anual nominal PMT
  bbva36mInteresUI: number;
  bbva60mInteresUI: number;
  cotizacionUI: number; // valor de la Unidad Indexada
  bbva24mGastosAdminCapital: number; // % sobre capital
  bbva36mGastosAdminCapital: number;
  bbva60mGastosAdminCapital: number;
  bbva24mFactorCuota: number; // factor sobre la cuota PMT
  bbva36mFactorCuota: number;
  bbva60mFactorCuota: number;
}

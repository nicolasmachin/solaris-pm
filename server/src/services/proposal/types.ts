// Tipos del calculator del generador de propuestas v2.
// Ver docs/features/proposals-v2/SPEC.md.

// Mirror de draftDataPublishSchema (schemas/draft.schema.ts) — mantener en
// sincronía. dirigidoA opcional; tipoMontaje/plazoEntrega/notas se agregaron en
// Fase F.
export type ProposalVariante = "RESIDENCIAL" | "EMPRESA";

export interface ProposalData {
  // Qué propuesta es. Opcional a propósito: los snapshots publicados antes de
  // la variante B2B no la traen y tienen que seguir regenerándose como
  // residenciales (el schema Zod inyecta el default al parsearlos).
  variante?: ProposalVariante;
  cliente: { nombre: string; dirigidoA?: string; ciudad: string };
  // Datos fiscales del cliente empresa. Obligatorios al publicar una propuesta
  // EMPRESA (lo valida draftDataPublishSchema), ausentes en las residenciales.
  empresa?: {
    razonSocial: string;
    rut: string;
    contactoNombre?: string;
    contactoCargo?: string;
  };
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
  // Markup por encima de la referencia B2B, en USD. Siempre 0 en residencial.
  markupExcedenteUsdSinIva: number;
  // Desglose de la comisión del asesor: la parte porcentual de siempre y, solo
  // en B2B, la tajada del markup excedente. Su suma es comisionVentasUsdSinIva.
  comisionVentasBaseUsdSinIva: number;
  comisionVentasExcedenteUsdSinIva: number;
  comisionVentasUsdSinIva: number;
  // % que representa la comisión sobre su base, como fracción. En residencial
  // coincide con defaults.comisionVendedorPorcentaje; en B2B sube con el markup.
  // Es el que se congela en Commission.porcentaje al ganar el lead.
  comisionVentasPctEfectivo: number;
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
  // Multiplicador del costo de instalación eléctrica por tramo de cantidad de
  // paneles (7 valores: ≤10, ≤20, ≤30, ≤40, ≤50, ≤100, 101+). Editable en Admin.
  multiplicadorElectricaEscalones: number[];
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

  // Generación / dimensionamiento (editables desde Admin)
  rendimientoAnualKwhPorKwp: number; // kWh generados al año por kWp (Uruguay ≈ 1479)
  metrosCuadradosPorPanel: number; // m² que ocupa cada panel (≈ 3)
  factoresGeneracionMensual: number[]; // 12 factores estacionales (Ene→Dic), suman 1.0

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

  // Comisión variable de las propuestas a empresas (grupo `b2b` del singleton,
  // aplanado acá). El asesor cobra la comisión base de siempre más una tajada
  // del markup que consiga por encima de la referencia. Solo se usan cuando
  // data.variante === "EMPRESA".
  //
  // OJO con las unidades, que son las del resto del archivo y no coinciden
  // entre sí: la referencia va en PORCENTAJE (20 = 20%, como markupPorcentaje)
  // y las dos comisiones en FRACCIÓN (0.04 = 4%, como comisionVendedorPorcentaje).
  b2bMarkupReferenciaPorcentaje: number;
  b2bComisionBasePorcentaje: number;
  b2bComisionExcedentePorcentaje: number;

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

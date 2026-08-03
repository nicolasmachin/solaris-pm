// View-model del PDF del reporte fotovoltaico.
//
// Es plano y ya preformateado: todos los importes vienen como strings con el
// formato ES (miles con punto, decimales con coma), igual que el sistema Python
// pasaba a `template.render`. El template no formatea números, sólo antepone
// `$`, `USD ` o unidades. Los pocos campos numéricos (los width de las barras)
// se usan en `style="width:Npct"` y en comparaciones de presentación.
//
// Se arma en viewModel.ts a partir de un ResultadoPeriodo + la config + el
// proyecto. Se persiste como snapshot en ReporteFvEmision para que el PDF se
// reproduzca idéntico años después.

export interface TarifaPdf {
  key: string;
  label: string;
  totalSin: string;
  totalCon: string;
  descuentoVenta: string;
  ahorroAutoconsumo: string;
  saldoGeneradoMes: string;
  saldoInicial: string;
  saldoAplicado: string;
  saldoFinal: string;
  ahorroTotal: string;
  ahorroVenta: string;
  pctAutoconsumo: string;
  pctVenta: string;
  ahorroTotalDesglose: string;
}

export interface NotaPdf {
  tipo: "alerta" | "nota";
  texto: string;
}

export interface ReporteFvPdfInput {
  // Datos generales
  cliente: string;
  esEmpresa: boolean;
  tarifaContratadaLabel: string; // vacío si residencial
  mes: string; // "junio 2026"
  mesAnterior: string;
  /**
   * Cómo se describe el período cubierto. Mes calendario → false + textos vacíos.
   * Con día de corte → true + `periodoTexto` ("del 24 de mayo al 23 de junio").
   */
  tienePeriodoMedidor: boolean;
  periodoTexto: string;
  fechaInst: string;
  potencia: string;
  potInst: string;
  inversion: string;

  // Tarifas mostradas (3 residencial / 1 empresa)
  tarifasMostradas: TarifaPdf[];

  // Resumen energético
  generacion: string;
  consumo: string;
  autoconsumo: string;
  importacionRed: string;
  exportacionActual: string;
  exportacionAnterior: string;
  autoconsumoSobreConsumo: string;
  pctPunta: string;
  pctLlano: string;
  pctValle: string;

  // Distribución de la energía (barras apiladas)
  consumoTotal: string;
  consumoBarAutoconsumo: number;
  consumoBarRed: number;
  consumoBarAutoconsumoLabel: string;
  consumoBarRedLabel: string;
  consumoAutoconsumoKwh: string;
  consumoRedKwh: string;
  generacionTotal: string;
  generacionBarAutoconsumo: number;
  generacionBarExportada: number;
  generacionBarAutoconsumoLabel: string;
  generacionBarExportadaLabel: string;
  generacionAutoconsumoKwh: string;
  generacionExportadaKwh: string;

  // Retorno de la inversión
  retornoInversionPct: string;
  roiBarraPct: number;
  inversionRecuperadaUsd: string;
  inversionFaltanteUsd: string;
  tiempoRestanteRetorno: string;
  tiempoTotalRetorno: string;
  mesRetornoEstimado: string;
  estimacionRetornoNota: string;

  // Acumulados
  ahorroAcumulado: string;
  ahorroAcumuladoUsd: string;
  irpfAcumulado: string;
  ahorroPromedioHistorico: string;
  saldoAcumulado: string;

  // Control UTE
  exportacionAcumulada: string;
  importacionAcumulada: string;
  ratioUte: string;
  estadoUte: string;

  tipoCambioUsado: string;
  notasAdicionales: NotaPdf[];
}

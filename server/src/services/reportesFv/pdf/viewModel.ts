// Traduce un ResultadoPeriodo del motor + contexto del generador al view-model
// del PDF. Acá vive TODO el formateo (format.ts) y la derivación de los strings
// de display (tiempos de retorno, notas), replicando lo que el loop de main.py
// armaba antes de `template.render`.

import { fmtDecimal, fmtInt, mesEs, duracionMeses } from "../format.js";
import { type ConfigEfectiva, POTENCIA_CONTRATADA_DEFAULT } from "../config.service.js";
import type { ResultadoPeriodo } from "../motor/serie.js";
import type { TarifaKey } from "../motor/types.js";
import { periodoAnterior, rangoDelPeriodo } from "../periodo.js";
import type { NotaPdf, ReporteFvPdfInput, TarifaPdf } from "./types.js";

const MESES_TEXTO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "del 24 de mayo al 23 de junio" a partir de un rango de ciclo. */
function textoRango(rango: { desdeDate: Date; hastaDate: Date }): string {
  const fmt = (d: Date) => `${d.getUTCDate()} de ${MESES_TEXTO[d.getUTCMonth()]}`;
  return `del ${fmt(rango.desdeDate)} al ${fmt(rango.hastaDate)}`;
}

const ETIQUETA_TARIFA: Record<TarifaKey, string> = {
  simple: "Tarifa simple",
  doble: "Tarifa doble horario",
  triple: "Tarifa triple horario",
  zafral: "Tarifa zafral",
};

/** Datos del generador que no están en el ResultadoPeriodo. */
export interface ContextoPdf {
  cliente: string;
  esEmpresa: boolean;
  tarifaContratada: TarifaKey | null;
  potenciaContratadaKw: number;
  potenciaInstaladaKwp: number;
  inversionUsd: number;
  /** Periodo "YYYY-MM" de habilitación, o null. */
  mesInicio: string | null;
  /** La potencia se estimó en el valor por defecto (falta el dato real). */
  potenciaEstimada: boolean;
  /** Día de corte del medidor (1-31), o null si el reporte es mes calendario. */
  diaCorteMedidor?: number | null;
  /** Días que el smart meter alcanzó a medir, y los que tenía el período. */
  diasConDatos?: number | null;
  diasEsperados?: number | null;
}

/** Contexto del PDF derivado de la config efectiva del generador. */
export function contextoDesdeConfig(config: ConfigEfectiva): ContextoPdf {
  return {
    cliente: config.clientName,
    esEmpresa: config.tipoCliente === "empresa",
    tarifaContratada: config.tarifaContratada,
    potenciaContratadaKw: config.potenciaContratadaKw,
    potenciaInstaladaKwp: config.potenciaInstaladaKwp,
    inversionUsd: config.inversionUsd,
    mesInicio: config.mesInicio,
    potenciaEstimada: config.potenciaEstimada,
    diaCorteMedidor: config.diaCorteMedidor,
  };
}

function tarifaPdf(r: ResultadoPeriodo, key: TarifaKey): TarifaPdf {
  const t = r.tarifas[key];
  return {
    key,
    label: ETIQUETA_TARIFA[key],
    totalSin: fmtInt(t.facturaSin.totalNeto),
    totalCon: fmtInt(t.facturaConAjustada.totalNeto),
    descuentoVenta: fmtInt(t.descuentoVentaFactura),
    ahorroAutoconsumo: fmtInt(t.desglose.ahorroAutoconsumo),
    saldoGeneradoMes: fmtInt(t.facturaConAjustada.saldoGeneradoMes),
    saldoInicial: fmtInt(t.facturaConAjustada.saldoInicial),
    saldoAplicado: fmtInt(t.facturaConAjustada.saldoAplicado),
    saldoFinal: fmtInt(t.facturaConAjustada.saldoFinal),
    ahorroTotal: fmtInt(t.ahorroTotalTabla),
    ahorroVenta: fmtInt(t.desglose.ahorroVenta),
    pctAutoconsumo: fmtInt(t.desglose.pctAutoconsumo),
    pctVenta: fmtInt(t.desglose.pctVenta),
    ahorroTotalDesglose: fmtInt(t.desglose.ahorroTotal),
  };
}

function construirNotas(r: ResultadoPeriodo, ctx: ContextoPdf): NotaPdf[] {
  const notas: NotaPdf[] = [];

  // Nota de potencia estimada: la agrega el viewModel (el motor no conoce el
  // flag). Va como "nota" (recuadro azul), no como alerta. Texto del Python.
  if (ctx.potenciaEstimada) {
    notas.push({
      tipo: "nota",
      texto:
        `La potencia contratada con UTE de este servicio no está registrada, por lo que ` +
        `los cargos por potencia se estimaron con un valor de referencia de ` +
        `${fmtDecimal(POTENCIA_CONTRATADA_DEFAULT)} kW. Al confirmarse la potencia real ` +
        `contratada, los importes de este reporte pueden variar.`,
    });
  }

  // Medición parcial del mes.
  //
  // El consumo se calcula como generación + importación − exportación. La
  // generación viene del inversor y está completa; las otras dos vienen del
  // medidor y les faltan días. Por eso el desvío puede ir para cualquier lado:
  // si el cliente importa más de lo que inyecta, el consumo queda por debajo del
  // real; si inyecta más de lo que importa, por encima. La nota NO afirma una
  // dirección porque depende de cada caso.
  const { diasConDatos, diasEsperados } = ctx;
  if (diasConDatos != null && diasEsperados != null && diasEsperados > 0 && diasConDatos < diasEsperados) {
    const cobertura = diasConDatos / diasEsperados;
    const faltantes = diasEsperados - diasConDatos;
    const base =
      `El medidor de este servicio registró ${diasConDatos} de los ${diasEsperados} días del ` +
      `período (faltan ${faltantes}). El consumo y el ahorro de este reporte se calcularon con ` +
      `esa medición parcial, por lo que pueden no coincidir con los valores reales.`;

    if (cobertura < 0.5) {
      // Menos de la mitad del mes medido: el número existe pero es endeble, y
      // el cliente tiene que verlo antes de sacar conclusiones.
      notas.push({
        tipo: "alerta",
        texto:
          `${base} Al faltar más de la mitad del período, estos valores son ` +
          `orientativos: tomalos con reserva. Estamos trabajando para normalizar la medición.`,
      });
    } else {
      notas.push({ tipo: "nota", texto: base });
    }
  }

  // Notas dinámicas del motor (ej. alerta de consumo excesivo). El motor usa
  // "info" para las no-alerta; en el PDF eso es un recuadro "nota".
  for (const n of r.notas) {
    notas.push({ tipo: n.tipo === "alerta" ? "alerta" : "nota", texto: n.texto });
  }

  return notas;
}

export function construirPdfInput(r: ResultadoPeriodo, ctx: ContextoPdf): ReporteFvPdfInput {
  const tarifas = r.tarifasMostradas.map((key) => tarifaPdf(r, key));

  // Strings de display del retorno, replicando la lógica de main.py.
  const tiempoRestanteRetorno = r.retornoCompletado
    ? "Completado"
    : r.mesesAdicionalesRetorno != null
      ? duracionMeses(r.mesesAdicionalesRetorno)
      : "-";
  const tiempoTotalRetorno = r.mesesTotalesRetorno != null ? duracionMeses(r.mesesTotalesRetorno) : "-";
  const mesRetornoEstimado = r.mesRetornoEstimado ? mesEs(r.mesRetornoEstimado) : "-";

  // Descripción del período: mes calendario (default) o ciclo del medidor.
  const tienePeriodoMedidor = ctx.diaCorteMedidor != null;
  const periodoTexto = tienePeriodoMedidor
    ? textoRango(rangoDelPeriodo(r.periodo, ctx.diaCorteMedidor))
    : "";

  return {
    cliente: ctx.cliente,
    esEmpresa: ctx.esEmpresa,
    tarifaContratadaLabel: ctx.esEmpresa && ctx.tarifaContratada ? ETIQUETA_TARIFA[ctx.tarifaContratada] : "",
    mes: mesEs(r.periodo),
    mesAnterior: mesEs(periodoAnterior(r.periodo)),
    tienePeriodoMedidor,
    periodoTexto,
    fechaInst: ctx.mesInicio ? mesEs(ctx.mesInicio) : "-",
    potencia: fmtInt(ctx.potenciaContratadaKw),
    potInst: fmtDecimal(ctx.potenciaInstaladaKwp, 2),
    inversion: fmtInt(ctx.inversionUsd),

    tarifasMostradas: tarifas,

    generacion: fmtInt(r.generacionKwh),
    consumo: fmtInt(r.consumoKwh),
    autoconsumo: fmtInt(r.autoconsumoKwh),
    importacionRed: fmtInt(r.importacionRedKwh),
    exportacionActual: fmtInt(r.exportacionKwh),
    exportacionAnterior: fmtInt(r.exportacionMesAnteriorKwh),
    autoconsumoSobreConsumo: fmtInt(r.pctConsumoAutoconsumo),
    pctPunta: fmtInt(0),
    pctLlano: fmtInt(0),
    pctValle: fmtInt(0),

    consumoTotal: fmtInt(r.consumoKwh),
    consumoBarAutoconsumo: r.pctConsumoAutoconsumo,
    consumoBarRed: r.pctConsumoRed,
    consumoBarAutoconsumoLabel: fmtInt(r.pctConsumoAutoconsumo),
    consumoBarRedLabel: fmtInt(r.pctConsumoRed),
    consumoAutoconsumoKwh: fmtInt(r.autoconsumoKwh),
    consumoRedKwh: fmtInt(r.importacionRedKwh),
    generacionTotal: fmtInt(r.generacionKwh),
    generacionBarAutoconsumo: r.pctGeneracionAutoconsumo,
    generacionBarExportada: r.pctGeneracionExportada,
    generacionBarAutoconsumoLabel: fmtInt(r.pctGeneracionAutoconsumo),
    generacionBarExportadaLabel: fmtInt(r.pctGeneracionExportada),
    generacionAutoconsumoKwh: fmtInt(r.autoconsumoKwh),
    generacionExportadaKwh: fmtInt(r.exportacionKwh),

    retornoInversionPct: fmtInt(r.retornoInversionPct),
    roiBarraPct: Math.round(Math.max(0, Math.min(r.retornoInversionPct, 100)) * 10) / 10,
    inversionRecuperadaUsd: fmtInt(r.inversionRecuperadaUsd),
    inversionFaltanteUsd: fmtInt(r.inversionFaltanteUsd),
    tiempoRestanteRetorno,
    tiempoTotalRetorno,
    mesRetornoEstimado,
    estimacionRetornoNota: r.estimacionRetornoNota,

    ahorroAcumulado: fmtInt(r.ahorroAcumulado),
    ahorroAcumuladoUsd: fmtInt(r.ahorroAcumuladoUsd),
    irpfAcumulado: fmtInt(r.irpfAcumulado),
    ahorroPromedioHistorico: fmtInt(r.ahorroPromedioHistorico),
    saldoAcumulado: fmtInt(r.saldoAcumulado),

    exportacionAcumulada: fmtInt(r.exportacionAcumuladaAnio),
    importacionAcumulada: fmtInt(r.importacionAcumuladaAnio),
    ratioUte: fmtInt(r.ratioUte),
    estadoUte: r.estadoUte,

    tipoCambioUsado: fmtDecimal(r.tipoCambioUsd, 1),
    notasAdicionales: construirNotas(r, ctx),
  };
}

// Port del loop principal de `main.py` + `calcular_saldos_cuenta_corriente` +
// `obtener_acumulado_anual`, unificados en UNA función pura.
//
// El original las tenía separadas y comunicadas por un Excel: el loop escribía
// una fila y después releía el archivo entero para obtener los acumulados. Acá
// es todo en memoria, pero el ORDEN de las operaciones se respeta porque de él
// dependen los números: el acumulado se lee DESPUÉS de guardar el mes en curso,
// así que se incluye a sí mismo.
//
// La cuenta corriente UTE arrastra saldo mes a mes, así que la serie de un
// cliente se calcula siempre completa y en orden. No hay forma correcta de
// recalcular un mes suelto.

import {
  aplicarSaldoCuentaCorriente,
  calcularAutoconsumo,
  calcularCargoPotencia,
  calcularCostoEnergiaDoble,
  calcularCostoEnergiaSimple,
  calcularCostoEnergiaTriple,
  calcularCreditoExportacionDoble,
  calcularCreditoExportacionSimple,
  calcularCreditoExportacionTriple,
  calcularDesgloseBeneficio,
  calcularFactura,
  calcularImportacionRed,
  pct,
  pyMax,
  pyMin,
  round2,
  round2Decimal1,
} from "./metrics.js";
import type {
  DesgloseBeneficio,
  Factura,
  FacturaAjustada,
  TarifaKey,
  TarifaSnapshot,
} from "./types.js";
import { TARIFAS } from "./types.js";
import {
  anioDePeriodo,
  fraccionDiasHabiles,
  mesDePeriodo,
  mesesEntre,
  type Periodo,
  sumarMeses,
} from "../periodo.js";

export interface ConfigSerie {
  potenciaContratadaKw: number;
  /** Reparto horario del consumo, normalizado 0..1. */
  pctPunta: number;
  pctLlano: number;
  pctValle: number;
  inversionUsd: number;
  potenciaInstaladaKwp: number;
  /** Ancla del ROI: el mes en que arrancó a generar. */
  mesInicio: Periodo | null;
  tipoCliente: "residencial" | "empresa";
  /** Obligatoria si tipoCliente = "empresa". */
  tarifaContratada: TarifaKey | null;
}

export interface LecturaSerie {
  periodo: Periodo;
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
}

export interface ResultadoTarifa {
  tarifa: TarifaKey;
  facturaSin: Factura;
  facturaConAjustada: FacturaAjustada;
  desglose: DesgloseBeneficio;
  /**
   * QUIRK: el total que muestra la tabla comparativa del reporte. Se calcula
   * con la factura PRE cuenta corriente mientras que el "total con paneles" de
   * la misma columna es POST. Es una inconsistencia del original que se replica
   * tal cual: corregirla cambiaría los números ya comunicados a los clientes.
   */
  ahorroTotalTabla: number;
  /** ahorro_venta menos lo que quedó como saldo (lo efectivamente descontado). */
  descuentoVentaFactura: number;
}

export interface ResultadoPeriodo {
  periodo: Periodo;
  /** Si tiene motivo, el mes no se pudo calcular y el resto viene en null. */
  omitido: string | null;

  generacionKwh: number;
  consumoKwh: number;
  exportacionKwh: number;
  exportacionMesAnteriorKwh: number;
  autoconsumoKwh: number;
  importacionRedKwh: number;

  pctConsumoAutoconsumo: number;
  pctConsumoRed: number;
  pctGeneracionAutoconsumo: number;
  pctGeneracionExportada: number;

  tarifaPrincipal: TarifaKey;
  tarifasMostradas: TarifaKey[];
  tarifas: Record<TarifaKey, ResultadoTarifa>;

  tipoCambioUsd: number;
  ahorroAutoconsumo: number;
  ahorroVenta: number;
  ahorroTotal: number;
  ahorroTotalUsd: number;
  irpf: number;

  saldoInicial: number;
  saldoAplicado: number;
  saldoGeneradoMes: number;
  saldoFinal: number;

  // Acumulados (incluyen el mes en curso, igual que el original)
  ahorroAcumulado: number;
  ahorroAcumuladoUsd: number;
  irpfAcumulado: number;
  saldoAcumulado: number;
  ahorroPromedioHistorico: number;
  ahorroPromedioHistoricoUsd: number;
  /** Promedio expandido excluyendo el primer mes: la columna del histórico. */
  ahorroPromedioHistoricoFila: number | null;
  mesesConDatosUsd: number;

  // Control UTE — la exportación del año no debe superar a la importación
  exportacionAcumuladaAnio: number;
  importacionAcumuladaAnio: number;
  ratioUte: number;
  estadoUte: string;

  // Retorno de la inversión
  retornoInversionPct: number;
  inversionRecuperadaUsd: number;
  inversionFaltanteUsd: number;
  mesesTranscurridosDesdeInicio: number;
  mesesAdicionalesRetorno: number | null;
  mesesTotalesRetorno: number | null;
  mesRetornoEstimado: Periodo | null;
  retornoCompletado: boolean;
  estimacionRetornoNota: string;

  notas: NotaReporte[];
}

export interface NotaReporte {
  tipo: "alerta" | "info";
  texto: string;
}

export interface EntradaSerie {
  config: ConfigSerie;
  lecturas: LecturaSerie[];
  /** Cuadro tarifario vigente para cada periodo. */
  tarifaPorPeriodo: (periodo: Periodo) => TarifaSnapshot;
  /** Cotización USD de cada periodo. */
  tipoCambioPorPeriodo: (periodo: Periodo) => number;
}

/** Fila del histórico que se va acumulando a medida que avanza la serie. */
interface FilaHistorico {
  periodo: Periodo;
  exportacionKwh: number;
  importacionRedKwh: number;
  ahorroTotal: number;
  ahorroTotalUsd: number;
  irpf: number;
  saldoFinal: number;
}

const N = Number.NaN;

/** null → NaN, para que la aritmética propague igual que en Python. */
function num(v: number | null | undefined): number {
  return v == null ? N : v;
}

/** Reparto de franjas ya ajustado por días hábiles (ver franjasHabiles). */
interface FranjasEfectivas {
  pctPunta: number;
  pctLlano: number;
  pctValle: number;
}

function costoEnergia(
  tarifa: TarifaKey,
  kwh: number,
  f: FranjasEfectivas,
  t: TarifaSnapshot,
): number {
  switch (tarifa) {
    case "simple":
      // La simple va por tramos de consumo, no por franjas: días hábiles no aplica.
      return calcularCostoEnergiaSimple(kwh, t.tramosSimple);
    case "doble":
      return calcularCostoEnergiaDoble(kwh, f.pctPunta, t.franjasDoble.punta, t.franjasDoble.fuera_punta);
    case "triple":
      return calcularCostoEnergiaTriple(
        kwh, f.pctPunta, f.pctLlano, f.pctValle,
        t.franjasTriple.punta, t.franjasTriple.llano, t.franjasTriple.valle,
      );
    case "zafral":
      return calcularCostoEnergiaTriple(
        kwh, f.pctPunta, f.pctLlano, f.pctValle,
        t.franjasZafral.punta, t.franjasZafral.llano, t.franjasZafral.valle,
      );
  }
}

/**
 * Reasigna la porción de punta que cae en fin de semana.
 *
 * UTE cobra la punta al precio caro sólo de lunes a viernes. La fracción de
 * punta correspondiente a sábados y domingos se factura a precio de fuera de
 * punta (doble) o de llano (triple/zafral). Port de `main.py`:
 *
 *   pct_punta_habil = pct_punta * fraccion_dias_habiles(mes)
 *   pct_llano_habil = pct_llano + (pct_punta - pct_punta_habil)
 *
 * En la doble el excedente cae solo a "fuera de punta" (que se calcula como el
 * complemento de la punta), así que basta con reducir pct_punta; en triple y
 * zafral el excedente se mueve explícitamente a llano.
 */
function franjasHabiles(cfg: ConfigSerie, fraccion: number): FranjasEfectivas {
  const pctPuntaHabil = cfg.pctPunta * fraccion;
  const pctLlanoHabil = cfg.pctLlano + (cfg.pctPunta - pctPuntaHabil);
  return { pctPunta: pctPuntaHabil, pctLlano: pctLlanoHabil, pctValle: cfg.pctValle };
}

function creditoExportacion(tarifa: TarifaKey, kwhMesAnterior: number, t: TarifaSnapshot): number {
  switch (tarifa) {
    case "simple":
      return calcularCreditoExportacionSimple(kwhMesAnterior, t.tramosSimple);
    case "doble":
      return calcularCreditoExportacionDoble(kwhMesAnterior, t.franjasDoble.fuera_punta);
    case "triple":
      return calcularCreditoExportacionTriple(kwhMesAnterior, t.franjasTriple.llano);
    case "zafral":
      return calcularCreditoExportacionTriple(kwhMesAnterior, t.franjasZafral.llano);
  }
}

/** Media de una serie salteando el primer valor (ver nota en promedioExpandido). */
function promedioExcluyendoPrimero(valores: number[]): number {
  if (valores.length <= 1) return 0;
  const resto = valores.slice(1);
  return round2(resto.reduce((a, b) => a + b, 0) / resto.length);
}

/**
 * Promedio expandido excluyendo el primer mes: para la fila N, la media de los
 * meses 2..N. Es la columna `ahorro_promedio_historico` del histórico.
 *
 * El primer mes se excluye a propósito: casi ninguna instalación arranca el día
 * 1, así que su ahorro es parcial y ensuciaría el promedio.
 */
function promedioExpandido(valores: number[]): number | null {
  if (valores.length <= 1) return null;
  const resto = valores.slice(1);
  return round2(resto.reduce((a, b) => a + b, 0) / resto.length);
}

/**
 * Calcula la serie completa de un cliente.
 *
 * Las lecturas se ordenan por periodo. Las que no tienen los datos mínimos se
 * devuelven con `omitido` seteado: no generan reporte pero SÍ participan del
 * arrastre de la cuenta corriente, igual que en el original.
 */
export function calcularSerie(entrada: EntradaSerie): ResultadoPeriodo[] {
  const { config, tarifaPorPeriodo, tipoCambioPorPeriodo } = entrada;

  const lecturas = [...entrada.lecturas].sort((a, b) => a.periodo.localeCompare(b.periodo));
  const porPeriodo = new Map(lecturas.map((l) => [l.periodo, l]));

  const tarifasMostradas: TarifaKey[] =
    config.tipoCliente === "empresa"
      ? config.tarifaContratada
        ? [config.tarifaContratada]
        : []
      : ["simple", "doble", "triple"];
  const tarifaPrincipal: TarifaKey = tarifasMostradas[0] ?? "simple";

  // Saldo de cuenta corriente arrastrado, uno por tarifa.
  const saldos: Record<TarifaKey, number> = { simple: 0, doble: 0, triple: 0, zafral: 0 };
  // Histórico que se va llenando; los acumulados lo leen entero en cada vuelta.
  const historico: FilaHistorico[] = [];
  const resultados: ResultadoPeriodo[] = [];

  for (const lectura of lecturas) {
    const { periodo } = lectura;
    const tarifaSnapshot = tarifaPorPeriodo(periodo);
    const tipoCambioUsd = tipoCambioPorPeriodo(periodo);

    const generacion = num(lectura.generacionKwh);
    const consumo = num(lectura.consumoKwh);
    const exportacion = num(lectura.exportacionKwh);

    const faltantes: string[] = [];
    if (lectura.generacionKwh == null) faltantes.push("generación");
    if (lectura.consumoKwh == null) faltantes.push("consumo");
    if (lectura.exportacionKwh == null) faltantes.push("exportación");
    if (!Number.isFinite(config.potenciaContratadaKw)) faltantes.push("potencia contratada");

    const sumaPct = round2(config.pctPunta + config.pctLlano + config.pctValle);
    if (Math.abs(sumaPct - 1) > 0.001) {
      faltantes.push("los porcentajes de franja horaria no suman 100%");
    }
    if (config.tipoCliente === "empresa" && !config.tarifaContratada) {
      faltantes.push("tarifa contratada (cliente empresa)");
    }

    // Crédito por exportación: se valúa con lo exportado el MES ANTERIOR.
    // Distinción fiel al Python: si NO hay lectura del mes anterior, es 0; pero
    // si la lectura EXISTE con exportación vacía, se propaga NaN (el crédito y el
    // ahorro del mes quedan NaN y no suman al acumulado). Es lo que pasa en el
    // primer mes con datos, cuyo mes anterior existe pero sin lectura del medidor.
    const lecturaAnterior = porPeriodo.get(sumarMeses(periodo, -1));
    const exportacionMesAnterior =
      lecturaAnterior === undefined ? 0 : (lecturaAnterior.exportacionKwh ?? N);

    const autoconsumo = calcularAutoconsumo(generacion, exportacion);
    const importacionRed = calcularImportacionRed(consumo, generacion, exportacion);

    // La porción de punta que cae en fin de semana se factura a precio de fuera
    // de punta / llano según la tarifa. Se calcula una vez por periodo.
    const franjas = franjasHabiles(config, fraccionDiasHabiles(periodo));

    // Las 4 tarifas se calculan siempre; el reporte muestra 3 (residencial) o 1
    // (empresa). Tenerlas todas permite cambiar de tarifa sin recalcular nada.
    const tarifas = {} as Record<TarifaKey, ResultadoTarifa>;
    for (const tarifa of TARIFAS) {
      const cargos = tarifaSnapshot.cargos[tarifa];
      const cargoPotencia = calcularCargoPotencia(config.potenciaContratadaKw, cargos);
      const credito = creditoExportacion(tarifa, exportacionMesAnterior, tarifaSnapshot);

      const facturaSin = calcularFactura({
        cargoFijo: cargos.cargoFijo,
        cargoPotencia,
        cargoEnergia: costoEnergia(tarifa, consumo, franjas, tarifaSnapshot),
        creditoExportacion: 0,
        tasaIva: tarifaSnapshot.ivaPct,
        tasaIrpf: tarifaSnapshot.irpfPct,
      });

      const facturaCon = calcularFactura({
        cargoFijo: cargos.cargoFijo,
        cargoPotencia,
        cargoEnergia: costoEnergia(tarifa, importacionRed, franjas, tarifaSnapshot),
        creditoExportacion: credito,
        tasaIva: tarifaSnapshot.ivaPct,
        tasaIrpf: tarifaSnapshot.irpfPct,
      });

      // QUIRK: se usa facturaCon PRE cuenta corriente (ver ResultadoTarifa).
      const ahorroTotalTabla = round2(
        facturaSin.totalNeto - facturaCon.totalNeto + facturaCon.saldoAFavor,
      );

      const facturaConAjustada = aplicarSaldoCuentaCorriente(facturaCon, saldos[tarifa]);
      saldos[tarifa] = facturaConAjustada.saldoFinal;

      const desglose = calcularDesgloseBeneficio(facturaSin, facturaCon);
      const descuentoVentaFactura = pyMax(
        desglose.ahorroVenta - facturaConAjustada.saldoGeneradoMes,
        0,
      );

      tarifas[tarifa] = {
        tarifa,
        facturaSin,
        facturaConAjustada,
        desglose,
        ahorroTotalTabla,
        descuentoVentaFactura,
      };
    }

    const principal = tarifas[tarifaPrincipal];
    const ahorroTotal = principal.desglose.ahorroTotal;
    const ahorroTotalUsd = round2(ahorroTotal / tipoCambioUsd);
    const omitido = faltantes.length > 0 ? `Faltan datos: ${faltantes.join(", ")}.` : null;

    // Un mes sin datos no genera reporte y NO entra al histórico —el original
    // hacía `continue` antes de guardar—, pero ya arrastró su saldo arriba: los
    // meses anteriores a la instalación tienen que seguir corriendo la cuenta
    // corriente aunque no se reporten.
    if (!omitido) {
      // El histórico se escribe ANTES de leer los acumulados: por eso incluyen
      // el mes en curso. No invertir el orden.
      historico.push({
        periodo,
        exportacionKwh: exportacion,
        importacionRedKwh: importacionRed,
        ahorroTotal,
        ahorroTotalUsd,
        irpf: principal.facturaConAjustada.irpf,
        saldoFinal: principal.facturaConAjustada.saldoFinal,
      });
    }

    const validos = historico.filter((h) => Number.isFinite(h.ahorroTotal));
    const ahorros = validos.map((h) => h.ahorroTotal);
    const ahorrosUsd = validos.map((h) => h.ahorroTotalUsd);

    const ahorroAcumulado = round2(ahorros.reduce((a, b) => a + b, 0));
    const ahorroAcumuladoUsd = round2(ahorrosUsd.reduce((a, b) => a + b, 0));
    const irpfAcumulado = round2(
      historico.filter((h) => Number.isFinite(h.irpf)).reduce((a, h) => a + h.irpf, 0),
    );
    const saldoAcumulado = historico.length > 0 ? round2(historico[historico.length - 1].saldoFinal) : 0;
    const ahorroPromedioHistorico = promedioExcluyendoPrimero(ahorros);
    const ahorroPromedioHistoricoUsd = promedioExcluyendoPrimero(ahorrosUsd);
    const mesesConDatosUsd = Math.max(ahorrosUsd.length - 1, 0);
    const ahorroPromedioHistoricoFila = promedioExpandido(ahorros);

    // Control UTE: los acumulados de energía son del AÑO, no de todo el
    // historial (a diferencia del ahorro). Es así en el original.
    const anio = anioDePeriodo(periodo);
    const delAnio = historico.filter((h) => anioDePeriodo(h.periodo) === anio);
    const exportacionAcumuladaAnio = round2(
      delAnio.filter((h) => Number.isFinite(h.exportacionKwh)).reduce((a, h) => a + h.exportacionKwh, 0),
    );
    const importacionAcumuladaAnio = round2(
      delAnio.filter((h) => Number.isFinite(h.importacionRedKwh)).reduce((a, h) => a + h.importacionRedKwh, 0),
    );

    let ratioUte = 0;
    if (importacionAcumuladaAnio > 0) {
      ratioUte = round2Decimal1((exportacionAcumuladaAnio / importacionAcumuladaAnio) * 100);
    }

    let estadoUte: string;
    if (exportacionAcumuladaAnio <= importacionAcumuladaAnio) {
      estadoUte = "OK";
    } else if (exportacionAcumuladaAnio <= importacionAcumuladaAnio * 1.1) {
      estadoUte = "ALERTA";
    } else {
      // Antes de agosto todavía hay medio año para compensar; después, no.
      estadoUte = mesDePeriodo(periodo) < 8 ? "EXCEDIDO - SIN RIESGO" : "EXCEDIDO - CON RIESGO";
    }

    // ─── Retorno de la inversión ───
    const inversion = config.inversionUsd;
    let mesesTranscurridosDesdeInicio = 0;
    if (config.mesInicio) {
      mesesTranscurridosDesdeInicio = Math.max(mesesEntre(config.mesInicio, periodo) + 1, 0);
    }

    let retornoInversionPct = 0;
    let mesesAdicionalesRetorno: number | null = null;
    let mesesTotalesRetorno: number | null = null;
    let mesRetornoEstimado: Periodo | null = null;
    let retornoCompletado = false;
    let estimacionRetornoNota = "";

    if (inversion > 0) {
      retornoInversionPct = round2Decimal1((ahorroAcumuladoUsd / inversion) * 100);

      if (ahorroAcumuladoUsd >= inversion) {
        retornoCompletado = true;
        mesesTotalesRetorno =
          mesesTranscurridosDesdeInicio > 0 ? mesesTranscurridosDesdeInicio : mesesConDatosUsd || null;
        mesRetornoEstimado = periodo;
      } else if (ahorroPromedioHistoricoUsd > 0) {
        const faltanteUsd = pyMax(inversion - ahorroAcumuladoUsd, 0);
        mesesAdicionalesRetorno = Math.ceil(faltanteUsd / ahorroPromedioHistoricoUsd);
        const base =
          mesesTranscurridosDesdeInicio > 0 ? mesesTranscurridosDesdeInicio : mesesConDatosUsd;
        mesesTotalesRetorno = base + mesesAdicionalesRetorno;
        mesRetornoEstimado = sumarMeses(periodo, mesesAdicionalesRetorno);
      } else {
        estimacionRetornoNota = "No hay base suficiente para estimar el retorno de la inversión.";
      }

      if (mesesConDatosUsd > 0 && mesesConDatosUsd < 12) {
        estimacionRetornoNota =
          `Aviso: la proyección se calculó con ${mesesConDatosUsd} ` +
          `${mesesConDatosUsd === 1 ? "mes" : "meses"} de historial útil.`;
      }
    }

    // ─── Notas dinámicas ───
    const notas: NotaReporte[] = [];
    const consumosPrevios = lecturas
      .filter((l) => l.periodo < periodo && l.consumoKwh != null)
      .map((l) => l.consumoKwh as number);
    if (consumosPrevios.length > 0 && Number.isFinite(consumo)) {
      const promedio = consumosPrevios.reduce((a, b) => a + b, 0) / consumosPrevios.length;
      if (promedio > 0 && consumo > promedio * 1.3) {
        const aumentoPct = Math.round((consumo / promedio - 1) * 100);
        notas.push({
          tipo: "alerta",
          texto:
            `Alerta: se detectó un consumo excesivo. El consumo del mes fue de ` +
            `${Math.round(consumo)} kWh, un ${aumentoPct}% por encima del promedio ` +
            `histórico previo (${Math.round(promedio)} kWh).`,
        });
      }
    }

    resultados.push({
      periodo,
      omitido,
      generacionKwh: generacion,
      consumoKwh: consumo,
      exportacionKwh: exportacion,
      exportacionMesAnteriorKwh: exportacionMesAnterior,
      autoconsumoKwh: autoconsumo,
      importacionRedKwh: importacionRed,
      pctConsumoAutoconsumo: pct(autoconsumo, consumo),
      pctConsumoRed: pct(importacionRed, consumo),
      pctGeneracionAutoconsumo: pct(autoconsumo, generacion),
      pctGeneracionExportada: pct(exportacion, generacion),
      tarifaPrincipal,
      tarifasMostradas,
      tarifas,
      tipoCambioUsd,
      ahorroAutoconsumo: principal.desglose.ahorroAutoconsumo,
      ahorroVenta: principal.desglose.ahorroVenta,
      ahorroTotal,
      ahorroTotalUsd,
      irpf: principal.facturaConAjustada.irpf,
      saldoInicial: principal.facturaConAjustada.saldoInicial,
      saldoAplicado: principal.facturaConAjustada.saldoAplicado,
      saldoGeneradoMes: principal.facturaConAjustada.saldoGeneradoMes,
      saldoFinal: principal.facturaConAjustada.saldoFinal,
      ahorroAcumulado,
      ahorroAcumuladoUsd,
      irpfAcumulado,
      saldoAcumulado,
      ahorroPromedioHistorico,
      ahorroPromedioHistoricoUsd,
      ahorroPromedioHistoricoFila,
      mesesConDatosUsd,
      exportacionAcumuladaAnio,
      importacionAcumuladaAnio,
      ratioUte,
      estadoUte,
      retornoInversionPct,
      inversionRecuperadaUsd: inversion > 0 ? pyMin(ahorroAcumuladoUsd, inversion) : 0,
      inversionFaltanteUsd: inversion > 0 ? pyMax(inversion - ahorroAcumuladoUsd, 0) : 0,
      mesesTranscurridosDesdeInicio,
      mesesAdicionalesRetorno,
      mesesTotalesRetorno,
      mesRetornoEstimado,
      retornoCompletado,
      estimacionRetornoNota,
      notas,
    });
  }

  return resultados;
}

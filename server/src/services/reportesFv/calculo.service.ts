// Recálculo y persistencia de la serie de un cliente.
//
// La cuenta corriente UTE arrastra saldo mes a mes, así que NO hay forma
// correcta de recalcular un mes suelto: siempre se recalcula la serie completa
// del cliente y se hace upsert de todos sus periodos. Son ~25 periodos por
// cliente, corre en milisegundos.
//
// Se dispara al: guardar una lectura, guardar la config, terminar una ingesta,
// publicar una tarifa, o desde el botón del panel.

import { Prisma, TarifaUte } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { calcularSerie, type LecturaSerie, type ResultadoPeriodo } from "./motor/serie.js";
import type { TarifaKey } from "./motor/types.js";
import { TARIFAS } from "./motor/types.js";
import { dateAPeriodo, periodoADate, type Periodo } from "./periodo.js";
import { crearResolutorTarifas, KEY_A_TARIFA } from "./tarifas/tarifas.service.js";
import { exigirConfigCompleta, getConfigEfectiva, type ConfigEfectiva } from "./config.service.js";
import { getTipoCambioResolver } from "./tipo-cambio.service.js";

/** Prisma.Decimal desde un number, tolerando NaN (que se persiste como 0). */
function d(v: number): Prisma.Decimal {
  return new Prisma.Decimal(Number.isFinite(v) ? v.toFixed(2) : "0");
}

export interface ResultadoRecalculo {
  projectId: string;
  clientName: string;
  periodosCalculados: number;
  periodosOmitidos: number;
  omitidos: Array<{ periodo: Periodo; motivo: string }>;
}

/**
 * Recalcula y persiste la serie completa de un proyecto.
 *
 * Los periodos sin datos suficientes NO se persisten (igual que el sistema
 * original, que los salteaba) pero sí participan del arrastre del saldo: los
 * meses previos a la instalación tienen que seguir corriendo la cuenta corriente.
 */
export async function recalcularSerie(projectId: string): Promise<ResultadoRecalculo> {
  const config = exigirConfigCompleta(await getConfigEfectiva(projectId));
  return recalcularSerieConConfig(config);
}

/**
 * Calcula la serie de un proyecto SIN persistir. Carga sus lecturas, resuelve
 * tarifas y tipo de cambio, y corre el motor. Lo usan tanto el recálculo (que
 * después persiste) como la generación del PDF (que sólo lee un periodo).
 */
export async function computarSerieDeProyecto(config: ConfigEfectiva): Promise<{
  serie: ResultadoPeriodo[];
  versionIdPorPeriodo: (periodo: Periodo) => string;
}> {
  const lecturasDb = await prisma.reporteFvLectura.findMany({
    where: { projectId: config.projectId },
    orderBy: { periodo: "asc" },
  });

  if (lecturasDb.length === 0) {
    return { serie: [], versionIdPorPeriodo: () => "" };
  }

  const lecturas: LecturaSerie[] = lecturasDb.map((l) => ({
    periodo: dateAPeriodo(l.periodo),
    generacionKwh: l.generacionKwh == null ? null : Number(l.generacionKwh),
    consumoKwh: l.consumoKwh == null ? null : Number(l.consumoKwh),
    exportacionKwh: l.exportacionKwh == null ? null : Number(l.exportacionKwh),
  }));

  const periodos = lecturas.map((l) => l.periodo);
  const tarifas = await crearResolutorTarifas(periodos);
  const tipoCambio = await getTipoCambioResolver(periodos);

  const serie = calcularSerie({
    config,
    lecturas,
    tarifaPorPeriodo: tarifas.tarifaPorPeriodo,
    tipoCambioPorPeriodo: tipoCambio.tipoCambioPorPeriodo,
  });

  return { serie, versionIdPorPeriodo: tarifas.versionIdPorPeriodo };
}

export async function recalcularSerieConConfig(config: ConfigEfectiva): Promise<ResultadoRecalculo> {
  const { projectId } = config;

  const { serie, versionIdPorPeriodo } = await computarSerieDeProyecto(config);

  if (serie.length === 0) {
    return {
      projectId,
      clientName: config.clientName,
      periodosCalculados: 0,
      periodosOmitidos: 0,
      omitidos: [],
    };
  }

  const calculables = serie.filter((r) => !r.omitido);
  const omitidos = serie
    .filter((r) => r.omitido)
    .map((r) => ({ periodo: r.periodo, motivo: r.omitido as string }));

  const snapshotConfig = {
    potenciaContratadaKw: config.potenciaContratadaKw,
    pctPunta: config.pctPunta,
    pctLlano: config.pctLlano,
    pctValle: config.pctValle,
    inversionUsd: config.inversionUsd,
    potenciaInstaladaKwp: config.potenciaInstaladaKwp,
    mesInicio: config.mesInicio,
    tipoCliente: config.tipoCliente,
    tarifaContratada: config.tarifaContratada,
    heredados: config.heredados,
  } satisfies Prisma.InputJsonValue;

  // Una transacción por proyecto: si algo falla, la serie no queda a medias.
  await prisma.$transaction(async (tx) => {
    // Los periodos que dejaron de ser calculables se borran, para que no queden
    // cálculos viejos de un mes cuya lectura se vació.
    const vigentes = calculables.map((r) => periodoADate(r.periodo));
    await tx.reporteFvCalculo.deleteMany({
      where: { projectId, periodo: { notIn: vigentes.length > 0 ? vigentes : [new Date(0)] } },
    });

    for (const r of calculables) {
      const data = filaCalculo(r, versionIdPorPeriodo(r.periodo), snapshotConfig);

      const calculo = await tx.reporteFvCalculo.upsert({
        where: { projectId_periodo: { projectId, periodo: periodoADate(r.periodo) } },
        create: { projectId, periodo: periodoADate(r.periodo), ...data },
        update: data,
      });

      for (const tarifa of TARIFAS) {
        const filaTarifa = filaCalculoTarifa(r, tarifa);
        await tx.reporteFvCalculoTarifa.upsert({
          where: { calculoId_tarifa: { calculoId: calculo.id, tarifa: KEY_A_TARIFA[tarifa] } },
          create: { calculoId: calculo.id, tarifa: KEY_A_TARIFA[tarifa], ...filaTarifa },
          update: filaTarifa,
        });
      }
    }
  });

  return {
    projectId,
    clientName: config.clientName,
    periodosCalculados: calculables.length,
    periodosOmitidos: omitidos.length,
    omitidos,
  };
}

function filaCalculo(
  r: ResultadoPeriodo,
  tarifaVersionId: string,
  configSnapshot: Prisma.InputJsonValue,
) {
  return {
    tarifaVersionId,
    tipoCambioUsd: new Prisma.Decimal(r.tipoCambioUsd.toFixed(4)),
    tarifaPrincipal: KEY_A_TARIFA[r.tarifaPrincipal] as TarifaUte,

    autoconsumoKwh: d(r.autoconsumoKwh),
    importacionRedKwh: d(r.importacionRedKwh),
    exportacionMesAnteriorKwh: d(r.exportacionMesAnteriorKwh),

    ahorroAutoconsumo: d(r.ahorroAutoconsumo),
    ahorroVenta: d(r.ahorroVenta),
    ahorroTotal: d(r.ahorroTotal),
    ahorroTotalUsd: d(r.ahorroTotalUsd),
    irpf: d(r.irpf),

    ahorroAcumulado: d(r.ahorroAcumulado),
    ahorroAcumuladoUsd: d(r.ahorroAcumuladoUsd),
    irpfAcumulado: d(r.irpfAcumulado),
    ahorroPromedioHistorico: d(r.ahorroPromedioHistorico),
    ahorroPromedioHistoricoUsd: d(r.ahorroPromedioHistoricoUsd),
    mesesConDatosUsd: r.mesesConDatosUsd,
    retornoInversionPct: new Prisma.Decimal(
      (Number.isFinite(r.retornoInversionPct) ? r.retornoInversionPct : 0).toFixed(2),
    ),
    mesRetornoEstimado: r.mesRetornoEstimado ? periodoADate(r.mesRetornoEstimado) : null,

    exportacionAcumuladaAnio: d(r.exportacionAcumuladaAnio),
    importacionAcumuladaAnio: d(r.importacionAcumuladaAnio),
    ratioUte: new Prisma.Decimal((Number.isFinite(r.ratioUte) ? r.ratioUte : 0).toFixed(2)),
    estadoUte: r.estadoUte,

    configSnapshot,
    notas: r.notas as unknown as Prisma.InputJsonValue,
    calculadoEn: new Date(),
  };
}

function filaCalculoTarifa(r: ResultadoPeriodo, tarifa: TarifaKey) {
  const t = r.tarifas[tarifa];
  return {
    sinTotalNeto: d(t.facturaSin.totalNeto),
    sinCargoEnergia: d(t.facturaSin.cargoEnergia),
    conTotalBruto: d(t.facturaConAjustada.totalBruto),
    conTotalNeto: d(t.facturaConAjustada.totalNeto),
    conCargoEnergia: d(t.facturaConAjustada.cargoEnergia),
    conIva: d(t.facturaConAjustada.iva),
    conIrpf: d(t.facturaConAjustada.irpf),
    creditoExportacion: d(t.facturaConAjustada.creditoExportacion),
    saldoInicial: d(t.facturaConAjustada.saldoInicial),
    saldoAplicado: d(t.facturaConAjustada.saldoAplicado),
    saldoGeneradoMes: d(t.facturaConAjustada.saldoGeneradoMes),
    saldoFinal: d(t.facturaConAjustada.saldoFinal),
    ahorroAutoconsumo: d(t.desglose.ahorroAutoconsumo),
    ahorroVenta: d(t.desglose.ahorroVenta),
    ahorroTotalDesglose: d(t.desglose.ahorroTotal),
    ahorroTotalTabla: d(t.ahorroTotalTabla),
    pctAutoconsumo: new Prisma.Decimal(
      (Number.isFinite(t.desglose.pctAutoconsumo) ? t.desglose.pctAutoconsumo : 0).toFixed(2),
    ),
    pctVenta: new Prisma.Decimal(
      (Number.isFinite(t.desglose.pctVenta) ? t.desglose.pctVenta : 0).toFixed(2),
    ),
  };
}

/** Recalcula varios proyectos. Los que fallan se reportan, no cortan la corrida. */
export async function recalcularVarios(projectIds: string[]) {
  const ok: ResultadoRecalculo[] = [];
  const errores: Array<{ projectId: string; error: string }> = [];

  for (const projectId of projectIds) {
    try {
      ok.push(await recalcularSerie(projectId));
    } catch (e) {
      errores.push({ projectId, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { ok, errores };
}

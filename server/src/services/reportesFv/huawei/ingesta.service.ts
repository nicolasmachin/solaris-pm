// Ingesta mensual de las plantas Huawei → ReporteFvLectura.
//
// Escribe en la misma tabla que la ingesta de Growatt, así que el cálculo, el
// PDF y el portal funcionan sin enterarse de la marca del inversor. Lo único que
// cambia es de dónde salen los números y qué queda en `*Fuente`.
//
// Dos reglas propias, más conservadoras que las de Growatt:
//
//   1. NO se pisa un valor cargado por una persona. Growatt sólo protege MANUAL;
//      acá también se protege IMPORT_LEGACY, porque son estimaciones hechas a
//      mano para meses en que el medidor estaba mal conectado (caso verificado:
//      Marianela Indart, mayo y junio de 2026) y la API para esos meses tiene
//      menos días que la estimación. Se pisan sólo con `force`.
//   2. Consumo y exportación se descartan si la cobertura del mes no llega al
//      mínimo. Con días faltantes los totales salen incoherentes — mayo de
//      Marianela daba 141 kWh generados contra 874 exportados, que es imposible.
//      La generación sí se guarda: es un contador del inversor, no del medidor.

import { ReporteFvFuente } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { periodoADate, type Periodo } from "../periodo.js";
import { serieDiariaDelMes } from "./client.js";
import { plantasHuaweiVinculadas } from "./plantas.service.js";

const COBERTURA_MINIMA = Number(process.env.HUAWEI_MIN_COVERAGE || "") || 0.9;

export interface ItemIngestaHuawei {
  plantCode: string;
  nombre: string;
  projectId: string;
  generacionKwh: number | null;
  consumoKwh: number | null;
  exportacionKwh: number | null;
  diasConDatos: number;
  diasEsperados: number;
  motivo: string | null;
  omitido: string | null;
}

export interface ResumenIngestaHuawei {
  periodo: Periodo;
  plantas: number;
  guardadas: number;
  omitidas: number;
  items: ItemIngestaHuawei[];
}

/**
 * Ingiere un periodo para todas las plantas Huawei vinculadas.
 *
 * `force` pisa también los valores cargados a mano (ver regla 1).
 */
export async function ingerirPeriodoHuawei(
  periodo: Periodo,
  opts: { force?: boolean; projectIds?: string[] } = {},
): Promise<ResumenIngestaHuawei> {
  const force = opts.force ?? false;
  let plantas = await plantasHuaweiVinculadas();
  if (opts.projectIds) {
    plantas = plantas.filter((p) => opts.projectIds!.includes(p.projectId!));
  }
  const items: ItemIngestaHuawei[] = [];

  if (!plantas.length) {
    return { periodo, plantas: 0, guardadas: 0, omitidas: 0, items };
  }

  const [anio, mes] = periodo.split("-").map(Number);
  const { series, diasReportados } = await serieDiariaDelMes(
    plantas.map((p) => p.plantCode),
    anio,
    mes,
  );

  let guardadas = 0;
  let omitidas = 0;

  for (const planta of plantas) {
    const dias = series.get(planta.plantCode) ?? [];
    const diasEsperados = diasReportados.get(planta.plantCode) ?? 0;
    const diasConDatos = dias.length;

    const base = {
      plantCode: planta.plantCode,
      nombre: planta.name,
      projectId: planta.projectId!,
      diasConDatos,
      diasEsperados,
    };

    if (!diasConDatos) {
      // Sin un solo día con datos: la planta no comunicó en todo el mes. No se
      // escribe una lectura en cero, que se leería como "generó 0" en vez de
      // "no sabemos". El monitoreo diario es el que avisa de esto.
      omitidas++;
      items.push({
        ...base,
        generacionKwh: null,
        consumoKwh: null,
        exportacionKwh: null,
        motivo: null,
        omitido: `sin datos en todo el mes (0 de ${diasEsperados} días)`,
      });
      continue;
    }

    const suma = (campo: "generacionKwh" | "consumoKwh" | "exportacionKwh" | "importacionKwh") =>
      Number(dias.reduce((a, d) => a + d[campo], 0).toFixed(2));

    // Planta sin smart meter: FusionSolar devuelve consumo e importación en cero
    // todo el mes en vez de omitirlos (caso verificado: Alejandro Fiermarin).
    // Guardar 0 diría "el cliente no consumió nada", que es falso y arruinaría el
    // ahorro del reporte. Sin medidor no hay dato, y eso es un null.
    const sinMedidor = suma("consumoKwh") === 0 && suma("importacionKwh") === 0;

    const cobertura = diasEsperados > 0 ? diasConDatos / diasEsperados : 1;
    const suficiente = cobertura >= COBERTURA_MINIMA && !sinMedidor;
    const motivo = sinMedidor
      ? "la planta no tiene medidor: sólo se registra la generación"
      : cobertura >= COBERTURA_MINIMA
        ? null
        : `sólo ${diasConDatos} de ${diasEsperados} días con datos (mínimo ${Math.round(COBERTURA_MINIMA * 100)}%)`;

    const item: ItemIngestaHuawei = {
      ...base,
      generacionKwh: suma("generacionKwh"),
      consumoKwh: suficiente ? suma("consumoKwh") : null,
      exportacionKwh: suficiente ? suma("exportacionKwh") : null,
      motivo,
      omitido: null,
    };

    await guardarLectura(
      planta.projectId!,
      periodo,
      {
        generacionKwh: item.generacionKwh,
        consumoKwh: item.consumoKwh,
        exportacionKwh: item.exportacionKwh,
        importacionMedidaKwh: suficiente ? suma("importacionKwh") : null,
        diasConDatos,
        diasEsperados,
        motivo,
      },
      force,
    );

    guardadas++;
    items.push(item);
  }

  return { periodo, plantas: plantas.length, guardadas, omitidas, items };
}

/** Fuentes que representan un número puesto por una persona: no se pisan. */
const CARGADO_A_MANO: ReporteFvFuente[] = [ReporteFvFuente.MANUAL, ReporteFvFuente.IMPORT_LEGACY];

async function guardarLectura(
  projectId: string,
  periodo: Periodo,
  datos: {
    generacionKwh: number | null;
    consumoKwh: number | null;
    exportacionKwh: number | null;
    importacionMedidaKwh: number | null;
    diasConDatos: number;
    diasEsperados: number;
    motivo: string | null;
  },
  force: boolean,
): Promise<void> {
  const fecha = periodoADate(periodo);
  const existente = await prisma.reporteFvLectura.findUnique({
    where: { projectId_periodo: { projectId, periodo: fecha } },
  });

  type Campo = "generacion" | "consumo" | "exportacion";
  const nuevo: Record<Campo, number | null> = {
    generacion: datos.generacionKwh,
    consumo: datos.consumoKwh,
    exportacion: datos.exportacionKwh,
  };
  const fuenteVieja: Record<Campo, ReporteFvFuente | null> = {
    generacion: existente?.generacionFuente ?? null,
    consumo: existente?.consumoFuente ?? null,
    exportacion: existente?.exportacionFuente ?? null,
  };
  const valorViejo: Record<Campo, number | null> = {
    generacion: existente?.generacionKwh == null ? null : Number(existente.generacionKwh),
    consumo: existente?.consumoKwh == null ? null : Number(existente.consumoKwh),
    exportacion: existente?.exportacionKwh == null ? null : Number(existente.exportacionKwh),
  };

  const resolver = (campo: Campo): { valor: number | null; fuente: ReporteFvFuente | null } => {
    // Un null nuevo nunca borra lo que había.
    if (nuevo[campo] == null) return { valor: valorViejo[campo], fuente: fuenteVieja[campo] };
    const vieja = fuenteVieja[campo];
    if (vieja && CARGADO_A_MANO.includes(vieja) && !force) {
      return { valor: valorViejo[campo], fuente: vieja };
    }
    return { valor: nuevo[campo], fuente: ReporteFvFuente.HUAWEI };
  };

  const g = resolver("generacion");
  const c = resolver("consumo");
  const e = resolver("exportacion");

  const comun = {
    generacionKwh: g.valor,
    consumoKwh: c.valor,
    exportacionKwh: e.valor,
    importacionMedidaKwh: datos.importacionMedidaKwh,
    generacionFuente: g.fuente,
    consumoFuente: c.fuente,
    exportacionFuente: e.fuente,
    diasConDatos: datos.diasConDatos,
    diasEsperados: datos.diasEsperados,
    motivoFaltante: datos.motivo,
  };

  await prisma.reporteFvLectura.upsert({
    where: { projectId_periodo: { projectId, periodo: fecha } },
    create: { projectId, periodo: fecha, ...comun },
    update: comun,
  });
}

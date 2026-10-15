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
//   2. Si al mes le faltan días pero hay al menos la mitad medidos, los
//      faltantes se ESTIMAN con el promedio diario. Por debajo de la mitad no
//      se estima nada: se descartan consumo y exportación y el mes no se emite,
//      porque los totales salen incoherentes — mayo de Marianela daba 141 kWh
//      generados contra 874 exportados, que es imposible.
//      La generación nunca se toca: es un contador del inversor, no del medidor.
//
// Período: si el generador tiene día de corte del medidor, la lectura cubre su
// ciclo (`rangoDelPeriodo()`), igual que la factura de UTE: con corte 16,
// `2026-09` es del 17 de agosto al 16 de septiembre. Como la API da la serie
// por mes calendario, se piden los dos meses que toca el ciclo y se suman sólo
// sus días. Sin corte, mes calendario.

import { ReporteFvFuente } from "@prisma/client";

import { prisma } from "../../../lib/prisma.js";
import { periodoADate, periodoCerrado, rangoDelPeriodo, type Periodo } from "../periodo.js";
import { type DiaHuawei, huaweiPausa, serieDiariaDelMes } from "./client.js";
import { plantasHuaweiVinculadas } from "./plantas.service.js";

const COBERTURA_MINIMA = Number(process.env.HUAWEI_MIN_COVERAGE || "") || 0.5;

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

  // Día de corte de cada generador: define qué días cubre su lectura.
  const configs = await prisma.reporteFvConfig.findMany({
    where: { projectId: { in: plantas.map((p) => p.projectId!) } },
    select: { projectId: true, diaCorteMedidor: true },
  });
  const cortePorProyecto = new Map(configs.map((c) => [c.projectId, c.diaCorteMedidor]));
  const rangoDe = (projectId: string) => rangoDelPeriodo(periodo, cortePorProyecto.get(projectId) ?? null);

  // Un ciclo abierto no se ingiere: sus totales todavía cambian.
  plantas = plantas.filter((p) => periodoCerrado(periodo, cortePorProyecto.get(p.projectId!) ?? null));

  if (!plantas.length) {
    return { periodo, plantas: 0, guardadas: 0, omitidas: 0, items };
  }

  // Los meses calendario que tocan los ciclos (uno sin corte, dos con corte).
  const meses = new Map<string, { anio: number; mes: number }>();
  for (const p of plantas) {
    const r = rangoDe(p.projectId!);
    for (const fecha of [r.desde, r.hasta]) {
      const [anio, mes] = fecha.split("-").map(Number);
      meses.set(`${anio}-${mes}`, { anio, mes });
    }
  }

  const seriePorPlanta = new Map<string, DiaHuawei[]>();
  const fechasPorPlanta = new Map<string, Set<string>>();
  let primera = true;
  for (const { anio, mes } of meses.values()) {
    if (!primera) await huaweiPausa();
    primera = false;
    const { series, fechasReportadas } = await serieDiariaDelMes(
      plantas.map((p) => p.plantCode),
      anio,
      mes,
    );
    for (const [code, dias] of series) {
      seriePorPlanta.set(code, [...(seriePorPlanta.get(code) ?? []), ...dias]);
    }
    for (const [code, fechas] of fechasReportadas) {
      const acc = fechasPorPlanta.get(code) ?? new Set<string>();
      for (const f of fechas) acc.add(f);
      fechasPorPlanta.set(code, acc);
    }
  }

  let guardadas = 0;
  let omitidas = 0;

  for (const planta of plantas) {
    const { desde, hasta } = rangoDe(planta.projectId!);
    const enCiclo = (fecha: string) => fecha >= desde && fecha <= hasta;
    const dias = (seriePorPlanta.get(planta.plantCode) ?? []).filter((d) => enCiclo(d.fecha));
    // FusionSolar lista los días desde la conexión a red: una planta que arrancó
    // a mitad del ciclo no figura como si le faltaran datos.
    const diasEsperados = [...(fechasPorPlanta.get(planta.plantCode) ?? [])].filter(enCiclo).length;
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
        omitido: `sin datos en todo el período (0 de ${diasEsperados} días)`,
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
    // Completa los días que el medidor no reportó con el promedio de los que sí.
    const factor = suficiente && diasConDatos > 0 ? diasEsperados / diasConDatos : 1;
    const escalar = (campo: "consumoKwh" | "exportacionKwh" | "importacionKwh") =>
      Number((suma(campo) * factor).toFixed(2));

    const motivo = sinMedidor
      ? "la planta no tiene medidor: sólo se registra la generación"
      : !suficiente
        ? `sólo ${diasConDatos} de ${diasEsperados} días con datos (menos de la mitad del período): no se puede estimar el mes`
        : factor > 1
          ? `el medidor reportó ${diasConDatos} de ${diasEsperados} días; los ${diasEsperados - diasConDatos} faltantes se estimaron con el promedio diario`
          : null;

    const item: ItemIngestaHuawei = {
      ...base,
      generacionKwh: suma("generacionKwh"),
      consumoKwh: suficiente ? escalar("consumoKwh") : null,
      exportacionKwh: suficiente ? escalar("exportacionKwh") : null,
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
        importacionMedidaKwh: suficiente ? escalar("importacionKwh") : null,
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

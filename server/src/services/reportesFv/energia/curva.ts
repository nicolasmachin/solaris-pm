// Armado de la curva de un día (pestaña "Hora" de la vista de energía), a partir
// de lo que devuelve Growatt. Puro: sin base ni API, para poder testearlo.
//
// Dos formas de medir el consumo, según el inversor:
//
//  - INVERSOR (MIN, tipo 7): el medidor está conectado al inversor y cada
//    registro trae consumo, tomado de la red y exportado. Curva completa, cada
//    5 minutos, igual a la que muestra la aplicación de Growatt.
//  - MEDIDOR (MAX, tipo 4, o un MIN cuyo medidor no le llega): el inversor solo
//    da la producción, y lo de la red sale del medidor aparte. El medidor marca
//    la potencia tomada de la red, pero al exportar marca 0 (no negativo): lo
//    exportado se deduce de cuánto sube su contador. El contador avanza de a
//    0,1 kWh, que en 5 minutos son 1,2 kW de salto, así que se promedia en una
//    ventana de 30 minutos. El consumo queda = producción + red − exportado.
//    Menos fino que el del inversor, pero coherente con los totales.
//
// Sin medidor (ni en el inversor ni aparte) solo hay producción: consumo, red y
// exportado quedan null, y la pantalla lo dice. No se inventan.

import type { MuestraInversor, MuestraMedidorCurva } from "../growatt/client.js";

export type OrigenMedicion = "INVERSOR" | "MEDIDOR";

export interface PuntoCurva {
  /** "HH:MM" en hora de Uruguay, inicio del tramo de 5 minutos. */
  h: string;
  /** W */
  gen: number;
  consumo: number | null;
  deRed: number | null;
  aRed: number | null;
}

export interface TotalesDia {
  generacionKwh: number | null;
  consumoKwh: number | null;
  importacionKwh: number | null;
  exportacionKwh: number | null;
}

export interface CurvaArmada {
  puntos: PuntoCurva[];
  totales: TotalesDia;
  origenMedicion: OrigenMedicion | null;
}

const TRAMO_MS = 5 * 60 * 1000;
const VENTANA_EXPORT_MS = 30 * 60 * 1000;
const UY_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Inicio del tramo de 5 minutos (epoch ms) que contiene `ts`. */
function tramo(ts: Date): number {
  return Math.floor(ts.getTime() / TRAMO_MS) * TRAMO_MS;
}

function horaUy(ms: number): string {
  const d = new Date(ms - UY_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function promedio(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

const redondear2 = (n: number) => Math.round(n * 100) / 100;

/** Promedio por tramo de un campo, por inversor. */
function porTramo<T>(muestras: T[], ts: (m: T) => Date, valor: (m: T) => number | null): Map<number, number> {
  const acc = new Map<number, number[]>();
  for (const m of muestras) {
    const v = valor(m);
    if (v === null) continue;
    const k = tramo(ts(m));
    const arr = acc.get(k) ?? [];
    arr.push(v);
    acc.set(k, arr);
  }
  return new Map([...acc].map(([k, v]) => [k, promedio(v)]));
}

/** ¿Algún MIN trae medición de consumo/red en el día? (Todo en 0 = no le llega el medidor.) */
export function medidorEnInversor(inversores: MuestraInversor[][]): boolean {
  return inversores.some((muestras) =>
    muestras.some((m) => (m.consumo ?? 0) > 0 || (m.deRed ?? 0) > 0 || (m.aRed ?? 0) > 0),
  );
}

/** Contador acumulado interpolado en `t` (lineal entre muestras, constante en los bordes). */
function contadorEn(serie: { t: number; v: number }[], t: number): number {
  if (t <= serie[0].t) return serie[0].v;
  const ult = serie[serie.length - 1];
  if (t >= ult.t) return ult.v;
  let i = 1;
  while (serie[i].t < t) i++;
  const a = serie[i - 1];
  const b = serie[i];
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
}

/**
 * Lecturas posibles de un contador "de hoy" (eacToday, etoUserToday…), en orden
 * cronológico. Se suman los AUMENTOS entre muestras consecutivas, y en un
 * reinicio el valor nuevo cuenta entero (arranca de cero). Eso resuelve de una
 * las tres trampas de Growatt:
 *
 *  - Los contadores de los MIN se reinician cuando el inversor arranca con el
 *    sol, no a la medianoche: entre la medianoche y el amanecer arrastran el de
 *    ayer (y el de consumo sigue sumando la noche). Lo que suben esas horas sí
 *    es de hoy; el valor de arrastre no.
 *  - Si el equipo se reinicia a mitad del día (Ricca, 10-oct-2026: el contador
 *    daba 7,6 kWh y la curva 36), se suman los dos tramos.
 *  - Una baja chica es ruido de redondeo, no un reinicio: no suma ni resta.
 *
 * Lo único que no se sabe es si el PRIMER valor del día es de hoy (un contador
 * que se reinicia a la medianoche, como el del medidor aparte) o arrastre de
 * ayer. Por eso hay dos lecturas: sin contarlo y contándolo.
 */
function lecturasDelContador(vals: (number | null)[]): { pasos: number; conPrimero: number; primero: number } | null {
  const xs = vals.filter((v): v is number => v !== null);
  if (xs.length === 0) return null;
  let pasos = 0;
  for (let i = 1; i < xs.length; i++) {
    const prev = xs[i - 1];
    const v = xs[i];
    if (v >= prev) pasos += v - prev;
    else if (prev - v > 0.5 && v < prev * 0.5) pasos += v; // reinicio
    // si no, ruido: no suma
  }
  return { pasos, conPrimero: pasos + xs[0], primero: xs[0] };
}

/** Total de un contador sin curva para comparar (suma de tramos, contando el primero). */
export function acumuladoDelDia(vals: (number | null)[]): number | null {
  return lecturasDelContador(vals)?.conPrimero ?? null;
}

/**
 * Total del día de un contador. Con la curva integrada como árbitro se elige
 * entre contar o no el primer valor; si ninguna lectura se le parece (más de
 * 25 % y más de 1 kWh de diferencia), se usa la curva. Sin curva, el primer
 * valor se cuenta solo si es chico (≤ 1 kWh: parece de un contador que arrancó
 * a la medianoche, no un arrastre).
 */
export function totalDelContador(vals: (number | null)[], integralKwh: number | null): number | null {
  const l = lecturasDelContador(vals);
  if (!l) return integralKwh;
  if (integralKwh === null) return l.primero <= 1 ? l.conPrimero : l.pasos;
  const dif = (v: number) => Math.abs(v - integralKwh);
  const mejor = dif(l.pasos) <= dif(l.conPrimero) ? l.pasos : l.conPrimero;
  const lejos = dif(mejor) > Math.max(1, integralKwh * 0.25);
  return lejos ? integralKwh : mejor;
}

/** Energía (kWh) de una serie de potencias de 5 minutos (W). null si no hay datos. */
function integrar(puntos: PuntoCurva[], campo: "gen" | "consumo" | "deRed" | "aRed"): number | null {
  const vals = puntos.map((p) => p[campo]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return (vals.reduce((a, b) => a + b, 0) * 5) / 60 / 1000;
}

export function armarCurva(input: {
  /** Una lista de muestras por inversor de la planta. */
  inversores: MuestraInversor[][];
  /** Muestras del medidor aparte, si la planta lo tiene y hizo falta pedirlas. */
  medidor: MuestraMedidorCurva[] | null;
}): CurvaArmada {
  const { inversores, medidor } = input;
  const enInversor = medidorEnInversor(inversores);
  const conMedidor = !enInversor && !!medidor && medidor.some((m) => m.deRedHoyKwh !== null);
  const origen: OrigenMedicion | null = enInversor ? "INVERSOR" : conMedidor ? "MEDIDOR" : null;

  // Producción: suma de los inversores, tramo a tramo.
  const gen = new Map<number, number>();
  for (const muestras of inversores) {
    for (const [k, v] of porTramo(muestras, (m) => m.ts, (m) => m.pac)) {
      gen.set(k, (gen.get(k) ?? 0) + v);
    }
  }

  // Consumo y red.
  const consumo = new Map<number, number>();
  const deRed = new Map<number, number>();
  const aRed = new Map<number, number>();
  if (enInversor) {
    // Con varios MIN, todos ven el mismo medidor: se toma el mayor, no la suma.
    for (const muestras of inversores) {
      for (const [campo, destino] of [
        ["consumo", consumo],
        ["deRed", deRed],
        ["aRed", aRed],
      ] as const) {
        for (const [k, v] of porTramo(muestras, (m) => m.ts, (m) => m[campo])) {
          destino.set(k, Math.max(destino.get(k) ?? 0, v));
        }
      }
    }
  } else if (conMedidor && medidor) {
    for (const [k, v] of porTramo(medidor, (m) => m.ts, (m) => m.deRed)) deRed.set(k, Math.max(0, v));
    const exp = medidor
      .filter((m) => m.aRedHoyKwh !== null)
      .map((m) => ({ t: m.ts.getTime(), v: m.aRedHoyKwh as number }));
    const tramos = new Set<number>([...gen.keys(), ...deRed.keys()]);
    for (const k of tramos) {
      if (exp.length >= 2) {
        const centro = k + TRAMO_MS / 2;
        const kwh =
          contadorEn(exp, centro + VENTANA_EXPORT_MS / 2) - contadorEn(exp, centro - VENTANA_EXPORT_MS / 2);
        aRed.set(k, Math.max(0, (kwh * 1000 * 3_600_000) / VENTANA_EXPORT_MS));
      }
      // El medidor no reporta todos los tramos: sin dato de red no se arma consumo.
      if (deRed.has(k)) {
        consumo.set(k, Math.max(0, (gen.get(k) ?? 0) + (deRed.get(k) ?? 0) - (aRed.get(k) ?? 0)));
      }
    }
  }

  const claves = [...new Set([...gen.keys(), ...consumo.keys(), ...deRed.keys()])].sort((a, b) => a - b);
  const puntos: PuntoCurva[] = claves.map((k) => ({
    h: horaUy(k),
    gen: Math.round(gen.get(k) ?? 0),
    consumo: origen && consumo.has(k) ? Math.round(consumo.get(k)!) : null,
    deRed: origen && deRed.has(k) ? Math.round(deRed.get(k)!) : null,
    aRed: origen && aRed.has(k) ? Math.round(aRed.get(k)!) : null,
  }));

  // Totales: de los acumulados del día (lo que muestra Growatt), con la curva
  // integrada como árbitro (ver totalDelContador). Producción = suma de los
  // inversores, cada uno contra su propia curva.
  let generacionKwh: number | null = null;
  for (const muestras of inversores) {
    // Integral por tramos de 5 minutos, no por registro: algunos inversores
    // mandan más de un registro por tramo (Ricca: 194 en un día) y sumarlos
    // crudos inflaba la producción (48 kWh en vez de 36).
    const tramos = [...porTramo(muestras, (m) => m.ts, (m) => m.pac).values()];
    const integral = tramos.length ? (tramos.reduce((a, b) => a + b, 0) * 5) / 60 / 1000 : null;
    const hoy = totalDelContador(muestras.map((m) => m.genHoyKwh), integral);
    if (hoy !== null) generacionKwh = (generacionKwh ?? 0) + hoy;
  }

  let consumoKwh: number | null = null;
  let importacionKwh: number | null = null;
  let exportacionKwh: number | null = null;
  if (enInversor) {
    const maxDe = (campo: "consumoHoyKwh" | "deRedHoyKwh" | "aRedHoyKwh", curva: "consumo" | "deRed" | "aRed") => {
      const integral = integrar(puntos, curva);
      let m: number | null = null;
      for (const muestras of inversores) {
        const v = totalDelContador(muestras.map((x) => x[campo]), integral);
        if (v !== null) m = Math.max(m ?? 0, v);
      }
      return m;
    };
    consumoKwh = maxDe("consumoHoyKwh", "consumo");
    importacionKwh = maxDe("deRedHoyKwh", "deRed");
    exportacionKwh = maxDe("aRedHoyKwh", "aRed");
  } else if (conMedidor && medidor) {
    // El medidor aparte se reinicia a la medianoche (tiene reloj): su contador
    // vale tal cual, sin árbitro. Y no reporta de noche (Ricca: primera muestra
    // 06:16 con 10,9 kWh ya importados desde la medianoche), así que la curva no
    // sirve para compararlo: el primer valor es de hoy y cuenta.
    importacionKwh = acumuladoDelDia(medidor.map((m) => m.deRedHoyKwh));
    exportacionKwh = acumuladoDelDia(medidor.map((m) => m.aRedHoyKwh));
    if (generacionKwh !== null && importacionKwh !== null && exportacionKwh !== null) {
      consumoKwh = Math.max(0, generacionKwh + importacionKwh - exportacionKwh);
    }
  }

  const r = (n: number | null) => (n === null ? null : redondear2(n));
  return {
    puntos,
    totales: {
      generacionKwh: r(generacionKwh),
      consumoKwh: r(consumoKwh),
      importacionKwh: r(importacionKwh),
      exportacionKwh: r(exportacionKwh),
    },
    origenMedicion: origen,
  };
}

/** Autoconsumo y porcentajes del resumen (como los de la aplicación de Growatt). */
export function resumenEnergia(t: TotalesDia) {
  const gen = t.generacionKwh;
  const exp = t.exportacionKwh;
  const cons = t.consumoKwh;
  const autoconsumo = gen !== null && exp !== null ? Math.max(0, redondear2(gen - exp)) : null;
  const importado = t.importacionKwh ?? (cons !== null && autoconsumo !== null ? Math.max(0, redondear2(cons - autoconsumo)) : null);
  return { ...t, autoconsumoKwh: autoconsumo, importacionKwh: importado };
}

//   node --import tsx --test src/services/reportesFv/energia/curva.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { acumuladoDelDia, armarCurva, medidorEnInversor, resumenEnergia, totalDelContador } from "./curva.js";
import type { MuestraInversor, MuestraMedidorCurva } from "../growatt/client.js";

// 12:00 de Uruguay = 15:00 UTC.
const t = (hhmm: string) => new Date(`2026-10-12T${hhmm}:00-03:00`);

function inv(h: string, pac: number, extra: Partial<MuestraInversor> = {}): MuestraInversor {
  return {
    ts: t(h), pac, consumo: null, deRed: null, aRed: null,
    genHoyKwh: null, consumoHoyKwh: null, deRedHoyKwh: null, aRedHoyKwh: null, ...extra,
  };
}

test("MIN con medidor: curva y totales salen del inversor", () => {
  const muestras = [
    // Contadores coherentes con la curva (dos tramos de 5 minutos).
    inv("12:01", 3000, { consumo: 500, deRed: 0, aRed: 2500, genHoyKwh: 0.25, consumoHoyKwh: 0.04, deRedHoyKwh: 0, aRedHoyKwh: 0.2 }),
    inv("12:06", 2800, { consumo: 600, deRed: 0, aRed: 2200, genHoyKwh: 0.49, consumoHoyKwh: 0.09, deRedHoyKwh: 0, aRedHoyKwh: 0.4 }),
  ];
  const c = armarCurva({ inversores: [muestras], medidor: null });
  assert.equal(c.origenMedicion, "INVERSOR");
  assert.deepEqual(c.puntos[0], { h: "12:00", gen: 3000, consumo: 500, deRed: 0, aRed: 2500 });
  assert.deepEqual(c.puntos[1].h, "12:05");
  assert.deepEqual(c.totales, { generacionKwh: 0.49, consumoKwh: 0.09, importacionKwh: 0, exportacionKwh: 0.4 });
});

test("MIN sin medidor que le llegue: solo producción, el resto null", () => {
  const muestras = [inv("13:59", 660, { consumo: 0, deRed: 0, aRed: 0, genHoyKwh: 0.05 })];
  assert.equal(medidorEnInversor([muestras]), false);
  const c = armarCurva({ inversores: [muestras], medidor: null });
  assert.equal(c.origenMedicion, null);
  assert.deepEqual(c.puntos[0], { h: "13:55", gen: 660, consumo: null, deRed: null, aRed: null });
  assert.deepEqual(c.totales, { generacionKwh: 0.05, consumoKwh: null, importacionKwh: null, exportacionKwh: null });
});

test("MAX con medidor aparte: exportado sale del contador y consumo = prod + red − exportado", () => {
  const muestras = [
    inv("12:00", 3000, { genHoyKwh: 0.25 }),
    inv("12:30", 3000, { genHoyKwh: 0.5 }),
  ];
  // Exporta 1 kWh por cada media hora → 2 kW constantes; no toma de la red.
  const medidor: MuestraMedidorCurva[] = [
    { ts: t("11:30"), deRed: 0, deRedHoyKwh: 0.1, aRedHoyKwh: 5 },
    { ts: t("12:00"), deRed: 0, deRedHoyKwh: 0.1, aRedHoyKwh: 6 },
    { ts: t("12:30"), deRed: 0, deRedHoyKwh: 0.1, aRedHoyKwh: 7 },
    { ts: t("13:00"), deRed: 0, deRedHoyKwh: 0.1, aRedHoyKwh: 8 },
  ];
  const c = armarCurva({ inversores: [muestras], medidor });
  assert.equal(c.origenMedicion, "MEDIDOR");
  const p = c.puntos.find((x) => x.h === "12:00")!;
  assert.equal(p.aRed, 2000);
  assert.equal(p.consumo, 1000);
  // El consumo total no puede ser negativo: con estos datos de prueba se recorta a 0.
  // El medidor aparte se reinicia a la medianoche: lo que trae la primera
  // muestra (0,1) ya es de hoy y cuenta.
  assert.deepEqual(c.totales, { generacionKwh: 0.5, consumoKwh: 0, importacionKwh: 0.1, exportacionKwh: 8 });
});

test("varios inversores: la producción se suma", () => {
  const a = [inv("10:00", 1000, { genHoyKwh: 0.08 })];
  const b = [inv("10:02", 500, { genHoyKwh: 0.04 })];
  const c = armarCurva({ inversores: [a, b], medidor: null });
  assert.equal(c.puntos[0].gen, 1500);
  assert.equal(c.totales.generacionKwh, 0.12);
});

test("resumen: autoconsumo = producción − exportado", () => {
  // Caso real de la aplicación de Growatt (Rafael Ricca, 12-oct-2026).
  const r = resumenEnergia({ generacionKwh: 21.4, consumoKwh: 29.2, importacionKwh: 15.9, exportacionKwh: 8.1 });
  assert.equal(r.autoconsumoKwh, 13.3);
});

test("contador de hoy que se reinicia a mitad del día: se suman los tramos", () => {
  // Rafael Ricca, 10-oct-2026: el inversor se reinició y el contador volvió a 0.
  assert.equal(acumuladoDelDia([0, 5, 20, 28.4, 0.1, 3, 7.6]), 36);
  // Una baja chica es ruido, no reinicio: no suma ni resta.
  assert.equal(acumuladoDelDia([10, 10.7, 10.6, 11]), 11.1);
  assert.equal(acumuladoDelDia([null, null]), null);
});

test("consumo de la noche antes del amanecer (MIN): lo que sube el arrastre es de hoy", () => {
  // Arrastra 15,6 de ayer, sube 1,4 en la madrugada, se reinicia al amanecer y llega a 12.
  const vals = [15.6, 16.2, 17.0, 0, 4, 12];
  // La curva de consumo integra ~13,4 kWh en el día.
  assert.equal(Math.round(totalDelContador(vals, 13.4)! * 10) / 10, 13.4);
}); 

test("contador que arrastra el día anterior hasta que arranca el inversor: manda la curva", () => {
  // Belora, 13-oct-2026 a la 1 de la mañana: el contador dice 18,9 (de ayer) y no hubo sol.
  assert.equal(totalDelContador([18.9, 18.9, 18.9], 0), 0);
  // Día cerrado normal: el contador coincide con la curva.
  assert.equal(totalDelContador([0, 0, 5, 12, 18.9], 18), 18.9);
  // Reinicio a mitad del día (Ricca): la suma de tramos se parece a la curva.
  assert.equal(totalDelContador([0, 5, 20, 28.4, 0.1, 3, 7.6], 36), 36);
  // Arrastre de ayer y reinicio al amanecer: el valor final se parece a la curva.
  assert.equal(totalDelContador([15.6, 15.6, 0, 4, 18.9], 18), 18.9);
});

test("inversor que manda varios registros por tramo: la producción no se infla", () => {
  // Dos registros en el mismo tramo de 5 minutos (Ricca manda así a veces).
  const muestras = [
    inv("12:00", 3000, { genHoyKwh: 0.25 }),
    inv("12:02", 3000, { genHoyKwh: 0.35 }),
    inv("12:05", 3000, { genHoyKwh: 0.5 }),
  ];
  const c = armarCurva({ inversores: [muestras], medidor: null });
  assert.equal(c.totales.generacionKwh, 0.5);
});

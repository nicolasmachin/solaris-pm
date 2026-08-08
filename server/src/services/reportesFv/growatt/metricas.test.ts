// Tests de la lógica de derivación de métricas Growatt (sin API).
// Correr: npm run test:reportes-fv-growatt

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  contarDiasEsperados,
  derivarMetricas,
  diasConMuestras,
  resumirHistorialDiario,
  type MuestraMedidor,
} from "./metricas.js";
import { rangoDelPeriodo } from "../periodo.js";

function muestra(dia: string, imp: number, exp: number): MuestraMedidor {
  return { time: `${dia} 12:00:00`, positiveActiveTodayEnergy: imp, reverseActiveTodayEnergy: exp };
}

test("resumirHistorialDiario suma el máximo de cada día", () => {
  const muestras: MuestraMedidor[] = [
    { time: "2026-06-01 08:00", positiveActiveTodayEnergy: 2, reverseActiveTodayEnergy: 1 },
    { time: "2026-06-01 18:00", positiveActiveTodayEnergy: 5, reverseActiveTodayEnergy: 3 }, // máx del día 1
    { time: "2026-06-02 18:00", positiveActiveTodayEnergy: 4, reverseActiveTodayEnergy: 2 },
  ];
  // importación: max(2,5) + 4 = 9 ; exportación: max(1,3) + 2 = 5
  assert.equal(resumirHistorialDiario(muestras, "positiveActiveTodayEnergy"), 9);
  assert.equal(resumirHistorialDiario(muestras, "reverseActiveTodayEnergy"), 5);
});

test("resumirHistorialDiario devuelve null sin muestras útiles", () => {
  assert.equal(resumirHistorialDiario([], "positiveActiveTodayEnergy"), null);
  assert.equal(
    resumirHistorialDiario([{ time: "", positiveActiveTodayEnergy: 5 }], "positiveActiveTodayEnergy"),
    null,
  );
});

test("diasConMuestras cuenta días distintos", () => {
  const m = [muestra("2026-06-01", 1, 0), muestra("2026-06-01", 2, 0), muestra("2026-06-03", 1, 0)];
  assert.equal(diasConMuestras(m).size, 2);
});

test("contarDiasEsperados no cuenta días futuros", () => {
  const inicio = new Date(Date.UTC(2026, 5, 1)); // 1 jun
  const fin = new Date(Date.UTC(2026, 5, 30)); // 30 jun
  // Si hoy es después de fin de mes: los 30 días.
  assert.equal(contarDiasEsperados(inicio, fin, new Date(Date.UTC(2026, 6, 15))), 30);
  // Si hoy es 10 de junio: sólo 10 días transcurridos.
  assert.equal(contarDiasEsperados(inicio, fin, new Date(Date.UTC(2026, 5, 10))), 10);
  // Si hoy es antes del inicio: 0.
  assert.equal(contarDiasEsperados(inicio, fin, new Date(Date.UTC(2026, 4, 1))), 0);
});

test("derivarMetricas calcula consumo = generación + importación - exportación", () => {
  const muestras = [muestra("2026-06-01", 100, 50)];
  const r = derivarMetricas({
    generacionKwh: 500,
    muestras,
    diasEsperados: 1,
    coberturaMinima: 0.9,
  });
  assert.equal(r.importacionMedidaKwh, 100);
  assert.equal(r.exportacionKwh, 50);
  assert.equal(r.consumoKwh, 550); // 500 + 100 - 50
  assert.equal(r.motivoDescarte, null);
});

test("derivarMetricas conserva los datos aunque la cobertura sea baja, y lo marca", () => {
  // 5 días de 30 = 17%. Antes se borraban consumo y exportación y el generador
  // se quedaba sin reporte hasta que alguien los cargara a mano — en la práctica,
  // meses sin mandarle nada al cliente. Ahora el dato se conserva y el reporte
  // sale con una nota que aclara que la medición fue parcial.
  const muestras = Array.from({ length: 5 }, (_, i) =>
    muestra(`2026-06-0${i + 1}`, 10, 5),
  );
  const r = derivarMetricas({
    generacionKwh: 500,
    muestras,
    diasEsperados: 30,
    coberturaMinima: 0.9,
  });
  assert.equal(r.diasConDatos, 5);
  // importación 5×10 = 50, exportación 5×5 = 25 → consumo 500 + 50 − 25.
  assert.equal(r.consumoKwh, 525);
  assert.equal(r.exportacionKwh, 25);
  assert.equal(r.importacionMedidaKwh, 50);
  // El motivo queda registrado: es lo que dispara la nota del PDF y lo que se
  // ve en el panel.
  assert.ok(r.motivoDescarte?.includes("5 de 30"));
  assert.equal(r.generacionKwh, 500);
});

test("derivarMetricas no marca nada cuando la cobertura alcanza", () => {
  const muestras = Array.from({ length: 30 }, (_, i) =>
    muestra(`2026-06-${String(i + 1).padStart(2, "0")}`, 10, 5),
  );
  const r = derivarMetricas({
    generacionKwh: 500,
    muestras,
    diasEsperados: 30,
    coberturaMinima: 0.9,
  });
  assert.equal(r.motivoDescarte, null);
  assert.equal(r.diasConDatos, 30);
});

test("sin ninguna muestra del medidor no hay consumo que reportar", () => {
  // Distinto del caso anterior: acá no es medición parcial, es medición nula.
  // El reporte no puede salir porque no hay ningún dato de consumo.
  const r = derivarMetricas({
    generacionKwh: 500,
    muestras: [],
    diasEsperados: 30,
    coberturaMinima: 0.9,
  });
  assert.equal(r.consumoKwh, null);
  assert.equal(r.exportacionKwh, null);
  assert.equal(r.diasConDatos, 0);
});

test("derivarMetricas deja consumo null si falta generación", () => {
  const r = derivarMetricas({
    generacionKwh: null,
    muestras: [muestra("2026-06-01", 100, 50)],
    diasEsperados: 1,
    coberturaMinima: 0.9,
  });
  assert.equal(r.consumoKwh, null);
  assert.equal(r.exportacionKwh, 50); // exportación sí se mide
});

test("rangoDelPeriodo sin día de corte = mes calendario", () => {
  const r = rangoDelPeriodo("2026-06", null);
  assert.equal(r.desde, "2026-06-01");
  assert.equal(r.hasta, "2026-06-30");
  assert.equal(r.dias, 30);
  assert.equal(r.esCalendario, true);
});

test("rangoDelPeriodo con día de corte = ciclo del medidor", () => {
  // Día de corte 23: el reporte de junio va del 24 de mayo al 23 de junio.
  const r = rangoDelPeriodo("2026-06", 23);
  assert.equal(r.desde, "2026-05-24");
  assert.equal(r.hasta, "2026-06-23");
  assert.equal(r.esCalendario, false);
  assert.equal(r.dias, 31); // 24-31 mayo (8) + 1-23 junio (23) = 31
});

test("rangoDelPeriodo acota el día de corte a meses cortos", () => {
  // Día de corte 31 en febrero → se acota al último día de cada mes.
  const r = rangoDelPeriodo("2026-02", 31);
  assert.equal(r.hasta, "2026-02-28"); // febrero se acota a 28
  assert.equal(r.desde, "2026-02-01"); // 31 de enero + 1 = 1 de febrero
});

test("rangoDelPeriodo cruza el año", () => {
  const r = rangoDelPeriodo("2026-01", 23);
  assert.equal(r.desde, "2025-12-24");
  assert.equal(r.hasta, "2026-01-23");
});

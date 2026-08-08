// Tests de la detección de "genera pero no inyecta".
// Correr: npm run test:fv-exportacion

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  evaluarExportacion,
  leerUmbralesExportacion,
  UMBRALES_EXPORTACION,
  type DiaExportacion,
} from "./exportacion.js";
import { rangoDias, sumarDias } from "./dias.js";

const DIA = "2026-08-06";

/** Serie terminando en DIA. El último par del array es el día evaluado. */
function serie(dias: Array<[number | null, number | null]>): Map<string, DiaExportacion> {
  const fechas = rangoDias(sumarDias(DIA, -(dias.length - 1)), DIA);
  return new Map(
    fechas.map((f, i) => [f, { generacionKwh: dias[i][0], exportacionKwh: dias[i][1] }]),
  );
}

const base = { dia: DIA, umbrales: UMBRALES_EXPORTACION };

test("un solo día sin exportar NO alerta", () => {
  // Puede haber sido un día de mucho consumo en la casa.
  const r = evaluarExportacion({ ...base, historial: serie([[20, 8], [18, 0]]) });
  assert.equal(r.alerta, false);
  assert.equal(r.diasSinExportar, 1);
});

test("dos días seguidos generando bien y sin inyectar SÍ alerta", () => {
  const r = evaluarExportacion({ ...base, historial: serie([[20, 8], [18, 0], [19, 0]]) });
  assert.equal(r.alerta, true);
  assert.equal(r.diasSinExportar, 2);
  assert.match(r.detalle!, /no inyectó/);
  assert.match(r.detalle!, /limitada/);
});

test("cuenta la racha completa, no sólo dos", () => {
  const r = evaluarExportacion({
    ...base,
    historial: serie([[20, 5], [18, 0], [19, 0], [21, 0], [17, 0]]),
  });
  assert.equal(r.diasSinExportar, 4);
  // 18+19+21+17 = 75 kWh generados sin inyectar nada.
  assert.match(r.detalle!, /75 kWh/);
});

test("si exportó algo, se corta la racha", () => {
  const r = evaluarExportacion({ ...base, historial: serie([[18, 0], [19, 0], [20, 6]]) });
  assert.equal(r.alerta, false);
  assert.equal(r.diasSinExportar, 0);
});

test("un día sin dato del medidor corta la racha en vez de sumarla", () => {
  // Ésta es la distinción central: exportó cero ≠ no sabemos cuánto exportó.
  // El smart meter falla seguido; tratar el null como cero llenaría el panel de
  // alertas falsas.
  const r = evaluarExportacion({ ...base, historial: serie([[18, 0], [19, null], [20, 0]]) });
  assert.equal(r.alerta, false);
  assert.equal(r.diasSinExportar, 1);
});

test("los días de poca generación no cuentan", () => {
  // Un día nublado que generó 2 kWh y no exportó no prueba nada: se autoconsumió.
  const r = evaluarExportacion({ ...base, historial: serie([[20, 0], [2, 0], [18, 0]]) });
  assert.equal(r.alerta, false);
  assert.equal(r.diasSinExportar, 1);
});

test("exportación por debajo del umbral cuenta como no exportar", () => {
  // 0,2 kWh en un día que generó 18 no es inyección, es ruido de medición.
  const r = evaluarExportacion({ ...base, historial: serie([[18, 0.2], [19, 0.1]]) });
  assert.equal(r.alerta, true);
});

test("historial vacío o sin el día evaluado no alerta", () => {
  assert.equal(evaluarExportacion({ ...base, historial: new Map() }).alerta, false);
  const sinElDia = new Map([[sumarDias(DIA, -1), { generacionKwh: 20, exportacionKwh: 0 }]]);
  assert.equal(evaluarExportacion({ ...base, historial: sinElDia }).alerta, false);
});

test("el umbral de días se puede subir por entorno", () => {
  const umbrales = { ...UMBRALES_EXPORTACION, diasSeguidos: 3 };
  const dos = evaluarExportacion({ ...base, umbrales, historial: serie([[18, 0], [19, 0]]) });
  assert.equal(dos.alerta, false);
  const tres = evaluarExportacion({ ...base, umbrales, historial: serie([[18, 0], [19, 0], [20, 0]]) });
  assert.equal(tres.alerta, true);
});

test("leerUmbralesExportacion trata la cadena vacía como no configurada", () => {
  // docker-compose pasa "" cuando el compose declara ${VAR:-} sin valor, y
  // Number("") es 0: sin el guard, el umbral de días quedaría en 0 y alertaría
  // por cualquier cosa.
  const vacias = leerUmbralesExportacion({
    FV_MONITOR_EXPORT_DIAS: "",
    FV_MONITOR_EXPORT_GEN_MIN: "",
    FV_MONITOR_EXPORT_MAX: "",
  } as NodeJS.ProcessEnv);
  assert.deepEqual(vacias, UMBRALES_EXPORTACION);

  const puesto = leerUmbralesExportacion({ FV_MONITOR_EXPORT_DIAS: "3" } as NodeJS.ProcessEnv);
  assert.equal(puesto.diasSeguidos, 3);
});

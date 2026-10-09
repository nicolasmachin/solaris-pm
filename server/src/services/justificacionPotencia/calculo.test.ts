import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularBalance, fmtNum, kwhMesDeCarga } from "./calculo.js";
import { datosSchema, type DatosJustificacionInput } from "./schema.js";
import { textosAutomaticos, textosFinales } from "./textos.js";

// Caso real: informe "Soler" (31/03/2026). UTE decía que el balance daba para
// 17 kW; con este informe abrió caso por 25 kW.
const soler: DatosJustificacionInput = {
  tipoSolicitud: "NUEVA",
  cliente: { nombre: "SOLER LALINDE, MARIA VICTORIA", documento: "4.325.104-2", cuentaUte: "8989422522", ubicacion: "Ruta 2 km 281, Río Negro" },
  firmante: { nombre: "Ing. Nicolás Machín", ci: "4.139.492-7" },
  potenciaSolicitadaKw: 25,
  potenciaUteKw: 17,
  consumoAnualActualKwh: 24_000,
  cargas: [
    { id: "1", tipo: "CARGA", concepto: "Cinco cabañas nuevas", modo: "DESGLOSE", potenciaKw: 2, horasDia: 6, diasMes: 8, cantidad: 5 },
    { id: "2", tipo: "CARGA", concepto: "Piscina y sistema de circulación", modo: "DESGLOSE", potenciaKw: 1, horasDia: 6, diasMes: 30 },
    { id: "3", tipo: "UNIFICACION", concepto: "Unificación de suministro", cuentaUte: "4176411000", kwhMes: 450 },
  ],
};

test("kWh/mes desglosado = kW × h × días × cantidad (cantidad vacía = 1)", () => {
  const d = datosSchema.parse(soler);
  assert.equal(kwhMesDeCarga(d.cargas[0]), 480);
  assert.equal(kwhMesDeCarga(d.cargas[1]), 180);
  assert.equal(kwhMesDeCarga(d.cargas[2]), 450);
});

test("balance anual: actual + incremento × 12 contra kW × productividad", () => {
  const b = calcularBalance(datosSchema.parse(soler));
  assert.equal(b.incrementoMensualKwh, 1110);
  assert.equal(b.incrementoAnualKwh, 13_320);
  assert.equal(b.consumoAnualProyectadoKwh, 37_320);
  assert.equal(b.productividadKwhKw, 1450); // default
  assert.equal(b.generacionAnualKwh, 36_250);
  assert.equal(b.cumpleBalance, true);
  assert.equal(b.potenciaJustificadaKw, 25.73);
});

test("si la generación supera el consumo, no cumple y dice hasta cuánto da", () => {
  const b = calcularBalance(datosSchema.parse({ ...soler, potenciaSolicitadaKw: 30 }));
  assert.equal(b.cumpleBalance, false);
  const t = textosAutomaticos(datosSchema.parse({ ...soler, potenciaSolicitadaKw: 30 }), b);
  assert.match(t.conclusion, /hasta 25,73 kW/);
});

test("estimación directa y cuenta sin consumo histórico (caso ESTILO)", () => {
  const d = datosSchema.parse({
    ...soler,
    consumoAnualActualKwh: null,
    potenciaUteKw: null,
    potenciaSolicitadaKw: 19,
    cargas: [
      { id: "a", tipo: "UNIFICACION", concepto: "Cuenta anterior", cuentaUte: "8355290000", potenciaContratadaKw: 9.2, kwhMes: 450 },
      { id: "b", tipo: "UNIFICACION", concepto: "Cuenta anterior", cuentaUte: "6965430000", potenciaContratadaKw: 7.4, kwhMes: 850 },
      { id: "c", tipo: "UNIFICACION", concepto: "Cuenta anterior", cuentaUte: "3055800000", potenciaContratadaKw: 7.4, kwhMes: 300 },
      { id: "d", tipo: "CARGA", concepto: "Aumento por nueva infraestructura", modo: "DIRECTO", kwhMes: 500 },
    ],
  });
  const b = calcularBalance(d);
  assert.equal(b.incrementoMensualKwh, 2100);
  assert.equal(b.consumoAnualProyectadoKwh, 25_200);
  assert.equal(b.cargas[0].formula, "Cuenta 8355290000 · 9,2 kW contratados");
  assert.equal(b.cargas[3].formula, "Estimación global");
  assert.equal(b.cumpleBalance, false); // 19 × 1450 = 27.550 > 25.200
  const t = textosAutomaticos(d, b);
  assert.match(t.justificacion, /consumo futuro estimado de 2\.100 kWh\/mes/);
});

test("los textos escritos a mano ganan; los vacíos se completan solos", () => {
  const d = datosSchema.parse({ ...soler, textos: { objeto: "Mi objeto.", antecedentes: "  ", justificacion: "", conclusion: "" } });
  const t = textosFinales(d, calcularBalance(d));
  assert.equal(t.objeto, "Mi objeto.");
  assert.match(t.antecedentes, /no resulta representativo/);
  assert.match(t.conclusion, /\(cinco cabañas nuevas, piscina y sistema de circulación y unificación de suministro\)/);
});

test("fmtNum usa formato uruguayo", () => {
  assert.equal(fmtNum(1600), "1.600");
  assert.equal(fmtNum(25.5, 2), "25,5");
});

test("sin consumo cargado pero con la potencia de UTE: el consumo actual se deduce de esa potencia", () => {
  const b = calcularBalance(datosSchema.parse({ ...soler, consumoAnualActualKwh: null }));
  assert.equal(b.consumoActualEstimadoDesdeUte, true);
  assert.equal(b.consumoAnualActualKwh, 24_650); // 17 kW × 1.450
  assert.equal(b.consumoAnualProyectadoKwh, 24_650 + 13_320);
  assert.match(textosAutomaticos(datosSchema.parse({ ...soler, consumoAnualActualKwh: null }), b).justificacion, /del orden de 24\.650 kWh anuales/);
});

test("consumo cargado a mano le gana a la estimación por UTE; sin ninguno de los dos es cuenta nueva", () => {
  assert.equal(calcularBalance(datosSchema.parse(soler)).consumoActualEstimadoDesdeUte, false);
  const nueva = calcularBalance(datosSchema.parse({ ...soler, consumoAnualActualKwh: null, potenciaUteKw: null }));
  assert.equal(nueva.consumoActualEstimadoDesdeUte, false);
  assert.equal(nueva.consumoAnualActualKwh, 0);
  assert.equal(nueva.consumoAnualProyectadoKwh, 13_320);
});

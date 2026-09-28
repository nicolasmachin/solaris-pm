// Plazos de un daño por granizo (Condiciones generales, secciones 6 y 7).
// Correr: npm run test:seguro-granizo

import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularPlazosDanio, type DanioParaPlazos } from "./plazos.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: string | Date | null | undefined) => (x instanceof Date ? x.toISOString().slice(0, 10) : x);

const base: DanioParaPlazos = {
  estado: "REPORTADO",
  fechaEvento: d("2026-10-05"), // lunes
  fechaAviso: d("2026-10-06"),
  fechaInspeccion: null,
  fechaReposicion: null,
  eventoMasivo: false,
};

test("aviso: 10 días hábiles desde el granizo", () => {
  assert.equal(calcularPlazosDanio({ ...base, fechaAviso: d("2026-10-19") }, d("2026-10-19")).avisoFueraDePlazo, false);
  assert.equal(calcularPlazosDanio({ ...base, fechaAviso: d("2026-10-20") }, d("2026-10-20")).avisoFueraDePlazo, true);
});

test("inspección: vence a los 10 días hábiles del aviso y avisa vencido", () => {
  const p = calcularPlazosDanio(base, d("2026-10-07"));
  assert.equal(iso(p.inspeccion.limite), "2026-10-20");
  assert.equal(p.pendiente?.etapa, "INSPECCION");
  assert.equal(p.pendiente?.vencido, false);
  assert.equal(calcularPlazosDanio(base, d("2026-10-21")).pendiente?.vencido, true);
});

test("reposición: 30 días desde la inspección, 60 si el evento es masivo", () => {
  const insp = { ...base, estado: "EVALUADO" as const, fechaInspeccion: d("2026-10-10") };
  assert.equal(iso(calcularPlazosDanio(insp, d("2026-10-11")).reposicion?.limite), "2026-11-09");
  assert.equal(iso(calcularPlazosDanio({ ...insp, eventoMasivo: true }, d("2026-10-11")).reposicion?.limite), "2026-12-09");
  const repuesto = { ...insp, estado: "REPUESTO" as const, fechaReposicion: d("2026-11-20") };
  const p = calcularPlazosDanio(repuesto, d("2026-11-21"));
  assert.equal(p.reposicion?.cumplido, false);
  assert.equal(p.pendiente, null);
});

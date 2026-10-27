// Tests de la lectura del History Data. Correr: npm run test:growatt-historial
import assert from "node:assert/strict";
import { test } from "node:test";

import { analizarHistorial } from "./historial-analisis.js";
import type { RegistroTlx } from "./web.client.js";

function reg(time: string, v1: number, i1: number, v2: number, i2: number, extra: Partial<RegistroTlx> = {}): RegistroTlx {
  return {
    time, status: 1, ppv: v1 * i1 + v2 * i2, pac: (v1 * i1 + v2 * i2) * 0.97,
    vpv: [v1, v2, 0, 0], ipv: [i1, i2, 0, 0], ppvN: [v1 * i1, v2 * i2, 0, 0],
    vac1: 230, fac: 50, temp1: 35, eacToday: 0, etoGridToday: 0, etoUserToday: 0, elocalLoadToday: 0,
    pacToGrid: 0, pacToUser: 0, pacToLocalLoad: 0, faultType: 0, warnCode: 0, deratingMode: 0, realOPPercent: 0,
    ...extra,
  };
}
function dia(d: string, f: (h: number) => [number, number, number, number]): RegistroTlx[] {
  const out: RegistroTlx[] = [];
  for (let m = 9 * 60; m <= 16 * 60; m += 5) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0"), mm = String(m % 60).padStart(2, "0");
    out.push(reg(`${d} ${hh}:${mm}:00`, ...f(m / 60)));
  }
  return out;
}

test("caso Vallegra: PV1 vacía y PV2 clavada en 16 A", () => {
  const rs = dia("2026-10-20", (h) => [3.7, 0, 255, Math.min(16, 4 + Math.sin(((h - 9) / 7) * Math.PI) * 20)]);
  const a = analizarHistorial(rs, { kwp: 7.08, hoy: "2026-10-27" });
  assert.ok(a.avisos.some((x) => /PV1 no tiene tensión/.test(x)));
  assert.ok(a.avisos.some((x) => /PV2 llega a 16 A/.test(x) && /paralelo/.test(x)));
});

test("picos normales de un día de sol no son techo", () => {
  // Como Santiago Pons el 26/10: máximo 13,7 A en unos pocos registros.
  const rs = dia("2026-10-26", (h) => { const i = 1 + Math.sin(((h - 9) / 7) * Math.PI) * 12.7; return [260, i, 214, i]; });
  const a = analizarHistorial(rs, { hoy: "2026-10-27" });
  assert.equal(a.avisos.filter((x) => /techo/.test(x)).length, 0);
});

test("planta sana: sin avisos de entradas", () => {
  const rs = dia("2026-10-20", (h) => { const i = 2 + Math.sin(((h - 9) / 7) * Math.PI) * 9; return [255, i, 255, i]; });
  const a = analizarHistorial(rs, { kwp: 7.08, hoy: "2026-10-27" });
  assert.equal(a.avisos.filter((x) => /PV\d/.test(x)).length, 0);
});

test("corte de comunicación a media tarde se detecta", () => {
  const rs = dia("2026-10-21", () => [255, 8, 255, 8]).filter((r) => r.time <= "2026-10-21 14:51:00");
  const a = analizarHistorial(rs, { hasta: "2026-10-27", hoy: "2026-10-27" });
  assert.ok(a.avisos.some((x) => /dejó de comunicar/.test(x)));
});

test("la noche no es un hueco; un día cortado sí", () => {
  const d1 = dia("2026-10-25", () => [255, 8, 255, 8]);
  const d2 = dia("2026-10-26", () => [255, 8, 255, 8]);
  assert.equal(analizarHistorial([...d1, ...d2]).huecos.length, 0);
  const cortado = [...d1.filter((r) => r.time < "2026-10-25 13:05"), ...d2.filter((r) => r.time > "2026-10-26 16:00")];
  assert.equal(analizarHistorial(cortado).huecos.length, 1);
});

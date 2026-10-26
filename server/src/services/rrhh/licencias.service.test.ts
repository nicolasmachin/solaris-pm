import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularSaldo, contarDiasHabiles, contingenteSugerido } from "./licencias.service.js";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test("cuenta lunes a viernes sin feriados", () => {
  assert.equal(contarDiasHabiles(d("2026-11-03"), d("2026-11-14")), 9); // martes a sábado de la semana siguiente
  assert.equal(contarDiasHabiles(d("2026-12-21"), d("2026-12-31")), 8); // saca el 25 de diciembre
  assert.equal(contarDiasHabiles(d("2026-11-07"), d("2026-11-08")), 0); // fin de semana
});

test("contingente sugerido por antigüedad", () => {
  assert.equal(contingenteSugerido(null, 2025), 20);
  assert.equal(contingenteSugerido(d("2025-07-01"), 2025), 10); // entró a mitad de año: proporcional
  assert.equal(contingenteSugerido(d("2027-01-01"), 2026), 0); // todavía no había entrado
  assert.equal(contingenteSugerido(d("2022-03-01"), 2025), 20); // 3 años
  assert.equal(contingenteSugerido(d("2020-03-01"), 2025), 21); // 5 años: +1
  assert.equal(contingenteSugerido(d("2016-03-01"), 2025), 22); // 9 años: +2
});

test("saldo: lo pedido ya se descuenta, solo cuenta la licencia anual", () => {
  const saldo = calcularSaldo(
    [{ dias: 20 }, { dias: 21 }],
    [
      { tipo: "ANUAL", estado: "APROBADA", dias: 10 },
      { tipo: "ANUAL", estado: "SOLICITADA", dias: 5 },
      { tipo: "ANUAL", estado: "RECHAZADA", dias: 7 },
      { tipo: "ANUAL", estado: "CANCELADA", dias: 3 },
      { tipo: "ENFERMEDAD", estado: "APROBADA", dias: 4 },
    ],
  );
  assert.deepEqual(saldo, { generados: 41, tomados: 10, pedidos: 5, disponibles: 26 });
});

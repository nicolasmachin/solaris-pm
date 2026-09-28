// Tests del estado del plan de granizo contra las Condiciones generales
// (sección 5: carencia, gracia, suspensión, baja) y de la aritmética de fechas.
// Correr: npm run test:seguro-granizo

import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularEstadoPoliza, cubiertoEn, type PeriodoParaEstado, type PolizaParaEstado } from "./estado.js";
import { sumarUnAnio } from "./fechas.js";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

// Cliente que se adhirió con la obra: sin carencia, firmado.
const obra: PolizaParaEstado = { estado: "ACTIVA", montoAnualUsd: 120, sinCarencia: true, anexoFirmadoEn: d("2025-12-01") };
// Cliente existente: con carencia, firmado.
const existente: PolizaParaEstado = { ...obra, sinCarencia: false };

const per = (
  numero: number,
  desde: string,
  hasta: string,
  fechaPago: string | null,
  inicioAlPagar = false,
): PeriodoParaEstado => ({
  id: `p${numero}`,
  numero,
  desde: d(desde),
  hasta: d(hasta),
  montoUsd: 120,
  pagado: fechaPago != null,
  fechaPago: fechaPago ? d(fechaPago) : null,
  inicioAlPagar,
});

test("sumarUnAnio: caso normal y 29 de febrero", () => {
  assert.equal(iso(sumarUnAnio(d("2026-09-28"))), "2027-09-28");
  assert.equal(iso(sumarUnAnio(d("2028-02-29"))), "2029-02-28");
});

test("contratado con la obra y sin puesta en marcha: pendiente de inicio", () => {
  const e = calcularEstadoPoliza({ ...obra, estado: "PENDIENTE_INICIO" }, [], d("2026-09-28"));
  assert.equal(e.estado, "PENDIENTE_INICIO");
  assert.equal(e.coberturaActiva, false);
});

test("sin primer pago no hay cobertura (sin gracia en el año 1)", () => {
  const e = calcularEstadoPoliza(obra, [per(1, "2026-01-10", "2027-01-10", null)], d("2026-01-12"));
  assert.equal(e.estado, "PENDIENTE_ACTIVACION");
  assert.equal(e.faltaPago, true);
  assert.equal(e.coberturaActiva, false);
});

test("pago sin Anexo A firmado: no hay cobertura", () => {
  const e = calcularEstadoPoliza({ ...obra, anexoFirmadoEn: null }, [per(1, "2026-01-10", "2027-01-10", "2026-01-05")], d("2026-03-01"));
  assert.equal(e.estado, "PENDIENTE_ACTIVACION");
  assert.equal(e.faltaFirma, true);
  assert.equal(e.coberturaActiva, false);
});

test("adhesión con la obra: sin carencia, cubre desde la puesta en marcha", () => {
  const periodos = [per(1, "2026-01-10", "2027-01-10", "2026-01-05")];
  const e = calcularEstadoPoliza(obra, periodos, d("2026-01-10"));
  assert.equal(e.estado, "VIGENTE");
  assert.equal(e.coberturaActiva, true);
  assert.equal(iso(e.coberturaDesde), "2026-01-10");
});

test("cliente existente: el año arranca al pago + 30 y antes está en carencia", () => {
  // Pagó el 1/3; el año quedó fijado del 31/3 al 31/3 del año siguiente.
  const periodos = [per(1, "2026-03-31", "2027-03-31", "2026-03-01", true)];
  const enCarencia = calcularEstadoPoliza(existente, periodos, d("2026-03-15"));
  assert.equal(enCarencia.estado, "EN_CARENCIA");
  assert.equal(enCarencia.coberturaActiva, false);
  assert.equal(iso(enCarencia.coberturaDesde), "2026-03-31");
  assert.equal(calcularEstadoPoliza(existente, periodos, d("2026-03-31")).estado, "VIGENTE");
});

test("por vencer a 30 días con la siguiente anualidad sin pagar; a 31 todavía no", () => {
  const periodos = [per(1, "2026-01-10", "2027-01-10", "2026-01-05"), per(2, "2027-01-10", "2028-01-10", null)];
  const e = calcularEstadoPoliza(obra, periodos, d("2026-12-11"));
  assert.equal(e.estado, "POR_VENCER");
  assert.equal(e.alerta, true);
  assert.equal(e.diasParaVencer, 30);
  assert.equal(e.proximoCobro?.periodoId, "p2");
  assert.equal(calcularEstadoPoliza(obra, periodos, d("2026-12-10")).estado, "VIGENTE");
});

test("renovación ya paga: no avisa aunque falten pocos días", () => {
  const periodos = [per(1, "2026-01-10", "2027-01-10", "2026-01-05"), per(2, "2027-01-10", "2028-01-10", "2026-12-20")];
  assert.equal(calcularEstadoPoliza(obra, periodos, d("2027-01-05")).estado, "VIGENTE");
});

test("gracia de 15 días: en gracia cubre; el día 16 queda suspendido sin cobertura", () => {
  const periodos = [per(1, "2026-01-10", "2027-01-10", "2026-01-05"), per(2, "2027-01-10", "2028-01-10", null)];
  const enGracia = calcularEstadoPoliza(obra, periodos, d("2027-01-25"));
  assert.equal(enGracia.estado, "EN_GRACIA");
  assert.equal(enGracia.coberturaActiva, true);
  assert.equal(enGracia.alerta, true);
  assert.equal(enGracia.deudaUsd, 120);
  const suspendida = calcularEstadoPoliza(obra, periodos, d("2027-01-26"));
  assert.equal(suspendida.estado, "SUSPENDIDA");
  assert.equal(suspendida.coberturaActiva, false);
});

test("renovación pagada en término no corta; pagada tarde corre nueva carencia", () => {
  const enTermino = [per(1, "2026-01-10", "2027-01-10", "2026-01-05"), per(2, "2027-01-10", "2028-01-10", "2027-01-20")];
  assert.equal(calcularEstadoPoliza(obra, enTermino, d("2027-01-21")).estado, "VIGENTE");

  const tarde = [per(1, "2026-01-10", "2027-01-10", "2026-01-05"), per(2, "2027-01-10", "2028-01-10", "2027-03-01")];
  const e = calcularEstadoPoliza(obra, tarde, d("2027-03-15"));
  assert.equal(e.estado, "EN_CARENCIA");
  assert.equal(iso(e.coberturaDesde), "2027-03-31");
  assert.equal(calcularEstadoPoliza(obra, tarde, d("2027-03-31")).estado, "VIGENTE");
});

test("vencida si se terminó la última anualidad sin renovar", () => {
  const e = calcularEstadoPoliza(obra, [per(1, "2026-01-10", "2027-01-10", "2026-01-05")], d("2027-01-10"));
  assert.equal(e.estado, "VENCIDA");
  assert.equal(e.coberturaActiva, false);
});

test("baja: cubre hasta el fin del período pago", () => {
  const cancelada = { ...obra, estado: "CANCELADA" as const };
  const periodos = [per(1, "2026-01-10", "2027-01-10", "2026-01-05")];
  const durante = calcularEstadoPoliza(cancelada, periodos, d("2026-06-01"));
  assert.equal(durante.estado, "CANCELADA");
  assert.equal(durante.coberturaActiva, true);
  assert.equal(iso(durante.vencimiento), "2027-01-10");
  assert.equal(calcularEstadoPoliza(cancelada, periodos, d("2027-01-10")).coberturaActiva, false);
});

test("cubiertoEn: daño antes de firmar, en carencia, en gracia y suspendido", () => {
  const periodos = [per(1, "2026-03-31", "2027-03-31", "2026-03-01", true), per(2, "2027-03-31", "2028-03-31", null)];
  const firmado = { ...existente, anexoFirmadoEn: d("2026-02-20") };
  assert.equal(cubiertoEn(firmado, periodos, d("2026-02-10"), d("2026-06-01")), false); // antes de firmar
  assert.equal(cubiertoEn(firmado, periodos, d("2026-03-20"), d("2026-06-01")), false); // carencia
  assert.equal(cubiertoEn(firmado, periodos, d("2026-05-01"), d("2026-06-01")), true);
  assert.equal(cubiertoEn(firmado, periodos, d("2027-04-05"), d("2027-04-10")), true); // gracia
  assert.equal(cubiertoEn(firmado, periodos, d("2027-04-05"), d("2027-04-20")), false); // ya suspendido
});

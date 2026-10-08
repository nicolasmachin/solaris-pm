// Cálculo del balance anual de energía del informe de justificación de
// potencia. Funciones puras: las usan el PDF, el texto automático y la IA.
//
// El criterio de UTE para microgeneración es solo el balance anual: lo que la
// planta genera en un año no puede superar lo que la cuenta consume en un año.
// La potencia contratada es otro límite, pero se resuelve aparte con un
// aumento de potencia (Suministro individual) y no entra acá.

import type { Carga, DatosJustificacion } from "./schema.js";

export interface CargaCalculada {
  carga: Carga;
  kwhMes: number;
  /** "2 kW × 6 h/día × 8 días/mes × 5 u." — cómo se llegó al número. */
  formula: string;
}

export interface Balance {
  cargas: CargaCalculada[];
  incrementoMensualKwh: number;
  incrementoAnualKwh: number;
  consumoAnualActualKwh: number;
  /**
   * true cuando el consumo actual no se cargó y se dedujo de la potencia que
   * dijo UTE (potenciaUteKw × productividad): UTE llega a esa potencia
   * dividiendo el consumo del último año, así que la cuenta tiene historia
   * aunque la factura no traiga el total anual.
   */
  consumoActualEstimadoDesdeUte: boolean;
  consumoAnualProyectadoKwh: number;
  potenciaSolicitadaKw: number;
  productividadKwhKw: number;
  generacionAnualKwh: number;
  /** Potencia que el consumo proyectado justifica (consumo / productividad). */
  potenciaJustificadaKw: number;
  /** generación / consumo proyectado (1 = da justo). */
  cobertura: number;
  cumpleBalance: boolean;
}

const nz = (v: number | null | undefined): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function kwhMesDeCarga(c: Carga): number {
  if (c.tipo === "UNIFICACION" || c.modo === "DIRECTO") return nz(c.kwhMes);
  const cantidad = c.cantidad == null ? 1 : nz(c.cantidad);
  return nz(c.potenciaKw) * nz(c.horasDia) * nz(c.diasMes) * cantidad;
}

export function formulaDeCarga(c: Carga): string {
  if (c.tipo === "UNIFICACION") {
    const partes = [`Cuenta ${c.cuentaUte?.trim() || "s/d"}`];
    if (c.potenciaContratadaKw) partes.push(`${fmtNum(c.potenciaContratadaKw, 1)} kW contratados`);
    return partes.join(" · ");
  }
  if (c.modo === "DIRECTO") return "Estimación global";
  const partes = [
    `${fmtNum(nz(c.potenciaKw), 2)} kW`,
    `${fmtNum(nz(c.horasDia), 1)} h/día`,
    `${fmtNum(nz(c.diasMes), 0)} días/mes`,
  ];
  if (c.cantidad != null && c.cantidad !== 1) partes.push(`${fmtNum(nz(c.cantidad), 0)} u.`);
  return partes.join(" × ");
}

export function calcularBalance(d: DatosJustificacion): Balance {
  const cargas = d.cargas.map((carga) => ({
    carga,
    kwhMes: redondear(kwhMesDeCarga(carga), 1),
    formula: formulaDeCarga(carga),
  }));
  const incrementoMensualKwh = redondear(cargas.reduce((acc, c) => acc + c.kwhMes, 0), 1);
  const incrementoAnualKwh = redondear(incrementoMensualKwh * 12, 0);
  const productividadKwhKw = d.productividadKwhKw;
  const consumoActualEstimadoDesdeUte = nz(d.consumoAnualActualKwh) <= 0 && nz(d.potenciaUteKw) > 0;
  const consumoAnualActualKwh = redondear(
    consumoActualEstimadoDesdeUte ? nz(d.potenciaUteKw) * productividadKwhKw : nz(d.consumoAnualActualKwh),
    0,
  );
  const consumoAnualProyectadoKwh = consumoAnualActualKwh + incrementoAnualKwh;
  const generacionAnualKwh = redondear(d.potenciaSolicitadaKw * productividadKwhKw, 0);
  // Se redondea hacia abajo: decir que se justifican 25,01 kW cuando da 25,009
  // es prometerle a UTE más de lo que dan las cuentas.
  const potenciaJustificadaKw = Math.floor((consumoAnualProyectadoKwh / productividadKwhKw) * 100) / 100;
  const cobertura = consumoAnualProyectadoKwh > 0 ? generacionAnualKwh / consumoAnualProyectadoKwh : Infinity;
  return {
    cargas,
    incrementoMensualKwh,
    incrementoAnualKwh,
    consumoAnualActualKwh,
    consumoActualEstimadoDesdeUte,
    consumoAnualProyectadoKwh,
    potenciaSolicitadaKw: d.potenciaSolicitadaKw,
    productividadKwhKw,
    generacionAnualKwh,
    potenciaJustificadaKw,
    cobertura,
    cumpleBalance: generacionAnualKwh <= consumoAnualProyectadoKwh,
  };
}

function redondear(v: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
}

/** Formato uruguayo: miles con punto, decimales con coma, sin ceros de más. */
export function fmtNum(v: number, maxDecimales = 0): string {
  return new Intl.NumberFormat("es-UY", {
    maximumFractionDigits: maxDecimales,
    minimumFractionDigits: 0,
  }).format(v);
}

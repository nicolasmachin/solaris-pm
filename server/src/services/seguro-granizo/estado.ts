// Estado visible del Plan de Protección contra Granizo de un cliente. Puro (sin
// Prisma) para poder testearlo: el pago de cada anualidad se deriva del
// FinanceMovement vinculado y llega ya resuelto en `pagado` / `fechaPago`.
//
// Reglas de las Condiciones generales del plan (sección 5) y la guía interna:
//   - El plan se activa con el Anexo A firmado Y la primera anualidad paga. Sin
//     las dos no hay cobertura (en el primer año no hay gracia).
//   - Carencia: 30 días corridos desde el primer pago. No aplica si el cliente
//     se adhirió al contratar la obra (`sinCarencia`): cubre desde la puesta en
//     marcha.
//   - Renovación: si se paga dentro de los 15 días del vencimiento, sigue sin
//     corte. Si no, el plan queda SUSPENDIDO; al pagar corre una nueva carencia.
//   - Baja: la anualidad en curso no se reintegra y cubre hasta el fin del
//     período pago.
//   - POR_VENCER: faltan ≤ 30 días para el fin de la anualidad en curso y la
//     siguiente no está paga. Es lo que pinta al cliente en rojo.

import { addDays, diffInDays, startOfUtcDay } from "./fechas.js";

export const DIAS_AVISO = 30;
export const DIAS_GRACIA = 15;
export const DIAS_CARENCIA = 30;

export type EstadoPolizaVisible =
  | "PENDIENTE_INICIO" // contratado con la obra, espera la puesta en marcha
  | "PENDIENTE_ACTIVACION" // falta el Anexo A firmado y/o el primer pago
  | "EN_CARENCIA"
  | "VIGENTE"
  | "POR_VENCER"
  | "EN_GRACIA" // venció la anualidad sin pagar: cubre hasta 15 días más
  | "SUSPENDIDA"
  | "VENCIDA"
  | "CANCELADA";

export type PeriodoParaEstado = {
  id: string;
  numero: number;
  desde: Date;
  hasta: Date;
  montoUsd: number;
  pagado: boolean;
  fechaPago: Date | null;
  // El inicio ya se fijó a pago + carencia (primera anualidad de un cliente
  // existente o re-adhesión): cubre desde `desde`.
  inicioAlPagar: boolean;
};

export type PolizaParaEstado = {
  estado: "PENDIENTE_INICIO" | "ACTIVA" | "CANCELADA";
  montoAnualUsd: number;
  sinCarencia: boolean;
  anexoFirmadoEn: Date | null;
};

export type EstadoPoliza = {
  estado: EstadoPolizaVisible;
  coberturaActiva: boolean;
  // Rojo en listas y ficha: por vencer, en gracia, suspendido o vencido.
  alerta: boolean;
  faltaFirma: boolean;
  faltaPago: boolean;
  periodoActualId: string | null;
  // Desde cuándo cubre la anualidad en curso (fin de la carencia, si hay).
  coberturaDesde: Date | null;
  // Fin de la anualidad en curso (o de la última, si ya venció).
  vencimiento: Date | null;
  diasParaVencer: number | null;
  proximoCobro: { fecha: Date; montoUsd: number; periodoId: string | null } | null;
  // Anualidades ya arrancadas y no pagas.
  deudaUsd: number;
};

type Opts = { diasAviso?: number; diasGracia?: number; diasCarencia?: number };

function max(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function periodoEn<T extends PeriodoParaEstado>(periodos: T[], dia: Date): T | null {
  return periodos.find((p) => p.desde.getTime() <= dia.getTime() && dia.getTime() < p.hasta.getTime()) ?? null;
}

// Desde cuándo cubre una anualidad paga. null si no está paga.
export function coberturaDesdePeriodo(
  poliza: PolizaParaEstado,
  p: PeriodoParaEstado,
  opts: Opts = {},
): Date | null {
  if (!p.pagado || !p.fechaPago) return null;
  const gracia = opts.diasGracia ?? DIAS_GRACIA;
  const carencia = opts.diasCarencia ?? DIAS_CARENCIA;
  const pago = startOfUtcDay(p.fechaPago);
  if (p.inicioAlPagar) return max(p.desde, pago);
  if (p.numero === 1) {
    return poliza.sinCarencia ? max(p.desde, pago) : max(p.desde, addDays(pago, carencia));
  }
  // Renovación: en término (dentro de la gracia) no corta; tarde, nueva carencia.
  return diffInDays(p.desde, pago) <= gracia ? p.desde : max(p.desde, addDays(pago, carencia));
}

// ¿Había cobertura el día `fecha`? Sirve para marcar un daño por granizo.
export function cubiertoEn(
  poliza: PolizaParaEstado,
  periodosIn: PeriodoParaEstado[],
  fecha: Date,
  hoyIn: Date,
  opts: Opts = {},
): boolean {
  if (poliza.estado === "PENDIENTE_INICIO") return false;
  const gracia = opts.diasGracia ?? DIAS_GRACIA;
  const dia = startOfUtcDay(fecha);
  const hoy = startOfUtcDay(hoyIn);
  if (!poliza.anexoFirmadoEn || startOfUtcDay(poliza.anexoFirmadoEn).getTime() > dia.getTime()) return false;

  const periodos = [...periodosIn].sort((a, b) => a.numero - b.numero);
  const p = periodoEn(periodos, dia);
  if (!p) return false;
  if (p.pagado) {
    const desde = coberturaDesdePeriodo(poliza, p, opts);
    return !!desde && dia.getTime() >= desde.getTime();
  }
  // Renovación impaga: sigue cubriendo mientras dure la gracia (salvo baja), y
  // sólo si el año anterior estaba pago.
  if (poliza.estado === "CANCELADA" || p.numero === 1) return false;
  const anterior = periodos.find((x) => x.numero === p.numero - 1);
  if (!anterior?.pagado) return false;
  return diffInDays(p.desde, hoy) <= gracia && diffInDays(p.desde, dia) <= gracia;
}

export function calcularEstadoPoliza(
  poliza: PolizaParaEstado,
  periodosIn: PeriodoParaEstado[],
  hoyIn: Date,
  opts: Opts = {},
): EstadoPoliza {
  const diasAviso = opts.diasAviso ?? DIAS_AVISO;
  const gracia = opts.diasGracia ?? DIAS_GRACIA;
  const hoy = startOfUtcDay(hoyIn);
  const periodos = [...periodosIn].sort((a, b) => a.numero - b.numero);

  const arrancados = periodos.filter((p) => p.desde.getTime() <= hoy.getTime());
  const deudaUsd = arrancados.filter((p) => !p.pagado).reduce((acc, p) => acc + p.montoUsd, 0);
  const primerImpago = periodos.find((p) => !p.pagado) ?? null;
  const ultimo = periodos[periodos.length - 1] ?? null;
  const primero = periodos[0] ?? null;
  const faltaFirma = !poliza.anexoFirmadoEn;
  const faltaPago = !!primero && !primero.pagado;

  const actual = periodoEn(periodos, hoy);
  const coberturaActiva = cubiertoEn(poliza, periodos, hoy, hoy, opts);
  const coberturaDesde = actual ? coberturaDesdePeriodo(poliza, actual, opts) : primero ? coberturaDesdePeriodo(poliza, primero, opts) : null;
  const proximoCobro = primerImpago
    ? { fecha: primerImpago.desde, montoUsd: primerImpago.montoUsd, periodoId: primerImpago.id }
    : ultimo
      ? { fecha: ultimo.hasta, montoUsd: poliza.montoAnualUsd, periodoId: null }
      : null;

  const base: EstadoPoliza = {
    estado: "PENDIENTE_INICIO",
    coberturaActiva,
    alerta: false,
    faltaFirma,
    faltaPago,
    periodoActualId: actual?.id ?? null,
    coberturaDesde,
    vencimiento: actual?.hasta ?? ultimo?.hasta ?? null,
    diasParaVencer: actual ? diffInDays(hoy, actual.hasta) : null,
    proximoCobro,
    deudaUsd,
  };

  if (poliza.estado === "CANCELADA") {
    // Cubre hasta el fin del período pago; después ya no hay vencimiento que mostrar.
    return { ...base, estado: "CANCELADA", proximoCobro: null, vencimiento: coberturaActiva ? base.vencimiento : null };
  }
  if (poliza.estado === "PENDIENTE_INICIO" || periodos.length === 0) {
    return { ...base, estado: "PENDIENTE_INICIO", faltaPago: false };
  }
  if (faltaFirma || faltaPago) {
    return { ...base, estado: "PENDIENTE_ACTIVACION" };
  }
  if (!actual && ultimo && hoy.getTime() >= ultimo.hasta.getTime()) {
    return { ...base, estado: "VENCIDA", alerta: true, diasParaVencer: diffInDays(hoy, ultimo.hasta) };
  }

  const suspendida = arrancados.some((p) => p.numero > 1 && !p.pagado && diffInDays(p.desde, hoy) > gracia);
  if (suspendida) return { ...base, estado: "SUSPENDIDA", alerta: true };

  if (!coberturaActiva) {
    // Pago registrado pero todavía corre la carencia (o arranca en el futuro).
    return { ...base, estado: "EN_CARENCIA" };
  }

  if (actual && !actual.pagado) return { ...base, estado: "EN_GRACIA", alerta: true };

  const siguiente = actual ? periodos.find((p) => p.numero === actual.numero + 1) ?? null : null;
  const porVencer = base.diasParaVencer != null && base.diasParaVencer <= diasAviso && !(siguiente?.pagado ?? false);
  return porVencer ? { ...base, estado: "POR_VENCER", alerta: true } : { ...base, estado: "VIGENTE" };
}

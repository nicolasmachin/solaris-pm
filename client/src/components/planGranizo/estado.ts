// Etiquetas y colores del Plan de Protección contra Granizo. Vocabulario: nunca
// "seguro", "póliza", "prima" ni "siniestro" (guía interna del plan).

import type { CobroEstado, EstadoDanio, EstadoPlan } from "../../api/planGranizo.api";

export const ESTADO_PLAN_LABEL: Record<EstadoPlan, string> = {
  PENDIENTE_INICIO: "Espera puesta en marcha",
  PENDIENTE_ACTIVACION: "Falta firma o pago",
  EN_CARENCIA: "En carencia",
  VIGENTE: "Vigente",
  POR_VENCER: "Por vencer",
  EN_GRACIA: "En gracia",
  SUSPENDIDA: "Suspendido",
  VENCIDA: "Vencido",
  CANCELADA: "Dado de baja",
};

export const ESTADO_PLAN_AYUDA: Record<EstadoPlan, string> = {
  PENDIENTE_INICIO: "Se adhirió con la obra: arranca solo con la puesta en marcha.",
  PENDIENTE_ACTIVACION: "No cubre hasta tener el Anexo A firmado y la primera anualidad paga.",
  EN_CARENCIA: "Pagó, pero cubre recién cuando terminan los 30 días de carencia.",
  VIGENTE: "Cubre.",
  POR_VENCER: "Falta un mes o menos y la próxima anualidad no está paga: avisar y cobrar.",
  EN_GRACIA: "Venció sin pago: sigue cubriendo hasta 15 días. Cobrar ya.",
  SUSPENDIDA: "Más de 15 días sin pagar: no cubre. Al pagar corre una nueva carencia.",
  VENCIDA: "Terminó la última anualidad sin renovar.",
  CANCELADA: "Dado de baja: cubre hasta el fin del período que ya pagó.",
};

type Tono = "ok" | "alerta" | "espera" | "apagado";

export const ESTADO_PLAN_TONO: Record<EstadoPlan, Tono> = {
  PENDIENTE_INICIO: "espera",
  PENDIENTE_ACTIVACION: "espera",
  EN_CARENCIA: "espera",
  VIGENTE: "ok",
  POR_VENCER: "alerta",
  EN_GRACIA: "alerta",
  SUSPENDIDA: "alerta",
  VENCIDA: "alerta",
  CANCELADA: "apagado",
};

export const TONO_CLASES: Record<Tono, string> = {
  ok: "bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]",
  alerta: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]",
  espera: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
  apagado: "bg-[var(--color-border)] text-[var(--color-text-muted)]",
};

export const ESTADO_DANIO_LABEL: Record<EstadoDanio, string> = {
  REPORTADO: "Avisado",
  EVALUADO: "Inspeccionado",
  REPUESTO: "Repuesto",
  RECHAZADO: "No se repone",
};

export const COBRO_LABEL: Record<CobroEstado, string> = {
  PAGADO: "Cobrada",
  PREVISTO: "A cobrar",
  SIN_COBRO: "Sin cobro en Finanzas",
};

// Nombre del cliente en rojo: por vencer, en gracia, suspendido o vencido.
export const NOMBRE_ALERTA = "text-[var(--color-danger-text)]";

export function fmtFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y?.slice(2)}`;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return "—";
  return `USD ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;
}

export function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function errMsg(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

// Etiqueta corta del vencimiento para las listas: "Vence 12/10" / "Suspendido".
export function etiquetaAlerta(r: {
  estado: EstadoPlan;
  vencimiento: string | null;
  diasParaVencer: number | null;
  proximoCobro?: { fecha: string | null } | null;
}): string {
  if (r.estado === "POR_VENCER") return `Vence ${fmtFecha(r.vencimiento)}${r.diasParaVencer != null ? ` (${r.diasParaVencer} d)` : ""}`;
  // En gracia: la anualidad venció el día del cobro y sigue cubriendo 15 días más.
  if (r.estado === "EN_GRACIA" && r.proximoCobro?.fecha) {
    const d = new Date(`${r.proximoCobro.fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 15);
    return `En gracia hasta ${fmtFecha(d.toISOString().slice(0, 10))}`;
  }
  return ESTADO_PLAN_LABEL[r.estado];
}

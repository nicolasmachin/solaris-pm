// Plazos de un daño por granizo y causales de rechazo, según las Condiciones
// generales del plan (secciones 4, 6 y 7) y la guía interna. Puro, testeable.
//
//   Aviso del cliente   ≤ 10 días hábiles desde el granizo (fuera de plazo se
//                       atiende igual, pero puede rechazarse si ya no se puede
//                       confirmar que fue granizo).
//   Inspección          ≤ 10 días hábiles desde el aviso.
//   Reposición          ≤ 30 días corridos desde la inspección; 60 si la
//                       tormenta afectó muchas obras (evento masivo).
//
// Días hábiles = lunes a viernes (utils/business-days.ts todavía no descuenta
// feriados).

import { addBusinessDays, businessDaysBetween, signedBusinessDaysBetween } from "../../utils/business-days.js";
import { addDays, diffInDays, startOfUtcDay } from "./fechas.js";

export const PLAZO_AVISO_HABILES = 10;
export const PLAZO_INSPECCION_HABILES = 10;
export const PLAZO_REPOSICION_DIAS = 30;
export const PLAZO_REPOSICION_MASIVO_DIAS = 60;

// Causales para no reponer. El código se guarda; la etiqueta cita la sección de
// las condiciones, que es lo que hay que decirle al cliente.
export const MOTIVOS_RECHAZO = {
  OTROS_EQUIPOS: "Es otro equipo (inversor, estructura, cableado, protecciones) — sección 4.1",
  OTRA_CAUSA: "No fue granizo (viento, rayo, golpe, robo u otra causa) — sección 4.2",
  DANO_PREVIO: "Daño previo a la adhesión o durante la carencia — sección 4.3",
  MICROFISURA: "Microfisura no visible sin pérdida mayor al 20 % — sección 4.4",
  TERCEROS: "Instalación intervenida por terceros — sección 4.6",
  ESTETICO: "Daño sólo estético — sección 4.7",
  FALTA_PAGO: "Anualidad vencida e impaga — sección 4.8",
  AVISO_FUERA_DE_PLAZO: "Aviso fuera de plazo, no se pudo confirmar el granizo — sección 6",
  OTRO: "Otro motivo (detallado en la nota)",
} as const;

export type MotivoRechazo = keyof typeof MOTIVOS_RECHAZO;
export const MOTIVOS_RECHAZO_CODIGOS = Object.keys(MOTIVOS_RECHAZO) as [MotivoRechazo, ...MotivoRechazo[]];

export type DanioParaPlazos = {
  estado: "REPORTADO" | "EVALUADO" | "REPUESTO" | "RECHAZADO";
  fechaEvento: Date;
  fechaAviso: Date;
  fechaInspeccion: Date | null;
  fechaReposicion: Date | null;
  eventoMasivo: boolean;
};

export type PlazoEtapa = {
  limite: Date;
  cumplido: boolean | null; // null: todavía no se hizo
  diasRestantes: number | null; // sólo si está pendiente; negativo = vencido
  unidad: "habiles" | "corridos";
};

export type PlazosDanio = {
  diasHabilesHastaAviso: number;
  avisoFueraDePlazo: boolean;
  inspeccion: PlazoEtapa;
  reposicion: PlazoEtapa | null; // se conoce recién con la inspección
  // Lo que hay que hacer ahora, si hay algo.
  pendiente: { etapa: "INSPECCION" | "REPOSICION"; vencido: boolean } | null;
};

export function calcularPlazosDanio(s: DanioParaPlazos, hoyIn: Date): PlazosDanio {
  const hoy = startOfUtcDay(hoyIn);
  const evento = startOfUtcDay(s.fechaEvento);
  const aviso = startOfUtcDay(s.fechaAviso);
  const diasHabilesHastaAviso = businessDaysBetween(evento, aviso);

  const limiteInsp = addBusinessDays(aviso, PLAZO_INSPECCION_HABILES);
  const cerrado = s.estado === "REPUESTO" || s.estado === "RECHAZADO";
  const inspeccion: PlazoEtapa = {
    limite: limiteInsp,
    cumplido: s.fechaInspeccion ? startOfUtcDay(s.fechaInspeccion).getTime() <= limiteInsp.getTime() : null,
    diasRestantes: s.fechaInspeccion || cerrado ? null : signedBusinessDaysBetween(hoy, limiteInsp),
    unidad: "habiles",
  };

  let reposicion: PlazoEtapa | null = null;
  if (s.fechaInspeccion) {
    const limite = addDays(
      startOfUtcDay(s.fechaInspeccion),
      s.eventoMasivo ? PLAZO_REPOSICION_MASIVO_DIAS : PLAZO_REPOSICION_DIAS,
    );
    reposicion = {
      limite,
      cumplido: s.fechaReposicion ? startOfUtcDay(s.fechaReposicion).getTime() <= limite.getTime() : null,
      diasRestantes: s.fechaReposicion || cerrado ? null : diffInDays(hoy, limite),
      unidad: "corridos",
    };
  }

  let pendiente: PlazosDanio["pendiente"] = null;
  if (s.estado === "REPORTADO") pendiente = { etapa: "INSPECCION", vencido: (inspeccion.diasRestantes ?? 0) < 0 };
  if (s.estado === "EVALUADO" && reposicion) pendiente = { etapa: "REPOSICION", vencido: (reposicion.diasRestantes ?? 0) < 0 };

  return {
    diasHabilesHastaAviso,
    avisoFueraDePlazo: diasHabilesHastaAviso > PLAZO_AVISO_HABILES,
    inspeccion,
    reposicion,
    pendiente,
  };
}

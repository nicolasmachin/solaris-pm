/**
 * Ítems de checklist respaldados por evidencia.
 *
 * Un ítem normal es una casilla de confianza: alguien la tilda y el sistema le
 * cree. Un ítem con `evidenceKind` **no se puede tildar a mano**: hace falta que
 * exista lo que dice que existe. Y al revés, cuando esa evidencia aparece, el
 * ítem se marca solo, para no pedirle a nadie que además se acuerde de tildar.
 *
 * Empezó con los videos de ensayo (eran casillas que se marcaban sin que nadie
 * hubiera subido nada) y acá se generaliza, porque la subetapa "Modalidad de pago
 * definida" tenía el mismo problema y peor: se podía dar por cerrada **sin elegir
 * la modalidad**, y entonces los ítems condicionados (proforma, crédito) ni
 * siquiera se exigían. El proyecto seguía sin proforma y sin plan de pagos, y
 * quien después tenía que cobrar no sabía qué cobrar.
 *
 * Para agregar una evidencia nueva: sumar acá su verificador y su mensaje, poner
 * el `evidenceKind` en el ítem del catálogo (`pipeline-definitions.ts`), y llamar
 * a `completarPorEvidencia()` desde donde esa evidencia se produce.
 */

import {
  CategoriaPrincipal,
  FinanceMovementStatus,
  ModalidadPago,
  MovementSourceType,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { hasReadyEnsayoVideo } from "./project-video.service.js";

export const EVIDENCIA_ENSAYO_VIDEO = "ensayo-video";
export const EVIDENCIA_PROFORMA = "proforma";
export const EVIDENCIA_PLAN_PAGOS = "plan-pagos";
export const EVIDENCIA_MODALIDAD_OTRO = "modalidad-otro";

type Evidencia = {
  /** ¿Existe hoy la evidencia para este proyecto? */
  existe: (projectId: string) => Promise<boolean>;
  /** Qué se le dice a quien intenta tildar el ítem sin ella. */
  falta: string;
};

/** Una proforma publicada (no descartada) en el proyecto. */
async function hayProforma(projectId: string): Promise<boolean> {
  const version = await prisma.proformaVersion.findFirst({
    where: { projectId, status: "PUBLISHED" },
    select: { id: true },
  });
  return version !== null;
}

/**
 * Al menos un cobro previsto cargado: es lo que el plan de pagos deja en la base.
 * No se pide una cantidad concreta de cuotas a propósito — el plan de un contado
 * es una sola línea y también es un plan.
 */
async function hayPlanDePagos(projectId: string): Promise<boolean> {
  const cuota = await prisma.financeMovement.findFirst({
    where: {
      projectId,
      tipoMovimiento: TipoMovimiento.INGRESO,
      categoriaPrincipal: CategoriaPrincipal.PROYECTO_ENTRADA,
      status: FinanceMovementStatus.PREVISTO,
      sourceType: MovementSourceType.MANUAL,
      deletedAt: null,
    },
    select: { id: true },
  });
  return cuota !== null;
}

/** La explicación escrita del caso particular, cuando la modalidad es OTRO. */
async function hayNotaDeModalidad(projectId: string): Promise<boolean> {
  const proyecto = await prisma.project.findUnique({
    where: { id: projectId },
    select: { modalidadPagoNota: true },
  });
  return (proyecto?.modalidadPagoNota ?? "").trim().length > 0;
}

const EVIDENCIAS: Record<string, Evidencia> = {
  [EVIDENCIA_ENSAYO_VIDEO]: {
    // El criterio de qué video vale (un ensayo, no una visita técnica) vive en
    // project-video.service: se reusa en vez de repetirlo acá.
    existe: hasReadyEnsayoVideo,
    falta: "Para marcar este ítem hay que subir antes el video del ensayo, en la sección Obra del proyecto.",
  },
  [EVIDENCIA_PROFORMA]: {
    existe: hayProforma,
    falta: "Para marcar este ítem hay que generar antes la proforma, con el botón de esta misma subetapa.",
  },
  [EVIDENCIA_PLAN_PAGOS]: {
    existe: hayPlanDePagos,
    falta: "Para marcar este ítem hay que crear antes el plan de pagos, con el botón de esta misma subetapa.",
  },
  [EVIDENCIA_MODALIDAD_OTRO]: {
    existe: hayNotaDeModalidad,
    falta: "Para marcar este ítem hay que explicar antes qué se acordó, en el campo de esta misma subetapa.",
  },
};

/**
 * Qué falta para poder tildar este ítem a mano. `null` = se puede tildar (o
 * porque no exige evidencia, o porque la evidencia ya está).
 *
 * Un `evidenceKind` desconocido no bloquea: si alguien deja un ítem apuntando a
 * una evidencia que se retiró, el checklist sigue funcionando como uno normal.
 */
export async function faltaEvidencia(
  projectId: string,
  evidenceKind: string | null,
): Promise<string | null> {
  if (!evidenceKind) return null;
  const evidencia = EVIDENCIAS[evidenceKind];
  if (!evidencia) return null;
  return (await evidencia.existe(projectId)) ? null : evidencia.falta;
}

/**
 * Marca los ítems que esperaban esta evidencia, ahora que existe. Devuelve las
 * subetapas y etapas tocadas, para que quien llama recalcule su progreso.
 */
export async function completarPorEvidencia(
  projectId: string,
  evidenceKind: string,
  userId: string,
): Promise<{ substageIds: string[]; stageIds: string[] }> {
  // Se verifica igual, aunque quien llama suele venir de crear la evidencia. Es
  // barato y evita el error que se cometió al sincronizar proyectos viejos:
  // llamarla a ciegas tildaba ítems de proyectos que no tenían nada hecho, que es
  // exactamente lo que esta feature vino a impedir.
  if (await faltaEvidencia(projectId, evidenceKind)) return { substageIds: [], stageIds: [] };

  const items = await prisma.checklistItem.findMany({
    where: { projectId, evidenceKind, completed: false, deletedAt: null },
    select: { id: true, substageId: true, substage: { select: { stageId: true } } },
  });
  if (items.length === 0) return { substageIds: [], stageIds: [] };

  await prisma.checklistItem.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: { completed: true, completedAt: new Date(), completedBy: userId },
  });

  return {
    substageIds: [...new Set(items.map((i) => i.substageId))],
    stageIds: [...new Set(items.map((i) => i.substage.stageId))],
  };
}

/**
 * Al revés: la evidencia desapareció (se descartó la proforma, se borró el plan),
 * así que el ítem vuelve a estar pendiente. Sin esto un ítem quedaría tildado
 * afirmando algo que ya no es cierto.
 */
export async function despintarPorEvidencia(
  projectId: string,
  evidenceKind: string,
): Promise<void> {
  if (await faltaEvidencia(projectId, evidenceKind)) {
    await prisma.checklistItem.updateMany({
      where: { projectId, evidenceKind, completed: true, deletedAt: null },
      data: { completed: false, completedAt: null, completedBy: null },
    });
  }
}

/** El nombre de la subetapa donde se define cómo paga el cliente. */
export const SUBETAPA_MODALIDAD_PAGO = "Modalidad de pago definida";

/** Etiqueta de cada modalidad, para los mensajes de error. */
export const MODALIDAD_LABEL: Record<ModalidadPago, string> = {
  [ModalidadPago.DIRECTO_50_50]: "Pago directo",
  [ModalidadPago.FINANCIACION_BANCARIA]: "Financiación bancaria",
  [ModalidadPago.OTRO]: "Otro",
};

import { NotificationType, SettingKey, SettingLevel } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

// Config del resumen diario (digest): a qué hora se manda y qué tipo de
// notificación entra al resumen de cada rol (matriz opt-in).

export const DEFAULT_DIGEST_HOUR = 8;

// Catálogo de tipos de notificación con etiqueta y explicación de usuario final.
// Alimenta la matriz de Administración (con su tooltip ⓘ). Al agregar un tipo
// nuevo al enum, sumarlo acá.
export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; description: string }
> = {
  goals_not_configured: {
    label: "Metas sin configurar",
    description: "Avisa que todavía no se cargaron las metas del período en Métricas.",
  },
  deadline_warning: {
    label: "Deadline próximo",
    description: "Una subetapa está por vencer (faltan 3 días hábiles o menos) y sigue sin completarse.",
  },
  prev_substage_completed: {
    label: "Subetapa previa completada",
    description: "Se completó la subetapa anterior y ya se puede arrancar la que sigue (avisa al responsable).",
  },
  engineering_completed: {
    label: "Ingeniería completada",
    description: "Un proyecto terminó la etapa de Ingeniería y está listo para que Operaciones planifique la instalación.",
  },
  traspaso_asignado: {
    label: "Traspaso asignado",
    description: "Se confirmó un traspaso y el trabajo pasó a tu área: hay algo nuevo para hacer.",
  },
  traspaso_escalado: {
    label: "Traspaso escalado",
    description: "Un traspaso quedó sin confirmar más de 5 días hábiles y se escaló a administración.",
  },
  traspaso_por_confirmar: {
    label: "Traspaso por confirmar",
    description: "Tenés un traspaso pendiente de confirmar en tu bandeja de Pendientes.",
  },
  aviso_habilitacion_pendiente: {
    label: "Aviso de habilitación pendiente",
    description: "Terminó un trámite UTE y hay que avisar al Generador que ya puede encender su instalación.",
  },
  ticket_actualizado: {
    label: "Ticket actualizado",
    description: "Hubo novedades en un ticket: un comentario nuevo o un cambio de estado.",
  },
  encuesta_disponible: {
    label: "Encuesta disponible",
    description: "Se generó una encuesta de satisfacción para un Generador (esta le llega al cliente, no al equipo interno).",
  },
};

export const ALL_NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_META) as NotificationType[];

// --- Hora de envío (setting SYSTEM) ---

export async function getDigestSendHour(): Promise<number> {
  const row = await prisma.setting.findFirst({
    where: { level: SettingLevel.SYSTEM, key: SettingKey.DIGEST_SEND_HOUR },
  });
  const parsed = row ? Number.parseInt(row.value, 10) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 23 ? parsed : DEFAULT_DIGEST_HOUR;
}

// --- Matriz rol → tipos habilitados (opt-in: presencia de fila = habilitado) ---

export async function getEnabledByRole(): Promise<Map<string, Set<NotificationType>>> {
  const rows = await prisma.digestPreference.findMany();
  const map = new Map<string, Set<NotificationType>>();
  for (const r of rows) {
    const set = map.get(r.roleName) ?? new Set<NotificationType>();
    set.add(r.notificationType);
    map.set(r.roleName, set);
  }
  return map;
}

export async function setDigestPreference(
  roleName: string,
  notificationType: NotificationType,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    await prisma.digestPreference.upsert({
      where: { roleName_notificationType: { roleName, notificationType } },
      create: { roleName, notificationType },
      update: {},
    });
  } else {
    await prisma.digestPreference.deleteMany({ where: { roleName, notificationType } });
  }
}

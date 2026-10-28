import { NotificationType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { enviarPush } from "./push/push.service.js";

/**
 * A dónde lleva el aviso push cuando la notificación no trae `link`: lo mismo
 * que hace la campanita del portal al tocarla. "/" lleva a cada uno a su
 * pantalla de inicio (el cliente, al portal).
 */
const URL_POR_TIPO: Partial<Record<NotificationType, string>> = {
  encuesta_disponible: "/portal/encuestas",
};

type CreateNotificationInput = {
  projectId?: string | null;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  sentEmail?: boolean;
  sentWhatsapp?: boolean;
  uniqueKey?: string | null;
  /** Ruta interna a la que lleva al tocarla. Sin esto, la campanita navega por tipo. */
  link?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  const n = await prisma.notification.create({
    data: {
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      sentEmail: input.sentEmail ?? false,
      sentWhatsapp: input.sentWhatsapp ?? false,
      uniqueKey: input.uniqueKey ?? null,
      link: input.link ?? null,
    },
  });
  // También al celular o la computadora, si la persona activó los avisos. Sin
  // await: el aviso no demora ni rompe lo que lo disparó.
  if (n.userId) {
    void enviarPush(n.userId, { titulo: n.title, cuerpo: n.message, url: n.link ?? URL_POR_TIPO[n.type] ?? "/", etiqueta: n.id });
  }
  return n;
}

export async function createNotificationIfNotExists(input: CreateNotificationInput) {
  const existing = await prisma.notification.findFirst({
    where: {
      projectId: input.projectId ?? null,
      type: input.type,
      read: false,
    },
  });

  if (existing) {
    return existing;
  }

  return createNotification(input);
}

/**
 * Crea una notificación deduplicada por `uniqueKey`. Si ya existe una con la
 * misma key, devuelve la existente sin crear una nueva (idempotencia
 * "una sola vez de por vida"). Pensado para eventos que se pueden disparar
 * desde varios lugares (ej. completar etapa Ingeniería + aprobar EFP).
 */
export async function createNotificationByUniqueKey(
  input: CreateNotificationInput & { uniqueKey: string },
) {
  const existing = await prisma.notification.findUnique({
    where: { uniqueKey: input.uniqueKey },
  });
  if (existing) return { notification: existing, created: false };
  const notification = await createNotification(input);
  return { notification, created: true };
}

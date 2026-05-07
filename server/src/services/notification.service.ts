import { NotificationType } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

type CreateNotificationInput = {
  projectId?: string | null;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  sentEmail?: boolean;
  sentWhatsapp?: boolean;
  uniqueKey?: string | null;
};

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      projectId: input.projectId ?? null,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      sentEmail: input.sentEmail ?? false,
      sentWhatsapp: input.sentWhatsapp ?? false,
      uniqueKey: input.uniqueKey ?? null,
    },
  });
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

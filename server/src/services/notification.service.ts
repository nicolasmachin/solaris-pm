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

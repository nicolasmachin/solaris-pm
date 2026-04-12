import { AuditAction, AuditEntityType, type Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

type AuditEntryInput = {
  entityType: AuditEntityType;
  entityId: string;
  projectId?: string | null;
  userId: string;
  action: AuditAction;
  fieldChanged?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue | null;
};

type AuditChangesInput = {
  entityType: AuditEntityType;
  entityId: string;
  projectId?: string | null;
  userId: string;
  action?: AuditAction;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  labels?: Record<string, string>;
  formatter?: (params: {
    field: string;
    label: string;
    oldValue: string | null;
    newValue: string | null;
  }) => string;
  metadata?: Prisma.InputJsonValue | null;
};

export async function createAuditEntry(input: AuditEntryInput) {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId ?? null,
        userId: input.userId,
        action: input.action,
        fieldChanged: input.fieldChanged ?? null,
        oldValue: input.oldValue ?? null,
        newValue: input.newValue ?? null,
        description: input.description,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error("No se pudo insertar AuditLog", {
      input,
      error,
    });
  }
}

function stringifyAuditValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export async function createAuditEntriesForChanges(input: AuditChangesInput) {
  const changedEntries = Object.entries(input.newData).filter(([field, newValue]) => {
    const oldValue = input.oldData[field];
    return stringifyAuditValue(oldValue) !== stringifyAuditValue(newValue);
  });

  for (const [field, value] of changedEntries) {
    const oldValue = stringifyAuditValue(input.oldData[field]);
    const newValue = stringifyAuditValue(value);
    const label = input.labels?.[field] ?? field;
    const description = input.formatter
      ? input.formatter({ field, label, oldValue, newValue })
      : `Actualizó ${label} de ${oldValue ?? "vacío"} a ${newValue ?? "vacío"}`;

    await createAuditEntry({
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId,
      userId: input.userId,
      action: input.action ?? AuditAction.updated,
      fieldChanged: field,
      oldValue,
      newValue,
      description,
      metadata: input.metadata,
    });
  }
}

// Creación rápida del usuario de portal (Generador) de un cliente desde el
// módulo Experiencia Solar. Reutiliza la misma mecánica que el panel de Admin
// (crea un User rol CLIENT con passwordTemporary=true y lo vincula al proyecto
// vía ProjectClient), pero acotada a UN proyecto y gateada por
// EXPERIENCIA_CLIENTES.CREATE (no expone la gestión de usuarios internos).
//
// Si el email ya pertenece a un Generador existente, se lo VINCULA al proyecto
// en lugar de fallar (caso: un mismo dueño con varios generadores). Si el email
// pertenece a un usuario NO cliente (interno), se rechaza.

import { AuditAction, AuditEntityType } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";

export type CreatePortalUserParams = {
  projectId: string;
  name: string;
  email: string;
  temporaryPassword: string;
  phone?: string | null;
  actorUserId: string;
};

export type CreatePortalUserResult = {
  userId: string;
  name: string;
  email: string;
  // true → se reutilizó/vinculó un Generador ya existente; false → recién creado.
  linked: boolean;
};

export type ResetPortalUserParams = {
  projectId: string;
  newPassword: string;
  actorUserId: string;
};

export type ResetPortalUserResult = {
  userId: string;
  name: string;
  email: string;
};

// Resetea la contraseña del usuario de portal (Generador) vinculado al proyecto,
// dejándola como temporal (el cliente la cambia en el próximo ingreso). Sirve
// para reenviar el acceso: como la contraseña original no se guarda en texto
// plano, "reenviar" implica generar una nueva. Mismo gate que crear
// (EXPERIENCIA_CLIENTES.CREATE). Espejo del reset de Admin.
export async function resetPortalUserPassword(
  params: ResetPortalUserParams,
): Promise<ResetPortalUserResult> {
  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: params.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe o está borrado");

    const links = await tx.projectClient.findMany({
      where: { projectId: project.id, user: { deletedAt: null, role: { name: "CLIENT" } } },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (links.length === 0) {
      throw badRequest("NO_PORTAL_USER", "Este generador no tiene un usuario de portal");
    }
    if (links.length > 1) {
      throw badRequest(
        "AMBIGUOUS_PORTAL_USER",
        "El generador tiene más de un usuario de portal; reseteá la contraseña desde Admin",
      );
    }
    const target = links[0].user;

    const hashed = await bcrypt.hash(params.newPassword, 10);
    const updated = await tx.user.update({
      where: { id: target.id },
      data: { password: hashed, passwordTemporary: true },
      select: { id: true, name: true, email: true },
    });
    return updated;
  });

  await createAuditEntry({
    entityType: AuditEntityType.user,
    entityId: result.id,
    projectId: params.projectId,
    userId: params.actorUserId,
    action: AuditAction.updated,
    description: `Reseteó la contraseña del usuario de portal '${result.name}' (${result.email}) desde Experiencia Solar`,
  });

  return { userId: result.id, name: result.name, email: result.email };
}

export async function createPortalUserForProject(
  params: CreatePortalUserParams,
): Promise<CreatePortalUserResult> {
  const email = params.email.trim().toLowerCase();

  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { name: "CLIENT" } });
    if (!role) throw badRequest("ROLE_NOT_FOUND", "El rol CLIENT no existe");

    const project = await tx.project.findFirst({
      where: { id: params.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe o está borrado");

    const existing = await tx.user.findUnique({
      where: { email },
      include: { role: { select: { name: true } } },
    });

    if (existing) {
      // Un usuario interno no puede reusarse como acceso de cliente.
      if (existing.role.name !== "CLIENT") {
        throw badRequest("EMAIL_IN_USE", "El email ya pertenece a un usuario interno");
      }
      if (existing.deletedAt) {
        throw badRequest(
          "USER_DELETED",
          "Existe un usuario borrado con ese email. Restauralo desde Admin antes de reutilizarlo.",
        );
      }
      // Generador existente → vincular al proyecto (idempotente).
      await tx.projectClient.upsert({
        where: { projectId_userId: { projectId: project.id, userId: existing.id } },
        create: { projectId: project.id, userId: existing.id, createdById: params.actorUserId },
        update: {},
      });
      return { user: existing, linked: true };
    }

    const hashed = await bcrypt.hash(params.temporaryPassword, 10);
    const created = await tx.user.create({
      data: {
        name: params.name.trim(),
        email,
        password: hashed,
        phone: params.phone?.trim() || null,
        roleId: role.id,
        passwordTemporary: true,
      },
    });
    await tx.projectClient.create({
      data: { projectId: project.id, userId: created.id, createdById: params.actorUserId },
    });
    return { user: created, linked: false };
  });

  await createAuditEntry({
    entityType: AuditEntityType.user,
    entityId: result.user.id,
    projectId: params.projectId,
    userId: params.actorUserId,
    action: result.linked ? AuditAction.updated : AuditAction.created,
    description: result.linked
      ? `Vinculó el Generador '${result.user.name}' (${result.user.email}) al proyecto desde Experiencia Solar`
      : `Creó el usuario de portal '${result.user.name}' (${result.user.email}) desde Experiencia Solar`,
  });

  return {
    userId: result.user.id,
    name: result.user.name,
    email: result.user.email,
    linked: result.linked,
  };
}

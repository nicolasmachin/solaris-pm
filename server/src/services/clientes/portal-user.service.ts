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
import {
  esUsernameValido,
  normalizarUsername,
  primerUsernameLibre,
  usernameDesdeCedula,
  usernameDesdeNombre,
} from "../../utils/username.js";

export type CreatePortalUserParams = {
  projectId: string;
  name: string;
  /** Opcional: muchos Generadores no tienen mail. Si no viene, se genera un alias. */
  email?: string | null;
  /** Alias explícito. Si viene, gana sobre la cascada automática. */
  username?: string | null;
  temporaryPassword: string;
  phone?: string | null;
  actorUserId: string;
};

export type CreatePortalUserResult = {
  userId: string;
  name: string;
  email: string | null;
  username: string | null;
  /** Lo que hay que dictarle al cliente para entrar: el mail si lo tiene, si no el alias. */
  identificador: string;
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
  email: string | null;
  username: string | null;
  identificador: string;
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
      include: { user: { select: { id: true, name: true, email: true, username: true } } },
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
      select: { id: true, name: true, email: true, username: true },
    });
    return updated;
  });

  await createAuditEntry({
    entityType: AuditEntityType.user,
    entityId: result.id,
    projectId: params.projectId,
    userId: params.actorUserId,
    action: AuditAction.updated,
    description: `Reseteó la contraseña del usuario de portal '${result.name}' (${result.email ?? result.username}) desde Experiencia Solar`,
  });

  return {
    userId: result.id,
    name: result.name,
    email: result.email,
    username: result.username,
    identificador: result.email ?? result.username ?? "",
  };
}

/**
 * Cómo va a entrar el cliente al portal. La cascada:
 *
 *   1. **El mail**, si lo tenemos. Es lo mejor: se lo sabe de memoria y le sirve
 *      para recuperar la contraseña.
 *   2. **La cédula**, si el proyecto la tiene cargada. También se la sabe de
 *      memoria y no hay que inventar nada.
 *   3. **Un alias derivado del nombre** (`maria.fernandez`), con sufijo numérico
 *      si ya está tomado.
 *
 * Antes solo existía el paso 1, y por eso 72 de 95 Generadores no tenían acceso:
 * sin mail no había forma de crearles usuario. La cédula va antes que el alias
 * generado porque un dato que el cliente ya conoce siempre le va a costar menos
 * que uno que le inventamos nosotros.
 */
async function resolverIdentificador(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: { projectId: string; name: string; email?: string | null; username?: string | null },
): Promise<{ email: string | null; username: string | null }> {
  const email = params.email?.trim().toLowerCase() || null;
  if (email) return { email, username: null };

  // Un identificador no puede pisar ni el mail ni el alias de otro: el login
  // busca por los dos campos, así que comparten espacio de nombres.
  const libre = async (candidato: string) =>
    !(await tx.user.findFirst({
      where: { OR: [{ username: candidato }, { email: candidato }] },
      select: { id: true },
    }));

  const explicito = params.username ? normalizarUsername(params.username) : "";
  if (explicito) {
    if (!esUsernameValido(explicito)) {
      throw badRequest(
        "USERNAME_INVALIDO",
        "El usuario debe tener entre 3 y 32 caracteres: letras, números, punto, guion o guion bajo.",
      );
    }
    if (!(await libre(explicito))) {
      throw badRequest("USERNAME_EN_USO", `El usuario "${explicito}" ya está tomado.`);
    }
    return { email: null, username: explicito };
  }

  const project = await tx.project.findFirst({
    where: { id: params.projectId, deletedAt: null },
    select: { ciCliente: true },
  });
  const porCedula = usernameDesdeCedula(project?.ciCliente ?? "");
  if (porCedula && (await libre(porCedula))) return { email: null, username: porCedula };

  const base = usernameDesdeNombre(params.name);
  if (!base) {
    throw badRequest(
      "SIN_IDENTIFICADOR",
      "No hay mail ni cédula y el nombre no alcanza para armar un usuario. Cargá uno a mano.",
    );
  }
  return { email: null, username: await primerUsernameLibre(base, libre) };
}

function identificadorDe(u: { email: string | null; username: string | null }): string {
  return u.email ?? u.username ?? "";
}

export async function createPortalUserForProject(
  params: CreatePortalUserParams,
): Promise<CreatePortalUserResult> {
  const result = await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { name: "CLIENT" } });
    if (!role) throw badRequest("ROLE_NOT_FOUND", "El rol CLIENT no existe");

    const project = await tx.project.findFirst({
      where: { id: params.projectId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw notFound("PROJECT_NOT_FOUND", "El proyecto no existe o está borrado");

    const { email, username } = await resolverIdentificador(tx, params);

    // Solo se busca duplicado cuando hay mail: el alias ya se generó libre.
    const existing = email
      ? await tx.user.findUnique({
          where: { email },
          include: { role: { select: { name: true } } },
        })
      : null;

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
        username,
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
      ? `Vinculó el Generador '${result.user.name}' (${identificadorDe(result.user)}) al proyecto desde Experiencia Solar`
      : `Creó el usuario de portal '${result.user.name}' (${identificadorDe(result.user)}) desde Experiencia Solar`,
  });

  return {
    userId: result.user.id,
    name: result.user.name,
    email: result.user.email,
    username: result.user.username,
    identificador: identificadorDe(result.user),
    linked: result.linked,
  };
}

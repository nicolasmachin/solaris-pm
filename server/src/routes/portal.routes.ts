import bcrypt from "bcryptjs";
import { Action, AuditAction, AuditEntityType, Module } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import {
  agregarComentario,
  crearTicket,
  serializeTicket,
} from "../services/tickets/tickets.service.js";
import { calculateTimes } from "../services/uteProcess.service.js";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

// ─── Schemas ────────────────────────────────────────────────────────────────

const createClientSchema = z
  .object({
    name: z.string().trim().min(1, "Ingresá el nombre"),
    email: z.string().trim().toLowerCase().email("Ingresá un email válido"),
    temporaryPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    projectIds: z.array(z.string().min(1)).default([]),
    phone: z.string().trim().optional().nullable(),
  })
  .strict();

const patchClientSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    phone: z.string().trim().nullable().optional(),
    active: z.boolean().optional(),
    newPassword: z.string().min(8).optional(),
    projectIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureUser(request: import("fastify").FastifyRequest) {
  if (!request.user) {
    throw unauthorized("No autenticado");
  }
  return request.user;
}

function serializeClient(c: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  passwordTemporary: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  projectClients: Array<{ project: { id: string; code: string; clientName: string } | null }>;
}) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    passwordTemporary: c.passwordTemporary,
    active: c.deletedAt == null,
    createdAt: serializeDate(c.createdAt),
    projects: c.projectClients
      .map((pc) => pc.project)
      .filter((p): p is { id: string; code: string; clientName: string } => p != null)
      .map((p) => ({ id: p.id, code: p.code, clientName: p.clientName })),
  };
}

const CLIENT_PROJECTS_INCLUDE = {
  projectClients: {
    where: { project: { deletedAt: null } },
    include: {
      project: { select: { id: true, code: true, clientName: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

// ─── Timeline UTE para portal cliente ───────────────────────────────────────

type UteStageKey =
  | "consulta"
  | "caso_abierto"
  | "consulta_aprobada"
  | "solicitud"
  | "proyecto_aprobado"
  | "docs1"
  | "docs1_aprobados"
  | "ensayos"
  | "ensayos_aprobados"
  | "docs2"
  | "finalizado";

type TimelineItem = {
  key: UteStageKey;
  label: string;
  description: string;
  responsible: "VOLTIA" | "UTE";
  status: "completed" | "current" | "pending";
  completedAt: string | null;
  daysInStage: number | null;
  explanation: string | null;
};

function buildTimeline(
  ute: {
    consultaSentAt: Date | null;
    caseOpenedAt: Date | null;
    consultaApprovedAt: Date | null;
    solicitudSentAt: Date | null;
    proyectoApprovedAt: Date | null;
    docs1SentAt: Date | null;
    docs1ApprovedAt: Date | null;
    ensayosSentAt: Date | null;
    ensayosApprovedAt: Date | null;
    docs2SentAt: Date | null;
    finalizedAt: Date | null;
  } | null,
): TimelineItem[] {
  const steps: Array<{
    key: UteStageKey;
    label: string;
    description: string;
    responsible: "VOLTIA" | "UTE";
    explanation: string;
    field: keyof NonNullable<typeof ute>;
  }> = [
    {
      key: "consulta",
      label: "Consulta enviada a UTE",
      description: "Voltia presenta la consulta inicial.",
      responsible: "VOLTIA",
      explanation: "Voltia envió la consulta a UTE.",
      field: "consultaSentAt",
    },
    {
      key: "caso_abierto",
      label: "Caso abierto en UTE",
      description: "UTE registra el caso en su sistema interno.",
      responsible: "UTE",
      explanation: "UTE recibió la consulta y le asignó un número de caso.",
      field: "caseOpenedAt",
    },
    {
      key: "consulta_aprobada",
      label: "Consulta aprobada",
      description: "UTE da el visto bueno técnico inicial.",
      responsible: "UTE",
      explanation: "UTE aprobó la consulta inicial. Voltia ya puede preparar la solicitud formal.",
      field: "consultaApprovedAt",
    },
    {
      key: "solicitud",
      label: "Solicitud enviada",
      description: "Voltia presenta la solicitud formal.",
      responsible: "VOLTIA",
      explanation: "Voltia envió la solicitud formal a UTE.",
      field: "solicitudSentAt",
    },
    {
      key: "proyecto_aprobado",
      label: "Proyecto aprobado",
      description: "UTE aprueba el proyecto técnico.",
      responsible: "UTE",
      explanation: "UTE aprobó el proyecto. Voltia puede preparar la documentación de obra.",
      field: "proyectoApprovedAt",
    },
    {
      key: "docs1",
      label: "Documentos de obra enviados",
      description: "Voltia entrega la primera tanda de documentación.",
      responsible: "VOLTIA",
      explanation: "Voltia envió a UTE la documentación de obra.",
      field: "docs1SentAt",
    },
    {
      key: "docs1_aprobados",
      label: "Documentos de obra aprobados",
      description: "UTE aprueba la documentación de obra.",
      responsible: "UTE",
      explanation: "UTE aprobó la documentación. Voltia coordina ensayos.",
      field: "docs1ApprovedAt",
    },
    {
      key: "ensayos",
      label: "Ensayos enviados",
      description: "Voltia envía resultados de ensayos.",
      responsible: "VOLTIA",
      explanation: "Voltia envió los resultados de los ensayos a UTE.",
      field: "ensayosSentAt",
    },
    {
      key: "ensayos_aprobados",
      label: "Ensayos aprobados",
      description: "UTE valida los ensayos.",
      responsible: "UTE",
      explanation: "UTE aprobó los ensayos. Voltia prepara documentación final.",
      field: "ensayosApprovedAt",
    },
    {
      key: "docs2",
      label: "Documentos finales enviados",
      description: "Voltia presenta la documentación final.",
      responsible: "VOLTIA",
      explanation: "Voltia envió la documentación final a UTE.",
      field: "docs2SentAt",
    },
    {
      key: "finalizado",
      label: "Trámite finalizado",
      description: "UTE habilita el sistema.",
      responsible: "UTE",
      explanation: "¡Trámite UTE finalizado! El sistema queda habilitado.",
      field: "finalizedAt",
    },
  ];

  if (!ute) {
    return steps.map((s) => ({
      key: s.key,
      label: s.label,
      description: s.description,
      responsible: s.responsible,
      status: "pending",
      completedAt: null,
      daysInStage: null,
      explanation: null,
    }));
  }

  // Última fecha disponible (para calcular daysInStage de la etapa actual).
  const dates = steps
    .map((s) => ({ key: s.key, date: ute[s.field] as Date | null }))
    .filter((s): s is { key: UteStageKey; date: Date } => s.date != null);
  const lastCompletedDate = dates.length > 0 ? dates[dates.length - 1].date : null;

  // currentIndex = primer paso pendiente.
  let currentIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (ute[steps[i].field] == null) {
      currentIndex = i;
      break;
    }
  }
  // Si todos completados, no hay current.
  const allDone = currentIndex === -1;

  const now = new Date();
  return steps.map((s, i) => {
    const completedAt = ute[s.field] as Date | null;
    if (completedAt) {
      return {
        key: s.key,
        label: s.label,
        description: s.description,
        responsible: s.responsible,
        status: "completed" as const,
        completedAt: serializeDate(completedAt),
        daysInStage: null,
        explanation: null,
      };
    }
    if (!allDone && i === currentIndex) {
      const daysInStage = lastCompletedDate
        ? Math.max(0, Math.round((now.getTime() - lastCompletedDate.getTime()) / 86_400_000))
        : null;
      return {
        key: s.key,
        label: s.label,
        description: s.description,
        responsible: s.responsible,
        status: "current" as const,
        completedAt: null,
        daysInStage,
        explanation: s.explanation,
      };
    }
    return {
      key: s.key,
      label: s.label,
      description: s.description,
      responsible: s.responsible,
      status: "pending" as const,
      completedAt: null,
      daysInStage: null,
      explanation: null,
    };
  });
}

// ─── Registro de rutas ──────────────────────────────────────────────────────

export async function registerPortalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ════════════════════════════════════════════════════════════════════════
  // ADMIN: gestión de clientes
  // ════════════════════════════════════════════════════════════════════════

  app.get(
    "/admin/clients",
    { preHandler: authorize(Module.USUARIOS, Action.VIEW) },
    async () => {
      const clients = await prisma.user.findMany({
        where: { role: { name: "CLIENT" } },
        include: CLIENT_PROJECTS_INCLUDE,
        orderBy: { createdAt: "desc" },
      });

      return clients.map(serializeClient);
    },
  );

  // Lista de proyectos disponibles para asignar a un cliente desde el modal
  // de admin. A diferencia del flujo anterior, NO filtra por "sin cliente
  // asignado": ahora un proyecto puede tener varios clientes (m2m). Devuelve
  // un contador con la cantidad de clientes que ya tienen acceso, para que
  // el admin lo vea como contexto en el multi-select.
  app.get(
    "/admin/projects/available-for-client",
    { preHandler: authorize(Module.USUARIOS, Action.VIEW) },
    async () => {
      const projects = await prisma.project.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          clientName: true,
          capacityKwp: true,
          locationCity: true,
          locationProvince: true,
          status: true,
          _count: { select: { clients: true } },
        },
        orderBy: { code: "desc" },
      });
      return projects.map((p) => ({
        id: p.id,
        code: p.code,
        clientName: p.clientName,
        capacityKwp: Number(p.capacityKwp),
        location: `${p.locationCity}, ${p.locationProvince}`,
        status: p.status,
        clientsCount: p._count.clients,
      }));
    },
  );

  // Clientes con acceso al portal para un proyecto específico (m2m). Usado
  // en el detalle del proyecto para mostrar qué CLIENTs ya tienen acceso.
  app.get(
    "/admin/projects/:projectId/clients",
    { preHandler: authorize(Module.USUARIOS, Action.VIEW) },
    async (request) => {
      const params = z.object({ projectId: z.string() }).parse(request.params);
      const project = await prisma.project.findFirst({
        where: { id: params.projectId, deletedAt: null },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");

      const rows = await prisma.projectClient.findMany({
        where: { projectId: params.projectId, user: { deletedAt: null } },
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true, passwordTemporary: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      return rows.map((r) => ({
        projectClientId: r.id,
        userId: r.user.id,
        name: r.user.name,
        email: r.user.email,
        phone: r.user.phone,
        passwordTemporary: r.user.passwordTemporary,
        assignedAt: serializeDate(r.createdAt),
      }));
    },
  );

  app.get(
    "/admin/clients/:id",
    { preHandler: authorize(Module.USUARIOS, Action.VIEW) },
    async (request) => {
      const params = z.object({ id: z.string() }).parse(request.params);
      const client = await prisma.user.findFirst({
        where: { id: params.id, role: { name: "CLIENT" } },
        include: CLIENT_PROJECTS_INCLUDE,
      });
      if (!client) throw notFound("CLIENT_NOT_FOUND", "Cliente no encontrado");
      return serializeClient(client);
    },
  );

  app.post(
    "/admin/clients",
    { preHandler: authorize(Module.USUARIOS, Action.CREATE) },
    async (request, reply) => {
      const currentUser = ensureUser(request);
      const body = createClientSchema.parse(request.body);

      const result = await prisma.$transaction(async (tx) => {
        const role = await tx.role.findUnique({ where: { name: "CLIENT" } });
        if (!role) throw badRequest("ROLE_NOT_FOUND", "El rol CLIENT no existe");

        const existing = await tx.user.findUnique({ where: { email: body.email } });
        if (existing) throw badRequest("EMAIL_IN_USE", "El email ya está en uso");

        // Validar que los projectIds existan; ya no validamos "no asignado" porque
        // un proyecto puede tener varios clientes.
        if (body.projectIds.length > 0) {
          const projects = await tx.project.findMany({
            where: { id: { in: body.projectIds }, deletedAt: null },
            select: { id: true },
          });
          if (projects.length !== body.projectIds.length) {
            throw badRequest("PROJECT_NOT_FOUND", "Alguno de los proyectos no existe o está borrado");
          }
        }

        const hashed = await bcrypt.hash(body.temporaryPassword, 10);
        const newUser = await tx.user.create({
          data: {
            name: body.name,
            email: body.email,
            password: hashed,
            phone: body.phone ?? null,
            roleId: role.id,
            passwordTemporary: true,
          },
        });

        if (body.projectIds.length > 0) {
          await tx.projectClient.createMany({
            data: body.projectIds.map((projectId) => ({
              projectId,
              userId: newUser.id,
              createdById: currentUser.id,
            })),
            skipDuplicates: true,
          });
        }

        return tx.user.findUniqueOrThrow({
          where: { id: newUser.id },
          include: CLIENT_PROJECTS_INCLUDE,
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: result.id,
        userId: currentUser.id,
        action: AuditAction.created,
        description: `Creó cliente '${result.name}' (${result.email}) con ${body.projectIds.length} proyecto(s)`,
      });

      reply.code(201);
      return serializeClient(result);
    },
  );

  app.patch(
    "/admin/clients/:id",
    { preHandler: authorize(Module.USUARIOS, Action.EDIT) },
    async (request) => {
      const currentUser = ensureUser(request);
      const params = z.object({ id: z.string() }).parse(request.params);
      const body = patchClientSchema.parse(request.body);

      const existing = await prisma.user.findFirst({
        where: { id: params.id, role: { name: "CLIENT" } },
        include: CLIENT_PROJECTS_INCLUDE,
      });
      if (!existing) throw notFound("CLIENT_NOT_FOUND", "Cliente no encontrado");

      const updated = await prisma.$transaction(async (tx) => {
        if (body.email !== undefined && body.email !== existing.email) {
          const emailTaken = await tx.user.findUnique({ where: { email: body.email } });
          if (emailTaken) throw badRequest("EMAIL_IN_USE", "El email ya está en uso");
        }

        const data: Record<string, unknown> = {};
        if (body.name !== undefined) data.name = body.name;
        if (body.email !== undefined) data.email = body.email;
        if (body.phone !== undefined) data.phone = body.phone;
        if (body.active !== undefined) {
          data.deletedAt = body.active ? null : new Date();
        }
        if (body.newPassword !== undefined) {
          data.password = await bcrypt.hash(body.newPassword, 10);
          data.passwordTemporary = true;
        }

        if (Object.keys(data).length > 0) {
          await tx.user.update({ where: { id: existing.id }, data });
        }

        if (body.projectIds !== undefined) {
          // Validar que los nuevos projectIds existan. Ya no validamos
          // "asignado a otro cliente" porque la relación es m2m.
          if (body.projectIds.length > 0) {
            const projects = await tx.project.findMany({
              where: { id: { in: body.projectIds }, deletedAt: null },
              select: { id: true },
            });
            if (projects.length !== body.projectIds.length) {
              throw badRequest("PROJECT_NOT_FOUND", "Alguno de los proyectos no existe o está borrado");
            }
          }

          // Sync: quitar los project_clients de este user que no estén
          // en la nueva lista, y crear los nuevos.
          await tx.projectClient.deleteMany({
            where: { userId: existing.id, projectId: { notIn: body.projectIds } },
          });
          if (body.projectIds.length > 0) {
            await tx.projectClient.createMany({
              data: body.projectIds.map((projectId) => ({
                projectId,
                userId: existing.id,
                createdById: currentUser.id,
              })),
              skipDuplicates: true,
            });
          }
        }

        return tx.user.findUniqueOrThrow({
          where: { id: existing.id },
          include: CLIENT_PROJECTS_INCLUDE,
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: existing.id,
        userId: currentUser.id,
        action: AuditAction.updated,
        description: `Actualizó cliente '${existing.name}' (${existing.email})`,
      });

      return serializeClient(updated);
    },
  );

  app.delete(
    "/admin/clients/:id",
    { preHandler: authorize(Module.USUARIOS, Action.DELETE) },
    async (request, reply) => {
      const currentUser = ensureUser(request);
      const params = z.object({ id: z.string() }).parse(request.params);

      const existing = await prisma.user.findFirst({
        where: { id: params.id, role: { name: "CLIENT" }, deletedAt: null },
      });
      if (!existing) throw notFound("CLIENT_NOT_FOUND", "Cliente no encontrado");

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existing.id },
          data: { deletedAt: new Date() },
        });
        // Sacar todas sus asignaciones m2m. El campo legacy clientUserId
        // también se limpia por consistencia hasta que se dropee.
        await tx.projectClient.deleteMany({ where: { userId: existing.id } });
        await tx.project.updateMany({
          where: { clientUserId: existing.id },
          data: { clientUserId: null },
        });
      });

      await createAuditEntry({
        entityType: AuditEntityType.user,
        entityId: existing.id,
        userId: currentUser.id,
        action: AuditAction.deleted,
        description: `Eliminó cliente '${existing.name}' (${existing.email})`,
      });

      reply.code(204).send();
    },
  );

  // ════════════════════════════════════════════════════════════════════════
  // CLIENT: portal del cliente
  // ════════════════════════════════════════════════════════════════════════

  app.get(
    "/client/projects",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);

      const projects = await prisma.project.findMany({
        where: {
          deletedAt: null,
          clients: { some: { userId: user.id } },
        },
        select: {
          id: true,
          code: true,
          clientName: true,
          capacityKwp: true,
          locationCity: true,
          locationProvince: true,
          uteProcesses: {
            where: { deletedAt: null },
            select: { id: true, currentStage: true, finalizedAt: true, caseNumber: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return projects.map((p) => ({
        id: p.id,
        code: p.code,
        clientName: p.clientName,
        capacityKwp: Number(p.capacityKwp),
        location: `${p.locationCity}, ${p.locationProvince}`,
        uteCaseNumber: p.uteProcesses[0]?.caseNumber ?? null,
        uteCurrentStage: p.uteProcesses[0]?.currentStage ?? null,
        uteFinalized: !!p.uteProcesses[0]?.finalizedAt,
      }));
    },
  );

  app.get(
    "/client/projects/:id/ute",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const params = z.object({ id: z.string() }).parse(request.params);

      const project = await prisma.project.findFirst({
        where: {
          id: params.id,
          deletedAt: null,
          clients: { some: { userId: user.id } },
        },
        include: {
          uteProcesses: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });
      if (!project) {
        // Mismo mensaje que si no existe para no filtrar info.
        throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      }

      const ute = project.uteProcesses[0] ?? null;
      const timeline = buildTimeline(ute);
      const times = ute ? calculateTimes(ute, new Date()) : null;

      return {
        projectId: project.id,
        projectCode: project.code,
        clientName: project.clientName,
        capacityKwp: Number(project.capacityKwp),
        location: `${project.locationCity}, ${project.locationProvince}`,
        ute: ute
          ? {
              id: ute.id,
              caseNumber: ute.caseNumber,
              currentStage: ute.currentStage,
              currentStatus: ute.currentStatus,
              finalizedAt: serializeDate(ute.finalizedAt),
              totalDays: times?.totalDays ?? 0,
              ourTimeDays: times?.ourTimeDays ?? 0,
              uteTimeDays: times?.uteTimeDays ?? 0,
            }
          : null,
        timeline,
      };
    },
  );

  // ─── Tickets del cliente (in-app, sin email) ────────────────────────────
  // El cliente abre/ve/comenta sus propios tickets. Ownership: el ticket cuelga
  // de un proyecto donde el cliente figura en ProjectClient.

  app.get(
    "/client/tickets",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const rows = await prisma.ticket.findMany({
        where: {
          deletedAt: null,
          project: { deletedAt: null, clients: { some: { userId: user.id } } },
        },
        include: { project: { select: { id: true, clientName: true, code: true } } },
        orderBy: { createdAt: "desc" },
      });
      return rows.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        projectName: t.project.clientName,
        projectCode: t.project.code,
        titulo: t.titulo,
        estado: t.estado,
        prioridad: t.prioridad,
        createdAt: t.createdAt.toISOString(),
      }));
    },
  );

  app.get(
    "/client/tickets/:id",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const t = await prisma.ticket.findFirst({
        where: {
          id,
          deletedAt: null,
          project: { clients: { some: { userId: user.id } } },
        },
        include: { comentarios: true },
      });
      if (!t) throw notFound("TICKET_NOT_FOUND", "Ticket no encontrado");
      // El cliente NO ve comentarios internos.
      return serializeTicket(t, { includeInternalComments: false });
    },
  );

  app.post(
    "/client/tickets",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.CREATE) },
    async (request) => {
      const user = ensureUser(request);
      const body = z
        .object({
          projectId: z.string(),
          titulo: z.string().trim().min(1).max(200),
          descripcion: z.string().trim().min(1).max(4000),
        })
        .parse(request.body);
      // Ownership: el proyecto debe ser del cliente.
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, deletedAt: null, clients: { some: { userId: user.id } } },
        select: { id: true },
      });
      if (!project) throw notFound("PROJECT_NOT_FOUND", "Proyecto no encontrado");
      const t = await crearTicket({
        projectId: body.projectId,
        titulo: body.titulo,
        descripcion: body.descripcion,
        creadoPorId: user.id,
        origenCliente: true,
      });
      return serializeTicket(t, { includeInternalComments: false });
    },
  );

  app.post(
    "/client/tickets/:id/comentarios",
    { preHandler: authorize(Module.PORTAL_CLIENTE, Action.COMMENT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ contenido: z.string().trim().min(1).max(4000) }).parse(request.body);
      // Ownership.
      const owned = await prisma.ticket.findFirst({
        where: { id, deletedAt: null, project: { clients: { some: { userId: user.id } } } },
        select: { id: true },
      });
      if (!owned) throw notFound("TICKET_NOT_FOUND", "Ticket no encontrado");
      // El cliente nunca crea comentarios internos.
      const t = await agregarComentario({ ticketId: id, autorId: user.id, contenido: body.contenido, esInterno: false });
      return serializeTicket(t, { includeInternalComments: false });
    },
  );

  // No-op para suprimir warnings de imports no usados en futuros refactors.
  void forbidden;
}

// Sistema de mails: configuración SMTP por usuario, plantillas (CRUD admin),
// preparación (Handlebars) y envío con nodemailer + auditoría.

import { Action, EmailTemplateScope, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { unauthorized } from "../utils/errors.js";
import {
  getSmtpConfig,
  testSmtp,
  upsertSmtpConfig,
  type SmtpConfigInput,
} from "../services/email/smtp.service.js";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  type TemplateInput,
} from "../services/email/template.service.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const smtpConfigSchema = z
  .object({
    host: z.string().trim().min(1),
    port: z.number().int().min(1).max(65535),
    secure: z.boolean(),
    username: z.string().trim().min(1),
    password: z.string().min(1).optional(),
    fromName: z.string().trim().nullable().optional(),
    replyTo: z.string().trim().email().nullable().optional(),
  })
  .strict();

const idParam = z.object({ id: z.string().min(1) });

const templateQuery = z
  .object({
    modulo: z.nativeEnum(Module).optional(),
    scope: z.nativeEnum(EmailTemplateScope).optional(),
    activo: z
      .enum(["true", "false"])
      .transform((v) => v === "true")
      .optional(),
  })
  .strict();

const templateCreateSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+$/, "La clave debe ser kebab/snake en minúsculas"),
    nombre: z.string().trim().min(1),
    descripcion: z.string().trim().nullable().optional(),
    modulo: z.nativeEnum(Module),
    scope: z.nativeEnum(EmailTemplateScope),
    toTemplate: z.string().optional(),
    ccTemplate: z.string().optional(),
    bccTemplate: z.string().optional(),
    subjectTemplate: z.string().min(1),
    bodyTemplate: z.string().min(1),
    activo: z.boolean().optional(),
  })
  .strict();

// La key no se edita (es estable para la auto-selección).
const templateUpdateSchema = templateCreateSchema.omit({ key: true }).partial().strict();

export async function registerEmailRoutes(app: FastifyInstance) {
  // Todas las rutas del módulo requieren usuario autenticado.
  app.addHook("preHandler", authenticate);

  // ─── SMTP por usuario ───────────────────────────────────────────────────────
  app.get("/me/smtp-config", async (request) => {
    const user = ensureUser(request);
    return getSmtpConfig(user.id);
  });

  app.put("/me/smtp-config", async (request) => {
    const user = ensureUser(request);
    const body = smtpConfigSchema.parse(request.body) as SmtpConfigInput;
    return upsertSmtpConfig(user.id, body);
  });

  app.post("/me/smtp-config/test", async (request) => {
    const user = ensureUser(request);
    // El body es opcional: si no viene, prueba la config guardada.
    const body =
      request.body && Object.keys(request.body).length > 0
        ? (smtpConfigSchema.parse(request.body) as SmtpConfigInput)
        : undefined;
    return testSmtp(user.id, body);
  });

  // ─── Plantillas (CRUD; lectura autenticada, escritura ADMIN/CONFIGURACION) ───
  app.get("/email-templates", async (request) => {
    const q = templateQuery.parse(request.query);
    return listTemplates(q);
  });

  app.get("/email-templates/:id", async (request) => {
    const { id } = idParam.parse(request.params);
    return getTemplate(id);
  });

  app.post(
    "/email-templates",
    { preHandler: authorize(Module.CONFIGURACION, Action.CREATE) },
    async (request, reply) => {
      const body = templateCreateSchema.parse(request.body) as TemplateInput;
      const tpl = await createTemplate(body);
      reply.code(201);
      return tpl;
    },
  );

  app.patch(
    "/email-templates/:id",
    { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) },
    async (request) => {
      const { id } = idParam.parse(request.params);
      const body = templateUpdateSchema.parse(request.body) as Partial<TemplateInput>;
      return updateTemplate(id, body);
    },
  );

  app.delete(
    "/email-templates/:id",
    { preHandler: authorize(Module.CONFIGURACION, Action.DELETE) },
    async (request, reply) => {
      const { id } = idParam.parse(request.params);
      await deleteTemplate(id); // 409 si esSistema
      return reply.code(204).send();
    },
  );
}

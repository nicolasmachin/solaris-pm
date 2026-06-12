// Sistema de mails: configuración SMTP por usuario, plantillas (CRUD admin),
// preparación (Handlebars) y envío con nodemailer + auditoría.

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { unauthorized } from "../utils/errors.js";
import {
  getSmtpConfig,
  testSmtp,
  upsertSmtpConfig,
  type SmtpConfigInput,
} from "../services/email/smtp.service.js";

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
}

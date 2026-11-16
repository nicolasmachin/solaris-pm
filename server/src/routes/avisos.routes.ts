/**
 * Avisos automáticos al cliente (Administración → Avisos automáticos).
 * Ver: CONFIGURACION:VIEW. Crear, editar, mandar a Meta, activar: CONFIGURACION:EDIT.
 */

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import {
  activarAviso,
  borrarAviso,
  catalogo,
  crearAviso,
  editarAviso,
  listarAvisos,
  listarEnvios,
  mandarAMeta,
  pausarAviso,
  refrescarPlantillas,
} from "../services/avisos/avisos.service.js";
import { archivoPorToken, guardarAdjunto, quitarAdjunto } from "../services/avisos/adjunto.js";
import { MetaApiError } from "../services/whatsapp-cloud/api.service.js";
import { AppError, badRequest, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

async function conMeta<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MetaApiError) {
      throw new AppError(502, "META_ERROR", `Meta: ${err.message}`, { detalle: err.detalle as Record<string, unknown> });
    }
    throw err;
  }
}

const datosSchema = z.object({
  nombre: z.string().trim().min(3).max(80),
  disparador: z.string().min(3).max(80),
  dias: z.number().int().min(1).max(30).nullish(),
  // Hasta 60 días.
  demoraMinutos: z.number().int().min(0).max(60 * 24 * 60).nullish(),
  condicion: z.enum(["SIN_CONTACTO", "PORTAL_CON_MAIL", "PORTAL_SIN_MAIL", "MANTENIMIENTO_SIN_COSTO"]).nullish(),
  canal: z.enum(["WHATSAPP", "EMAIL"]),
  asunto: z.string().max(200).nullish(),
  cuerpo: z.string().min(1).max(4000),
  cierraCheck: z.string().max(60).nullish(),
  adjuntoTexto: z.string().max(1024).nullish(),
  adjuntoUnaVez: z.boolean().optional(),
});

const idParam = z.object({ id: z.string().min(1) });

export async function registerAvisosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const ver = { preHandler: authorize(Module.CONFIGURACION, Action.VIEW) };
  const editar = { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) };

  app.get("/avisos/catalogo", ver, async () => catalogo());

  app.get("/avisos", ver, async () => {
    // Al abrir la pantalla se trae de Meta el estado de las plantillas en revisión.
    await refrescarPlantillas().catch((err) => console.error("[avisos] refrescar:", err instanceof Error ? err.message : err));
    return listarAvisos();
  });

  app.get("/avisos/envios", ver, async (request) => {
    const q = z
      .object({ avisoId: z.string().optional(), projectId: z.string().optional(), limite: z.coerce.number().int().optional() })
      .parse(request.query);
    return listarEnvios(q);
  });

  app.post("/avisos", editar, async (request, reply) => {
    const user = ensureUser(request);
    const a = await crearAviso(datosSchema.parse(request.body), user.id);
    return reply.status(201).send(a);
  });

  app.put("/avisos/:id", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return editarAviso(id, datosSchema.parse(request.body), user.id);
  });

  // El video o la foto que sale después del texto. Los límites son los de WhatsApp.
  app.post("/avisos/:id/adjunto", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const part = await request.file({ limits: { fileSize: 16 * 1024 * 1024, files: 1 } });
    if (!part) throw badRequest("SIN_ARCHIVO", "No llegó ningún archivo.");
    const buffer = await part.toBuffer().catch(() => {
      throw badRequest("MUY_GRANDE", "WhatsApp acepta videos de hasta 16 MB y fotos de hasta 5 MB.");
    });
    const a = await guardarAdjunto(id, { buffer, mimetype: part.mimetype, filename: part.filename });
    await auditarAdjunto(id, user.id, `Subió ${a.adjuntoTipo === "VIDEO" ? "el video" : "la foto"} «${part.filename}» del aviso «${a.nombre}»`);
    return a;
  });

  app.delete("/avisos/:id/adjunto", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    const a = await quitarAdjunto(id);
    await auditarAdjunto(id, user.id, `Quitó el video o la foto del aviso «${a.nombre}»`);
    return a;
  });

  app.post("/avisos/:id/meta", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return conMeta(() => mandarAMeta(id, user.id));
  });

  app.post("/avisos/:id/activar", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return activarAviso(id, user.id);
  });

  app.post("/avisos/:id/pausar", editar, async (request) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    return pausarAviso(id, user.id);
  });

  app.delete("/avisos/:id", editar, async (request, reply) => {
    const user = ensureUser(request);
    const { id } = idParam.parse(request.params);
    await borrarAviso(id, user.id);
    return reply.status(204).send();
  });
}

async function auditarAdjunto(avisoId: string, userId: string, description: string) {
  const { createAuditEntry } = await import("../services/audit.service.js");
  const { AuditAction, AuditEntityType } = await import("@prisma/client");
  await createAuditEntry({ entityType: AuditEntityType.aviso_automatico, entityId: avisoId, userId, action: AuditAction.updated, description });
}

/**
 * La dirección pública del video o la foto de un aviso: Meta lo baja de acá al
 * mandar el mensaje. Sin sesión (Meta no tiene), protegida por el token, que no
 * se puede adivinar.
 */
export async function registerAvisosPublicoRoutes(app: FastifyInstance) {
  // "No puedo entrar" del ingreso al portal: sin sesión (justamente no puede
  // entrar), con límite de pedidos por IP. Le llega a Experiencia Solar como
  // pendiente; ver services/portal/no-puedo-entrar.service.ts.
  app.post("/publico/portal/no-puedo-entrar", async (request) => {
    const { tooManyAttempts } = await import("./mcp/rate-limit.js");
    if (tooManyAttempts(`no-puedo-entrar:${request.ip}`)) {
      throw new AppError(429, "DEMASIADOS_PEDIDOS", "Ya recibimos tu pedido. Te vamos a escribir.");
    }
    const body = z
      .object({
        nombre: z.string().trim().min(2).max(120),
        telefono: z.string().trim().min(6).max(30),
        mensaje: z.string().trim().max(1000).nullish(),
      })
      .parse(request.body);
    const { registrarNoPuedoEntrar } = await import("../services/portal/no-puedo-entrar.service.js");
    return registrarNoPuedoEntrar(body);
  });

  app.get("/publico/avisos/adjunto/:token", async (request, reply) => {
    const { token } = z.object({ token: z.string().min(20).max(60) }).parse(request.params);
    const archivo = await archivoPorToken(token);
    if (!archivo) throw notFound("ARCHIVO_NO_ENCONTRADO", "No existe.");
    reply.header("Content-Type", archivo.mime);
    reply.header("Content-Length", String(archivo.size));
    reply.header("Cache-Control", "public, max-age=3600");
    return reply.send(archivo.stream);
  });
}

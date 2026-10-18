/**
 * WhatsApp (Cloud API): mandar mensajes, ver conversaciones y manejar
 * plantillas. Por ahora solo para Administración → WhatsApp, que es donde se
 * prueba la conexión y se graban los videos para la revisión de Meta. Permiso:
 * CONFIGURACION:EDIT.
 */

import { Action, AuditAction, AuditEntityType, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import {
  MetaApiError,
  crearPlantilla,
  enviarPlantilla,
  enviarTexto,
  listarConversaciones,
  listarPlantillas,
  mensajesDe,
} from "../services/whatsapp-cloud/api.service.js";
import { faltantesParaEnviar, whatsappConfig } from "../services/whatsapp-cloud/config.js";
import { AppError, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

/** Los errores de Meta se devuelven con su mensaje: es lo que hay que corregir. */
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

export async function registerWhatsAppRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  const puede = { preHandler: authorize(Module.CONFIGURACION, Action.EDIT) };

  app.get("/whatsapp/estado", puede, async () => {
    const c = whatsappConfig();
    return {
      faltan: faltantesParaEnviar(c),
      webhookListo: !!c.appSecret && !!c.verifyToken,
      phoneNumberId: c.phoneNumberId || null,
      graphVersion: c.graphVersion,
    };
  });

  app.get("/whatsapp/conversaciones", puede, async () => listarConversaciones());

  app.get("/whatsapp/conversaciones/:telefono", puede, async (request) => {
    const { telefono } = z.object({ telefono: z.string().min(6).max(20) }).parse(request.params);
    return mensajesDe(telefono);
  });

  app.post("/whatsapp/enviar", puede, async (request, reply) => {
    const user = ensureUser(request);
    const body = z
      .discriminatedUnion("tipo", [
        z.object({
          tipo: z.literal("plantilla"),
          telefono: z.string().min(6).max(20),
          plantilla: z.string().min(1).max(512),
          idioma: z.string().min(2).max(10),
          variables: z.array(z.string().max(1024)).max(20).optional(),
        }),
        z.object({
          tipo: z.literal("texto"),
          telefono: z.string().min(6).max(20),
          texto: z.string().trim().min(1).max(4096),
        }),
      ])
      .parse(request.body);

    const mensaje = await conMeta(() =>
      body.tipo === "plantilla"
        ? enviarPlantilla({
            telefono: body.telefono,
            nombre: body.plantilla,
            idioma: body.idioma,
            variables: body.variables,
            userId: user.id,
          })
        : enviarTexto({ telefono: body.telefono, texto: body.texto, userId: user.id }),
    );
    reply.code(201);
    return { id: mensaje.id, waMessageId: mensaje.waMessageId, estado: mensaje.estado, telefono: mensaje.telefono };
  });

  app.get("/whatsapp/plantillas", puede, async () => conMeta(() => listarPlantillas()));

  app.post("/whatsapp/plantillas", puede, async (request, reply) => {
    const user = ensureUser(request);
    const body = z
      .object({
        // Meta solo acepta minúsculas, números y guion bajo en el nombre.
        nombre: z.string().regex(/^[a-z0-9_]{1,512}$/, "Solo minúsculas, números y guion bajo"),
        categoria: z.enum(["UTILITY", "MARKETING"]),
        idioma: z.string().min(2).max(10),
        cuerpo: z.string().trim().min(1).max(1024),
        ejemplos: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
      })
      .parse(request.body);
    const creada = await conMeta(() => crearPlantilla(body));
    await createAuditEntry({
      entityType: AuditEntityType.user,
      entityId: user.id,
      userId: user.id,
      action: AuditAction.created,
      description: `Mandó a aprobar a Meta la plantilla de WhatsApp "${body.nombre}" (${body.categoria})`,
    });
    reply.code(201);
    return creada;
  });
}

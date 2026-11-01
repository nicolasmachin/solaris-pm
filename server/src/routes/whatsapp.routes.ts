/**
 * WhatsApp (Cloud API), lo que se configura desde Administración → WhatsApp:
 * números conectados (y para qué bandeja es cada uno) y plantillas. Permiso:
 * CONFIGURACION:EDIT.
 *
 * Las conversaciones NO están acá: viven en la bandeja de cada área
 * (`whatsapp-bandejas.routes.ts`).
 */

import { Action, AuditAction, AuditEntityType, Module } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { MetaApiError, crearPlantilla, listarPlantillas } from "../services/whatsapp-cloud/api.service.js";
import { USOS_NUMERO, bandejaExperienciaSolar } from "../services/whatsapp-cloud/bandejas.service.js";
import { faltantesParaConectar, faltantesParaEnviar, whatsappConfig } from "../services/whatsapp-cloud/config.js";
import {
  actualizarNumero,
  conectarNumero,
  listarNumeros,
  sincronizarNumero,
} from "../services/whatsapp-cloud/numeros.service.js";
import { AppError, badRequest, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

/** Los errores de Meta se devuelven con su mensaje: es lo que hay que corregir. */
export async function conMeta<T>(fn: () => Promise<T>): Promise<T> {
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

  // Las plantillas son de la cuenta del número general (el de Experiencia
  // Solar), que es por donde salen los avisos automáticos.
  async function cuentaGeneral() {
    const b = await bandejaExperienciaSolar();
    if (!b.cuenta) throw badRequest("SIN_NUMERO", "No hay un número de WhatsApp para Experiencia Solar.");
    return b.cuenta;
  }

  app.get("/whatsapp/plantillas", puede, async () => conMeta(async () => listarPlantillas(await cuentaGeneral())));

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
    const creada = await conMeta(async () => crearPlantilla(body, await cuentaGeneral()));
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

  // ─── Números conectados con el registro integrado de Meta ─────────────────

  // Lo que necesita el navegador para abrir la ventana de Meta. El app id y el
  // id de configuración son públicos (van igual en el código de la página).
  app.get("/whatsapp/registro", puede, async () => {
    const c = whatsappConfig();
    return {
      faltan: faltantesParaConectar(c),
      appId: c.appId || null,
      configId: c.signupConfigId || null,
      graphVersion: c.graphVersion,
    };
  });

  app.get("/whatsapp/numeros", puede, async () => listarNumeros());

  app.post("/whatsapp/numeros", puede, async (request, reply) => {
    const user = ensureUser(request);
    const body = z
      .object({
        code: z.string().min(10).max(2048),
        phoneNumberId: z.string().regex(/^\d{5,30}$/),
        wabaId: z.string().regex(/^\d{5,30}$/),
        businessId: z.string().regex(/^\d{5,30}$/).optional(),
        etiqueta: z.string().max(60).optional(),
        responsableId: z.string().min(1).max(40).optional(),
        uso: z.enum(USOS_NUMERO).optional(),
      })
      .parse(request.body);
    const numero = await conMeta(() => conectarNumero({ ...body, userId: user.id }));
    reply.code(201);
    const { tokenCifrado: _t, ...rest } = numero;
    return rest;
  });

  app.post("/whatsapp/numeros/:id/sincronizar", puede, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { tokenCifrado: _t, ...rest } = await sincronizarNumero(id);
    return rest;
  });

  app.patch("/whatsapp/numeros/:id", puede, async (request) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z
      .object({
        etiqueta: z.string().max(60).nullable().optional(),
        responsableId: z.string().min(1).max(40).nullable().optional(),
        uso: z.enum(USOS_NUMERO).nullable().optional(),
      })
      .parse(request.body);
    return actualizarNumero(id, body, ensureUser(request).id);
  });
}

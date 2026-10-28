/**
 * Números de WhatsApp conectados con el registro integrado de Meta.
 *
 * El alta la dispara la pantalla de Administración → WhatsApp: el navegador abre
 * la ventana de Meta, el dueño del número escanea el código QR con WhatsApp
 * Business y Meta le devuelve al navegador un código de un solo uso (vive 30
 * segundos) más los ids del número y de la cuenta. Acá se cambia ese código por
 * el token del negocio, se suscribe la app a la cuenta para recibir los avisos y,
 * si el número sigue en el celular (coexistencia), se pide traer contactos e
 * historial.
 *
 * En coexistencia NO se llama a /register: el número ya está registrado en la
 * aplicación del celular. Ver docs/manual/15-whatsapp.md.
 */

import { AuditAction, AuditEntityType } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "../email/crypto.js";
import { MetaApiError } from "./api.service.js";
import { faltantesParaConectar, graphUrl, whatsappConfig } from "./config.js";

/** Meta deja pedir contactos e historial una sola vez y dentro de las 24 h de conectar. */
export const PLAZO_SYNC_MS = 24 * 60 * 60 * 1000;

async function graph<T>(path: string, token: string, init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" }) {
  const res = await fetch(graphUrl(path), {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; error_user_msg?: string } };
  if (!res.ok) {
    const msg = data.error?.error_user_msg ?? data.error?.message ?? `Meta respondió ${res.status}`;
    throw new MetaApiError(msg, res.status, data.error ?? data);
  }
  return data as T;
}

/** Cambia el código de un solo uso del registro integrado por el token del negocio. */
async function canjearCodigo(code: string): Promise<string> {
  const c = whatsappConfig();
  const url = new URL(graphUrl("oauth/access_token"));
  url.searchParams.set("client_id", c.appId);
  url.searchParams.set("client_secret", c.appSecret);
  url.searchParams.set("code", code);
  const res = await fetch(url);
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: { message?: string } };
  if (!res.ok || !data.access_token) {
    throw new MetaApiError(
      data.error?.message ?? "Meta no devolvió el token (el código vence a los 30 segundos)",
      res.status,
      data.error ?? data,
    );
  }
  return data.access_token;
}

type DatosNumero = {
  display_phone_number?: string;
  verified_name?: string;
  is_on_biz_app?: boolean;
  platform_type?: string;
};

export async function conectarNumero(params: {
  code: string;
  phoneNumberId: string;
  wabaId: string;
  businessId?: string;
  etiqueta?: string;
  responsableId?: string;
  userId: string;
}) {
  const faltan = faltantesParaConectar();
  if (faltan.length > 0) {
    throw badRequest("WHATSAPP_NO_CONFIGURADO", `Falta configurar en el servidor: ${faltan.join(", ")}.`);
  }
  // Sin clave de cifrado no se guarda un token en claro.
  if (!isEncryptionConfigured()) {
    throw badRequest("SIN_CIFRADO", "Falta SMTP_ENCRYPTION_KEY en el servidor para guardar el token cifrado.");
  }

  const token = await canjearCodigo(params.code);
  const datos = await graph<DatosNumero>(
    `${params.phoneNumberId}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`,
    token,
  );
  await graph(`${params.wabaId}/subscribed_apps`, token, { method: "POST" });

  const coexistencia = datos.is_on_biz_app === true;
  const data = {
    wabaId: params.wabaId,
    businessId: params.businessId ?? null,
    telefono: datos.display_phone_number ?? params.phoneNumberId,
    nombreVerificado: datos.verified_name ?? null,
    tokenCifrado: encryptSecret(token),
    coexistencia,
    etiqueta: params.etiqueta?.trim() || null,
    responsableId: params.responsableId ?? null,
    estado: "CONECTADO",
    conectadoPorId: params.userId,
    conectadoEn: new Date(),
    // Una reconexión es una conexión nueva para Meta: se puede volver a sincronizar.
    syncContactosId: null,
    syncContactosEn: null,
    syncHistorialId: null,
    syncHistorialEn: null,
    historialProgreso: null,
    historialError: null,
    syncError: null,
  };
  const numero = await prisma.whatsAppNumero.upsert({
    where: { phoneNumberId: params.phoneNumberId },
    create: { phoneNumberId: params.phoneNumberId, ...data },
    update: data,
  });

  await createAuditEntry({
    entityType: AuditEntityType.user,
    entityId: params.userId,
    userId: params.userId,
    action: AuditAction.created,
    description: `Conectó el número de WhatsApp ${numero.telefono}${coexistencia ? " (sigue en el celular)" : ""}${numero.etiqueta ? ` — ${numero.etiqueta}` : ""}`,
  });

  if (coexistencia) await sincronizarNumero(numero.id);
  return prisma.whatsAppNumero.findUniqueOrThrow({ where: { id: numero.id } });
}

/**
 * Pide a Meta los contactos y después el historial. Cada pedido se hace una sola
 * vez: lo que ya tiene id no se repite. Los datos llegan después por el webhook.
 */
export async function sincronizarNumero(id: string) {
  const numero = await prisma.whatsAppNumero.findUnique({ where: { id } });
  if (!numero) throw notFound("NUMERO_NO_ENCONTRADO", "El número no existe");
  if (!numero.coexistencia) return numero;
  if (Date.now() - numero.conectadoEn.getTime() > PLAZO_SYNC_MS) {
    throw badRequest("SYNC_VENCIDA", "Pasaron más de 24 h desde la conexión: Meta ya no deja traer contactos ni historial.");
  }
  const token = decryptSecret(numero.tokenCifrado);
  try {
    if (!numero.syncContactosId) {
      const r = await graph<{ request_id?: string }>(`${numero.phoneNumberId}/smb_app_data`, token, {
        method: "POST",
        body: { messaging_product: "whatsapp", sync_type: "smb_app_state_sync" },
      });
      await prisma.whatsAppNumero.update({
        where: { id },
        data: { syncContactosId: r.request_id ?? "ok", syncContactosEn: new Date(), syncError: null },
      });
    }
    if (!numero.syncHistorialId) {
      const r = await graph<{ request_id?: string }>(`${numero.phoneNumberId}/smb_app_data`, token, {
        method: "POST",
        body: { messaging_product: "whatsapp", sync_type: "history" },
      });
      await prisma.whatsAppNumero.update({
        where: { id },
        data: { syncHistorialId: r.request_id ?? "ok", syncHistorialEn: new Date(), syncError: null },
      });
    }
  } catch (err) {
    // Se guarda y se sigue: el número quedó conectado igual, y desde la pantalla
    // se puede reintentar mientras no pasen las 24 h.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] sincronización de ${numero.telefono} falló:`, msg);
    await prisma.whatsAppNumero.update({ where: { id }, data: { syncError: msg } });
  }
  return prisma.whatsAppNumero.findUniqueOrThrow({ where: { id } });
}

/** Lista para la pantalla: nunca devuelve el token. */
export async function listarNumeros() {
  const numeros = await prisma.whatsAppNumero.findMany({
    orderBy: { conectadoEn: "asc" },
    include: {
      responsable: { select: { id: true, name: true } },
      conectadoPor: { select: { name: true } },
    },
  });
  return numeros.map(({ tokenCifrado: _token, ...n }) => ({
    ...n,
    responsable: n.responsable,
    conectadoPor: n.conectadoPor?.name ?? null,
    puedeSincronizar:
      n.coexistencia &&
      (!n.syncContactosId || !n.syncHistorialId) &&
      Date.now() - n.conectadoEn.getTime() <= PLAZO_SYNC_MS,
  }));
}

export async function actualizarNumero(id: string, cambios: { etiqueta?: string | null; responsableId?: string | null }) {
  const numero = await prisma.whatsAppNumero.findUnique({ where: { id } });
  if (!numero) throw notFound("NUMERO_NO_ENCONTRADO", "El número no existe");
  return prisma.whatsAppNumero.update({
    where: { id },
    data: {
      ...(cambios.etiqueta !== undefined ? { etiqueta: cambios.etiqueta?.trim() || null } : {}),
      ...(cambios.responsableId !== undefined ? { responsableId: cambios.responsableId } : {}),
    },
    select: { id: true, etiqueta: true, responsableId: true },
  });
}

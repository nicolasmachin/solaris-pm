/**
 * Procesa lo que manda Meta al webhook: mensajes entrantes y estados de los
 * salientes. Idempotente: Meta reintenta los envíos que no le contestamos a
 * tiempo, así que el mismo mensaje o el mismo estado pueden llegar dos veces.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

type MetaMensaje = {
  from: string;
  /** Solo en los que manda el negocio (ecos del celular e historial). */
  to?: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
  video?: { caption?: string };
};

type MetaEstado = {
  id: string;
  status: string;
  timestamp: string;
  recipient_id?: string;
  pricing?: unknown;
  errors?: Array<{ code?: number; title?: string; message?: string; error_data?: { details?: string } }>;
};

type MetaHistorial = {
  metadata?: { phase?: number; chunk_order?: number; progress?: number };
  threads?: Array<{ id: string; messages?: MetaMensaje[] }>;
  errors?: Array<{ code?: number; message?: string; error_data?: { details?: string } }>;
};

type MetaValue = {
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  messages?: MetaMensaje[];
  statuses?: MetaEstado[];
  /** smb_message_echoes: lo que el negocio escribió desde el celular. */
  message_echoes?: MetaMensaje[];
  history?: MetaHistorial[];
  /** account_update */
  event?: string;
  phone_number?: string;
};

type MetaPayload = {
  object?: string;
  entry?: Array<{ changes?: Array<{ field?: string; value?: MetaValue }> }>;
};

type Resultado = { mensajes: number; estados: number };

const ORDEN_ESTADO: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

function fechaDe(timestamp: string | undefined): Date {
  const n = Number(timestamp);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

/** Texto legible de un mensaje entrante, según su tipo. */
export function textoDeMensaje(m: MetaMensaje): string | null {
  return (
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    m.image?.caption ??
    m.document?.caption ??
    m.document?.filename ??
    m.video?.caption ??
    null
  );
}

function esDuplicado(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Un mensaje del lado del negocio (eco o historial) lleva `to`; uno del cliente,
 * no. En el historial vienen mezclados dentro del mismo hilo.
 */
export function direccionDe(m: MetaMensaje): "ENTRANTE" | "SALIENTE" {
  return m.to ? "SALIENTE" : "ENTRANTE";
}

async function guardarMensaje(m: MetaMensaje, phoneNumberId: string, origen: "API" | "CELULAR" | "HISTORIAL", telefonoCliente?: string) {
  const direccion = origen === "API" ? "ENTRANTE" : direccionDe(m);
  try {
    await prisma.whatsAppMensaje.create({
      data: {
        waMessageId: m.id,
        direccion,
        telefono: telefonoCliente ?? (direccion === "SALIENTE" ? (m.to ?? m.from) : m.from),
        phoneNumberId,
        tipo: m.type,
        texto: textoDeMensaje(m),
        origen,
        ocurridoEn: fechaDe(m.timestamp),
        payload: m as unknown as Prisma.InputJsonValue,
      },
    });
    return 1;
  } catch (err) {
    if (!esDuplicado(err)) throw err;
    return 0;
  }
}

/** Historial que manda Meta al conectar un número en coexistencia, por tandas. */
async function procesarHistorial(historial: MetaHistorial[], phoneNumberId: string): Promise<number> {
  let n = 0;
  for (const h of historial) {
    const error = h.errors?.[0];
    if (error) {
      // 2593109: el dueño tiene apagado "compartir historial" en el celular.
      await prisma.whatsAppNumero.updateMany({
        where: { phoneNumberId },
        data: { historialError: error.error_data?.details ?? error.message ?? `Error ${error.code ?? ""}` },
      });
      continue;
    }
    for (const hilo of h.threads ?? []) {
      for (const m of hilo.messages ?? []) n += await guardarMensaje(m, phoneNumberId, "HISTORIAL", hilo.id);
    }
    const progreso = h.metadata?.progress;
    if (typeof progreso === "number") {
      // Las tandas pueden llegar desordenadas: el avance solo sube.
      await prisma.whatsAppNumero.updateMany({
        where: { phoneNumberId, OR: [{ historialProgreso: null }, { historialProgreso: { lt: progreso } }] },
        data: { historialProgreso: progreso },
      });
    }
  }
  return n;
}

export async function procesarWebhook(payload: MetaPayload): Promise<Resultado> {
  let mensajes = 0;
  let estados = 0;
  if (payload.object !== "whatsapp_business_account") return { mensajes, estados };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (!change.value) continue;
      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id ?? "";

      if (change.field === "smb_message_echoes") {
        for (const m of value.message_echoes ?? []) mensajes += await guardarMensaje(m, phoneNumberId, "CELULAR");
        continue;
      }
      if (change.field === "history") {
        mensajes += await procesarHistorial(value.history ?? [], phoneNumberId);
        continue;
      }
      if (change.field === "account_update") {
        // El número se desconectó (lo sacaron desde el celular, o pasaron ~14
        // días sin abrir WhatsApp Business): deja de entrar y salir por acá.
        if (value.event === "PARTNER_REMOVED" && value.phone_number) {
          const digitos = value.phone_number.replace(/\D/g, "");
          const numeros = await prisma.whatsAppNumero.findMany({ select: { id: true, telefono: true } });
          const ids = numeros.filter((x) => x.telefono.replace(/\D/g, "") === digitos).map((x) => x.id);
          if (ids.length > 0) {
            await prisma.whatsAppNumero.updateMany({ where: { id: { in: ids } }, data: { estado: "DESCONECTADO" } });
          }
        }
        continue;
      }
      // smb_app_state_sync (contactos) no se guarda: los clientes ya están en
      // Voltia PM y los nombres de la agenda del celular no se necesitan.
      if (change.field !== "messages") continue;

      for (const m of value.messages ?? []) mensajes += await guardarMensaje(m, phoneNumberId, "API");

      for (const s of value.statuses ?? []) {
        const ocurridoEn = fechaDe(s.timestamp);
        const error = s.errors?.[0];
        try {
          await prisma.whatsAppEstado.create({
            data: {
              waMessageId: s.id,
              estado: s.status,
              ocurridoEn,
              pricing: (s.pricing ?? undefined) as Prisma.InputJsonValue | undefined,
              errores: (s.errors ?? undefined) as Prisma.InputJsonValue | undefined,
              payload: s as unknown as Prisma.InputJsonValue,
            },
          });
          estados++;
        } catch (err) {
          if (!esDuplicado(err)) throw err;
          continue;
        }
        // Al mensaje se le deja el estado más avanzado: "leído" llega a veces
        // antes que "entregado", y no tiene que volver atrás.
        const actual = await prisma.whatsAppMensaje.findUnique({
          where: { waMessageId: s.id },
          select: { estado: true },
        });
        if (actual && (ORDEN_ESTADO[s.status] ?? 0) >= (ORDEN_ESTADO[actual.estado ?? ""] ?? 0)) {
          await prisma.whatsAppMensaje.update({
            where: { waMessageId: s.id },
            data: {
              estado: s.status,
              estadoEn: ocurridoEn,
              errorCodigo: error?.code != null ? String(error.code) : null,
              errorDetalle: error ? (error.error_data?.details ?? error.message ?? error.title ?? null) : null,
            },
          });
        }
      }
    }
  }
  return { mensajes, estados };
}

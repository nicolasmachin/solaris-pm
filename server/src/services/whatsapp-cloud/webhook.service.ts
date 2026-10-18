/**
 * Procesa lo que manda Meta al webhook: mensajes entrantes y estados de los
 * salientes. Idempotente: Meta reintenta los envíos que no le contestamos a
 * tiempo, así que el mismo mensaje o el mismo estado pueden llegar dos veces.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

type MetaMensaje = {
  from: string;
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

type MetaValue = {
  metadata?: { phone_number_id?: string };
  messages?: MetaMensaje[];
  statuses?: MetaEstado[];
};

type MetaPayload = {
  object?: string;
  entry?: Array<{ changes?: Array<{ field?: string; value?: MetaValue }> }>;
};

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

export async function procesarWebhook(payload: MetaPayload): Promise<{ mensajes: number; estados: number }> {
  let mensajes = 0;
  let estados = 0;
  if (payload.object !== "whatsapp_business_account") return { mensajes, estados };

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id ?? "";

      for (const m of value.messages ?? []) {
        try {
          await prisma.whatsAppMensaje.create({
            data: {
              waMessageId: m.id,
              direccion: "ENTRANTE",
              telefono: m.from,
              phoneNumberId,
              tipo: m.type,
              texto: textoDeMensaje(m),
              ocurridoEn: fechaDe(m.timestamp),
              payload: m as unknown as Prisma.InputJsonValue,
            },
          });
          mensajes++;
        } catch (err) {
          if (!esDuplicado(err)) throw err;
        }
      }

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

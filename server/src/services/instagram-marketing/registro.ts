/**
 * Lo que queda anotado de cada cosa que hace el asistente de Instagram, el
 * gasto del mes con su tope y los avisos por mail.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { diaManualUruguay, hoyUruguay } from "../../utils/uruguay.js";
import { sendEmail } from "../email.service.js";
import { asistenteConfig } from "./config.js";

export type Evento = {
  tipo: "privado" | "seguimiento" | "comentario" | "aviso_gasto";
  resultado: string;
  razon?: string | null;
  automatizacion?: string | null;
  persona?: string | null;
  usuario?: string | null;
  comentarioId?: string | null;
  sombra?: boolean;
  desdeAnuncio?: boolean;
  speech?: boolean;
  lead?: boolean;
  derivado?: boolean;
  costoUsd?: number | null;
  datos?: Record<string, unknown>;
};

export async function anotar(e: Evento): Promise<void> {
  try {
    await prisma.instagramEvento.create({
      data: {
        tipo: e.tipo,
        resultado: e.resultado,
        razon: e.razon ?? null,
        automatizacion: e.automatizacion ?? null,
        persona: e.persona ?? null,
        usuario: e.usuario ?? null,
        comentarioId: e.comentarioId ?? null,
        sombra: e.sombra ?? false,
        desdeAnuncio: e.desdeAnuncio ?? false,
        speech: e.speech ?? false,
        lead: e.lead ?? false,
        derivado: e.derivado ?? false,
        costoUsd: e.costoUsd ?? null,
        datos: (e.datos ?? {}) as Prisma.InputJsonObject,
      },
    });
  } catch (err) {
    console.error("[instagram] no se pudo anotar el evento:", err instanceof Error ? err.message : err);
  }
}

// ── Gasto ───────────────────────────────────────────────────────────────────

function inicioDelMes(ahora: Date): Date {
  const { anio, mes } = hoyUruguay(ahora);
  return diaManualUruguay(`${anio}-${String(mes).padStart(2, "0")}-01`);
}

/** Lo gastado en Claude este mes (hora de Uruguay) por el asistente de Instagram. */
export async function gastoDelMes(ahora = new Date()): Promise<{ usd: number; llamadas: number }> {
  const r = await prisma.aIUsage.aggregate({
    where: { feature: { in: ["instagram_privados", "instagram_comentarios"] }, createdAt: { gte: inicioDelMes(ahora) } },
    _sum: { costUsd: true },
    _count: { _all: true },
  });
  return { usd: Number(r._sum.costUsd ?? 0), llamadas: r._count._all };
}

export async function superoElTope(ahora = new Date()): Promise<boolean> {
  return (await gastoDelMes(ahora)).usd >= asistenteConfig().topeUsd;
}

/** Mail al 80 % y al 100 % del tope, una sola vez por mes cada uno. */
export async function avisarGasto(ahora = new Date()): Promise<void> {
  const { topeUsd } = asistenteConfig();
  const gasto = await gastoDelMes(ahora);
  const nivel = gasto.usd >= topeUsd ? "100" : gasto.usd >= topeUsd * 0.8 ? "80" : null;
  if (!nivel) return;
  const yaAvisado = await prisma.instagramEvento.count({
    where: { tipo: "aviso_gasto", resultado: nivel, creadoEn: { gte: inicioDelMes(ahora) } },
  });
  if (yaAvisado) return;
  await anotar({ tipo: "aviso_gasto", resultado: nivel, costoUsd: gasto.usd });
  if (nivel === "100") {
    await avisar(
      "Asistente de Instagram: llegó al tope de gasto y dejó de contestar",
      `Este mes se gastaron US$ ${gasto.usd.toFixed(2)} de US$ ${topeUsd}. El asistente no contesta más hasta el mes que viene. ` +
        "Para subir el tope, cambiar INSTAGRAM_TOPE_USD en el .env de Voltia PM y recrear el server.",
    );
  } else {
    await avisar(
      "Asistente de Instagram: va el 80 % del tope de gasto",
      `Este mes van US$ ${gasto.usd.toFixed(2)} de US$ ${topeUsd} (${gasto.llamadas} respuestas). Al llegar al tope deja de contestar.`,
    );
  }
}

// ── Mails ───────────────────────────────────────────────────────────────────

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Un aviso a `para` (si hay) con copia a INSTAGRAM_AVISOS_MAIL. Solo a usuarios de Voltia PM. */
export async function avisar(asunto: string, cuerpo: string, para: string[] = []): Promise<boolean> {
  const destinos = [...new Set([...para, asistenteConfig().avisosMail].map((d) => d.trim().toLowerCase()).filter(Boolean))];
  try {
    return await sendEmail({
      to: destinos,
      subject: asunto,
      text: cuerpo,
      html: `<div style="white-space:pre-wrap;font-family:sans-serif;font-size:14px">${escapar(cuerpo)}</div>`,
    });
  } catch (err) {
    console.error("[instagram] no salió el mail de aviso:", err instanceof Error ? err.message : err);
    return false;
  }
}

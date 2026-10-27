// Topes de gasto del asistente del equipo.
//
// Dos frenos, los dos sobre lo registrado en `ai_usage`:
// - por usuario y por día (hora de Uruguay), para que nadie se lo gaste solo;
// - para todo Voltia en el mes, para que la cuenta no se vaya de las manos.
// El tope del mes no reemplaza al límite de gasto de la cuenta de Anthropic:
// es una segunda capa, que además le explica al usuario por qué no anda.

import { prisma } from "../../lib/prisma.js";

/** Lo que cuenta para los topes: el chat y las notas por usuario. */
const FEATURES_ASISTENTE = ["asistente_chat", "asistente_perfil", "asistente_audio", "asistente_voz"];

function numeroEnv(nombre: string, porDefecto: number): number {
  const v = Number(process.env[nombre]);
  return Number.isFinite(v) && v > 0 ? v : porDefecto;
}

export function topes() {
  return {
    diarioPorUsuarioUsd: numeroEnv("ASISTENTE_TOPE_DIARIO_USD", 5),
    mensualTotalUsd: numeroEnv("ASISTENTE_TOPE_MENSUAL_USD", 200),
  };
}

type Suma = { usd: string | null };

export async function gastoActual(userId: string) {
  const [[hoy], [mes]] = await Promise.all([
    prisma.$queryRaw<Suma[]>`
      SELECT SUM("costUsd")::text AS usd FROM ai_usage
      WHERE feature = ANY(${FEATURES_ASISTENTE}) AND "userId" = ${userId}
        AND ("createdAt" AT TIME ZONE 'America/Montevideo')::date
            = (now() AT TIME ZONE 'America/Montevideo')::date`,
    prisma.$queryRaw<Suma[]>`
      SELECT SUM("costUsd")::text AS usd FROM ai_usage
      WHERE feature = ANY(${FEATURES_ASISTENTE})
        AND date_trunc('month', "createdAt" AT TIME ZONE 'America/Montevideo')
            = date_trunc('month', now() AT TIME ZONE 'America/Montevideo')`,
  ]);
  return { hoyUsuarioUsd: Number(hoy?.usd ?? 0), mesTotalUsd: Number(mes?.usd ?? 0) };
}

/** null si puede seguir; si no, el mensaje para el usuario. */
export async function chequearTopes(userId: string): Promise<string | null> {
  const t = topes();
  const g = await gastoActual(userId);
  if (g.mesTotalUsd >= t.mensualTotalUsd) {
    return "El asistente llegó al tope de gasto del mes para todo Voltia. Avisale a la Dirección si lo necesitás.";
  }
  if (g.hoyUsuarioUsd >= t.diarioPorUsuarioUsd) {
    return "Llegaste al tope de uso del asistente por hoy. Mañana se renueva.";
  }
  return null;
}

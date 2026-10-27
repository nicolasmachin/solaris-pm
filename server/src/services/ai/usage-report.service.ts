/**
 * Totales del gasto de IA para la pestaña "Gasto de IA" de Admin.
 *
 * Se agrupa por mes en hora de Uruguay: una llamada del 31 a las 22 h es de
 * ese mes, no del siguiente (en UTC ya sería el 1).
 */

import { prisma } from "../../lib/prisma.js";
import { AI_FEATURES } from "./usage.js";

export type FilaGastoIA = {
  mes: string; // "2026-10"
  feature: string;
  featureLabel: string;
  provider: string;
  model: string;
  llamadas: number;
  errores: number;
  /** Llamadas cuyo modelo no está en la tabla de precios: su costo no suma. */
  sinPrecio: number;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
  audioSegundos: number;
};

type FilaCruda = {
  mes: string;
  feature: string;
  provider: string;
  model: string;
  llamadas: bigint;
  errores: bigint;
  sin_precio: bigint;
  cost_usd: string | null;
  tokens_input: bigint | null;
  tokens_output: bigint | null;
  audio_segundos: string | null;
};

/** Gasto de un usuario en un mes, sumando todas las funciones de IA. */
export type FilaGastoUsuario = {
  mes: string;
  userId: string;
  nombre: string;
  llamadas: number;
  costUsd: number;
  /** Parte del costo que es del asistente del equipo. */
  asistenteUsd: number;
};

type FilaUsuarioCruda = {
  mes: string;
  user_id: string;
  nombre: string | null;
  llamadas: bigint;
  cost_usd: string | null;
  asistente_usd: string | null;
};

export async function getGastoIA(meses: number): Promise<{
  desde: string;
  primerRegistro: string | null;
  filas: FilaGastoIA[];
  porUsuario: FilaGastoUsuario[];
}> {
  // Primer día del mes, `meses - 1` meses atrás, en hora de Uruguay.
  const filas = await prisma.$queryRaw<FilaCruda[]>`
    WITH desde AS (
      SELECT (date_trunc('month', now() AT TIME ZONE 'America/Montevideo')
              - make_interval(months => ${meses - 1}::int)) AS inicio_local
    )
    SELECT
      to_char(date_trunc('month', u."createdAt" AT TIME ZONE 'America/Montevideo'), 'YYYY-MM') AS mes,
      u.feature, u.provider, u.model,
      COUNT(*) AS llamadas,
      COUNT(*) FILTER (WHERE NOT u.ok) AS errores,
      COUNT(*) FILTER (WHERE u.ok AND u."costUsd" IS NULL) AS sin_precio,
      SUM(u."costUsd")::text AS cost_usd,
      SUM(u."tokensInput") AS tokens_input,
      SUM(u."tokensOutput") AS tokens_output,
      SUM(u."audioSeconds")::text AS audio_segundos
    FROM ai_usage u, desde
    WHERE u."createdAt" AT TIME ZONE 'America/Montevideo' >= desde.inicio_local
    GROUP BY 1, 2, 3, 4
    ORDER BY 1, 2, 4
  `;

  // Solo las llamadas hechas a nombre de alguien: las de procesos automáticos
  // (mail de novedades, lectura de facturas en lote) no tienen usuario.
  const porUsuario = await prisma.$queryRaw<FilaUsuarioCruda[]>`
    WITH desde AS (
      SELECT (date_trunc('month', now() AT TIME ZONE 'America/Montevideo')
              - make_interval(months => ${meses - 1}::int)) AS inicio_local
    )
    SELECT
      to_char(date_trunc('month', u."createdAt" AT TIME ZONE 'America/Montevideo'), 'YYYY-MM') AS mes,
      u."userId" AS user_id,
      MAX(us.name) AS nombre,
      COUNT(*) AS llamadas,
      SUM(u."costUsd")::text AS cost_usd,
      SUM(u."costUsd") FILTER (WHERE u.feature IN ('asistente_chat', 'asistente_perfil'))::text AS asistente_usd
    FROM ai_usage u
    JOIN desde ON true
    LEFT JOIN users us ON us.id = u."userId"
    WHERE u."userId" IS NOT NULL
      AND u."createdAt" AT TIME ZONE 'America/Montevideo' >= desde.inicio_local
    GROUP BY 1, 2
    ORDER BY 1 DESC, SUM(u."costUsd") DESC NULLS LAST
  `;

  const [desdeRow] = await prisma.$queryRaw<Array<{ desde: string }>>`
    SELECT to_char(date_trunc('month', now() AT TIME ZONE 'America/Montevideo')
                   - make_interval(months => ${meses - 1}::int), 'YYYY-MM') AS desde
  `;
  const primero = await prisma.aIUsage.findFirst({
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const labels: Record<string, string> = AI_FEATURES;
  return {
    desde: desdeRow.desde,
    primerRegistro: primero ? primero.createdAt.toISOString() : null,
    filas: filas.map((f) => ({
      mes: f.mes,
      feature: f.feature,
      featureLabel: labels[f.feature] ?? f.feature,
      provider: f.provider,
      model: f.model,
      llamadas: Number(f.llamadas),
      errores: Number(f.errores),
      sinPrecio: Number(f.sin_precio),
      costUsd: f.cost_usd ? Number(f.cost_usd) : 0,
      tokensInput: Number(f.tokens_input ?? 0),
      tokensOutput: Number(f.tokens_output ?? 0),
      audioSegundos: f.audio_segundos ? Number(f.audio_segundos) : 0,
    })),
    porUsuario: porUsuario.map((f) => ({
      mes: f.mes,
      userId: f.user_id,
      nombre: f.nombre ?? "(usuario borrado)",
      llamadas: Number(f.llamadas),
      costUsd: f.cost_usd ? Number(f.cost_usd) : 0,
      asistenteUsd: f.asistente_usd ? Number(f.asistente_usd) : 0,
    })),
  };
}

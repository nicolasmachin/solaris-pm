/**
 * Las consultas de Instagram por día y por origen (anuncio / orgánico).
 *
 * Decisión de Nicolás del 30-oct-2026: las métricas arrancan de cero con lo
 * que registra Voltia PM. Lo importado (historial de ManyChat y del
 * contestador de indicadores) se ve en la bandeja y en los contactos, pero no
 * se cuenta: solo mensajes con `importado = false` y eventos que no son de
 * modo sombra.
 *
 * - personas: distintas que escribieron por privado ese día.
 * - nuevas: de ésas, las que no habían escrito en los 30 días anteriores.
 * - speech: personas a las que se les contó el speech ese día. Es la cifra
 *   "IG" de la planilla (antes la daba ManyChat con la etiqueta "Speach
 *   enviado").
 * - derivadas y leads: derivaciones a Martín, y de ésas las que mandaron
 *   factura o techo.
 * - privados de lead magnets y respuestas públicas a comentarios.
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export type DiaInstagram = {
  dia: string;
  personas: number;
  nuevas: number;
  anuncio: number;
  organico: number;
  speech: number;
  derivadas: number;
  leads: number;
  leadMagnets: number;
  comentariosContestados: number;
};

const ZONA = Prisma.sql`'America/Montevideo'`;

/** Días "AAAA-MM-DD" de Uruguay, ambos incluidos. */
export async function consultasPorDia(desde: string, hasta: string): Promise<DiaInstagram[]> {
  const inicio = new Date(`${desde}T03:00:00.000Z`);
  const fin = new Date(new Date(`${hasta}T03:00:00.000Z`).getTime() + 24 * 3600_000);

  const personas = await prisma.$queryRaw<Array<{ dia: string; personas: number; nuevas: number; anuncio: number }>>`
    WITH dias AS (
      SELECT DISTINCT m."conversacionId", c."desdeAnuncio",
             to_char((m."enviadoEn" AT TIME ZONE ${ZONA})::date, 'YYYY-MM-DD') AS dia,
             MIN(m."enviadoEn") OVER (PARTITION BY m."conversacionId", (m."enviadoEn" AT TIME ZONE ${ZONA})::date) AS primero
      FROM "instagram_mensajes" m JOIN "instagram_conversaciones" c ON c."id" = m."conversacionId"
      WHERE m."autor" = 'CLIENTE' AND m."importado" = false AND m."enviadoEn" >= ${inicio} AND m."enviadoEn" < ${fin}
    )
    SELECT d.dia,
           COUNT(*)::int AS personas,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM "instagram_mensajes" p
             WHERE p."conversacionId" = d."conversacionId" AND p."autor" = 'CLIENTE'
               AND p."enviadoEn" < d.primero AND p."enviadoEn" >= d.primero - interval '30 days'
               AND (p."enviadoEn" AT TIME ZONE ${ZONA})::date < (d.primero AT TIME ZONE ${ZONA})::date
           ))::int AS nuevas,
           COUNT(*) FILTER (WHERE d."desdeAnuncio")::int AS anuncio
    FROM dias d GROUP BY d.dia
  `;

  const eventos = await prisma.$queryRaw<Array<{ dia: string; speech: number; derivadas: number; leads: number; magnets: number; publicas: number }>>`
    SELECT to_char((e."creadoEn" AT TIME ZONE ${ZONA})::date, 'YYYY-MM-DD') AS dia,
           COUNT(DISTINCT e."persona") FILTER (WHERE e."tipo" = 'privado' AND e."speech")::int AS speech,
           COUNT(*) FILTER (WHERE e."tipo" = 'privado' AND e."derivado")::int AS derivadas,
           COUNT(*) FILTER (WHERE e."tipo" = 'privado' AND e."lead")::int AS leads,
           COUNT(*) FILTER (WHERE e."tipo" = 'comentario' AND COALESCE(e."datos"->>'privado', '') <> '')::int AS magnets,
           COUNT(*) FILTER (WHERE e."tipo" = 'comentario' AND COALESCE(e."datos"->>'publica', '') <> '')::int AS publicas
    FROM "instagram_eventos" e
    WHERE e."sombra" = false AND e."creadoEn" >= ${inicio} AND e."creadoEn" < ${fin}
    GROUP BY 1
  `;

  const salida: DiaInstagram[] = [];
  for (let t = inicio.getTime(); t < fin.getTime(); t += 24 * 3600_000) {
    const dia = new Date(t).toISOString().slice(0, 10);
    const p = personas.find((x) => x.dia === dia);
    const e = eventos.find((x) => x.dia === dia);
    salida.push({
      dia,
      personas: p?.personas ?? 0,
      nuevas: p?.nuevas ?? 0,
      anuncio: p?.anuncio ?? 0,
      organico: (p?.personas ?? 0) - (p?.anuncio ?? 0),
      speech: e?.speech ?? 0,
      derivadas: e?.derivadas ?? 0,
      leads: e?.leads ?? 0,
      leadMagnets: e?.magnets ?? 0,
      comentariosContestados: e?.publicas ?? 0,
    });
  }
  return salida;
}

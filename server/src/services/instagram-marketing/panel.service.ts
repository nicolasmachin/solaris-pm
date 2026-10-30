/**
 * Lo que muestra Marketing además de la bandeja: el estado del asistente
 * (modo, gasto), las automatizaciones con su actividad, los contactos y las
 * consultas por día. Y prender, apagar o editar una automatización.
 */

import { AuditAction, AuditEntityType, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { createAuditEntry } from "../audit.service.js";
import { desdeFila, normalizar } from "./automatizaciones.js";
import { asistenteConfig, instagramConectorConfig, modoInstagram, webhookInstagramConfig } from "./config.js";
import { buscarContactos, conteoPorEtiqueta } from "./contactos.js";
import { consultasPorDia } from "./metricas.js";
import { gastoDelMes } from "./registro.js";

const DIA_MS = 24 * 3600_000;

export async function estado() {
  const gasto = await gastoDelMes();
  const c = asistenteConfig();
  return {
    modo: modoInstagram(),
    conectado: Boolean(instagramConectorConfig().url && instagramConectorConfig().secreto),
    webhook: Boolean(webhookInstagramConfig().appSecret),
    gasto: { usd: gasto.usd, llamadas: gasto.llamadas, topeUsd: c.topeUsd },
    derivarA: c.derivarA,
    derivarWhatsapp: c.derivarWhatsapp,
  };
}

/** Las automatizaciones (sin los textos comunes) con lo que hicieron en los últimos 7 días. */
export async function listarAutomatizaciones() {
  const filas = await prisma.marketingAutomatizacion.findMany({
    orderBy: [{ disparador: "asc" }, { id: "asc" }],
    include: { actualizadoPor: { select: { name: true } } },
  });
  const desde = new Date(Date.now() - 7 * DIA_MS);
  const hoy = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(new Date())}T03:00:00.000Z`);
  const actividad = await prisma.$queryRaw<Array<{ automatizacion: string; semana: number; hoy: number; contestados: number; sombra: number }>>`
    SELECT "automatizacion",
           COUNT(*)::int AS semana,
           COUNT(*) FILTER (WHERE "creadoEn" >= ${hoy})::int AS hoy,
           COUNT(*) FILTER (WHERE "resultado" IN ('contestado', 'derivado', 'seguimiento') AND NOT "sombra")::int AS contestados,
           COUNT(*) FILTER (WHERE "sombra")::int AS sombra
    FROM "instagram_eventos"
    WHERE "creadoEn" >= ${desde} AND "automatizacion" IS NOT NULL
    GROUP BY 1
  `;
  return filas.map((f) => {
    const a = actividad.find((x) => x.automatizacion === f.id);
    return {
      ...desdeFila(f),
      actualizadoPor: f.actualizadoPor?.name ?? null,
      actualizadoEn: f.updatedAt,
      actividad: { hoy: a?.hoy ?? 0, semana: a?.semana ?? 0, contestados: a?.contestados ?? 0, sombra: a?.sombra ?? 0 },
    };
  });
}

export type CambioAutomatizacion = {
  activa?: boolean;
  nombre?: string;
  flujo?: string;
  palabras?: string[];
  link?: string | null;
  esperaMinSeg?: number;
  esperaMaxSeg?: number;
  topeDiario?: number;
};

export async function editarAutomatizacion(id: string, cambio: CambioAutomatizacion, actor: { id: string }) {
  const a = await prisma.marketingAutomatizacion.findUnique({ where: { id } });
  if (!a) throw notFound("AUTOMATIZACION_NO_ENCONTRADA", "No existe esa automatización");
  if (a.disparador === "texto" && cambio.activa !== undefined) {
    throw badRequest("ES_UN_TEXTO", "Los textos comunes no se prenden ni se apagan");
  }
  if (cambio.flujo !== undefined && !cambio.flujo.trim()) throw badRequest("FLUJO_VACIO", "El flujo no puede quedar vacío");
  if (a.id === "privados" && cambio.flujo !== undefined && !cambio.flujo.includes("{DATOS}")) {
    throw badRequest("FALTA_DATOS", "El flujo de privados tiene que conservar {DATOS} (ahí van los datos de Voltia)");
  }
  if (a.id === "_comentarios" && cambio.flujo !== undefined && !cambio.flujo.includes("{FLUJO}")) {
    throw badRequest("FALTA_FLUJO", "La parte común de los comentarios tiene que conservar {FLUJO}");
  }
  const min = cambio.esperaMinSeg ?? a.esperaMinSeg;
  const max = cambio.esperaMaxSeg ?? a.esperaMaxSeg;
  if (min < 0 || max < min) throw badRequest("ESPERA_INVALIDA", "La espera mínima tiene que ser menor que la máxima");
  const data: Prisma.MarketingAutomatizacionUpdateInput = {
    ...(cambio.activa !== undefined ? { activa: cambio.activa } : {}),
    ...(cambio.nombre ? { nombre: cambio.nombre.trim() } : {}),
    ...(cambio.flujo !== undefined ? { flujo: cambio.flujo.trim() } : {}),
    ...(cambio.palabras ? { palabras: cambio.palabras.map(normalizar).filter(Boolean) } : {}),
    ...(cambio.link !== undefined ? { link: cambio.link?.trim() || null } : {}),
    esperaMinSeg: min,
    esperaMaxSeg: max,
    ...(cambio.topeDiario !== undefined ? { topeDiario: cambio.topeDiario } : {}),
    actualizadoPor: { connect: { id: actor.id } },
  };
  const nueva = await prisma.marketingAutomatizacion.update({ where: { id }, data });
  const que =
    cambio.activa !== undefined && Object.keys(cambio).length === 1
      ? cambio.activa
        ? "Prendió"
        : "Apagó"
      : "Editó";
  await createAuditEntry({
    entityType: AuditEntityType.marketing_automatizacion,
    entityId: id,
    userId: actor.id,
    action: cambio.activa !== undefined && Object.keys(cambio).length === 1 ? AuditAction.status_changed : AuditAction.updated,
    description: `${que} la automatización de Instagram «${nueva.nombre}»`,
  });
  return desdeFila(nueva);
}

export async function contactos(f: { etiqueta?: string; texto?: string; cuantos?: number }) {
  const [{ total, contactos }, etiquetas] = await Promise.all([buscarContactos(f), conteoPorEtiqueta()]);
  return {
    total,
    etiquetas,
    contactos: contactos.map((c) => ({
      id: c.id,
      persona: c.persona,
      usuario: c.usuario,
      nombre: c.nombre,
      sigue: c.sigue,
      importado: c.importado,
      primeraVez: c.primeraVez,
      ultimaVez: c.ultimaVez,
      lead: c.lead,
      etiquetas: c.etiquetas.map((e) => ({ nombre: e.nombre, veces: e.veces, ultima: e.ultima, importada: e.importada })),
    })),
  };
}

export async function consultas(dias = 14) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo" }).format(new Date());
  const desde = new Date(Date.parse(hoy) - (dias - 1) * DIA_MS).toISOString().slice(0, 10);
  return consultasPorDia(desde, hoy);
}


// Config efectiva de un proyecto para el reporte fotovoltaico.
//
// `ReporteFvConfig` guarda en null todo lo que ya vive en `Project`: null
// significa "usar el del proyecto". Sólo se persiste el valor cuando alguien lo
// pisa a mano. Así el dato tiene una sola fuente de verdad — que es justamente
// lo que se había perdido con la hoja `constantes` de la planilla, desactualizada
// respecto de los proyectos.
//
// Esta función es el único lugar donde se resuelven esos fallbacks. Todo lo que
// necesite la config (cálculo, PDF, panel, envío) pasa por acá.

import type { Prisma, ReporteFvConfig, Project } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { dateAPeriodo, type Periodo } from "./periodo.js";
import { tarifaAKey } from "./tarifas/tarifas.service.js";
import type { ConfigSerie } from "./motor/serie.js";

const dec = (v: Prisma.Decimal | null | undefined): number | null => (v == null ? null : Number(v));

export interface ConfigEfectiva extends ConfigSerie {
  projectId: string;
  clientName: string;
  habilitado: boolean;
  origenDatos: "GROWATT" | "MANUAL";
  growattPlantId: string | null;
  /** Qué campos salen del proyecto en vez de estar pisados a mano. */
  heredados: string[];
  /** Motivos por los que este proyecto todavía no puede generar reporte. */
  bloqueos: string[];
  destinatarios: Array<{ email: string; nombre: string | null; esCopia: boolean }>;
}

type ProyectoParaConfig = Pick<
  Project,
  "id" | "clientName" | "capacityKwp" | "budgetUsd" | "postHabilitacionInicioEn" | "actualUteEnd" | "clientEmail"
>;

export const SELECT_PROYECTO_CONFIG = {
  id: true,
  clientName: true,
  capacityKwp: true,
  budgetUsd: true,
  postHabilitacionInicioEn: true,
  actualUteEnd: true,
  clientEmail: true,
} as const;

type ConfigConDestinatarios = ReporteFvConfig & {
  destinatarios: Array<{ email: string; nombre: string | null; esCopia: boolean; activo: boolean }>;
};

/**
 * Combina la config del reporte con los datos del proyecto.
 *
 * No tira si falta algo: devuelve `bloqueos` para que el panel pueda mostrar
 * exactamente qué le falta a cada generador. Los que tiran son los servicios que
 * necesitan una config completa (ver `exigirConfigCompleta`).
 */
export function resolverConfigEfectiva(
  config: ConfigConDestinatarios,
  proyecto: ProyectoParaConfig,
): ConfigEfectiva {
  const heredados: string[] = [];
  const bloqueos: string[] = [];

  // ─── Campos con fallback al proyecto ───
  let potenciaInstaladaKwp = dec(config.potenciaInstaladaKwp);
  if (potenciaInstaladaKwp == null) {
    potenciaInstaladaKwp = dec(proyecto.capacityKwp) ?? 0;
    heredados.push("potencia instalada");
  }

  let inversionUsd = dec(config.inversionUsd);
  if (inversionUsd == null) {
    inversionUsd = dec(proyecto.budgetUsd) ?? 0;
    heredados.push("inversión");
  }

  let mesInicio: Periodo | null = config.mesInicio ? dateAPeriodo(config.mesInicio) : null;
  if (mesInicio == null) {
    const ancla = proyecto.postHabilitacionInicioEn ?? proyecto.actualUteEnd;
    if (ancla) {
      mesInicio = dateAPeriodo(ancla);
      heredados.push("mes de inicio");
    }
  }

  let destinatarios = config.destinatarios
    .filter((d) => d.activo)
    .map((d) => ({ email: d.email, nombre: d.nombre, esCopia: d.esCopia }));
  if (destinatarios.length === 0 && proyecto.clientEmail) {
    destinatarios = [{ email: proyecto.clientEmail, nombre: null, esCopia: false }];
    heredados.push("destinatario");
  }

  // ─── Validaciones ───
  const potenciaContratadaKw = Number(config.potenciaContratadaKw);
  if (!(potenciaContratadaKw > 0)) bloqueos.push("falta la potencia contratada a UTE");

  const pctPunta = Number(config.pctPunta);
  const pctLlano = Number(config.pctLlano);
  const pctValle = Number(config.pctValle);
  if (Math.abs(pctPunta + pctLlano + pctValle - 1) > 0.001) {
    bloqueos.push("el reparto por franja horaria no suma 100%");
  }

  const tipoCliente = config.tipoCliente === "EMPRESA" ? "empresa" : "residencial";
  if (tipoCliente === "empresa" && !config.tarifaContratada) {
    bloqueos.push("es cliente empresa y no tiene tarifa contratada");
  }
  if (!mesInicio) bloqueos.push("no se sabe desde cuándo genera (falta la fecha de habilitación)");
  if (!(inversionUsd > 0)) bloqueos.push("falta el monto invertido (no se puede calcular el retorno)");
  if (destinatarios.length === 0) bloqueos.push("no tiene a quién enviarle el reporte");

  return {
    projectId: proyecto.id,
    clientName: proyecto.clientName,
    habilitado: config.habilitado,
    origenDatos: config.origenDatos,
    growattPlantId: config.growattPlantId?.toString() ?? null,
    potenciaContratadaKw,
    pctPunta,
    pctLlano,
    pctValle,
    inversionUsd,
    potenciaInstaladaKwp,
    mesInicio,
    tipoCliente,
    tarifaContratada: config.tarifaContratada ? tarifaAKey(config.tarifaContratada) : null,
    heredados,
    bloqueos,
    destinatarios,
  };
}

export async function getConfigEfectiva(projectId: string): Promise<ConfigEfectiva> {
  const config = await prisma.reporteFvConfig.findUnique({
    where: { projectId },
    include: { destinatarios: true },
  });
  if (!config) {
    throw notFound(
      "REPORTE_FV_SIN_CONFIG",
      "Este generador todavía no tiene configurado el reporte fotovoltaico",
    );
  }

  const proyecto = await prisma.project.findUnique({
    where: { id: projectId },
    select: SELECT_PROYECTO_CONFIG,
  });
  if (!proyecto) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe");

  return resolverConfigEfectiva(config, proyecto);
}

/** Todas las configs de una, para el panel y las corridas masivas. */
export async function listarConfigsEfectivas(opts: { soloHabilitados?: boolean } = {}) {
  const configs = await prisma.reporteFvConfig.findMany({
    where: opts.soloHabilitados ? { habilitado: true } : {},
    include: {
      destinatarios: true,
      project: { select: SELECT_PROYECTO_CONFIG },
    },
  });

  return configs
    .filter((c) => c.project.id)
    .map((c) => resolverConfigEfectiva(c, c.project))
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));
}

/** Igual que resolver, pero tira si la config no alcanza para calcular. */
export function exigirConfigCompleta(config: ConfigEfectiva): ConfigEfectiva {
  if (config.bloqueos.length > 0) {
    throw badRequest(
      "REPORTE_FV_CONFIG_INCOMPLETA",
      `No se puede generar el reporte de ${config.clientName}: ${config.bloqueos.join("; ")}.`,
    );
  }
  return config;
}

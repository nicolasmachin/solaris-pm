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

import {
  AuditAction,
  AuditEntityType,
  type Prisma,
  type Project,
  type ReporteFvConfig,
  type TarifaUte,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { createAuditEntry } from "../audit.service.js";
import { badRequest, notFound } from "../../utils/errors.js";
import { dateAPeriodo, type Periodo, periodoADate } from "./periodo.js";
import { KEY_A_TARIFA, tarifaAKey } from "./tarifas/tarifas.service.js";
import type { ConfigSerie } from "./motor/serie.js";
import type { TarifaKey } from "./motor/types.js";

const dec = (v: Prisma.Decimal | null | undefined): number | null => (v == null ? null : Number(v));

/**
 * Potencia contratada de referencia cuando el generador no la tiene registrada.
 * El reporte se calcula igual, con una nota al cliente aclarando que el cargo
 * por potencia se estimó. Mismo criterio que el sistema Python
 * (POTENCIA_CONTRATADA_POR_DEFECTO). No dejar sin potencia bloquea a demasiados
 * generadores; 5 kW es un valor intermedio razonable para el parque residencial.
 */
export const POTENCIA_CONTRATADA_DEFAULT = 5.0;

export interface ConfigEfectiva extends ConfigSerie {
  projectId: string;
  clientName: string;
  habilitado: boolean;
  origenDatos: "GROWATT" | "MANUAL";
  growattPlantId: string | null;
  /** Qué campos salen del proyecto en vez de estar pisados a mano. */
  heredados: string[];
  /**
   * Impiden CALCULAR: sin esto los números saldrían mal, no incompletos.
   */
  bloqueosCalculo: string[];
  /**
   * Impiden ENVIAR pero no calcular. El reporte se puede generar y revisar
   * igual; lo que falta es a quién mandárselo.
   */
  bloqueosEnvio: string[];
  /**
   * El reporte sale, pero con alguna sección degradada (por ejemplo, sin monto
   * invertido no se puede mostrar el retorno de la inversión).
   */
  advertencias: string[];
  /**
   * La potencia contratada no estaba registrada y se usó el valor por defecto.
   * El reporte lleva una nota y el envío requiere confirmación.
   */
  potenciaEstimada: boolean;
  /** Día de corte del medidor (1-31), o null = el reporte cubre el mes calendario. */
  diaCorteMedidor: number | null;
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
  const bloqueosCalculo: string[] = [];
  const bloqueosEnvio: string[] = [];
  const advertencias: string[] = [];

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
  // Sólo bloquea el cálculo lo que haría que los números salieran MAL. Lo que
  // apenas degrada una sección del reporte va como advertencia, y lo que impide
  // mandarlo pero no calcularlo va aparte: un generador sin mail tiene que poder
  // verse igual en el panel.
  // Si falta la potencia contratada, se estima en 5 kW y el reporte lo aclara.
  // No bloquea el cálculo, pero queda marcado para que no se envíe sin confirmar.
  let potenciaContratadaKw = Number(config.potenciaContratadaKw);
  let potenciaEstimada = false;
  if (!(potenciaContratadaKw > 0)) {
    potenciaContratadaKw = POTENCIA_CONTRATADA_DEFAULT;
    potenciaEstimada = true;
    advertencias.push(
      `sin potencia contratada registrada: se estima en ${POTENCIA_CONTRATADA_DEFAULT} kW (el reporte lo aclara)`,
    );
  }

  const pctPunta = Number(config.pctPunta);
  const pctLlano = Number(config.pctLlano);
  const pctValle = Number(config.pctValle);
  if (Math.abs(pctPunta + pctLlano + pctValle - 1) > 0.001) {
    bloqueosCalculo.push("el reparto por franja horaria no suma 100%");
  }

  const tipoCliente = config.tipoCliente === "EMPRESA" ? "empresa" : "residencial";
  if (tipoCliente === "empresa" && !config.tarifaContratada) {
    bloqueosCalculo.push("es cliente empresa y no tiene tarifa contratada");
  }

  if (!(inversionUsd > 0)) {
    advertencias.push("sin monto invertido: el reporte sale sin el retorno de la inversión");
  }
  if (!mesInicio) {
    advertencias.push("sin fecha de habilitación: el retorno se estima con los meses que haya de datos");
  }
  if (destinatarios.length === 0) {
    bloqueosEnvio.push("no tiene a quién enviarle el reporte");
  }

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
    potenciaEstimada,
    diaCorteMedidor: config.diaCorteMedidor ?? null,
    bloqueosCalculo,
    // Todo lo que impide calcular también impide enviar.
    bloqueosEnvio: [...bloqueosCalculo, ...bloqueosEnvio],
    advertencias,
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

export interface DestinatarioInput {
  email: string;
  nombre?: string | null;
  esCopia?: boolean;
}

export interface UpsertConfigInput {
  habilitado?: boolean;
  tipoCliente?: "residencial" | "empresa";
  tarifaContratada?: TarifaKey | null;
  potenciaContratadaKw?: number | null;
  pctPunta?: number | null;
  pctLlano?: number | null;
  pctValle?: number | null;
  inversionUsd?: number | null;
  potenciaInstaladaKwp?: number | null;
  mesInicio?: string | null; // "YYYY-MM"
  origenDatos?: "GROWATT" | "MANUAL";
  growattPlantId?: string | null;
  notasFijas?: string | null;
  /** Día de corte del medidor de UTE (1-31). null = mes calendario. */
  diaCorteMedidor?: number | null;
  /** Si viene, reemplaza el set completo de destinatarios. */
  destinatarios?: DestinatarioInput[];
}

const TIPO_A_ENUM = { residencial: "RESIDENCIAL", empresa: "EMPRESA" } as const;

/**
 * Da de alta o edita la config de un generador. Para dar de alta (primera vez)
 * alcanza con la potencia contratada y el reparto de franjas; el resto hereda
 * del proyecto mientras quede en null. Tras guardar, recalcular es responsabilidad
 * del caller (para no crear un ciclo de imports con calculo.service).
 */
export async function upsertConfig(
  projectId: string,
  input: UpsertConfigInput,
  userId: string,
): Promise<void> {
  const proyecto = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    select: { id: true },
  });
  if (!proyecto) throw notFound("PROYECTO_NO_ENCONTRADO", "El proyecto no existe");

  const existente = await prisma.reporteFvConfig.findUnique({ where: { projectId } });

  // Normaliza el reparto de franjas: acepta 0..1 o 0..100 (se guarda 0..1).
  const norm = (v: number | null | undefined): number | undefined =>
    v == null ? undefined : v > 1 ? v / 100 : v;

  const data = {
    habilitado: input.habilitado,
    tipoCliente: input.tipoCliente ? TIPO_A_ENUM[input.tipoCliente] : undefined,
    tarifaContratada:
      input.tarifaContratada === undefined
        ? undefined
        : input.tarifaContratada
          ? KEY_A_TARIFA[input.tarifaContratada]
          : null,
    inversionUsd: input.inversionUsd === undefined ? undefined : input.inversionUsd,
    potenciaInstaladaKwp: input.potenciaInstaladaKwp === undefined ? undefined : input.potenciaInstaladaKwp,
    mesInicio:
      input.mesInicio === undefined ? undefined : input.mesInicio ? periodoADate(input.mesInicio) : null,
    origenDatos: input.origenDatos,
    growattPlantId:
      input.growattPlantId === undefined ? undefined : input.growattPlantId ? BigInt(input.growattPlantId) : null,
    notasFijas: input.notasFijas === undefined ? undefined : input.notasFijas,
    diaCorteMedidor:
      input.diaCorteMedidor === undefined
        ? undefined
        : input.diaCorteMedidor == null
          ? null
          : Math.min(Math.max(Math.round(input.diaCorteMedidor), 1), 31),
    actualizadoPorId: userId,
  };

  // Los 4 obligatorios (potencia + reparto de franjas) se manejan aparte: en
  // update sólo si vienen, en create con default 0 (la config puede quedar
  // incompleta a propósito mientras se cargan los datos).
  const obligatoriosUpdate = {
    ...(input.potenciaContratadaKw != null ? { potenciaContratadaKw: input.potenciaContratadaKw } : {}),
    ...(norm(input.pctPunta) != null ? { pctPunta: norm(input.pctPunta) } : {}),
    ...(norm(input.pctLlano) != null ? { pctLlano: norm(input.pctLlano) } : {}),
    ...(norm(input.pctValle) != null ? { pctValle: norm(input.pctValle) } : {}),
  };

  await prisma.$transaction(async (tx) => {
    const config = existente
      ? await tx.reporteFvConfig.update({ where: { projectId }, data: { ...data, ...obligatoriosUpdate } })
      : await tx.reporteFvConfig.create({
          data: {
            projectId,
            potenciaContratadaKw: input.potenciaContratadaKw ?? 0,
            pctPunta: norm(input.pctPunta) ?? 0,
            pctLlano: norm(input.pctLlano) ?? 0,
            pctValle: norm(input.pctValle) ?? 0,
            ...data,
          },
        });

    if (input.destinatarios) {
      await tx.reporteFvDestinatario.deleteMany({ where: { configId: config.id } });
      const vistos = new Set<string>();
      for (const d of input.destinatarios) {
        const email = d.email.trim().toLowerCase();
        if (!email || vistos.has(email)) continue;
        vistos.add(email);
        await tx.reporteFvDestinatario.create({
          data: { configId: config.id, email, nombre: d.nombre ?? null, esCopia: d.esCopia ?? false },
        });
      }
    }
  });

  await createAuditEntry({
    entityType: AuditEntityType.reporte_fv_config,
    entityId: projectId,
    projectId,
    userId,
    action: existente ? AuditAction.updated : AuditAction.created,
    description: existente
      ? `Editó la config de reporte fotovoltaico`
      : `Dio de alta el reporte fotovoltaico del generador`,
  });
}

/**
 * Setea SÓLO el día de corte del medidor. Pensado para el portal del cliente:
 * el cliente ajusta a qué día corta su ciclo de facturación de UTE sin poder
 * tocar ningún otro campo de la config. `null` vuelve a mes calendario.
 */
export async function setDiaCorteMedidorCliente(
  projectId: string,
  diaCorte: number | null,
  userId: string,
): Promise<number | null> {
  const valor =
    diaCorte == null ? null : Math.min(Math.max(Math.round(diaCorte), 1), 31);

  await prisma.reporteFvConfig.upsert({
    where: { projectId },
    update: { diaCorteMedidor: valor, actualizadoPorId: userId },
    // La rama create casi nunca corre (si hay reportes, ya hay config); los 4
    // obligatorios quedan en 0 hasta que se complete la config desde el panel.
    create: {
      projectId,
      diaCorteMedidor: valor,
      actualizadoPorId: userId,
      potenciaContratadaKw: 0,
      pctPunta: 0,
      pctLlano: 0,
      pctValle: 0,
    },
  });

  await createAuditEntry({
    entityType: AuditEntityType.reporte_fv_config,
    entityId: projectId,
    projectId,
    userId,
    action: AuditAction.updated,
    description:
      valor == null
        ? `El cliente volvió el reporte a mes calendario`
        : `El cliente fijó el día de corte del medidor en ${valor}`,
  });

  return valor;
}

export interface DatosUteCliente {
  tarifaContratada: TarifaUte | null;
  potenciaContratadaKw: number | null;
}

/**
 * Datos de la factura de UTE cargados por el propio cliente desde el portal.
 *
 * Los tiene él en la factura y nosotros muchas veces no: hoy, cuando falta la
 * potencia contratada el sistema estima 5 kW y el reporte sale con una nota
 * aclarándolo. Dejar que la cargue el titular es más rápido y más confiable que
 * perseguir el dato.
 *
 * Lo que el cliente NO toca es el reparto de franjas horarias (punta/llano/
 * valle): eso es una estimación técnica nuestra sobre su perfil de consumo, no
 * un dato que figure en su factura.
 */
export async function setDatosUteCliente(
  projectId: string,
  datos: DatosUteCliente,
  userId: string,
): Promise<DatosUteCliente> {
  const potencia =
    datos.potenciaContratadaKw == null || datos.potenciaContratadaKw <= 0
      ? null
      : Math.round(datos.potenciaContratadaKw * 100) / 100;

  const previa = await prisma.reporteFvConfig.findUnique({
    where: { projectId },
    select: { tarifaContratada: true, potenciaContratadaKw: true },
  });

  await prisma.reporteFvConfig.upsert({
    where: { projectId },
    update: {
      tarifaContratada: datos.tarifaContratada,
      // Una potencia vacía no borra la que ya estaba: si el cliente deja el
      // campo en blanco es que no la sabe, no que sea cero.
      ...(potencia != null ? { potenciaContratadaKw: potencia } : {}),
      actualizadoPorId: userId,
    },
    create: {
      projectId,
      tarifaContratada: datos.tarifaContratada,
      potenciaContratadaKw: potencia ?? 0,
      actualizadoPorId: userId,
      pctPunta: 0,
      pctLlano: 0,
      pctValle: 0,
    },
  });

  const cambios: string[] = [];
  if (previa?.tarifaContratada !== datos.tarifaContratada) {
    cambios.push(`tarifa ${datos.tarifaContratada ?? "sin especificar"}`);
  }
  if (potencia != null && Number(previa?.potenciaContratadaKw ?? 0) !== potencia) {
    cambios.push(`potencia contratada ${potencia} kW`);
  }
  if (cambios.length > 0) {
    await createAuditEntry({
      entityType: AuditEntityType.reporte_fv_config,
      entityId: projectId,
      projectId,
      userId,
      action: AuditAction.updated,
      description: `El cliente cargó sus datos de UTE: ${cambios.join(", ")}`,
    });
  }

  return {
    tarifaContratada: datos.tarifaContratada,
    potenciaContratadaKw: potencia ?? (previa ? Number(previa.potenciaContratadaKw) || null : null),
  };
}

/** Tira si la config no alcanza para calcular los números. */
export function exigirConfigCompleta(config: ConfigEfectiva): ConfigEfectiva {
  if (config.bloqueosCalculo.length > 0) {
    throw badRequest(
      "REPORTE_FV_CONFIG_INCOMPLETA",
      `No se puede calcular el reporte de ${config.clientName}: ${config.bloqueosCalculo.join("; ")}.`,
    );
  }
  return config;
}

/** Tira si falta algo para poder mandarle el reporte al cliente. */
export function exigirConfigEnviable(config: ConfigEfectiva): ConfigEfectiva {
  if (config.bloqueosEnvio.length > 0) {
    throw badRequest(
      "REPORTE_FV_NO_ENVIABLE",
      `No se puede enviar el reporte de ${config.clientName}: ${config.bloqueosEnvio.join("; ")}.`,
    );
  }
  return config;
}

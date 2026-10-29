// Mesa de Soporte. Ver services/soporte.
//
//   GET  /api/soporte/tablero                  plantas con su última lectura + casos abiertos (VIEW)
//   GET  /api/soporte/casos?estado=            casos (VIEW)
//   GET  /api/soporte/casos/:id/mensaje        mensaje sugerido para el cliente (VIEW)
//   POST /api/soporte/casos/:id/avisar-cliente { mensaje } (EDIT)
//   POST /api/soporte/casos/:id/cerrar         { estado: RESUELTO|DESCARTADO, motivo } (EDIT)
//   POST /api/soporte/vigia                    corre el vigía ahora (EDIT)
//   POST /api/soporte/rendimiento              corre el chequeo de bajo rendimiento ahora (EDIT)

import { Action, Module, SoporteCasoEstado, SoporteCasoTipo, TicketEstado } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { avisarCliente, cerrarManual, mensajeSugerido } from "../services/soporte/casos.service.js";
import { rendimientoReciente, revisarRendimiento, type RendimientoPlanta } from "../services/soporte/rendimiento.service.js";
import { vigiaHabilitado } from "../services/soporte/soporte.job.js";
import { medianaCartera, rendimiento, SOL_MIN } from "../services/soporte/vigia.js";
import { listarIncidencias, type FilaIncidencia } from "../services/reportesFv/monitor/incidencias.service.js";
import { pausasDePlantas } from "../services/soporte/pausas.js";
import { describirCodigo } from "../services/soporte/codigos.js";
import { kwpEfectivo } from "../services/soporte/kwp.js";
import { correrVigia } from "../services/soporte/vigia.service.js";
import { badRequest, notFound } from "../utils/errors.js";

const idParam = z.object({ id: z.string().min(1) });

const selectProyecto = {
  clientName: true,
  code: true,
  capacityKwp: true,
  reporteFvConfig: { select: { potenciaInstaladaKwp: true } },
  growattPlant: { select: { peakPowerKw: true } },
} as const;

const kwpDe = (p: {
  capacityKwp: unknown;
  reporteFvConfig: { potenciaInstaladaKwp: unknown } | null;
  growattPlant: { peakPowerKw: unknown } | null;
}) =>
  kwpEfectivo({
    config: p.reporteFvConfig?.potenciaInstaladaKwp,
    proyecto: p.capacityKwp,
    growatt: p.growattPlant?.peakPowerKw,
  });

// Los últimos días cambian una vez por día: no se recalculan en cada refresco.
let cacheRendimiento: { en: number; datos: Map<string, RendimientoPlanta> } | null = null;
async function rendimientoCacheado() {
  if (!cacheRendimiento || Date.now() - cacheRendimiento.en > 10 * 60_000) {
    cacheRendimiento = { en: Date.now(), datos: await rendimientoReciente() };
  }
  return cacheRendimiento.datos;
}

function userId(request: FastifyRequest) {
  const u = request.user;
  if (!u) throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  return u.id;
}

const serializarCaso = (c: {
  id: string;
  projectId: string;
  tipo: SoporteCasoTipo;
  estado: SoporteCasoEstado;
  titulo: string;
  detalle: string;
  codigoFalla: number | null;
  detectadoEn: Date;
  ultimaVezEn: Date;
  resueltoEn: Date | null;
  motivoCierre: string | null;
  clienteAvisadoEn: Date | null;
  mensajeCliente: string | null;
  project: { clientName: string; code: string; clients: { userId: string }[] };
  resueltoPor: { name: string } | null;
  clienteAvisadoPor: { name: string } | null;
}) => ({
  id: c.id,
  projectId: c.projectId,
  cliente: c.project.clientName,
  codigo: c.project.code,
  conPortal: c.project.clients.length > 0,
  tipo: c.tipo,
  estado: c.estado,
  titulo: c.titulo,
  detalle: c.detalle,
  codigoFalla: c.codigoFalla,
  detectadoEn: c.detectadoEn.toISOString(),
  ultimaVezEn: c.ultimaVezEn.toISOString(),
  resueltoEn: c.resueltoEn?.toISOString() ?? null,
  resueltoPor: c.resueltoPor?.name ?? null,
  motivoCierre: c.motivoCierre,
  clienteAvisadoEn: c.clienteAvisadoEn?.toISOString() ?? null,
  clienteAvisadoPor: c.clienteAvisadoPor?.name ?? null,
  mensajeCliente: c.mensajeCliente,
});

const incluirCaso = {
  project: { select: { clientName: true, code: true, clients: { select: { userId: true } } } },
  resueltoPor: { select: { name: true } },
  clienteAvisadoPor: { select: { name: true } },
} as const;

export async function registerSoporteRoutes(app: FastifyInstance) {
  await app.register(async (app) => {
    app.addHook("preHandler", authenticate);

    app.get("/soporte/tablero", { preHandler: authorize(Module.SOPORTE, Action.VIEW) }, async () => {
      const [estados, estadosHuawei, casos, reclamos, incidencias, dias] = await Promise.all([
        prisma.soporteEstadoPlanta.findMany({ include: { project: { select: selectProyecto } } }),
        prisma.soporteEstadoHuawei.findMany({ include: { project: { select: selectProyecto } } }),
        prisma.soporteCaso.findMany({ where: { estado: "ABIERTO" }, include: incluirCaso, orderBy: { detectadoEn: "desc" } }),
        prisma.ticket.count({ where: { estado: { in: [TicketEstado.ABIERTO, TicketEstado.DERIVADO, TicketEstado.EN_PROGRESO] } } }),
        listarIncidencias({ estado: "ABIERTA" }),
        rendimientoCacheado(),
      ]);
      const lecturas = estados.map((e) => ({
        status: e.status,
        potenciaW: e.potenciaW,
        kwp: kwpDe(e.project),
      }));
      const mediana = medianaCartera(lecturas);
      const casoPorProyecto = new Map(casos.map((c) => [c.projectId, c]));
      // En obra o silenciadas: la revisión no les abre caso.
      const [silGrowatt, silHuawei] = await Promise.all([
        prisma.growattPlant.findMany({ where: { projectId: { not: null } }, select: { projectId: true, monitoreoSilenciadoHasta: true } }),
        prisma.huaweiPlant.findMany({ where: { projectId: { not: null } }, select: { projectId: true, monitoreoSilenciadoHasta: true } }),
      ]);
      const pausas = await pausasDePlantas(
        [...estados.map((e) => e.projectId), ...estadosHuawei.map((h) => h.projectId)],
        new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" }),
        new Map([...silGrowatt, ...silHuawei].map((p) => [p.projectId!, p.monitoreoSilenciadoHasta])),
      );
      const plantas = estados.map((e, i) => {
        const r = rendimiento(lecturas[i]);
        const vsNormal =
          r != null && mediana && e.factorNormal && e.status === 1 ? r / mediana / e.factorNormal : null;
        const caso = casoPorProyecto.get(e.projectId);
        return {
          marca: "GROWATT" as "GROWATT" | "HUAWEI",
          projectId: e.projectId,
          cliente: e.project.clientName,
          codigo: e.project.code,
          kwp: lecturas[i].kwp,
          enLinea: e.status === 1,
          potenciaW: e.potenciaW,
          energiaHoyKwh:
            e.energiaTotalKwh != null && e.energiaInicioDiaKwh != null
              ? Math.max(0, e.energiaTotalKwh - e.energiaInicioDiaKwh)
              : null,
          vsNormal,
          aprendiendo: e.factorNormal == null,
          leidoEn: e.leidoEn.toISOString(),
          ultimaGeneracionEn: e.ultimaGeneracionEn?.toISOString() ?? null,
          caso: caso ? { id: caso.id, tipo: caso.tipo, titulo: caso.titulo } : null,
          pausa: pausas.get(e.projectId) ?? null,
          // Últimos días con sol, contra lo normal para ella (el dato confiable
          // para "genera menos"; el de ahora depende de la hora y la orientación).
          dias: dias.get(e.projectId)?.ultimos ?? null,
        };
      });
      // Huawei: FusionSolar da salud y energía del día; la potencia es el
      // promedio de la última media hora.
      for (const h of estadosHuawei) {
        const caso = casoPorProyecto.get(h.projectId);
        plantas.push({
          marca: "HUAWEI" as const,
          projectId: h.projectId,
          cliente: h.project.clientName,
          codigo: h.project.code,
          kwp: kwpDe(h.project),
          enLinea: h.salud !== 1,
          potenciaW: h.potenciaW,
          energiaHoyKwh: h.diaKwh,
          vsNormal: null,
          aprendiendo: false,
          leidoEn: h.leidoEn.toISOString(),
          ultimaGeneracionEn: h.ultimaGeneracionEn?.toISOString() ?? null,
          caso: caso ? { id: caso.id, tipo: caso.tipo, titulo: caso.titulo } : null,
          pausa: pausas.get(h.projectId) ?? null,
          dias: dias.get(h.projectId)?.ultimos ?? null,
        });
      }
      const problemas = armarProblemas(casos.map(serializarCaso), incidencias, plantas);
      const ultimaLectura = estados.reduce<Date | null>((m, e) => (!m || e.leidoEn > m ? e.leidoEn : m), null);
      return {
        vigiaAutomatico: vigiaHabilitado(),
        ultimaLectura: ultimaLectura?.toISOString() ?? null,
        mediana,
        plantas,
        casos: casos.map(serializarCaso),
        reclamosAbiertos: reclamos,
        incidenciasMonitoreo: incidencias.length,
        // Con la mediana de la cartera por debajo de esto es de noche (o muy
        // nublado): "desconectada" no quiere decir nada, Growatt las da así.
        haySol: mediana != null && mediana >= SOL_MIN,
        problemas,
      };
    });

    app.get("/soporte/casos", { preHandler: authorize(Module.SOPORTE, Action.VIEW) }, async (request) => {
      const { estado } = z.object({ estado: z.nativeEnum(SoporteCasoEstado).optional() }).parse(request.query);
      const casos = await prisma.soporteCaso.findMany({
        where: estado ? { estado } : {},
        include: incluirCaso,
        orderBy: { detectadoEn: "desc" },
        take: 200,
      });
      return { casos: casos.map(serializarCaso) };
    });

    app.get("/soporte/casos/:id/mensaje", { preHandler: authorize(Module.SOPORTE, Action.VIEW) }, async (request) => {
      const { id } = idParam.parse(request.params);
      const c = await prisma.soporteCaso.findUnique({ where: { id } });
      if (!c) throw notFound("CASO_NO_ENCONTRADO", "El caso no existe");
      return { mensaje: mensajeSugerido(c.tipo, c.llaveDelCliente) };
    });

    app.post("/soporte/casos/:id/avisar-cliente", { preHandler: authorize(Module.SOPORTE, Action.EDIT) }, async (request) => {
      const { id } = idParam.parse(request.params);
      const { mensaje } = z.object({ mensaje: z.string().max(1000) }).parse(request.body);
      return avisarCliente(id, userId(request), mensaje);
    });

    app.post("/soporte/casos/:id/cerrar", { preHandler: authorize(Module.SOPORTE, Action.EDIT) }, async (request) => {
      const { id } = idParam.parse(request.params);
      const body = z
        .object({ estado: z.enum(["RESUELTO", "DESCARTADO"]), motivo: z.string().max(1000).default("") })
        .parse(request.body);
      await cerrarManual(id, userId(request), body.estado, body.motivo);
      return { ok: true };
    });

    app.post("/soporte/vigia", { preHandler: authorize(Module.SOPORTE, Action.EDIT) }, async () => correrVigia());
    app.post("/soporte/rendimiento", { preHandler: authorize(Module.SOPORTE, Action.EDIT) }, async () => {
      cacheRendimiento = null;
      return revisarRendimiento();
    });
  });
}

// ─── Problemas: casos de Soporte + incidencias del monitoreo diario ──────────
// Una sola lista, agrupada por tipo de problema, para la vista gráfica de la
// mesa. Si una planta tiene caso de Soporte y también incidencia del monitoreo
// por lo mismo, se muestra una vez (el caso) con la marca de que el monitoreo
// también lo vio.

type Grupo = "FALLA" | "NO_GENERA" | "NO_COMUNICA" | "GENERA_MENOS" | "MEDIDOR" | "NO_EXPORTA" | "SIN_DATOS";

const GRUPO_CASO: Record<SoporteCasoTipo, Grupo> = {
  FALLA_INVERSOR: "FALLA",
  SIN_GENERACION: "NO_GENERA",
  SIN_COMUNICACION: "NO_COMUNICA",
  BAJO_RENDIMIENTO: "GENERA_MENOS",
};
const GRUPO_INCIDENCIA: Partial<Record<FilaIncidencia["diagnostico"], Grupo>> = {
  ERROR_DISPOSITIVO: "FALLA",
  SIN_GENERACION: "NO_GENERA",
  SIN_COMUNICACION: "NO_COMUNICA",
  GENERACION_BAJA: "GENERA_MENOS",
  MEDIDOR_INVERTIDO: "MEDIDOR",
  SIN_EXPORTACION: "NO_EXPORTA",
  SIN_DATOS_API: "SIN_DATOS",
};
/** "La planta está caída": no genera, no comunica o falla son el mismo problema visto distinto. */
const CAIDA: Grupo[] = ["FALLA", "NO_GENERA", "NO_COMUNICA"];
const familia = (g: Grupo) => (CAIDA.includes(g) ? "CAIDA" : g);

type Problema = {
  clave: string;
  origen: "SOPORTE" | "MONITOREO";
  id: string;
  projectId: string | null;
  cliente: string;
  grupo: Grupo;
  titulo: string;
  detalle: string;
  /** ISO (caso) o YYYY-MM-DD (incidencia). */
  desde: string;
  avisadoCliente: string | null;
  conPortal: boolean;
  revisada: boolean;
  /** El monitoreo diario también lo vio, desde este día. */
  monitoreoDesde: string | null;
  kwp: number | null;
  dias: Array<{ dia: string; kwh: number; vs: number }> | null;
  pausa: { motivo: "OBRA" | "SILENCIADA"; hasta: string } | null;
};

function armarProblemas(
  casos: ReturnType<typeof serializarCaso>[],
  incidencias: FilaIncidencia[],
  plantas: Array<{ projectId: string; kwp: number | null; dias: Problema["dias"]; pausa: Problema["pausa"] }>,
): Problema[] {
  const planta = new Map(plantas.map((p) => [p.projectId, p]));
  const out: Problema[] = [];
  const vistos = new Map<string, Problema>(); // projectId|familia → problema

  for (const c of casos) {
    const grupo = GRUPO_CASO[c.tipo];
    const p: Problema = {
      clave: `caso-${c.id}`,
      origen: "SOPORTE",
      id: c.id,
      projectId: c.projectId,
      cliente: c.cliente,
      grupo,
      titulo: c.titulo,
      detalle: c.detalle,
      desde: c.detectadoEn,
      avisadoCliente: c.clienteAvisadoEn,
      conPortal: c.conPortal,
      revisada: false,
      monitoreoDesde: null,
      kwp: planta.get(c.projectId)?.kwp ?? null,
      dias: planta.get(c.projectId)?.dias ?? null,
      pausa: planta.get(c.projectId)?.pausa ?? null,
    };
    out.push(p);
    vistos.set(`${c.projectId}|${familia(grupo)}`, p);
  }
  for (const i of incidencias) {
    const grupo = GRUPO_INCIDENCIA[i.diagnostico];
    if (!grupo) continue;
    const ya = i.projectId ? vistos.get(`${i.projectId}|${familia(grupo)}`) : undefined;
    if (ya) {
      ya.monitoreoDesde = ya.monitoreoDesde ?? i.primeraDeteccionEn;
      continue;
    }
    const pl = i.projectId ? planta.get(i.projectId) : undefined;
    // El monitoreo diario dice "código 302" a secas: se explica con la misma
    // tabla que usa Soporte.
    const codigo = Number((i.detalle ?? "").match(/c[oó]digo (\d+)/i)?.[1] ?? NaN);
    const falla = Number.isFinite(codigo) ? describirCodigo(codigo, null) : null;
    const p: Problema = {
      clave: `inc-${i.id}`,
      origen: "MONITOREO",
      id: i.id,
      projectId: i.projectId,
      cliente: i.clientName ?? i.plantName,
      grupo,
      titulo: falla?.titulo ?? "",
      detalle: falla ? `${i.detalle ?? ""} ${falla.queHacer}`.trim() : i.detalle ?? "",
      desde: i.primeraDeteccionEn,
      avisadoCliente: null,
      conPortal: false,
      revisada: i.revisada,
      monitoreoDesde: i.primeraDeteccionEn,
      kwp: pl?.kwp ?? null,
      dias: pl?.dias ?? null,
      pausa: pl?.pausa ?? null,
    };
    out.push(p);
    if (i.projectId) vistos.set(`${i.projectId}|${familia(grupo)}`, p);
  }
  return out;
}

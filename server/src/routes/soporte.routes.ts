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
import { medianaCartera, rendimiento } from "../services/soporte/vigia.js";
import { correrVigia } from "../services/soporte/vigia.service.js";
import { badRequest, notFound } from "../utils/errors.js";

const idParam = z.object({ id: z.string().min(1) });

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
        prisma.soporteEstadoPlanta.findMany({
          include: { project: { select: { clientName: true, code: true, capacityKwp: true } } },
        }),
        prisma.soporteEstadoHuawei.findMany({
          include: { project: { select: { clientName: true, code: true, capacityKwp: true } } },
        }),
        prisma.soporteCaso.findMany({ where: { estado: "ABIERTO" }, include: incluirCaso, orderBy: { detectadoEn: "desc" } }),
        prisma.ticket.count({ where: { estado: { in: [TicketEstado.ABIERTO, TicketEstado.DERIVADO, TicketEstado.EN_PROGRESO] } } }),
        prisma.fvIncidencia.count({ where: { estado: "ABIERTA" } }),
        rendimientoCacheado(),
      ]);
      const lecturas = estados.map((e) => ({
        status: e.status,
        potenciaW: e.potenciaW,
        kwp: e.project.capacityKwp != null ? Number(e.project.capacityKwp) : null,
      }));
      const mediana = medianaCartera(lecturas);
      const casoPorProyecto = new Map(casos.map((c) => [c.projectId, c]));
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
          kwp: h.project.capacityKwp != null ? Number(h.project.capacityKwp) : null,
          enLinea: h.salud !== 1,
          potenciaW: h.potenciaW,
          energiaHoyKwh: h.diaKwh,
          vsNormal: null,
          aprendiendo: false,
          leidoEn: h.leidoEn.toISOString(),
          ultimaGeneracionEn: h.ultimaGeneracionEn?.toISOString() ?? null,
          caso: caso ? { id: caso.id, tipo: caso.tipo, titulo: caso.titulo } : null,
          dias: dias.get(h.projectId)?.ultimos ?? null,
        });
      }
      const ultimaLectura = estados.reduce<Date | null>((m, e) => (!m || e.leidoEn > m ? e.leidoEn : m), null);
      return {
        vigiaAutomatico: vigiaHabilitado(),
        ultimaLectura: ultimaLectura?.toISOString() ?? null,
        mediana,
        plantas,
        casos: casos.map(serializarCaso),
        reclamosAbiertos: reclamos,
        incidenciasMonitoreo: incidencias,
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

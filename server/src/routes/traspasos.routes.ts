// Endpoints del módulo Traspasos. Prefijo /api.
//   GET  /traspasos/pendientes            (autenticado) — bandeja del usuario
//   GET  /traspasos/:id                    (TRASPASOS:VIEW)
//   POST /traspasos/:id/confirmar          (autenticado; solo el modalUsuario)
//   POST /traspasos/:id/cancelar           (ADMIN)
//   GET  /traspasos/proyecto/:projectId    (TRASPASOS:VIEW) — historial
//   GET  /admin/traspasos/reporte          (TRASPASOS:ADMIN_REPORT)

import { Action, Module, TraspasoEstado } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { badRequest, forbidden } from "../utils/errors.js";
import {
  buildModalTexto,
  cancelarTraspaso,
  confirmarTraspaso,
  previewDestinatarios,
  TRASPASO_LABEL,
} from "../services/traspasos/index.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) {
    throw badRequest("AUTH_CONTEXT_MISSING", "No se pudo resolver el usuario autenticado");
  }
  return request.user;
}

const confirmarSchema = z.object({ notaAlReceptor: z.string().max(2000).optional() }).strict();
const cancelarSchema = z.object({ motivo: z.string().max(2000).optional() }).strict();

export async function registerTraspasosRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Bandeja de pendientes del usuario autenticado.
  app.get("/traspasos/pendientes", async (request) => {
    const user = ensureUser(request);
    const pendientes = await prisma.traspaso.findMany({
      where: { modalUsuarioId: user.id, estado: TraspasoEstado.PENDIENTE_CONFIRMACION },
      include: { project: { select: { id: true, clientName: true } } },
      orderBy: { condicionDetectadaEn: "asc" },
    });

    const traspasos = await Promise.all(
      pendientes.map(async (t) => ({
        id: t.id,
        tipo: t.tipo,
        label: TRASPASO_LABEL[t.tipo],
        projectId: t.projectId,
        projectName: t.project.clientName,
        modalTexto: buildModalTexto(t.tipo, t.project.clientName),
        destinatariosPreview: await previewDestinatarios(t.tipo, { payload: t.payload, excludeUserId: user.id }),
        condicionDetectadaEn: t.condicionDetectadaEn,
      })),
    );

    return { traspasos };
  });

  // Detalle de un traspaso.
  app.get(
    "/traspasos/:id",
    { preHandler: authorize(Module.TRASPASOS, Action.VIEW) },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const traspaso = await prisma.traspaso.findUnique({
        where: { id },
        include: {
          project: { select: { id: true, clientName: true } },
          modalUsuario: { select: { id: true, name: true } },
          confirmadoPor: { select: { id: true, name: true } },
          destinatarios: {
            include: { usuario: { select: { id: true, name: true, role: { select: { name: true } } } } },
          },
        },
      });
      if (!traspaso) throw badRequest("TRASPASO_NOT_FOUND", "El traspaso no existe.");
      return {
        ...traspaso,
        label: TRASPASO_LABEL[traspaso.tipo],
        modalTexto: buildModalTexto(traspaso.tipo, traspaso.project.clientName),
      };
    },
  );

  // Confirmar (solo el usuario que originó el traspaso; se valida en el servicio).
  app.post("/traspasos/:id/confirmar", async (request) => {
    const user = ensureUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = confirmarSchema.parse(request.body ?? {});
    const result = await confirmarTraspaso({
      traspasoId: id,
      userId: user.id,
      notaAlReceptor: body.notaAlReceptor ?? null,
    });
    return result;
  });

  // Cancelar (excepcional): solo ADMIN.
  app.post("/traspasos/:id/cancelar", async (request) => {
    const user = ensureUser(request);
    if (user.role !== "ADMIN") throw forbidden("Solo ADMIN puede cancelar un traspaso.");
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = cancelarSchema.parse(request.body ?? {});
    return cancelarTraspaso({ traspasoId: id, userId: user.id, motivo: body.motivo ?? null });
  });

  // Historial de traspasos de un proyecto.
  app.get(
    "/traspasos/proyecto/:projectId",
    { preHandler: authorize(Module.TRASPASOS, Action.VIEW) },
    async (request) => {
      const { projectId } = z.object({ projectId: z.string() }).parse(request.params);
      const traspasos = await prisma.traspaso.findMany({
        where: { projectId },
        include: {
          modalUsuario: { select: { id: true, name: true } },
          confirmadoPor: { select: { id: true, name: true } },
        },
        orderBy: { condicionDetectadaEn: "desc" },
      });
      return {
        traspasos: traspasos.map((t) => ({ ...t, label: TRASPASO_LABEL[t.tipo] })),
      };
    },
  );

  // Reporte agregado para ADMIN.
  app.get(
    "/admin/traspasos/reporte",
    { preHandler: authorize(Module.TRASPASOS, Action.ADMIN_REPORT) },
    async () => {
      const porEstado = await prisma.traspaso.groupBy({
        by: ["estado"],
        _count: { _all: true },
      });
      const porTipo = await prisma.traspaso.groupBy({
        by: ["tipo"],
        _count: { _all: true },
      });
      return {
        porEstado: porEstado.map((e) => ({ estado: e.estado, count: e._count._all })),
        porTipo: porTipo.map((t) => ({ tipo: t.tipo, label: TRASPASO_LABEL[t.tipo], count: t._count._all })),
      };
    },
  );
}

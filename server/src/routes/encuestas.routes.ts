// Endpoints internos del módulo Encuestas. Prefijo /api. Guard authorize(ENCUESTAS,*).
// Solo lectura: las encuestas las genera el sistema (hitos + cron) y las responde
// el cliente desde el portal.
//   GET /encuestas       (VIEW) — lista con filtros tipo/estado/notaBaja/projectId
//   GET /encuestas/:id   (VIEW) — detalle

import { Action, Module, SurveyEstado, SurveyTipo } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { badRequest } from "../utils/errors.js";
import { getUmbralNotaBaja, serializeSurvey } from "../services/encuestas/encuestas.service.js";
import { esNotaBaja, promedioNotas } from "../services/encuestas/preguntas.js";

export async function registerEncuestasRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/encuestas", { preHandler: authorize(Module.ENCUESTAS, Action.VIEW) }, async (request) => {
    const q = z
      .object({
        tipo: z.nativeEnum(SurveyTipo).optional(),
        estado: z.nativeEnum(SurveyEstado).optional(),
        projectId: z.string().optional(),
        notaBaja: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
      })
      .parse(request.query);

    const umbral = await getUmbralNotaBaja();
    const rows = await prisma.satisfactionSurvey.findMany({
      where: {
        deletedAt: null,
        ...(q.tipo ? { tipo: q.tipo } : {}),
        ...(q.estado ? { estado: q.estado } : {}),
        ...(q.projectId ? { projectId: q.projectId } : {}),
        // Nota baja = cualquiera de las tres en el umbral o por debajo. No hace
        // falta chequear el promedio: si las tres están por encima del umbral, el
        // promedio también lo está.
        ...(q.notaBaja
          ? {
              OR: [
                { nota: { lte: umbral } },
                { nota2: { lte: umbral } },
                { nota3: { lte: umbral } },
              ],
            }
          : {}),
      },
      include: { project: { select: { id: true, clientName: true, code: true } } },
      orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
    });

    const respondedores = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.respondidaPorId).filter((x): x is string => !!x))] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(respondedores.map((u) => [u.id, u.name]));

    return {
      encuestas: rows.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        projectName: s.project.clientName,
        projectCode: s.project.code,
        tipo: s.tipo,
        estado: s.estado,
        edicion: s.edicion,
        nota: s.nota,
        nota2: s.nota2,
        nota3: s.nota3,
        notaPromedio: promedioNotas([s.nota, s.nota2, s.nota3]),
        comentario: s.comentario,
        notaBaja: esNotaBaja([s.nota, s.nota2, s.nota3], umbral),
        respondidaEn: s.respondidaEn?.toISOString() ?? null,
        respondidaPorNombre: s.respondidaPorId ? nameById.get(s.respondidaPorId) ?? null : null,
        traspasoId: s.traspasoId,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  });

  app.get("/encuestas/:id", { preHandler: authorize(Module.ENCUESTAS, Action.VIEW) }, async (request) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const s = await prisma.satisfactionSurvey.findFirst({ where: { id, deletedAt: null } });
    if (!s) throw badRequest("SURVEY_NOT_FOUND", "Encuesta no encontrada");
    return serializeSurvey(s);
  });
}

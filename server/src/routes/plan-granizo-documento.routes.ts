// Generador del documento del Plan de Protección contra Granizo (condiciones
// generales + Anexo A con los datos del cliente). Prefijo /api. Mismo patrón que
// proforma.routes.ts / contract.routes.ts.
//
// Se abre desde dos lugares, así que entra con cualquiera de los dos permisos:
// la ficha del cliente en Experiencia Solar (EXPERIENCIA_CLIENTES) y la etapa de
// Onboarding del proyecto (ONBOARDING).

import { Action, Module } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeAny } from "../middleware/authorize.middleware.js";
import { buildPlanGranizoDocContext } from "../services/seguro-granizo/documento/contexto.js";
import {
  generateDraftPreviewPdf,
  getDraft,
  getVersionPdf,
  listVersions,
  publishVersion,
  setVersionStatus,
  upsertDraft,
} from "../services/seguro-granizo/documento/documento.service.js";
import { planGranizoDocStorageSchema } from "../services/seguro-granizo/documento/schema.js";
import { contentDisposition } from "../utils/content-disposition.js";
import { notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const guard = (action: Action) =>
  authorizeAny([
    { module: Module.EXPERIENCIA_CLIENTES, action },
    { module: Module.ONBOARDING, action },
  ]);

const projectParams = z.object({ projectId: z.string().min(1) }).strict();
const idParams = z.object({ id: z.string().min(1) }).strict();

async function sendPdf(request: FastifyRequest, reply: FastifyReply, disposition: "attachment" | "inline") {
  const user = ensureUser(request);
  const { id } = idParams.parse(request.params);
  const includeDiscarded = (request.query as { includeDiscarded?: string }).includeDiscarded === "true";
  const { version, buf, filename } = await getVersionPdf(id);
  if (version.status === "DISCARDED" && !(includeDiscarded && user.role === "ADMIN")) {
    throw notFound("PLAN_GRANIZO_VERSION_DISCARDED", "La versión está descartada.");
  }
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", contentDisposition(disposition, filename));
  reply.header("Cache-Control", "no-store");
  return reply.send(buf);
}

export async function registerPlanGranizoDocumentoRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/projects/:projectId/plan-granizo/draft", { preHandler: guard(Action.VIEW) }, async (request) => {
    const { projectId } = projectParams.parse(request.params);
    const draft = await getDraft(projectId);
    if (!draft) throw notFound("PLAN_GRANIZO_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de las condiciones del plan.");
    return draft;
  });

  app.get("/projects/:projectId/plan-granizo/context", { preHandler: guard(Action.VIEW) }, async (request) => {
    const { projectId } = projectParams.parse(request.params);
    return buildPlanGranizoDocContext(projectId);
  });

  app.get("/projects/:projectId/plan-granizo/draft/preview.pdf", { preHandler: guard(Action.VIEW) }, async (request, reply) => {
    const { projectId } = projectParams.parse(request.params);
    const pdf = await generateDraftPreviewPdf(projectId);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", 'inline; filename="plan-granizo-preview.pdf"');
    reply.header("Cache-Control", "no-store");
    return reply.send(pdf);
  });

  app.put("/projects/:projectId/plan-granizo/draft", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { projectId } = projectParams.parse(request.params);
    const body = z.object({ data: planGranizoDocStorageSchema }).strict().parse(request.body);
    return upsertDraft(projectId, body.data, user.id);
  });

  app.post("/projects/:projectId/plan-granizo/versions", { preHandler: guard(Action.CREATE) }, async (request, reply) => {
    const user = ensureUser(request);
    const { projectId } = projectParams.parse(request.params);
    return reply.status(201).send(await publishVersion(projectId, user.id));
  });

  app.get("/projects/:projectId/plan-granizo/versions", { preHandler: guard(Action.VIEW) }, async (request) => {
    const { projectId } = projectParams.parse(request.params);
    const includeDiscarded = (request.query as { includeDiscarded?: string }).includeDiscarded === "true";
    return { versions: await listVersions(projectId, includeDiscarded) };
  });

  app.get("/plan-granizo/versions/:id/pdf", { preHandler: guard(Action.VIEW) }, (request, reply) => sendPdf(request, reply, "attachment"));
  app.get("/plan-granizo/versions/:id/preview", { preHandler: guard(Action.VIEW) }, (request, reply) => sendPdf(request, reply, "inline"));

  app.delete("/plan-granizo/versions/:id", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    const body = z.object({ reason: z.string().optional() }).strict().parse(request.body ?? {});
    return setVersionStatus(id, user.id, true, body.reason);
  });

  app.post("/plan-granizo/versions/:id/restore", { preHandler: guard(Action.EDIT) }, async (request) => {
    const user = ensureUser(request);
    const { id } = idParams.parse(request.params);
    return setVersionStatus(id, user.id, false);
  });
}

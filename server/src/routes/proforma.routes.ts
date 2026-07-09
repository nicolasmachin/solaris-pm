// Endpoints del generador de proforma BBVA (subetapa "Modalidad de pago definida").
// Prefijo /api. Gate Module.ONBOARDING. Mismo patrón que contract.routes.ts.

import { Action, AuditAction, AuditEntityType, Module, Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { buildProformaContext } from "../services/proforma/proforma-context.service.js";
import { getDraft, upsertDraft } from "../services/proforma/proforma-draft.service.js";
import {
  discardVersion,
  generateDraftPreviewPdf,
  getVersionById,
  listVersions,
  publishVersion,
  readVersionPdfById,
  restoreVersion,
} from "../services/proforma/proforma-version.service.js";
import { proformaPdfFilename } from "../services/proforma/filename.js";
import { proformaDataStorageSchema } from "../services/proforma/schemas/proforma.schema.js";
import type { ProformaSnapshot } from "../services/proforma/schemas/proforma-snapshot.schema.js";
import { notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const projectParams = z.object({ projectId: z.string().min(1) }).strict();
const idParams = z.object({ id: z.string().min(1) }).strict();
const putDraftBody = z.object({ data: proformaDataStorageSchema }).strict();
const discardBody = z.object({ reason: z.string().optional() }).strict();

function clientNameFromSnapshot(snapshot: Prisma.JsonValue): string {
  const snap = snapshot as unknown as ProformaSnapshot;
  return snap?.data?.cliente?.nombre ?? "Cliente";
}

async function sendVersionPdf(
  request: FastifyRequest,
  reply: FastifyReply,
  disposition: "attachment" | "inline",
) {
  const user = ensureUser(request);
  const { id } = idParams.parse(request.params);
  const includeDiscarded = (request.query as { includeDiscarded?: string }).includeDiscarded === "true";

  const version = await getVersionById(id);
  if (!version) throw notFound("PROFORMA_VERSION_NOT_FOUND", "La versión no existe.");
  if (version.status === "DISCARDED" && !(includeDiscarded && user.role === "ADMIN")) {
    throw notFound("PROFORMA_VERSION_DISCARDED", "La versión está descartada.");
  }

  const buf = await readVersionPdfById(id);
  const filename = proformaPdfFilename(clientNameFromSnapshot(version.snapshot), version.versionNumber);
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", `${disposition}; filename="${filename}"`);
  reply.header("Cache-Control", "no-store");
  return reply.send(buf);
}

export async function registerProformaRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get(
    "/projects/:projectId/proforma/draft",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const draft = await getDraft(projectId);
      if (!draft) throw notFound("PROFORMA_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de proforma.");
      return draft;
    },
  );

  app.get(
    "/projects/:projectId/proforma/context",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      return buildProformaContext(projectId);
    },
  );

  app.get(
    "/projects/:projectId/proforma/draft/preview.pdf",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const pdf = await generateDraftPreviewPdf(projectId);
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'inline; filename="proforma-preview.pdf"');
      reply.header("Cache-Control", "no-store");
      return reply.send(pdf);
    },
  );

  app.put(
    "/projects/:projectId/proforma/draft",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const body = putDraftBody.parse(request.body);

      const draft = await upsertDraft(projectId, body.data, user.id);

      await createAuditEntry({
        entityType: AuditEntityType.proforma,
        entityId: draft.id,
        userId: user.id,
        action: AuditAction.proforma_draft_updated,
        description: "Actualizó el borrador de proforma",
        metadata: { projectId, keys: Object.keys(body.data) } as unknown as Prisma.InputJsonValue,
      });

      return draft;
    },
  );

  app.post(
    "/projects/:projectId/proforma/versions",
    { preHandler: authorize(Module.ONBOARDING, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const version = await publishVersion(projectId, user.id);
      return reply.status(201).send(version);
    },
  );

  app.get(
    "/projects/:projectId/proforma/versions",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const includeDiscarded =
        (request.query as { includeDiscarded?: string }).includeDiscarded === "true";
      const versions = await listVersions(projectId, { includeDiscarded });
      return { versions };
    },
  );

  app.get(
    "/proforma/versions/:id/pdf",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "attachment"),
  );
  app.get(
    "/proforma/versions/:id/preview",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "inline"),
  );

  app.delete(
    "/proforma/versions/:id",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = discardBody.parse(request.body ?? {});
      return discardVersion(id, user.id, body.reason);
    },
  );

  app.post(
    "/proforma/versions/:id/restore",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      return restoreVersion(id, user.id);
    },
  );
}

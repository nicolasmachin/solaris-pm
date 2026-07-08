// Endpoints del generador de contrato (subetapa Contrato del onboarding).
// Prefijo /api. Gate Module.ONBOARDING. Handlers delgados: validan con Zod,
// llaman al service y dejan que el error handler global mapee AppError/ZodError.
//   Draft:    GET/PUT /projects/:projectId/contract/draft
//   Context:  GET     /projects/:projectId/contract/context
//   Preview:  GET     /projects/:projectId/contract/draft/preview.pdf
//   Versions: POST/GET /projects/:projectId/contract/versions,
//             GET /contract/versions/:id/pdf,
//             DELETE /contract/versions/:id, POST /contract/versions/:id/restore

import { Action, AuditAction, AuditEntityType, Module, Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { buildContractContext } from "../services/contract/contract-context.service.js";
import { getDraft, upsertDraft } from "../services/contract/contract-draft.service.js";
import {
  discardVersion,
  generateDraftPreviewPdf,
  getVersionById,
  listVersions,
  publishVersion,
  readVersionPdfById,
  restoreVersion,
} from "../services/contract/contract-version.service.js";
import { contractPdfFilename } from "../services/contract/filename.js";
import { contractDataStorageSchema } from "../services/contract/schemas/contract.schema.js";
import type { ContractSnapshot } from "../services/contract/schemas/contract-snapshot.schema.js";
import { notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

const projectParams = z.object({ projectId: z.string().min(1) }).strict();
const idParams = z.object({ id: z.string().min(1) }).strict();
const putDraftBody = z.object({ data: contractDataStorageSchema }).strict();
const discardBody = z.object({ reason: z.string().optional() }).strict();

function clientNameFromSnapshot(snapshot: Prisma.JsonValue): string {
  const snap = snapshot as unknown as ContractSnapshot;
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
  if (!version) throw notFound("CONTRACT_VERSION_NOT_FOUND", "La versión no existe.");
  if (version.status === "DISCARDED" && !(includeDiscarded && user.role === "ADMIN")) {
    throw notFound("CONTRACT_VERSION_DISCARDED", "La versión está descartada.");
  }

  const buf = await readVersionPdfById(id);
  const filename = contractPdfFilename(clientNameFromSnapshot(version.snapshot), version.versionNumber);
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", `${disposition}; filename="${filename}"`);
  reply.header("Cache-Control", "no-store");
  return reply.send(buf);
}

export async function registerContractRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Draft ─────────────────────────────────────────────────────────────
  app.get(
    "/projects/:projectId/contract/draft",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const draft = await getDraft(projectId);
      if (!draft) throw notFound("CONTRACT_DRAFT_NOT_FOUND", "El proyecto no tiene borrador de contrato.");
      return draft;
    },
  );

  // Precarga de datos del contrato (cliente/sistema/precio).
  app.get(
    "/projects/:projectId/contract/context",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      return buildContractContext(projectId);
    },
  );

  // Preview del PDF del borrador (al vuelo, inline, sin cache).
  app.get(
    "/projects/:projectId/contract/draft/preview.pdf",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request, reply) => {
      const { projectId } = projectParams.parse(request.params);
      const pdf = await generateDraftPreviewPdf(projectId);
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'inline; filename="contrato-preview.pdf"');
      reply.header("Cache-Control", "no-store");
      return reply.send(pdf);
    },
  );

  app.put(
    "/projects/:projectId/contract/draft",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const body = putDraftBody.parse(request.body);

      const draft = await upsertDraft(projectId, body.data, user.id);

      await createAuditEntry({
        entityType: AuditEntityType.contract,
        entityId: draft.id,
        userId: user.id,
        action: AuditAction.contract_draft_updated,
        description: "Actualizó el borrador de contrato",
        metadata: { projectId, keys: Object.keys(body.data) } as unknown as Prisma.InputJsonValue,
      });

      return draft;
    },
  );

  // ─── Versiones: publicar y listar ────────────────────────────────────────
  app.post(
    "/projects/:projectId/contract/versions",
    { preHandler: authorize(Module.ONBOARDING, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { projectId } = projectParams.parse(request.params);
      const version = await publishVersion(projectId, user.id);
      return reply.status(201).send(version);
    },
  );

  app.get(
    "/projects/:projectId/contract/versions",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    async (request) => {
      const { projectId } = projectParams.parse(request.params);
      const includeDiscarded =
        (request.query as { includeDiscarded?: string }).includeDiscarded === "true";
      const versions = await listVersions(projectId, { includeDiscarded });
      return { versions };
    },
  );

  // ─── Versiones: descargar / previsualizar PDF ────────────────────────────
  app.get(
    "/contract/versions/:id/pdf",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "attachment"),
  );
  app.get(
    "/contract/versions/:id/preview",
    { preHandler: authorize(Module.ONBOARDING, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "inline"),
  );

  // ─── Versiones: descartar y restaurar ────────────────────────────────────
  app.delete(
    "/contract/versions/:id",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = discardBody.parse(request.body ?? {});
      return discardVersion(id, user.id, body.reason);
    },
  );

  app.post(
    "/contract/versions/:id/restore",
    { preHandler: authorize(Module.ONBOARDING, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      return restoreVersion(id, user.id);
    },
  );
}

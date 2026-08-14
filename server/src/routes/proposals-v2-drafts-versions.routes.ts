// Endpoints de borradores y versiones publicadas de propuesta v2 (Fase E).
// Prefijo /api/proposals-v2. Handlers delgados: validan con Zod, llaman al
// service y dejan que el error handler global mapee AppError/ZodError.
//   Draft:    GET/PUT  /leads/:leadId/draft
//   Versions: POST/GET /leads/:leadId/versions, GET /versions/:id,
//             DELETE /versions/:id, POST /versions/:id/restore,
//             GET /versions/:id/pdf/{full,summary},
//             POST /versions/:id/regenerate-pdf (ADMIN)

import {
  Action,
  AuditAction,
  AuditEntityType,
  Module,
  Prisma,
  ProposalVariante,
} from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { contentDisposition } from "../utils/content-disposition.js";
import type { CalcDebugRow } from "../services/proposal/calculator-labels.js";
import {
  computeDraftCalcRows,
  computeDraftComision,
  ensureDraft,
  getDraft,
  upsertDraft,
} from "../services/proposal/draft.service.js";
import { computeDraftViability } from "../services/proposal/viability.service.js";
import { readVersionPdf } from "../services/proposal/proposal-storage.js";
import { draftDataStorageSchema } from "../services/proposal/schemas/draft.schema.js";
import type { ProposalV2Snapshot } from "../services/proposal/schemas/snapshot.schema.js";
import {
  discardVersion,
  generateDraftPreviewPdf,
  getVersionById,
  listVersions,
  publishVersion,
  regeneratePdf,
  restoreVersion,
  versionPdfFilename,
} from "../services/proposal/version.service.js";
import { badRequest, forbidden, notFound, unauthorized } from "../utils/errors.js";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

// Handler del endpoint de debug de cálculo. El gating de permiso lo hace el
// middleware authorize(VENTAS, DEBUG_CALCULADORA) en el registro de la ruta.
export function makeDraftCalcHandler(
  getRows: (leadId: string, variante: ProposalVariante) => Promise<CalcDebugRow[]>,
) {
  return async (request: FastifyRequest) => {
    const { leadId } = leadParams.parse(request.params);
    return { rows: await getRows(leadId, parseVariante(request.query)) };
  };
}

const leadParams = z.object({ leadId: z.string().min(1) }).strict();

// Qué cotizador. Ausente = residencial, así que todo cliente anterior al
// cotizador B2B sigue funcionando sin tocar una línea.
const varianteQuery = z
  .object({ variante: z.nativeEnum(ProposalVariante).default(ProposalVariante.RESIDENCIAL) })
  .passthrough();
const parseVariante = (query: unknown): ProposalVariante =>
  varianteQuery.parse(query ?? {}).variante;
const idParams = z.object({ id: z.string().min(1) }).strict();
const putDraftBody = z.object({ data: draftDataStorageSchema }).strict();
const discardBody = z.object({ reason: z.string().optional() }).strict();

function clientNameFromSnapshot(snapshot: Prisma.JsonValue): string {
  const snap = snapshot as unknown as ProposalV2Snapshot;
  return snap?.data?.cliente?.nombre ?? "cliente";
}

async function sendVersionPdf(
  request: FastifyRequest,
  reply: FastifyReply,
  kind: "full" | "summary",
) {
  const user = ensureUser(request);
  const { id } = idParams.parse(request.params);
  const includeDiscarded = (request.query as { includeDiscarded?: string }).includeDiscarded === "true";

  const version = await getVersionById(id);
  if (!version) throw notFound("VERSION_NOT_FOUND", "La versión no existe.");

  // Descartada: solo un admin con ?includeDiscarded=true puede descargarla.
  if (version.status === "DISCARDED" && !(includeDiscarded && user.role === "ADMIN")) {
    throw notFound("VERSION_DISCARDED", "La versión está descartada.");
  }

  const relativePath = kind === "full" ? version.fullPdfPath : version.summaryPdfPath;
  let buf: Buffer;
  try {
    buf = await readVersionPdf(relativePath);
  } catch {
    throw badRequest("VERSION_PDF_MISSING", "El archivo PDF de la versión no está disponible en disco.");
  }

  const filename = versionPdfFilename(kind, clientNameFromSnapshot(version.snapshot), version.versionNumber);
  reply.header("Content-Type", "application/pdf");
  reply.header("Content-Disposition", contentDisposition("attachment", filename));
  reply.header("Cache-Control", "no-store");
  return reply.send(buf);
}

export async function registerProposalsV2DraftsVersionsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Draft ─────────────────────────────────────────────────────────────
  app.get(
    "/proposals-v2/leads/:leadId/draft",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const { leadId } = leadParams.parse(request.params);
      const draft = await getDraft(leadId, parseVariante(request.query));
      if (!draft) throw notFound("DRAFT_NOT_FOUND", "El lead no tiene borrador.");
      return draft;
    },
  );

  // Abre el cotizador: devuelve el borrador y, si no existe, lo crea con la
  // precarga (defaults del singleton + datos del lead). Idempotente — llamarlo
  // de nuevo no pisa nada.
  //
  // Es EDIT y no VIEW porque puede escribir. Antes esta precarga vivía en el
  // frontend y la fila se creaba de rebote con el primer autosave; tenerla acá
  // es lo que permite cotizar desde el conector.
  app.post(
    "/proposals-v2/leads/:leadId/draft/init",
    { preHandler: authorize(Module.VENTAS, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { leadId } = leadParams.parse(request.params);
      return ensureDraft(leadId, user.id, parseVariante(request.query));
    },
  );

  // Preview del PDF del borrador (al vuelo, inline, sin cache).
  app.get(
    "/proposals-v2/leads/:leadId/draft/preview.pdf",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { leadId } = leadParams.parse(request.params);
      const pdf = await generateDraftPreviewPdf(leadId, user.id, parseVariante(request.query));
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", 'inline; filename="preview.pdf"');
      reply.header("Cache-Control", "no-store");
      return reply.send(pdf);
    },
  );

  // Cálculo del borrador para el drawer de debug (solo ADMIN). Devuelve las
  // filas ya armadas (label/descripción/unidad/valor/orden). ~50ms, sin PDF.
  app.get(
    "/proposals-v2/leads/:leadId/draft/calc",
    { preHandler: authorize(Module.VENTAS, Action.DEBUG_CALCULADORA) },
    makeDraftCalcHandler(computeDraftCalcRows),
  );

  // Indicadores de viabilidad (ahorro % + espacio) para el sub-header. VENTAS:VIEW
  // (a diferencia de /draft/calc que es admin-only). Solo 2 campos, no sensible.
  app.get(
    "/proposals-v2/leads/:leadId/draft/viability",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const { leadId } = leadParams.parse(request.params);
      return computeDraftViability(leadId, parseVariante(request.query));
    },
  );

  // Desglose de la comisión del asesor para el explicativo del cotizador. Es
  // VENTAS:EDIT (quien cotiza), no VIEW: la comisión no la tiene que ver
  // cualquiera que pueda mirar Ventas. Devuelve null mientras el borrador esté
  // incompleto — el panel no se muestra y no hay error.
  app.get(
    "/proposals-v2/leads/:leadId/draft/comision",
    { preHandler: authorize(Module.VENTAS, Action.EDIT) },
    async (request) => {
      const { leadId } = leadParams.parse(request.params);
      return { comision: await computeDraftComision(leadId, parseVariante(request.query)) };
    },
  );

  app.put(
    "/proposals-v2/leads/:leadId/draft",
    { preHandler: authorize(Module.VENTAS, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { leadId } = leadParams.parse(request.params);
      const body = putDraftBody.parse(request.body);

      const variante = parseVariante(request.query);
      const draft = await upsertDraft(leadId, body.data, user.id, variante);

      await createAuditEntry({
        entityType: AuditEntityType.proposal,
        entityId: draft.id,
        userId: user.id,
        action: AuditAction.proposal_v2_draft_updated,
        description: "Actualizó el borrador de propuesta",
        metadata: { leadId, variante, keys: Object.keys(body.data) } as unknown as Prisma.InputJsonValue,
      });

      return draft;
    },
  );

  // ─── Versiones: publicar y listar ────────────────────────────────────────
  app.post(
    "/proposals-v2/leads/:leadId/versions",
    { preHandler: authorize(Module.VENTAS, Action.CREATE) },
    async (request, reply) => {
      const user = ensureUser(request);
      const { leadId } = leadParams.parse(request.params);
      const version = await publishVersion(leadId, user.id, parseVariante(request.query));
      return reply.status(201).send(version);
    },
  );

  app.get(
    "/proposals-v2/leads/:leadId/versions",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const { leadId } = leadParams.parse(request.params);
      const includeDiscarded =
        (request.query as { includeDiscarded?: string }).includeDiscarded === "true";
      const versions = await listVersions(leadId, { includeDiscarded });
      return { versions };
    },
  );

  app.get(
    "/proposals-v2/versions/:id",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const { id } = idParams.parse(request.params);
      const version = await getVersionById(id);
      if (!version) throw notFound("VERSION_NOT_FOUND", "La versión no existe.");
      return version;
    },
  );

  // ─── Versiones: descarga de PDFs ─────────────────────────────────────────
  app.get(
    "/proposals-v2/versions/:id/pdf/full",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "full"),
  );

  app.get(
    "/proposals-v2/versions/:id/pdf/summary",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    (request, reply) => sendVersionPdf(request, reply, "summary"),
  );

  // ─── Versiones: descartar y restaurar ────────────────────────────────────
  app.delete(
    "/proposals-v2/versions/:id",
    { preHandler: authorize(Module.VENTAS, Action.DELETE) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      const body = discardBody.parse(request.body ?? {});
      return discardVersion(id, user.id, body.reason);
    },
  );

  app.post(
    "/proposals-v2/versions/:id/restore",
    { preHandler: authorize(Module.VENTAS, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      const { id } = idParams.parse(request.params);
      return restoreVersion(id, user.id);
    },
  );

  // ─── Versiones: regenerar PDF (solo ADMIN) ───────────────────────────────
  app.post(
    "/proposals-v2/versions/:id/regenerate-pdf",
    { preHandler: authorize(Module.VENTAS, Action.EDIT) },
    async (request) => {
      const user = ensureUser(request);
      if (user.role !== "ADMIN") {
        throw forbidden("Solo un administrador puede regenerar los PDFs de una versión.");
      }
      const { id } = idParams.parse(request.params);
      return regeneratePdf(id, user.id);
    },
  );
}

// Endpoints de defaults del generador de propuestas v2.
// Ver docs/features/proposals-v2/SPEC.md (sección 15).
//   GET /api/proposals-v2/defaults   → VENTAS:VIEW
//   PUT /api/proposals-v2/defaults   → solo rol ADMIN
// La subida de la tapa PDF (POST .../defaults/cover) es de Fase D.

import { Action, AuditAction, AuditEntityType, Module, Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/authorize.middleware.js";
import { createAuditEntry } from "../services/audit.service.js";
import { forbidden, unauthorized } from "../utils/errors.js";
import { serializeDate } from "../utils/serialization.js";

const SINGLETON_ID = "singleton";

function ensureUser(request: FastifyRequest) {
  if (!request.user) throw unauthorized("No autenticado");
  return request.user;
}

// Cada variable de defaults es { value, asesorCanOverride }.
const flaggedSchema = z
  .object({
    value: z.union([z.number(), z.string()]),
    asesorCanOverride: z.boolean(),
  })
  .strict();

// Subobjetos como `plazos`: record de variables flagged.
const nestedFlaggedSchema = z.record(z.string(), flaggedSchema);

// `data` completo: cada clave es una variable flagged o un subobjeto de flagged.
const dataSchema = z.record(z.string(), z.union([flaggedSchema, nestedFlaggedSchema]));

// Coordenadas del overlay de la tapa.
const overlayTextSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    fontSize: z.number(),
    color: z.string(),
    fontWeight: z.enum(["regular", "bold"]),
  })
  .strict();

const coverOverlaySchema = z
  .object({
    clientName: overlayTextSchema,
    city: overlayTextSchema,
    date: overlayTextSchema,
  })
  .strict();

const putBodySchema = z
  .object({
    data: dataSchema,
    coverOverlay: coverOverlaySchema,
  })
  .strict();

export async function registerProposalsV2DefaultsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // ─── Leer los defaults (cualquier rol con VENTAS:VIEW) ───────────────────
  app.get(
    "/proposals-v2/defaults",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async () => {
      const row = await prisma.proposalDefaults.findUnique({ where: { id: SINGLETON_ID } });
      if (!row) {
        // El seed todavía no se corrió: la UI muestra el aviso correspondiente.
        return {
          seeded: false,
          data: {},
          coverOverlay: null,
          coverPdfAttachmentId: null,
          updatedAt: null,
        };
      }
      return {
        seeded: true,
        data: row.data,
        coverOverlay: row.coverOverlay,
        coverPdfAttachmentId: row.coverPdfAttachmentId,
        updatedAt: serializeDate(row.updatedAt),
      };
    },
  );

  // ─── Actualizar los defaults (solo ADMIN) ────────────────────────────────
  app.put(
    "/proposals-v2/defaults",
    { preHandler: authorize(Module.VENTAS, Action.VIEW) },
    async (request) => {
      const user = ensureUser(request);
      if (user.role !== "ADMIN") {
        throw forbidden("Solo un administrador puede editar los defaults de propuestas");
      }

      const body = putBodySchema.parse(request.body);

      const existing = await prisma.proposalDefaults.findUnique({ where: { id: SINGLETON_ID } });

      const row = await prisma.proposalDefaults.upsert({
        where: { id: SINGLETON_ID },
        create: {
          id: SINGLETON_ID,
          data: body.data,
          coverOverlay: body.coverOverlay,
          updatedById: user.id,
        },
        update: {
          data: body.data,
          coverOverlay: body.coverOverlay,
          updatedById: user.id,
        },
      });

      await createAuditEntry({
        entityType: AuditEntityType.setting,
        entityId: SINGLETON_ID,
        userId: user.id,
        action: AuditAction.updated,
        fieldChanged: "proposal_defaults",
        description: "Actualizó los defaults del generador de propuestas",
        metadata: {
          before: existing?.data ?? null,
          after: body.data,
        } as unknown as Prisma.InputJsonValue,
      });

      return {
        seeded: true,
        data: row.data,
        coverOverlay: row.coverOverlay,
        coverPdfAttachmentId: row.coverPdfAttachmentId,
        updatedAt: serializeDate(row.updatedAt),
      };
    },
  );
}

// Zod del `snapshot` de una versión publicada (Fase E, sección 6 de la spec).
// Contiene todo lo necesario para regenerar el PDF idéntico sin depender del
// estado actual del sistema. Se valida al construirlo (atrapa drift) y al
// leerlo para regenerar.

import { z } from "zod";

import { draftDataPublishSchema } from "./draft.schema.js";

// Config del overlay de la tapa (mismo shape que ProposalDefaults.coverOverlay).
const overlayTextSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    fontSize: z.number(),
    color: z.string(),
    fontWeight: z.enum(["regular", "bold"]),
  })
  .strict();

export const snapshotCoverOverlaySchema = z
  .object({
    clientName: overlayTextSchema,
    city: overlayTextSchema,
    date: overlayTextSchema,
  })
  .strict();

export const SNAPSHOT_VERSION = 1;
// Informativo (nadie lo parsea): sirve para saber con qué generación de
// plantillas se emitió un PDF. "b2b" = ya existen las dos variantes.
export const TEMPLATE_VERSION = "fase-C-post-D-b2b";

export const snapshotSchema = z
  .object({
    // Versión del schema del snapshot, para migraciones futuras.
    version: z.literal(SNAPSHOT_VERSION),
    // Inputs del borrador tal cual al publicar.
    data: draftDataPublishSchema,
    // Defaults resueltos al momento: números, algún string de marca y algún
    // array de números (ej. factoresGeneracionMensual, 12 factores estacionales).
    defaults: z.record(z.string(), z.union([z.number(), z.string(), z.array(z.number())])),
    // Config de la tapa al momento.
    coverOverlay: snapshotCoverOverlaySchema,
    coverPdfAttachmentId: z.string().nullable(),
    // Salida completa de la calculadora (Fase B). Se guarda para no re-correrla
    // al regenerar; su shape es amplio (100+ campos) así que no se valida campo
    // a campo, solo que sea un objeto.
    calc: z.record(z.string(), z.unknown()),
    templateVersion: z.string(),
    renderedAt: z.string(), // ISO 8601
    // Asesor que publicó (Fase F). Opcional: las versiones publicadas antes de
    // Fase F no lo tienen y caen al fallback (publishedBy) al regenerar.
    advisor: z
      .object({
        name: z.string(),
        jobTitle: z.string().nullable(),
        email: z.string(),
      })
      .optional(),
  })
  .strict();

export type ProposalV2Snapshot = z.infer<typeof snapshotSchema>;

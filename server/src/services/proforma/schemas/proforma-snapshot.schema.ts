// Snapshot inmutable de una versión publicada de proforma. Todo lo necesario para
// reproducir el PDF (los datos + versión de template).

import { z } from "zod";

import { proformaDataPublishSchema } from "./proforma.schema.js";

export const PROFORMA_SNAPSHOT_VERSION = 1;
export const PROFORMA_TEMPLATE_VERSION = 1;

export const proformaSnapshotSchema = z
  .object({
    version: z.number(),
    templateVersion: z.number(),
    data: proformaDataPublishSchema,
    renderedAt: z.string(),
  })
  .strict();

export type ProformaSnapshot = z.infer<typeof proformaSnapshotSchema>;

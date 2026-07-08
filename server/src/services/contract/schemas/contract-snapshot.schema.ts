// Snapshot inmutable de una versión publicada de contrato. Todo lo necesario para
// reproducir el PDF (los datos del contrato + versión de template). A diferencia
// de propuestas, el contrato no tiene `calc` (no hay calculadora).

import { z } from "zod";

import { contractDataPublishSchema } from "./contract.schema.js";

export const CONTRACT_SNAPSHOT_VERSION = 1;
export const CONTRACT_TEMPLATE_VERSION = 1;

export const contractSnapshotSchema = z
  .object({
    version: z.number(),
    templateVersion: z.number(),
    data: contractDataPublishSchema,
    renderedAt: z.string(),
  })
  .strict();

export type ContractSnapshot = z.infer<typeof contractSnapshotSchema>;

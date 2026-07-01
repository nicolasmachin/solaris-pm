// Pipeline "cuerpo full (Puppeteer) + tapa (overlay) concatenados" de Fase D,
// extraído del route de preview para reusarlo desde el service de versiones
// (Fase E) sin duplicar la lógica ni arriesgar drift.

import { promises as fsPromises } from "node:fs";

import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { getStoredFilePath } from "../file-storage.service.js";
import { concatPdfs } from "./concatPdfs.js";
import { applyCoverOverlay, type CoverOverlayConfig } from "./coverOverlay.js";
import { generateProposalFullPdf } from "./pdfGenerator.js";
import type { ProposalCalculated, ProposalData } from "./types.js";

// Validación de borde del overlay guardado en el singleton (Json). Si está
// malformado preferimos generar sin tapa antes que romper toda la propuesta.
const overlayTextSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    fontSize: z.number(),
    color: z.string(),
    fontWeight: z.enum(["regular", "bold"]),
  })
  .strict();

const coverOverlayConfigSchema = z
  .object({
    clientName: overlayTextSchema,
    city: overlayTextSchema,
    date: overlayTextSchema,
  })
  .strict();

// Lee la tapa configurada en el singleton y su overlay. Devuelve null (→ sin
// tapa, la propuesta arranca por la carta) si no hay tapa cargada, si el overlay
// está malformado o si el archivo físico no está disponible.
export async function loadCoverForProposal(): Promise<{
  bytes: Buffer;
  config: CoverOverlayConfig;
} | null> {
  const row = await prisma.proposalDefaults.findUnique({
    where: { id: "singleton" },
    select: { coverOverlay: true, coverPdfAttachment: { select: { url: true } } },
  });
  const url = row?.coverPdfAttachment?.url;
  if (!url) return null;

  const parsed = coverOverlayConfigSchema.safeParse(row?.coverOverlay);
  if (!parsed.success) return null;

  try {
    const bytes = await fsPromises.readFile(getStoredFilePath(url));
    return { bytes, config: parsed.data };
  } catch {
    return null;
  }
}

// Cuerpo (Puppeteer) + tapa (con overlay) si está configurada. Si no hay tapa,
// devuelve solo el cuerpo sin romper.
export async function generateFullPdfWithCover(ctx: {
  data: ProposalData;
  calculated: ProposalCalculated;
}): Promise<Buffer> {
  const body = await generateProposalFullPdf(ctx);
  const cover = await loadCoverForProposal();
  if (!cover) return body;

  const overlaid = await applyCoverOverlay(cover.bytes, cover.config, {
    clientName: ctx.data.cliente.nombre,
    city: ctx.data.cliente.ciudad,
    date: ctx.calculated.fechaTextoLargo,
  });
  return concatPdfs(overlaid, body);
}

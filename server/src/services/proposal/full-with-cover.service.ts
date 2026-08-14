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
import type { RenderContext } from "./template.js";
import type { ProposalCalculated, ProposalData, ProposalVariante } from "./types.js";

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
//
// Para la variante EMPRESA usa la tapa propia si está cargada y **cae a la
// residencial si no**: así el cotizador B2B produce un PDF presentable desde el
// día uno, antes de que administración suba su tapa.
export async function loadCoverForProposal(
  variante: ProposalVariante = "RESIDENCIAL",
): Promise<{
  bytes: Buffer;
  config: CoverOverlayConfig;
  usedEmpresaCover: boolean;
} | null> {
  const row = await prisma.proposalDefaults.findUnique({
    where: { id: "singleton" },
    select: {
      coverOverlay: true,
      coverPdfAttachment: { select: { url: true } },
      coverEmpresaOverlay: true,
      coverEmpresaPdfAttachment: { select: { url: true } },
    },
  });
  if (!row) return null;

  const usarEmpresa = variante === "EMPRESA" && Boolean(row.coverEmpresaPdfAttachment?.url);
  const url = usarEmpresa ? row.coverEmpresaPdfAttachment?.url : row.coverPdfAttachment?.url;
  if (!url) return null;

  // Si la tapa de empresa no trae overlay propio, se reusan las coordenadas de
  // la residencial (misma plantilla de Canva, distinto arte).
  const rawOverlay = usarEmpresa ? (row.coverEmpresaOverlay ?? row.coverOverlay) : row.coverOverlay;
  const parsed = coverOverlayConfigSchema.safeParse(rawOverlay);
  if (!parsed.success) return null;

  try {
    const bytes = await fsPromises.readFile(getStoredFilePath(url));
    return { bytes, config: parsed.data, usedEmpresaCover: usarEmpresa };
  } catch {
    return null;
  }
}

// Cuerpo (Puppeteer) + tapa (con overlay) si está configurada. Si no hay tapa,
// devuelve solo el cuerpo sin romper.
export async function generateFullPdfWithCover(ctx: RenderContext): Promise<Buffer> {
  const body = await generateProposalFullPdf(ctx);
  const variante = ctx.data.variante ?? "RESIDENCIAL";
  const cover = await loadCoverForProposal(variante);
  if (!cover) return body;

  // En B2B el nombre que va en la tapa es el de la empresa, no el del contacto.
  const nombreTapa =
    variante === "EMPRESA" && ctx.data.empresa?.razonSocial
      ? ctx.data.empresa.razonSocial
      : ctx.data.cliente.nombre;

  const overlaid = await applyCoverOverlay(cover.bytes, cover.config, {
    clientName: nombreTapa,
    city: ctx.data.cliente.ciudad,
    date: ctx.calculated.fechaTextoLargo,
  });
  return concatPdfs(overlaid, body);
}

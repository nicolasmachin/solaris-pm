// Render compartido SVG → PDF de una página: rasteriza el SVG con resvg-js y
// embebe el PNG en un PDF con pdf-lib.
//
// Lo usan el generador de unifilares y el de láminas de gabinete. Las fuentes
// Roboto viven en `unifilarSvg/fonts/` (primer consumidor) y se cargan
// explícitamente porque el container Node no trae fuentes del sistema: sin
// esto, el PDF sale sin texto.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";

const A4_PT_W = 595.28;
const A4_PT_H = 841.89;

// Cuando corre vía tsx, __dirname = .../src/services; desde dist/,
// .../dist/services. En ambos casos las fuentes se buscan relativo al source.
function fontPaths(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "unifilarSvg", "fonts"),
    join(here, "..", "..", "src", "services", "unifilarSvg", "fonts"),
  ];
  for (const dir of candidates) {
    const reg = join(dir, "Roboto-Regular.ttf");
    if (existsSync(reg)) {
      const bold = join(dir, "Roboto-Bold.ttf");
      return existsSync(bold) ? [reg, bold] : [reg];
    }
  }
  return [];
}

export interface SvgToPdfOptions {
  /** Ancho del SVG en px (su viewBox), para calcular la proporción. */
  pageW: number;
  /** Alto del SVG en px. */
  pageH: number;
  /** Factor de rasterizado; 2 = ~192dpi sobre un SVG pensado a 96dpi. */
  scale?: number;
}

/** Devuelve un PDF A4 (vertical u horizontal según la proporción del SVG). */
export async function renderSvgToPdf(
  svg: string,
  options: SvgToPdfOptions,
): Promise<Uint8Array> {
  return await renderSvgsToPdf([svg], options);
}

/** Igual, con una página por SVG. Todas las páginas comparten dimensiones. */
export async function renderSvgsToPdf(
  svgs: string[],
  { pageW, pageH, scale = 2 }: SvgToPdfOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  // El SVG apaisado va a A4 horizontal; el vertical, a A4 vertical.
  const landscape = pageW > pageH;
  const ptW = landscape ? A4_PT_H : A4_PT_W;
  const ptH = landscape ? A4_PT_W : A4_PT_H;

  // Encajar manteniendo proporción, centrado.
  const aspect = pageW / pageH;
  let drawW = ptW;
  let drawH = ptW / aspect;
  if (drawH > ptH) {
    drawH = ptH;
    drawW = ptH * aspect;
  }

  const fonts = fontPaths();
  for (const svg of svgs) {
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: pageW * scale },
      font: { fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: "Roboto" },
    });
    const img = await pdf.embedPng(resvg.render().asPng());
    const page = pdf.addPage([ptW, ptH]);
    page.drawImage(img, {
      x: (ptW - drawW) / 2,
      y: (ptH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  return await pdf.save();
}

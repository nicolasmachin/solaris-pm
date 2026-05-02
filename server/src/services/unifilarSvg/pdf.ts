// Conversión SVG → PDF de una página A4. Renderiza el SVG a PNG con resvg-js
// y lo embebe en un PDF con pdf-lib.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";

import { PAGE_H, PAGE_W } from "./layout.js";

const A4_PT_W = 595.28;
const A4_PT_H = 841.89;

// Roboto Regular/Bold están bundleados en `./fonts/`. resvg necesita TTFs
// porque el container Node no trae fuentes del sistema; sin esto, el PDF
// renderiza sin texto. El `defaultFontFamily` actúa como fallback cuando el
// SVG usa "Arial, Helvetica, sans-serif" (resvg no las encuentra y cae acá).
function fontPaths(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  // Cuando corre vía tsx, here = .../src/services/unifilarSvg
  // Cuando corre desde dist/, here = .../dist/services/unifilarSvg
  // En ambos casos buscamos el directorio fonts/ relativo al source.
  const candidates = [
    join(here, "fonts"),
    join(here, "..", "..", "..", "src", "services", "unifilarSvg", "fonts"),
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

export async function svgToPdf(svg: string): Promise<Uint8Array> {
  const scale = 2;
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: PAGE_W * scale },
    font: {
      fontFiles: fontPaths(),
      loadSystemFonts: false,
      defaultFontFamily: "Roboto",
    },
  });
  const png = resvg.render().asPng();

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4_PT_W, A4_PT_H]);
  const img = await pdf.embedPng(png);

  // Mantener proporción del SVG original (794×1123) dentro de A4 con margen 0.
  const aspect = PAGE_W / PAGE_H;
  let drawW = A4_PT_W;
  let drawH = A4_PT_W / aspect;
  if (drawH > A4_PT_H) {
    drawH = A4_PT_H;
    drawW = A4_PT_H * aspect;
  }
  page.drawImage(img, {
    x: (A4_PT_W - drawW) / 2,
    y: (A4_PT_H - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  return await pdf.save();
}

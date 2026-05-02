// Conversión SVG → PDF de una página A4. Renderiza el SVG a PNG con resvg-js
// y lo embebe en un PDF con pdf-lib.

import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";

import { PAGE_H, PAGE_W } from "./layout.js";

const A4_PT_W = 595.28;
const A4_PT_H = 841.89;

export async function svgToPdf(svg: string): Promise<Uint8Array> {
  // Render SVG → PNG (alta resolución para que el PDF salga nítido).
  const scale = 2; // 2× = ~192dpi efectivo
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: PAGE_W * scale },
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

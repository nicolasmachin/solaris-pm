// Conversión SVG → PDF del unifilar. El render vive en `svgPdf.service.ts`,
// compartido con las láminas de gabinete.

import { renderSvgToPdf } from "../svgPdf.service.js";

import { PAGE_H, PAGE_W } from "./layout.js";

export async function svgToPdf(svg: string): Promise<Uint8Array> {
  return await renderSvgToPdf(svg, { pageW: PAGE_W, pageH: PAGE_H });
}

// Lámina de gabinete → PDF A4 vertical. El render vive en `svgPdf.service.ts`.

import { renderSvgToPdf } from "../svgPdf.service.js";

import { PAGE_H, PAGE_W } from "./layout.js";

export async function gabineteSvgToPdf(svg: string): Promise<Uint8Array> {
  return await renderSvgToPdf(svg, { pageW: PAGE_W, pageH: PAGE_H });
}

// Lámina de gabinete → PDF A4 vertical, una página por hoja. El render vive en
// `svgPdf.service.ts`, compartido con el generador de unifilares.

import { renderSvgsToPdf } from "../svgPdf.service.js";

import { PAGE_H, PAGE_W } from "./layout.js";

export async function gabineteSvgsToPdf(hojas: string[]): Promise<Uint8Array> {
  return await renderSvgsToPdf(hojas, { pageW: PAGE_W, pageH: PAGE_H });
}

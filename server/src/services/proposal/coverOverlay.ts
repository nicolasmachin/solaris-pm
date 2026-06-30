// Overlay de texto sobre la tapa (PDF de Canva) para Propuestas v2.
// Superpone 3 datos variables (nombre cliente, ciudad, fecha) en coordenadas
// configurables. La tapa es un PDF A4 vertical de 1 página (validado al subirla).

import { PDFDocument, rgb, StandardFonts, type PDFFont, type RGB } from "pdf-lib";

export interface CoverOverlayText {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontWeight: "regular" | "bold";
}

export interface CoverOverlayConfig {
  clientName: CoverOverlayText;
  city: CoverOverlayText;
  date: CoverOverlayText;
}

export interface CoverOverlayData {
  clientName: string;
  city: string;
  date: string; // ya formateada, ej. "19 de junio de 2026"
}

// Parsea "#RRGGBB" o "#RGB" al color rgb() de pdf-lib (componentes 0..1).
// Si el formato no es válido, cae a negro para no romper la generación.
function parseHexColor(hex: string): RGB {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return rgb(0, 0, 0);
  return rgb(
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  );
}

/**
 * Aplica el overlay de texto sobre el PDF de tapa y devuelve los bytes del PDF
 * resultante (sigue siendo 1 página A4).
 */
export async function applyCoverOverlay(
  coverPdfBytes: Buffer,
  config: CoverOverlayConfig,
  data: CoverOverlayData,
): Promise<Buffer> {
  const pdf = await PDFDocument.load(coverPdfBytes, { ignoreEncryption: true });
  const page = pdf.getPage(0);
  const pageHeight = page.getHeight();

  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const fields: Array<{ cfg: CoverOverlayText; text: string }> = [
    { cfg: config.clientName, text: data.clientName },
    { cfg: config.city, text: data.city },
    { cfg: config.date, text: data.date },
  ];

  for (const { cfg, text } of fields) {
    if (!text) continue;
    const font: PDFFont = cfg.fontWeight === "bold" ? fontBold : fontRegular;
    // IMPORTANTE — conversión de coordenadas:
    // El Admin configura (x, y) desde la esquina SUPERIOR izquierda (intuitivo
    // para diseño), pero pdf-lib dibuja desde la esquina INFERIOR izquierda y
    // drawText ancla en la baseline del texto. Conversión:
    //   y_pdf = alto_pagina - y_config - fontSize
    // (restar fontSize baja la baseline para que el texto quede por debajo de la
    // coordenada y, como espera el usuario).
    const yPdf = pageHeight - cfg.y - cfg.fontSize;
    page.drawText(text, {
      x: cfg.x,
      y: yPdf,
      size: cfg.fontSize,
      font,
      color: parseHexColor(cfg.color),
    });
  }

  const out = await pdf.save();
  return Buffer.from(out);
}

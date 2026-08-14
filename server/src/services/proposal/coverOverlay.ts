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

// Margen que se le respeta al borde derecho de la tapa al acomodar un texto
// largo. En puntos PDF (72 pt = 1 pulgada).
const MARGEN_DERECHO_PT = 34;
// Hasta dónde se permite encoger el cuerpo antes de pasar a dos líneas.
const ESCALA_MINIMA = 0.7;
// Separación entre las dos líneas, como múltiplo del cuerpo.
const INTERLINEADO = 1.12;

/**
 * Acomoda un texto que no entra en el ancho disponible.
 *
 * Existe porque las coordenadas y el cuerpo del overlay se configuran una sola
 * vez, pensados para un nombre de persona; una razón social como "Cooperativa
 * Agraria del Litoral S.A." se salía de la página. El orden de preferencia es:
 * dejarlo como está → encogerlo un poco → partirlo en dos líneas → recortarlo.
 * Recortar una razón social es el último recurso: se prefiere una segunda línea.
 */
export function acomodarTexto(
  texto: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): { lineas: string[]; size: number } {
  const ancho = (t: string, s: number) => font.widthOfTextAtSize(t, s);
  if (maxWidth <= 0 || ancho(texto, size) <= maxWidth) return { lineas: [texto], size };

  // 1) Encoger, pero poco: por debajo de ESCALA_MINIMA el texto se ve raquítico
  //    contra el arte de la tapa.
  const proporcional = (size * maxWidth) / ancho(texto, size);
  if (proporcional >= size * ESCALA_MINIMA) return { lineas: [texto], size: proporcional };

  // 2) Dos líneas partiendo por palabras, con el cuerpo apenas reducido.
  const sizeDosLineas = size * ESCALA_MINIMA;
  const palabras = texto.split(" ").filter(Boolean);
  if (palabras.length > 1) {
    let corte = -1;
    for (let i = 1; i < palabras.length; i++) {
      const a = palabras.slice(0, i).join(" ");
      const b = palabras.slice(i).join(" ");
      if (ancho(a, sizeDosLineas) <= maxWidth && ancho(b, sizeDosLineas) <= maxWidth) {
        // Se prefiere el corte más equilibrado entre las dos líneas.
        if (corte === -1 || Math.abs(ancho(a, sizeDosLineas) - ancho(b, sizeDosLineas)) <
            Math.abs(
              ancho(palabras.slice(0, corte).join(" "), sizeDosLineas) -
                ancho(palabras.slice(corte).join(" "), sizeDosLineas),
            )) {
          corte = i;
        }
      }
    }
    if (corte > 0) {
      return {
        lineas: [palabras.slice(0, corte).join(" "), palabras.slice(corte).join(" ")],
        size: sizeDosLineas,
      };
    }
  }

  // 3) Última red: una palabra sola larguísima o dos líneas que igual no entran.
  let recortado = texto;
  while (recortado.length > 1 && ancho(`${recortado}…`, sizeDosLineas) > maxWidth) {
    recortado = recortado.slice(0, -1);
  }
  return { lineas: [`${recortado.trimEnd()}…`], size: sizeDosLineas };
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
  const pageWidth = page.getWidth();

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
    const acomodado = acomodarTexto(
      text,
      font,
      cfg.fontSize,
      pageWidth - cfg.x - MARGEN_DERECHO_PT,
    );
    // La baseline se calcula con el cuerpo CONFIGURADO, no con el ajustado, para
    // que un nombre largo no se despegue de la línea donde va el corto. Cuando
    // hay dos líneas, la primera sube medio interlineado para que el bloque
    // quede centrado sobre esa misma línea.
    const yBase = pageHeight - cfg.y - cfg.fontSize;
    const salto = acomodado.size * INTERLINEADO;
    const yPrimera = acomodado.lineas.length > 1 ? yBase + salto / 2 : yBase;
    acomodado.lineas.forEach((linea, i) => {
      page.drawText(linea, {
        x: cfg.x,
        y: yPrimera - i * salto,
        size: acomodado.size,
        font,
        color: parseHexColor(cfg.color),
      });
    });
  }

  const out = await pdf.save();
  return Buffer.from(out);
}

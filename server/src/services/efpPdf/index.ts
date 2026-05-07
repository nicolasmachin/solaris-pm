// Genera el PDF del Proyecto Final de Ingeniería con el diseño Voltia:
// header con wordmark + tagline + línea azul, hero del proyecto en página 1
// con 4 cards de datos clave del sistema, secciones con número grande en azul
// + línea azul separadora, footer azul con paginación. Solo paleta azul +
// blanco + grises, sentence case, dos pesos de fuente (regular + bold).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";

import type { EFPSectionKey } from "../efp.service.js";
import { EFP_SECTION_TITLES } from "../efp.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONTS_DIR = path.resolve(__dirname, "..", "unifilarSvg", "fonts");
const ROBOTO_REGULAR = path.join(FONTS_DIR, "Roboto-Regular.ttf");
const ROBOTO_BOLD = path.join(FONTS_DIR, "Roboto-Bold.ttf");

// Paleta — azul Voltia + blanco + grises (sin otros colores).
const COLOR_BRAND = "#2438D6";
const COLOR_TEXT = "#1a1a1a";
const COLOR_TEXT_SECONDARY = "#444444";
const COLOR_TEXT_MUTED = "#666666";
const COLOR_LABEL = "#888888";
const COLOR_DIVIDER = "#eeeeee";
const COLOR_CARD_BG = "#f8f9fc";

// Geometría de página A4 (en pt). 1mm ≈ 2.835pt.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56; // ≈ 20mm
const HEADER_TOP = 24;
const HEADER_BOTTOM = 16; // espacio entre el header y la línea
const HEADER_LINE_W = 3;
const HEADER_BAND_H = 60; // alto del wordmark + doc info, antes de la línea
const TOP_MARGIN = HEADER_TOP + HEADER_BAND_H + HEADER_BOTTOM + HEADER_LINE_W + 12;
const FOOTER_BAND_H = 22;
const BOTTOM_MARGIN = FOOTER_BAND_H + 14;

const CONTENT_W = PAGE_W - MARGIN_X * 2;

const SECTION_KEYS_ORDERED: EFPSectionKey[] = [
  "datosGenerales",
  "resumenEjecutivo",
  "analisisSitio",
  "equipamiento",
  "disenoElectrico",
  "disenoMecanico",
  "anexos",
];

export interface EFPPdfInputs {
  cliente: string;
  proyectoCode: string;
  ubicacion: string;
  clientAddress: string | null;
  clientEmail: string | null;
  capacidadKwp: number;
  paneles: { cantidad: string | null; potenciaW: string | null };
  inversor: string | null;
  uteCaso: string | null;
  uteEtapa: string | null;
  uteStatus: string | null;
  proyectista: string | null;
  version: number;
  status: string;
  generatedAt: Date;
  changesFromPrevious: string | null;
  content: Record<string, string>;
  attachments: { filename: string; description: string | null; category: string | null }[];
}

export function generateEFPPdf(inputs: EFPPdfInputs): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: TOP_MARGIN, bottom: BOTTOM_MARGIN, left: MARGIN_X, right: MARGIN_X },
      bufferPages: true,
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (fs.existsSync(ROBOTO_REGULAR)) doc.registerFont("Roboto", ROBOTO_REGULAR);
    if (fs.existsSync(ROBOTO_BOLD)) doc.registerFont("Roboto-Bold", ROBOTO_BOLD);
    const FONT = fs.existsSync(ROBOTO_REGULAR) ? "Roboto" : "Helvetica";
    const FONT_BOLD = fs.existsSync(ROBOTO_BOLD) ? "Roboto-Bold" : "Helvetica-Bold";

    // Header se dibuja en cada página nueva (incluida la primera).
    doc.on("pageAdded", () => drawPageHeader(doc, inputs, FONT, FONT_BOLD));

    doc.addPage();

    drawProjectHero(doc, inputs, FONT, FONT_BOLD);

    if (inputs.changesFromPrevious && inputs.changesFromPrevious.trim().length > 0) {
      drawChangesBox(doc, inputs.changesFromPrevious, FONT, FONT_BOLD);
    }

    SECTION_KEYS_ORDERED.forEach((key, idx) => {
      drawSection(doc, idx + 1, EFP_SECTION_TITLES[key], inputs.content[key] ?? "", FONT, FONT_BOLD);
    });

    if (inputs.attachments.length > 0) {
      drawAttachments(doc, inputs.attachments, FONT, FONT_BOLD);
    }

    // Pasada final: dibujar footer en cada página con número/total.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      drawPageFooter(doc, i + 1, range.count, FONT, FONT_BOLD);
    }

    doc.end();
  });
}

function drawPageHeader(
  doc: PDFKit.PDFDocument,
  inputs: EFPPdfInputs,
  FONT: string,
  FONT_BOLD: string,
): void {
  const top = HEADER_TOP;

  // Brand: VOLTIA + tagline.
  doc
    .font(FONT_BOLD)
    .fontSize(16)
    .fillColor(COLOR_BRAND)
    .text("VOLTIA", MARGIN_X, top, { lineBreak: false, characterSpacing: 0.32 });
  doc
    .font(FONT)
    .fontSize(8)
    .fillColor(COLOR_TEXT_MUTED)
    .text("SOLUCIONES ELÉCTRICAS", MARGIN_X, top + 22, {
      lineBreak: false,
      characterSpacing: 0.8,
    });

  // Doc info a la derecha.
  const dateStr = inputs.generatedAt.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLOR_LABEL)
    .text("PROYECTO FINAL DE INGENIERÍA", MARGIN_X, top, {
      width: CONTENT_W,
      align: "right",
      characterSpacing: 0.5,
    });
  doc
    .font(FONT)
    .fontSize(10)
    .fillColor(COLOR_TEXT_SECONDARY)
    .text(`Versión ${inputs.version} · ${inputs.status} · ${dateStr}`, MARGIN_X, top + 14, {
      width: CONTENT_W,
      align: "right",
    });

  // Línea azul de 3pt bajo el header.
  const lineY = top + HEADER_BAND_H;
  doc
    .save()
    .lineWidth(HEADER_LINE_W)
    .strokeColor(COLOR_BRAND)
    .moveTo(MARGIN_X, lineY)
    .lineTo(PAGE_W - MARGIN_X, lineY)
    .stroke()
    .restore();
}

function drawPageFooter(
  doc: PDFKit.PDFDocument,
  pageNum: number,
  totalPages: number,
  FONT: string,
  _FONT_BOLD: string,
): void {
  const top = PAGE_H - FOOTER_BAND_H;
  doc.save();
  doc.rect(0, top, PAGE_W, FOOTER_BAND_H).fill(COLOR_BRAND);
  doc
    .font(FONT)
    .fontSize(8)
    .fillColor("#ffffff")
    .text("VOLTIA · PROYECTO FINAL DE INGENIERÍA", MARGIN_X, top + 7, {
      lineBreak: false,
      characterSpacing: 0.8,
    });
  doc
    .font(FONT)
    .fontSize(8)
    .fillColor("#ffffff")
    .text(`${pageNum} / ${totalPages}`, MARGIN_X, top + 7, {
      width: CONTENT_W,
      align: "right",
      lineBreak: false,
    });
  doc.restore();
}

function drawProjectHero(
  doc: PDFKit.PDFDocument,
  inputs: EFPPdfInputs,
  FONT: string,
  FONT_BOLD: string,
): void {
  const x = MARGIN_X;
  doc.x = x;
  doc.y = TOP_MARGIN;

  // Label small "PROYECTO".
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLOR_LABEL)
    .text("PROYECTO", x, doc.y, { characterSpacing: 0.9, lineBreak: false });
  doc.moveDown(0.25);

  // Cliente — h1.
  doc.font(FONT_BOLD).fontSize(24).fillColor(COLOR_TEXT).text(inputs.cliente, x, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.15);

  // Meta del proyecto (código + dirección).
  const metaParts = [inputs.proyectoCode];
  if (inputs.clientAddress) metaParts.push(inputs.clientAddress);
  metaParts.push(inputs.ubicacion);
  doc
    .font(FONT)
    .fontSize(11)
    .fillColor(COLOR_TEXT_MUTED)
    .text(metaParts.join("  ·  "), x, doc.y, { width: CONTENT_W });

  doc.moveDown(1);

  // Datos clave del sistema — 4 cards.
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLOR_LABEL)
    .text("DATOS CLAVE DEL SISTEMA", x, doc.y, { characterSpacing: 0.9, lineBreak: false });
  doc.moveDown(0.4);

  const cardsTop = doc.y;
  const cardGap = 8;
  const cardW = (CONTENT_W - cardGap * 3) / 4;
  const cardH = 56;

  drawKeyCard(doc, x + 0 * (cardW + cardGap), cardsTop, cardW, cardH, "POTENCIA", `${inputs.capacidadKwp}`, "kWp", FONT, FONT_BOLD);
  drawKeyCard(
    doc,
    x + 1 * (cardW + cardGap),
    cardsTop,
    cardW,
    cardH,
    "PANELES",
    inputs.paneles.cantidad ?? "—",
    inputs.paneles.potenciaW ? `× ${inputs.paneles.potenciaW}W` : "",
    FONT,
    FONT_BOLD,
  );
  drawKeyCard(doc, x + 2 * (cardW + cardGap), cardsTop, cardW, cardH, "INVERSOR", inputs.inversor ?? "—", "", FONT, FONT_BOLD, { mono: false, large: false });
  drawKeyCard(doc, x + 3 * (cardW + cardGap), cardsTop, cardW, cardH, "CASO UTE", inputs.uteCaso ?? "—", "", FONT, FONT_BOLD, { mono: true, large: false });

  doc.y = cardsTop + cardH + 12;

  // Meta-footer del hero (cliente, proyectista, etapa UTE).
  const metaItems: string[] = [];
  if (inputs.clientEmail) metaItems.push(`Cliente: ${inputs.clientEmail}`);
  if (inputs.proyectista) metaItems.push(`Proyectista: ${inputs.proyectista}`);
  if (inputs.uteEtapa) {
    const ute = inputs.uteStatus ? `${inputs.uteEtapa} · ${inputs.uteStatus}` : inputs.uteEtapa;
    metaItems.push(`Etapa UTE: ${ute}`);
  }
  if (metaItems.length > 0) {
    doc
      .save()
      .lineWidth(0.5)
      .strokeColor(COLOR_DIVIDER)
      .moveTo(x, doc.y)
      .lineTo(x + CONTENT_W, doc.y)
      .stroke()
      .restore();
    doc.y += 8;
    doc
      .font(FONT)
      .fontSize(10)
      .fillColor(COLOR_TEXT_MUTED)
      .text(metaItems.join("    ·    "), x, doc.y, { width: CONTENT_W });
    doc.moveDown(0.5);
  }
  doc.moveDown(0.5);
}

function drawKeyCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  unit: string,
  FONT: string,
  FONT_BOLD: string,
  opts: { mono?: boolean; large?: boolean } = {},
): void {
  const large = opts.large !== false;
  // Fondo + borde izquierdo azul de 3pt.
  doc.save();
  doc.rect(x, y, w, h).fill(COLOR_CARD_BG);
  doc.rect(x, y, 3, h).fill(COLOR_BRAND);
  doc.restore();

  const padX = 10;
  const innerX = x + padX;
  const innerW = w - padX * 2;

  doc
    .font(FONT)
    .fontSize(8)
    .fillColor(COLOR_LABEL)
    .text(label, innerX, y + 8, { width: innerW, characterSpacing: 0.5, lineBreak: false });

  // Valor principal: si es "large" (números grandes), 18pt bold; si es texto largo (inversor/UTE), 11pt.
  if (large && value !== "—") {
    doc
      .font(FONT_BOLD)
      .fontSize(18)
      .fillColor(COLOR_TEXT)
      .text(value, innerX, y + 22, { width: innerW, lineBreak: false });
    if (unit) {
      // Calcular ancho del valor para poner la unidad al lado.
      const valueWidth = doc.widthOfString(value);
      doc
        .font(FONT)
        .fontSize(10)
        .fillColor(COLOR_LABEL)
        .text(` ${unit}`, innerX + valueWidth, y + 30, {
          width: innerW - valueWidth,
          lineBreak: false,
        });
    }
  } else {
    // Texto de varios chars (modelo de inversor, número de caso UTE).
    doc
      .font(opts.mono ? FONT : FONT_BOLD)
      .fontSize(11)
      .fillColor(COLOR_TEXT)
      .text(value, innerX, y + 24, {
        width: innerW,
        lineBreak: true,
        height: h - 30,
        ellipsis: true,
      });
  }
}

function drawChangesBox(
  doc: PDFKit.PDFDocument,
  changes: string,
  FONT: string,
  FONT_BOLD: string,
): void {
  ensureSpace(doc, 60);
  const x = MARGIN_X;
  const y = doc.y;
  const text = stripMarkdown(changes.trim());

  // Estimar altura del bloque renderizando el texto en una posición temporal.
  doc.font(FONT).fontSize(10);
  const textHeight = doc.heightOfString(text, { width: CONTENT_W - 24 });
  const boxHeight = textHeight + 30;

  doc.save();
  doc.rect(x, y, CONTENT_W, boxHeight).fill(COLOR_CARD_BG);
  doc.rect(x, y, 3, boxHeight).fill(COLOR_BRAND);
  doc.restore();

  doc
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(COLOR_BRAND)
    .text("CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR", x + 12, y + 10, {
      characterSpacing: 0.5,
      lineBreak: false,
    });
  doc
    .font(FONT)
    .fontSize(10)
    .fillColor(COLOR_TEXT_SECONDARY)
    .text(text, x + 12, y + 24, { width: CONTENT_W - 24, lineGap: 2 });

  doc.y = y + boxHeight + 12;
}

function drawSection(
  doc: PDFKit.PDFDocument,
  number: number,
  title: string,
  content: string,
  FONT: string,
  FONT_BOLD: string,
): void {
  ensureSpace(doc, 80);
  const x = MARGIN_X;
  const headerTop = doc.y;

  // Número grande en azul.
  doc.font(FONT_BOLD).fontSize(28).fillColor(COLOR_BRAND).text(String(number).padStart(2, "0"), x, headerTop, {
    lineBreak: false,
    width: 50,
  });
  // Título alineado verticalmente con el número (baseline).
  const titleClean = stripSectionPrefix(title);
  doc.font(FONT_BOLD).fontSize(15).fillColor(COLOR_TEXT).text(titleClean, x + 50, headerTop + 10, {
    width: CONTENT_W - 50,
    lineBreak: false,
  });

  const headerBottom = headerTop + 38;
  // Línea azul de 2pt bajo el título.
  doc
    .save()
    .lineWidth(2)
    .strokeColor(COLOR_BRAND)
    .moveTo(x, headerBottom)
    .lineTo(x + CONTENT_W, headerBottom)
    .stroke()
    .restore();

  doc.y = headerBottom + 12;

  // Contenido: texto plano (markdown stripped).
  doc.font(FONT).fontSize(11).fillColor(COLOR_TEXT).text(stripMarkdown(content), x, doc.y, {
    width: CONTENT_W,
    lineGap: 3,
  });

  doc.moveDown(1.2);
}

function drawAttachments(
  doc: PDFKit.PDFDocument,
  attachments: EFPPdfInputs["attachments"],
  FONT: string,
  FONT_BOLD: string,
): void {
  ensureSpace(doc, 60);
  const x = MARGIN_X;
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLOR_LABEL)
    .text("ARCHIVOS ADJUNTOS CARGADOS", x, doc.y, { characterSpacing: 0.9, lineBreak: false });
  doc.moveDown(0.5);

  for (const a of attachments) {
    const tag = a.category ? ` [${a.category}]` : "";
    const desc = a.description ? ` — ${a.description}` : "";
    doc
      .font(FONT)
      .fontSize(10)
      .fillColor(COLOR_TEXT_SECONDARY)
      .text(`•  ${a.filename}${tag}${desc}`, x, doc.y, { width: CONTENT_W, lineGap: 2 });
  }
  doc.moveDown(0.5);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  const bottom = PAGE_H - BOTTOM_MARGIN;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

function stripSectionPrefix(title: string): string {
  // Las EFP_SECTION_TITLES vienen como "1. Datos generales del proyecto" — el
  // número ya lo dibujamos grande aparte, así que sacamos el prefijo "N. ".
  return title.replace(/^\s*\d+\.\s*/, "");
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^[-*]\s+/gm, "•  ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

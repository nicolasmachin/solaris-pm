// Genera el PDF del Proyecto Final de Ingeniería con el diseño Voltia:
// header con wordmark + tagline + URL + línea azul, hero del proyecto en
// página 1 con 4 cards de datos clave, secciones con número grande en azul
// + línea azul separadora, cajas "Pendiente de completar" destacadas, footer
// azul con código de proyecto + cliente + paginación. Solo paleta azul +
// blanco + grises, sentence case en títulos.

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

const COLOR_BRAND = "#2438D6";
const COLOR_BRAND_TINT = "#f0f3ff";
const COLOR_TEXT = "#1a1a1a";
const COLOR_TEXT_SECONDARY = "#444444";
const COLOR_TEXT_MUTED = "#666666";
const COLOR_LABEL = "#888888";
const COLOR_DIVIDER = "#eeeeee";
const COLOR_CARD_BG = "#f8f9fc";

// Geometría A4 (en pt). 1mm ≈ 2.835 pt.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 56;
const HEADER_TOP = 22;
const HEADER_LINE_Y = 56;
const HEADER_LINE_W = 3;
const TOP_MARGIN = HEADER_LINE_Y + HEADER_LINE_W + 14;
const FOOTER_BAND_H = 22;
const BOTTOM_MARGIN = FOOTER_BAND_H + 14;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_BOTTOM_Y = PAGE_H - BOTTOM_MARGIN;

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

    doc.on("pageAdded", () => {
      drawPageHeader(doc, inputs, FONT, FONT_BOLD);
      doc.x = MARGIN_X;
      doc.y = TOP_MARGIN;
    });

    doc.addPage();

    drawProjectHero(doc, inputs, FONT, FONT_BOLD);

    if (inputs.changesFromPrevious && inputs.changesFromPrevious.trim().length > 0) {
      drawChangesBox(doc, inputs.changesFromPrevious, FONT, FONT_BOLD);
    }

    SECTION_KEYS_ORDERED.forEach((key, idx) => {
      drawSection(
        doc,
        idx + 1,
        EFP_SECTION_TITLES[key],
        inputs.content[key] ?? "",
        FONT,
        FONT_BOLD,
      );
    });

    if (inputs.attachments.length > 0) {
      drawAttachments(doc, inputs.attachments, FONT, FONT_BOLD);
    }

    // Footer en cada página (se dibuja al final, cuando ya conozco totalPages).
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      drawPageFooter(doc, inputs, i + 1, range.count, FONT);
    }

    doc.end();
  });
}

// ─── Header / Footer por página ─────────────────────────────────────────────

function drawPageHeader(
  doc: PDFKit.PDFDocument,
  inputs: EFPPdfInputs,
  FONT: string,
  FONT_BOLD: string,
): void {
  doc
    .font(FONT_BOLD)
    .fontSize(14)
    .fillColor(COLOR_BRAND)
    .text("VOLTIA", MARGIN_X, HEADER_TOP, { lineBreak: false, characterSpacing: 0.4 });
  const voltiaWidth = doc.widthOfString("VOLTIA");
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLOR_TEXT_MUTED)
    .text(" · SOLUCIONES ELÉCTRICAS", MARGIN_X + voltiaWidth, HEADER_TOP + 3, {
      lineBreak: false,
      characterSpacing: 0.5,
    });
  doc
    .font(FONT)
    .fontSize(8)
    .fillColor(COLOR_LABEL)
    .text("voltia.com.uy", MARGIN_X, HEADER_TOP + 22, { lineBreak: false });

  doc
    .font(FONT)
    .fontSize(8)
    .fillColor(COLOR_LABEL)
    .text("PROYECTO FINAL DE INGENIERÍA", MARGIN_X, HEADER_TOP, {
      width: CONTENT_W,
      align: "right",
      characterSpacing: 0.6,
      lineBreak: false,
    });
  doc
    .font(FONT)
    .fontSize(10)
    .fillColor(COLOR_TEXT_SECONDARY)
    .text(`v${inputs.version}`, MARGIN_X, HEADER_TOP + 14, {
      width: CONTENT_W,
      align: "right",
      lineBreak: false,
    });

  doc
    .save()
    .lineWidth(HEADER_LINE_W)
    .strokeColor(COLOR_BRAND)
    .moveTo(MARGIN_X, HEADER_LINE_Y)
    .lineTo(PAGE_W - MARGIN_X, HEADER_LINE_Y)
    .stroke()
    .restore();
}

function drawPageFooter(
  doc: PDFKit.PDFDocument,
  inputs: EFPPdfInputs,
  pageNum: number,
  totalPages: number,
  FONT: string,
): void {
  const top = PAGE_H - FOOTER_BAND_H;
  doc.save();
  doc.rect(0, top, PAGE_W, FOOTER_BAND_H).fill(COLOR_BRAND);

  const leftText = `VOLTIA · PROYECTO FINAL DE INGENIERÍA · ${inputs.proyectoCode} · ${inputs.cliente}`;
  doc
    .font(FONT)
    .fontSize(8)
    .fillColor("#ffffff")
    .text(leftText, MARGIN_X, top + 7, {
      width: CONTENT_W - 60,
      lineBreak: false,
      ellipsis: true,
      characterSpacing: 0.4,
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

// ─── Página 1: hero ─────────────────────────────────────────────────────────

function drawProjectHero(
  doc: PDFKit.PDFDocument,
  inputs: EFPPdfInputs,
  FONT: string,
  FONT_BOLD: string,
): void {
  const x = MARGIN_X;
  doc.x = x;
  doc.y = TOP_MARGIN;

  // Título del documento.
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLOR_LABEL)
    .text("PROYECTO FINAL DE INGENIERÍA", x, doc.y, {
      characterSpacing: 0.9,
      lineBreak: false,
    });
  doc.moveDown(0.2);
  // Línea divisoria fina.
  doc
    .save()
    .lineWidth(0.5)
    .strokeColor(COLOR_DIVIDER)
    .moveTo(x, doc.y)
    .lineTo(x + CONTENT_W, doc.y)
    .stroke()
    .restore();
  doc.y += 12;

  // Cliente — h1.
  doc.font(FONT_BOLD).fontSize(24).fillColor(COLOR_TEXT).text(inputs.cliente, x, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.1);

  // Meta del proyecto.
  const metaParts = [inputs.proyectoCode];
  if (inputs.clientAddress) metaParts.push(inputs.clientAddress);
  metaParts.push(inputs.ubicacion);
  doc
    .font(FONT)
    .fontSize(11)
    .fillColor(COLOR_TEXT_MUTED)
    .text(metaParts.join("  ·  "), x, doc.y, { width: CONTENT_W });

  // Versión + status + fecha.
  const dateStr = inputs.generatedAt.toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc
    .font(FONT)
    .fontSize(11)
    .fillColor(COLOR_TEXT_SECONDARY)
    .text(`Versión ${inputs.version} · ${formatStatus(inputs.status)} · ${dateStr}`, x, doc.y, {
      width: CONTENT_W,
    });
  doc.moveDown(1.2);

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
  const cardH = 60;

  drawKeyCard(doc, x + 0 * (cardW + cardGap), cardsTop, cardW, cardH, "POTENCIA", `${inputs.capacidadKwp}`, "kWp", FONT, FONT_BOLD, "large");
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
    "large",
  );
  drawKeyCard(doc, x + 2 * (cardW + cardGap), cardsTop, cardW, cardH, "INVERSOR", inputs.inversor ?? "—", "", FONT, FONT_BOLD, "text");
  drawKeyCard(doc, x + 3 * (cardW + cardGap), cardsTop, cardW, cardH, "CASO UTE", inputs.uteCaso ?? "—", "", FONT, FONT_BOLD, "text");

  doc.y = cardsTop + cardH + 10;

  // Meta-footer (cliente, proyectista, etapa UTE).
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
    doc.moveDown(0.4);
  }
  doc.moveDown(0.4);
}

function formatStatus(s: string): string {
  const map: Record<string, string> = {
    DRAFT: "Borrador",
    REVIEW: "En revisión",
    APPROVED: "Aprobado",
    ARCHIVED: "Archivado",
  };
  return map[s] ?? s;
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
  variant: "large" | "text",
): void {
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
    .text(label, innerX, y + 8, {
      width: innerW,
      characterSpacing: 0.6,
      lineBreak: false,
    });

  if (variant === "large" && value !== "—") {
    doc
      .font(FONT_BOLD)
      .fontSize(20)
      .fillColor(COLOR_TEXT)
      .text(value, innerX, y + 22, { width: innerW, lineBreak: false });
    if (unit) {
      const valueWidth = doc.widthOfString(value);
      doc
        .font(FONT)
        .fontSize(10)
        .fillColor(COLOR_LABEL)
        .text(` ${unit}`, innerX + valueWidth, y + 32, {
          width: innerW - valueWidth,
          lineBreak: false,
        });
    }
  } else {
    doc
      .font(FONT_BOLD)
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

// ─── Cambios respecto a versión anterior ────────────────────────────────────

function drawChangesBox(
  doc: PDFKit.PDFDocument,
  changes: string,
  FONT: string,
  FONT_BOLD: string,
): void {
  ensureSpace(doc, 60);
  const x = MARGIN_X;
  const y = doc.y;
  const text = stripBasicMarkdown(changes.trim());

  doc.font(FONT).fontSize(10);
  const textHeight = doc.heightOfString(text, { width: CONTENT_W - 24 });
  const boxHeight = textHeight + 28;

  doc.save();
  doc.rect(x, y, CONTENT_W, boxHeight).fill(COLOR_BRAND_TINT);
  doc.rect(x, y, 3, boxHeight).fill(COLOR_BRAND);
  doc.restore();

  doc
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(COLOR_BRAND)
    .text("CAMBIOS RESPECTO A LA VERSIÓN ANTERIOR", x + 12, y + 8, {
      characterSpacing: 0.5,
      lineBreak: false,
    });
  doc
    .font(FONT)
    .fontSize(10)
    .fillColor(COLOR_TEXT_SECONDARY)
    .text(text, x + 12, y + 22, { width: CONTENT_W - 24, lineGap: 2 });

  doc.y = y + boxHeight + 10;
}

// ─── Sección con número grande ──────────────────────────────────────────────

function drawSection(
  doc: PDFKit.PDFDocument,
  number: number,
  title: string,
  content: string,
  FONT: string,
  FONT_BOLD: string,
): void {
  ensureSpace(doc, 70);
  const x = MARGIN_X;
  const headerTop = doc.y;

  doc
    .font(FONT_BOLD)
    .fontSize(28)
    .fillColor(COLOR_BRAND)
    .text(String(number).padStart(2, "0"), x, headerTop, { lineBreak: false, width: 50 });
  doc
    .font(FONT_BOLD)
    .fontSize(15)
    .fillColor(COLOR_TEXT)
    .text(stripSectionPrefix(title), x + 50, headerTop + 11, {
      width: CONTENT_W - 50,
      lineBreak: false,
    });

  const headerBottom = headerTop + 36;
  doc
    .save()
    .lineWidth(2)
    .strokeColor(COLOR_BRAND)
    .moveTo(x, headerBottom)
    .lineTo(x + CONTENT_W, headerBottom)
    .stroke()
    .restore();

  doc.y = headerBottom + 10;

  const blocks = parseMarkdownBlocks(content);
  for (const block of blocks) {
    renderBlock(doc, block, FONT, FONT_BOLD);
  }

  doc.moveDown(0.5);
}

// ─── Anexos cargados (lista simple al final del PDF) ────────────────────────

function drawAttachments(
  doc: PDFKit.PDFDocument,
  attachments: EFPPdfInputs["attachments"],
  FONT: string,
  _FONT_BOLD: string,
): void {
  ensureSpace(doc, 50);
  const x = MARGIN_X;
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLOR_LABEL)
    .text("ARCHIVOS ADJUNTOS CARGADOS EN EL SISTEMA", x, doc.y, {
      characterSpacing: 0.7,
      lineBreak: false,
    });
  doc.moveDown(0.4);

  for (const a of attachments) {
    ensureSpace(doc, 16);
    const tag = a.category ? ` [${a.category}]` : "";
    const desc = a.description ? ` — ${a.description}` : "";
    doc
      .font(FONT)
      .fontSize(10)
      .fillColor(COLOR_TEXT_SECONDARY)
      .text(`•  ${a.filename}${tag}${desc}`, x, doc.y, { width: CONTENT_W, lineGap: 2 });
  }
}

// ─── Markdown parser y renderer ─────────────────────────────────────────────

type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "pending"; label: string; items: string[] };

function parseMarkdownBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Línea con solo "**Label:**" — puede iniciar un pending box (si label
    // contiene "pendiente") o un mini-heading (otros labels).
    const labelMatch = line.match(/^\*\*([^*]+?):\*\*\s*$/);
    if (labelMatch) {
      const label = labelMatch[1].trim();
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j].trim();
        if (!next) {
          j++;
          continue;
        }
        const bm = next.match(/^[-*•]\s+(.+)$/);
        if (!bm) break;
        items.push(stripBasicMarkdown(bm[1]));
        j++;
      }
      if (items.length > 0) {
        if (/pendiente/i.test(label)) {
          blocks.push({ kind: "pending", label: `${label}:`, items });
        } else {
          blocks.push({ kind: "h", text: `${label}:` });
          blocks.push({ kind: "ul", items });
        }
        i = j;
        continue;
      }
      blocks.push({ kind: "h", text: `${label}:` });
      i++;
      continue;
    }

    // Heading markdown estándar (#, ##, ...) — lo tratamos como mini-heading.
    const hMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (hMatch) {
      blocks.push({ kind: "h", text: stripBasicMarkdown(hMatch[1]) });
      i++;
      continue;
    }

    // Lista de bullets contigua.
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = lines[i].trim();
        const m = t.match(/^[-*•]\s+(.+)$/);
        if (!m) break;
        items.push(stripBasicMarkdown(m[1]));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Párrafo: agrupa líneas no vacías que no sean bullets ni labels.
    const paraLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t) break;
      if (/^[-*•]\s+/.test(t)) break;
      if (/^\*\*[^*]+:\*\*\s*$/.test(t)) break;
      if (/^#{1,6}\s+/.test(t)) break;
      paraLines.push(t);
      i++;
    }
    const text = stripBasicMarkdown(paraLines.join(" "));
    if (text) blocks.push({ kind: "p", text });
  }

  return blocks;
}

function renderBlock(
  doc: PDFKit.PDFDocument,
  block: Block,
  FONT: string,
  FONT_BOLD: string,
): void {
  const x = MARGIN_X;

  switch (block.kind) {
    case "p": {
      doc.font(FONT).fontSize(11).fillColor(COLOR_TEXT_SECONDARY);
      const h = doc.heightOfString(block.text, { width: CONTENT_W, lineGap: 2 });
      ensureSpace(doc, h + 4);
      doc.text(block.text, x, doc.y, { width: CONTENT_W, lineGap: 2 });
      doc.moveDown(0.3);
      return;
    }
    case "h": {
      ensureSpace(doc, 22);
      doc
        .font(FONT_BOLD)
        .fontSize(10)
        .fillColor(COLOR_TEXT)
        .text(block.text, x, doc.y, { width: CONTENT_W });
      doc.moveDown(0.15);
      return;
    }
    case "ul": {
      doc.font(FONT).fontSize(11).fillColor(COLOR_TEXT_SECONDARY);
      for (const item of block.items) {
        const h = doc.heightOfString(item, { width: CONTENT_W - 16, lineGap: 2 });
        ensureSpace(doc, h + 4);
        const bulletY = doc.y;
        doc.text("•", x, bulletY, { width: 12, lineBreak: false });
        doc.text(item, x + 12, bulletY, { width: CONTENT_W - 16, lineGap: 2 });
        doc.moveDown(0.15);
      }
      doc.moveDown(0.15);
      return;
    }
    case "pending": {
      drawPendingBox(doc, block.label, block.items, FONT, FONT_BOLD);
      return;
    }
  }
}

function drawPendingBox(
  doc: PDFKit.PDFDocument,
  label: string,
  items: string[],
  FONT: string,
  FONT_BOLD: string,
): void {
  const x = MARGIN_X;
  const padX = 12;
  const innerW = CONTENT_W - padX * 2;
  const labelGap = 4;

  doc.font(FONT).fontSize(10);
  const itemsHeight = items.reduce(
    (acc, it) => acc + doc.heightOfString(it, { width: innerW - 12, lineGap: 2 }) + 3,
    0,
  );
  const boxHeight = 10 + 12 + labelGap + itemsHeight + 8;

  ensureSpace(doc, boxHeight + 10);
  const y = doc.y;

  doc.save();
  doc.rect(x, y, CONTENT_W, boxHeight).fill(COLOR_BRAND_TINT);
  doc.rect(x, y, 3, boxHeight).fill(COLOR_BRAND);
  doc.restore();

  doc
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(COLOR_BRAND)
    .text(label.toUpperCase(), x + padX, y + 8, {
      width: innerW,
      characterSpacing: 0.5,
      lineBreak: false,
    });

  let cy = y + 8 + 12 + labelGap;
  doc.font(FONT).fontSize(10).fillColor(COLOR_TEXT_SECONDARY);
  for (const item of items) {
    doc.text("•", x + padX, cy, { width: 10, lineBreak: false });
    doc.text(item, x + padX + 10, cy, { width: innerW - 10, lineGap: 2 });
    cy = doc.y + 3;
  }

  doc.y = y + boxHeight + 8;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > CONTENT_BOTTOM_Y) {
    doc.addPage();
  }
}

function stripSectionPrefix(title: string): string {
  return title.replace(/^\s*\d+\.\s*/, "");
}

function stripBasicMarkdown(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .trim();
}

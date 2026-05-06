// Genera el PDF del Proyecto Final de Ingeniería. Header con datos del proyecto,
// 7 secciones con su contenido, listado de anexos. Mismo estilo que los PDFs
// de Pre-Ingeniería y Visit Report (PDFKit, fuentes Roboto, logo Voltia).

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
const LOGO_PATH = path.resolve(__dirname, "..", "preingenieriaPdf", "assets", "voltia-logo.png");

const COLOR_PRIMARY = "#1e40af";
const COLOR_TEXT = "#000000";
const COLOR_MUTED = "#666666";
const COLOR_INFO_BG = "#f5f7fb";
const COLOR_INFO_BORDER = "#c7d2e6";

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
  capacidadKwp: number;
  version: number;
  status: string;
  generatedAt: Date;
  generatedBy: string | null;
  changesFromPrevious: string | null;
  content: Record<string, string>;
  attachments: { filename: string; description: string | null; category: string | null }[];
}

export function generateEFPPdf(inputs: EFPPdfInputs): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (fs.existsSync(ROBOTO_REGULAR)) doc.registerFont("Roboto", ROBOTO_REGULAR);
    if (fs.existsSync(ROBOTO_BOLD)) doc.registerFont("Roboto-Bold", ROBOTO_BOLD);
    const FONT = fs.existsSync(ROBOTO_REGULAR) ? "Roboto" : "Helvetica";
    const FONT_BOLD = fs.existsSync(ROBOTO_BOLD) ? "Roboto-Bold" : "Helvetica-Bold";

    const pageWidth = doc.page.width;
    const margin = doc.page.margins.left;
    const contentW = pageWidth - margin * 2;

    // ─── Header ─────────────────────────────────────────────────────────────
    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, margin, 30, { width: 70 });
      } catch {
        // ignore
      }
    } else {
      doc.font(FONT_BOLD).fontSize(16).fillColor(COLOR_PRIMARY).text("VOLTIA", margin, 35);
    }

    doc
      .font(FONT_BOLD)
      .fontSize(13)
      .fillColor(COLOR_TEXT)
      .text("Proyecto Final de Ingeniería", margin, 38, { width: contentW, align: "right" });
    doc
      .font(FONT)
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text(
        `Versión ${inputs.version} · ${inputs.status} · ${inputs.generatedAt.toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" })}`,
        margin,
        56,
        { width: contentW, align: "right" },
      );

    doc.y = 100;

    // ─── Datos del proyecto ─────────────────────────────────────────────────
    doc.save();
    doc.rect(margin, doc.y, contentW, 60).fillAndStroke(COLOR_INFO_BG, COLOR_INFO_BORDER);
    doc.fillColor(COLOR_TEXT);
    let infoY = doc.y + 8;
    doc.font(FONT_BOLD).fontSize(11).text(inputs.cliente, margin + 10, infoY, { width: contentW - 20 });
    infoY += 14;
    doc
      .font(FONT)
      .fontSize(9)
      .fillColor(COLOR_MUTED)
      .text(
        `Proyecto: ${inputs.proyectoCode}  ·  ${inputs.ubicacion}  ·  ${inputs.capacidadKwp} kWp`,
        margin + 10,
        infoY,
        { width: contentW - 20 },
      );
    infoY += 12;
    doc.text(`Generado por: ${inputs.generatedBy ?? "—"}`, margin + 10, infoY, {
      width: contentW - 20,
    });
    doc.restore();
    doc.y = doc.y + 70;

    // ─── Cambios respecto a versión anterior ───────────────────────────────
    if (inputs.changesFromPrevious && inputs.changesFromPrevious.trim().length > 0) {
      writeSectionHeader(doc, FONT_BOLD, "Cambios respecto a la versión anterior");
      doc
        .font(FONT)
        .fontSize(10)
        .fillColor(COLOR_TEXT)
        .text(stripMarkdown(inputs.changesFromPrevious), margin, doc.y, {
          width: contentW,
          lineGap: 2,
        });
      doc.moveDown(0.6);
    }

    // ─── 7 secciones ───────────────────────────────────────────────────────
    for (const key of SECTION_KEYS_ORDERED) {
      const text = inputs.content[key] ?? "Pendiente de completar por el proyectista";
      writeSectionHeader(doc, FONT_BOLD, EFP_SECTION_TITLES[key]);
      doc
        .font(FONT)
        .fontSize(10)
        .fillColor(COLOR_TEXT)
        .text(stripMarkdown(text), margin, doc.y, { width: contentW, lineGap: 2 });
      doc.moveDown(0.6);
    }

    // ─── Anexos: lista resumida (los archivos en sí no se embeben) ─────────
    if (inputs.attachments.length > 0) {
      writeSectionHeader(doc, FONT_BOLD, "Anexos cargados");
      for (const a of inputs.attachments) {
        const line = `• ${a.filename}${a.category ? ` [${a.category}]` : ""}${a.description ? ` — ${a.description}` : ""}`;
        doc
          .font(FONT)
          .fontSize(10)
          .fillColor(COLOR_TEXT)
          .text(line, margin, doc.y, { width: contentW, lineGap: 2 });
      }
      doc.moveDown(0.4);
    }

    doc.end();
  });
}

function writeSectionHeader(doc: PDFKit.PDFDocument, FONT_BOLD: string, title: string): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
    doc.addPage();
  }
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor(COLOR_PRIMARY)
    .text(title, doc.page.margins.left, doc.y, {
      width: doc.page.width - doc.page.margins.left * 2,
    });
  doc.moveDown(0.3);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1");
}

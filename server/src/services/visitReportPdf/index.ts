// Genera el PDF del informe de Visita Técnica. Es similar al PDF de Pre-
// Ingeniería pero más simple: A4 vertical con header, resumen ejecutivo, las 7
// secciones como prosa markdown, y al final las sugerencias de actualización
// del proyecto (si las hay).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";

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

const SECTION_TITLES: { key: string; title: string }[] = [
  { key: "datosGenerales", title: "1. Datos generales del sitio" },
  { key: "acometida", title: "2. Acometida y conexión eléctrica" },
  { key: "techo", title: "3. Techo / Superficie de instalación" },
  { key: "espacioInversor", title: "4. Espacio para inversor" },
  { key: "canalizaciones", title: "5. Recorrido de canalizaciones" },
  { key: "observaciones", title: "6. Observaciones especiales" },
  { key: "proximosPasos", title: "7. Próximos pasos sugeridos" },
];

export interface VisitReportPdfInputs {
  cliente: string;
  proyectoCode: string;
  visitDate: Date;
  visitType: string;
  operario: string | null;
  version: number;
  generatedAt: Date;
  generatedBy: string | null;
  summary: string | null;
  changesFromPrevious: string | null;
  content: Record<string, string>;
  projectSuggestions: Array<{
    field: string;
    currentValue?: string | number | null;
    suggestedValue: string | number | null;
    reason: string;
    confidence: string;
  }>;
}

export function generateVisitReportPdf(inputs: VisitReportPdfInputs): Promise<Buffer> {
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

    // ─── Header ───────────────────────────────────────────────────────────
    if (fs.existsSync(LOGO_PATH)) {
      try {
        doc.image(LOGO_PATH, margin, 30, { width: 70 });
      } catch {
        // ignore
      }
    } else {
      doc.font(FONT_BOLD).fontSize(16).fillColor(COLOR_PRIMARY).text("VOLTIA", margin, 35);
    }

    doc.font(FONT_BOLD).fontSize(13).fillColor(COLOR_TEXT)
      .text("Informe de Visita Técnica", margin, 38, {
        width: contentW,
        align: "right",
      });
    doc.font(FONT).fontSize(9).fillColor(COLOR_MUTED)
      .text(`Versión ${inputs.version} · ${inputs.generatedAt.toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" })}`, margin, 56, {
        width: contentW,
        align: "right",
      });

    doc.y = 100;

    // ─── Datos del proyecto ───────────────────────────────────────────────
    doc.save();
    doc.rect(margin, doc.y, contentW, 50).fillAndStroke(COLOR_INFO_BG, COLOR_INFO_BORDER);
    doc.fillColor(COLOR_TEXT);
    let infoY = doc.y + 8;
    doc.font(FONT_BOLD).fontSize(11).text(inputs.cliente, margin + 10, infoY, { width: contentW - 20 });
    infoY += 14;
    doc.font(FONT).fontSize(9).fillColor(COLOR_MUTED)
      .text(
        `Proyecto: ${inputs.proyectoCode}  ·  Visita: ${inputs.visitType.toLowerCase()} del ${inputs.visitDate.toLocaleDateString("es-UY", { day: "2-digit", month: "long", year: "numeric" })}  ·  Operario: ${inputs.operario ?? "—"}`,
        margin + 10,
        infoY,
        { width: contentW - 20 },
      );
    infoY += 12;
    doc.text(
      `Generado por: ${inputs.generatedBy ?? "—"}`,
      margin + 10,
      infoY,
      { width: contentW - 20 },
    );
    doc.restore();
    doc.y = doc.y + 60;

    // ─── Resumen ejecutivo ────────────────────────────────────────────────
    if (inputs.summary && inputs.summary.trim().length > 0) {
      writeSectionHeader(doc, FONT_BOLD, "Resumen ejecutivo");
      doc.font(FONT).fontSize(10).fillColor(COLOR_TEXT)
        .text(inputs.summary, margin, doc.y, { width: contentW, lineGap: 2 });
      doc.moveDown(0.6);
    }

    // ─── Changelog ────────────────────────────────────────────────────────
    if (inputs.changesFromPrevious && inputs.changesFromPrevious.trim().length > 0) {
      writeSectionHeader(doc, FONT_BOLD, "Cambios respecto a la versión anterior");
      doc.font(FONT).fontSize(10).fillColor(COLOR_TEXT)
        .text(stripMarkdown(inputs.changesFromPrevious), margin, doc.y, { width: contentW, lineGap: 2 });
      doc.moveDown(0.6);
    }

    // ─── Sugerencias de actualización ────────────────────────────────────
    if (inputs.projectSuggestions.length > 0) {
      writeSectionHeader(doc, FONT_BOLD, "Sugerencias para actualizar el proyecto");
      for (const s of inputs.projectSuggestions) {
        doc.font(FONT_BOLD).fontSize(10).fillColor(COLOR_TEXT)
          .text(
            `${s.field}: ${formatVal(s.currentValue)} → ${formatVal(s.suggestedValue)} (confianza: ${s.confidence})`,
            margin,
            doc.y,
            { width: contentW, lineGap: 2 },
          );
        doc.font(FONT).fontSize(9).fillColor(COLOR_MUTED)
          .text(s.reason, margin, doc.y, { width: contentW, lineGap: 2 });
        doc.moveDown(0.4);
      }
      doc.moveDown(0.4);
    }

    // ─── 7 secciones ──────────────────────────────────────────────────────
    for (const { key, title } of SECTION_TITLES) {
      const text = inputs.content[key] ?? "Sin información relevada todavía";
      writeSectionHeader(doc, FONT_BOLD, title);
      doc.font(FONT).fontSize(10).fillColor(COLOR_TEXT)
        .text(stripMarkdown(text), margin, doc.y, { width: contentW, lineGap: 2 });
      doc.moveDown(0.6);
    }

    doc.end();
  });
}

function writeSectionHeader(
  doc: PDFKit.PDFDocument,
  FONT_BOLD: string,
  title: string,
): void {
  // Si hay <40px hasta el final, salto de página.
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
    doc.addPage();
  }
  doc.font(FONT_BOLD).fontSize(11).fillColor(COLOR_PRIMARY)
    .text(title, doc.page.margins.left, doc.y, { width: doc.page.width - doc.page.margins.left * 2 });
  doc.moveDown(0.3);
}

function formatVal(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

/**
 * Stripe muy simple de markdown: saca `**bold**`, `*italic*`, headings y
 * bullets `- `. No es un parser completo; sólo limpia los símbolos para que
 * no aparezcan literales en el PDF.
 */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1");
}

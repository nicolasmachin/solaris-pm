// Generador del PDF "Resumen Técnico" (Pre-Ingeniería).
// Produce un PDF A4 vertical con:
//   - Página 1: formulario fijo en 2 columnas con datos del cliente, sitio,
//     eléctricos, otros datos. Reproduce el layout que Voltia usa hoy hecho a
//     mano (ver `docs/features/preingenieria/casos_referencia/`).
//   - Páginas 2..N: una foto por página con su etiqueta arriba.
//
// Tipografía: Roboto bundleada (mismo binario que el unifilar). Logo: PNG en
// `assets/voltia-logo.png` si existe; si no, fallback a tipografía.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONTS_DIR = path.resolve(__dirname, "..", "unifilarSvg", "fonts");
const ROBOTO_REGULAR = path.join(FONTS_DIR, "Roboto-Regular.ttf");
const ROBOTO_BOLD = path.join(FONTS_DIR, "Roboto-Bold.ttf");
const LOGO_PATH = path.join(__dirname, "assets", "voltia-logo.png");

const COLOR_PRIMARY = "#1e40af";
const COLOR_TEXT = "#000000";
const COLOR_MUTED = "#666666";
const COLOR_BORDER = "#1e40af";
const COLOR_INFO_BG = "#f5f7fb";
const COLOR_INFO_BORDER = "#c7d2e6";

export type TipoTechoKey = "ISOPANEL" | "HORMIGON" | "CHAPA" | "TEJAS" | "OTRO";

const TIPO_TECHO_LABELS: Record<TipoTechoKey, string> = {
  ISOPANEL: "Isopanel",
  HORMIGON: "Hormigón",
  CHAPA: "Chapa",
  TEJAS: "Tejas",
  OTRO: "Otro:",
};

export interface PreIngenieriaPdfInputs {
  // Cliente (snapshot)
  snapshotNombre: string;
  snapshotDireccion: string | null;
  snapshotCiudad: string | null;
  snapshotCelular: string | null;
  snapshotFechaPrevista: string | null;
  // Sitio
  tipoTecho: TipoTechoKey | null;
  tipoTechoOtro: string | null;
  infoTecho: string | null;
  alturaTecho: string | null;
  // Eléctricos
  cantidadPaneles: string | null;
  potenciaPaneles: string | null;
  inversor: string | null;
  stringsLineasDc: string | null;
  cableAc: string | null;
  termicaAc: string | null;
  diferencialAc: string | null;
  largoCablesAcMts: string | null;
  largoCablesDcMts: string | null;
  // Red
  redMonofasica: boolean;
  redTrifasica230SN: boolean;
  redTrifasica400CN: boolean;
  // Notas
  notasAdicionales: string | null;
}

export interface PreIngenieriaPdfFoto {
  /** Path absoluto al archivo de imagen */
  filePath: string;
  /** Etiqueta opcional que se muestra arriba de la foto */
  etiqueta: string | null;
  orden: number;
}

/**
 * Genera el PDF y devuelve un Buffer. Es seguro para llamar concurrentemente
 * (no hay estado compartido).
 */
export async function generatePreIngenieriaPdf(
  inputs: PreIngenieriaPdfInputs,
  fotos: PreIngenieriaPdfFoto[],
): Promise<Buffer> {
  // Pre-procesamos las fotos a JPEG con orientación EXIF aplicada para que
  // pdfkit no tenga que lidiar con HEIC/WEBP/EXIF rotation.
  const procesadas = await Promise.all(
    [...fotos]
      .sort((a, b) => a.orden - b.orden)
      .map(async (f) => {
        try {
          const buf = await sharp(f.filePath).rotate().jpeg({ quality: 88 }).toBuffer();
          return { etiqueta: f.etiqueta, jpeg: buf };
        } catch {
          return null;
        }
      }),
  );
  const fotosOk = procesadas.filter((x): x is { etiqueta: string | null; jpeg: Buffer } => x !== null);

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Fuentes Roboto si están disponibles, fallback a Helvetica.
    if (fs.existsSync(ROBOTO_REGULAR)) doc.registerFont("Roboto", ROBOTO_REGULAR);
    if (fs.existsSync(ROBOTO_BOLD)) doc.registerFont("Roboto-Bold", ROBOTO_BOLD);
    const FONT = fs.existsSync(ROBOTO_REGULAR) ? "Roboto" : "Helvetica";
    const FONT_BOLD = fs.existsSync(ROBOTO_BOLD) ? "Roboto-Bold" : "Helvetica-Bold";

    // ── Página 1: encabezado ─────────────────────────────────────────────
    drawHeader(doc, FONT, FONT_BOLD);

    // ── Página 1: cuerpo en 2 columnas ───────────────────────────────────
    const COL_W = 250;
    const GUTTER = 15;
    const LEFT_X = 40;
    const RIGHT_X = LEFT_X + COL_W + GUTTER;
    const BODY_TOP = 175;

    // Columna izquierda: Datos del cliente
    let leftY = BODY_TOP;
    leftY = drawSectionHeader(doc, FONT_BOLD, "DATOS DEL CLIENTE", LEFT_X, leftY, COL_W);
    leftY = drawFieldRow(doc, FONT, FONT_BOLD, "Nombre:", inputs.snapshotNombre, LEFT_X, leftY, COL_W);
    leftY = drawFieldRow(doc, FONT, FONT_BOLD, "Dirección:", inputs.snapshotDireccion, LEFT_X, leftY, COL_W);
    leftY = drawFieldRow(doc, FONT, FONT_BOLD, "Ciudad:", inputs.snapshotCiudad, LEFT_X, leftY, COL_W);
    leftY = drawFieldRow(doc, FONT, FONT_BOLD, "Celular:", inputs.snapshotCelular, LEFT_X, leftY, COL_W);
    leftY = drawFieldRow(doc, FONT, FONT_BOLD, "Fecha prevista:", inputs.snapshotFechaPrevista, LEFT_X, leftY, COL_W);

    // Columna izquierda (debajo): Datos sitio
    leftY += 12;
    leftY = drawSectionHeader(doc, FONT_BOLD, "DATOS SITIO DE INSTALACIÓN", LEFT_X, leftY, COL_W);
    leftY = drawTipoTechoBlock(doc, FONT, FONT_BOLD, inputs.tipoTecho, inputs.tipoTechoOtro, LEFT_X, leftY, COL_W);
    if (inputs.infoTecho) {
      leftY += 6;
      leftY = drawInfoBox(doc, FONT, FONT_BOLD, "Info techo:", inputs.infoTecho, LEFT_X, leftY, COL_W);
    }

    // Columna derecha: Datos eléctricos
    let rightY = BODY_TOP;
    rightY = drawSectionHeader(doc, FONT_BOLD, "DATOS ELÉCTRICOS", RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Cantidad Paneles:", inputs.cantidadPaneles, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Potencia Paneles:", inputs.potenciaPaneles, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Inversor:", inputs.inversor, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Strings/Lineas DC:", inputs.stringsLineasDc, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Cable AC:", inputs.cableAc, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Térmica AC:", inputs.termicaAc, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Diferencial AC:", inputs.diferencialAc, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Largo cables AC (aprox):", inputs.largoCablesAcMts, RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Largo cables DC (aprox):", inputs.largoCablesDcMts, RIGHT_X, rightY, COL_W);

    // Columna derecha (debajo): Otros datos + Red
    rightY += 12;
    rightY = drawSectionHeader(doc, FONT_BOLD, "OTROS DATOS", RIGHT_X, rightY, COL_W);
    rightY = drawFieldRow(doc, FONT, FONT_BOLD, "Altura techo:", inputs.alturaTecho, RIGHT_X, rightY, COL_W);
    rightY += 8;
    rightY = drawRedBlock(doc, FONT, FONT_BOLD, inputs, RIGHT_X, rightY, COL_W);

    // ── Notas adicionales (full width al final) ──────────────────────────
    const notasY = Math.max(leftY, rightY) + 18;
    if (inputs.notasAdicionales && inputs.notasAdicionales.trim().length > 0) {
      drawNotasBox(doc, FONT, FONT_BOLD, inputs.notasAdicionales, LEFT_X, notasY, COL_W * 2 + GUTTER);
    }

    // ── Páginas 2..N: una foto por página ────────────────────────────────
    fotosOk.forEach((f, idx) => {
      doc.addPage();
      drawFotoPage(doc, FONT, FONT_BOLD, f.jpeg, f.etiqueta, idx + 1, fotosOk.length);
    });

    doc.end();
  });
}

// ─── Helpers de dibujo ──────────────────────────────────────────────────────

function drawHeader(
  doc: PDFKit.PDFDocument,
  FONT: string,
  FONT_BOLD: string,
): void {
  const pageWidth = doc.page.width;
  // Logo: PNG si existe, si no fallback a "VOLTIA" en azul.
  if (fs.existsSync(LOGO_PATH)) {
    try {
      const logoW = 100;
      doc.image(LOGO_PATH, (pageWidth - logoW) / 2, 35, { width: logoW });
    } catch {
      // ignore logo errors
    }
  } else {
    doc.font(FONT_BOLD).fontSize(22).fillColor(COLOR_PRIMARY)
      .text("VOLTIA", 0, 45, { width: pageWidth, align: "center" });
  }
  doc.font(FONT).fontSize(14).fillColor(COLOR_TEXT)
    .text("Instalación Fotovoltaica", 0, 115, { width: pageWidth, align: "center" });
  doc.font(FONT_BOLD).fontSize(15).fillColor(COLOR_TEXT)
    .text("Resumen Técnico", 0, 135, { width: pageWidth, align: "center" });
}

function drawSectionHeader(
  doc: PDFKit.PDFDocument,
  FONT_BOLD: string,
  title: string,
  x: number,
  y: number,
  width: number,
): number {
  doc.save();
  doc.rect(x, y, width, 20).fill(COLOR_PRIMARY);
  doc.fillColor("#ffffff").font(FONT_BOLD).fontSize(9.5)
    .text(title, x, y + 5.5, { width, align: "center", lineBreak: false, characterSpacing: 1.5 });
  doc.restore();
  return y + 22;
}

function drawFieldRow(
  doc: PDFKit.PDFDocument,
  FONT: string,
  FONT_BOLD: string,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  width: number,
): number {
  const ROW_H = 18;
  doc.save();
  // Fondo blanco con borde inferior.
  doc.rect(x, y, width, ROW_H).strokeColor(COLOR_BORDER).lineWidth(0.4).stroke();
  doc.fillColor(COLOR_PRIMARY).font(FONT).fontSize(8.5);
  const labelW = doc.widthOfString(label) + 4;
  doc.text(label, x + 4, y + 5, { lineBreak: false, width: labelW });
  if (value && value.trim().length > 0) {
    doc.fillColor(COLOR_TEXT).font(FONT_BOLD).fontSize(9)
      .text(value, x + labelW + 4, y + 4.5, { width: width - labelW - 8, lineBreak: false });
  }
  doc.restore();
  return y + ROW_H + 2;
}

function drawTipoTechoBlock(
  doc: PDFKit.PDFDocument,
  FONT: string,
  FONT_BOLD: string,
  tipoTecho: TipoTechoKey | null,
  tipoTechoOtro: string | null,
  x: number,
  y: number,
  width: number,
): number {
  const opciones: TipoTechoKey[] = ["ISOPANEL", "HORMIGON", "CHAPA", "TEJAS", "OTRO"];
  const ROW_H = 14;
  const blockH = ROW_H * opciones.length + 8;
  doc.save();
  doc.rect(x, y, width, blockH).strokeColor(COLOR_BORDER).lineWidth(0.4).stroke();
  // Label "Tipo techo" a la izquierda
  doc.fillColor(COLOR_PRIMARY).font(FONT_BOLD).fontSize(8.5)
    .text("Tipo", x + 4, y + 14, { lineBreak: false });
  doc.text("techo", x + 4, y + 24, { lineBreak: false });

  const optX = x + 60;
  let optY = y + 5;
  for (const op of opciones) {
    drawCheckbox(doc, optX, optY + 2, tipoTecho === op);
    doc.fillColor(COLOR_TEXT).font(FONT).fontSize(9.5)
      .text(TIPO_TECHO_LABELS[op], optX + 14, optY + 1, { lineBreak: false });
    if (op === "OTRO" && tipoTecho === "OTRO" && tipoTechoOtro) {
      doc.fillColor(COLOR_TEXT).font(FONT_BOLD).fontSize(9)
        .text(tipoTechoOtro, optX + 50, optY + 1, { width: width - (optX - x) - 50 - 4, lineBreak: false });
    }
    optY += ROW_H;
  }
  doc.restore();
  return y + blockH + 2;
}

function drawCheckbox(doc: PDFKit.PDFDocument, x: number, y: number, checked: boolean): void {
  doc.save();
  doc.rect(x, y, 9, 9).strokeColor(COLOR_BORDER).lineWidth(0.6).stroke();
  if (checked) {
    doc.fillColor(COLOR_PRIMARY).font("Helvetica-Bold").fontSize(9)
      .text("X", x, y - 0.5, { width: 9, align: "center", lineBreak: false });
  }
  doc.restore();
}

function drawInfoBox(
  doc: PDFKit.PDFDocument,
  FONT: string,
  FONT_BOLD: string,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
): number {
  const PAD = 6;
  doc.save();
  doc.font(FONT_BOLD).fontSize(8.5);
  const lines = doc.heightOfString(value, { width: width - PAD * 2, lineGap: 1 });
  const total = 14 + lines + PAD * 2;
  doc.rect(x, y, width, total)
    .fillAndStroke(COLOR_INFO_BG, COLOR_INFO_BORDER);
  doc.fillColor(COLOR_PRIMARY).font(FONT_BOLD).fontSize(8.5)
    .text(label, x + PAD, y + PAD, { lineBreak: false });
  doc.fillColor(COLOR_TEXT).font(FONT).fontSize(9)
    .text(value, x + PAD, y + PAD + 12, { width: width - PAD * 2, lineGap: 1 });
  doc.restore();
  return y + total + 2;
}

function drawRedBlock(
  doc: PDFKit.PDFDocument,
  FONT: string,
  FONT_BOLD: string,
  inputs: PreIngenieriaPdfInputs,
  x: number,
  y: number,
  width: number,
): number {
  doc.save();
  doc.fillColor(COLOR_PRIMARY).font(FONT_BOLD).fontSize(9.5)
    .text("Red:", x, y + 4, { lineBreak: false });

  const optX = x + 40;
  const opts: Array<{ label: string; checked: boolean }> = [
    { label: "Monofásica", checked: inputs.redMonofasica },
    { label: "Trifásica 230 (sin neutro)", checked: inputs.redTrifasica230SN },
    { label: "Trifásica 400 (con neutro)", checked: inputs.redTrifasica400CN },
  ];
  let ry = y;
  for (const o of opts) {
    drawCheckbox(doc, optX, ry + 2, o.checked);
    doc.fillColor(COLOR_TEXT).font(FONT).fontSize(9.5)
      .text(o.label, optX + 14, ry + 1, { lineBreak: false });
    ry += 16;
  }
  doc.restore();
  return ry + 2;
}

function drawNotasBox(
  doc: PDFKit.PDFDocument,
  FONT: string,
  FONT_BOLD: string,
  text: string,
  x: number,
  y: number,
  width: number,
): void {
  const PAD = 8;
  doc.save();
  doc.font(FONT).fontSize(9.5);
  const textH = doc.heightOfString(text, { width: width - PAD * 2, lineGap: 2 });
  const totalH = 18 + textH + PAD * 2;
  doc.rect(x, y, width, totalH).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
  doc.fillColor(COLOR_PRIMARY).font(FONT_BOLD).fontSize(9)
    .text("NOTAS ADICIONALES:", x + PAD, y + PAD, { lineBreak: false, characterSpacing: 1 });
  doc.fillColor(COLOR_TEXT).font(FONT).fontSize(9.5)
    .text(text, x + PAD, y + PAD + 16, { width: width - PAD * 2, lineGap: 2 });
  doc.restore();
}

function drawFotoPage(
  doc: PDFKit.PDFDocument,
  FONT: string,
  FONT_BOLD: string,
  jpeg: Buffer,
  etiqueta: string | null,
  index: number,
  total: number,
): void {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;
  let topY = margin;

  if (etiqueta && etiqueta.trim().length > 0) {
    doc.font(FONT_BOLD).fontSize(11).fillColor(COLOR_TEXT)
      .text(etiqueta, margin, topY, { width: pageWidth - margin * 2, lineBreak: true });
    topY = doc.y + 6;
  }

  // Numeración discreta arriba a la derecha
  doc.font(FONT).fontSize(8).fillColor(COLOR_MUTED)
    .text(`Foto ${index} de ${total}`, pageWidth - margin - 80, margin, {
      width: 80,
      align: "right",
      lineBreak: false,
    });

  const availW = pageWidth - margin * 2;
  const availH = pageHeight - topY - margin;
  doc.image(jpeg, margin, topY, { fit: [availW, availH], align: "center" });
}

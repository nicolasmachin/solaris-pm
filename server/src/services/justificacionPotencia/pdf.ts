// PDF del informe "Justificación de aumento de consumo eléctrico" para UTE.
// Reproduce la estructura de los informes que Voltia mandaba armados a mano
// (encabezado con datos, Objeto, Antecedentes, cargas, balance, justificación,
// conclusión) y cierra con una línea de firma: el PDF se firma digitalmente
// después, fuera de Voltia PM.
//
// PDFKit con Roboto (mismos binarios que el unifilar) y el logo embebido de
// `reportesFv/pdf/logo.ts` (constante TS: tsc no copia los .png a dist/).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PDFDocument from "pdfkit";

import { LOGO_VOLTIA_DATA_URI } from "../reportesFv/pdf/logo.js";
import { calcularBalance, fmtNum, type Balance } from "./calculo.js";
import type { DatosJustificacion } from "./schema.js";
import { textosFinales } from "./textos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, "..", "unifilarSvg", "fonts");
const ROBOTO_REGULAR = path.join(FONTS_DIR, "Roboto-Regular.ttf");
const ROBOTO_BOLD = path.join(FONTS_DIR, "Roboto-Bold.ttf");
const LOGO = Buffer.from(LOGO_VOLTIA_DATA_URI.replace(/^data:image\/\w+;base64,/, ""), "base64");

const COLOR_PRIMARY = "#1e40af";
const COLOR_TEXT = "#111111";
const COLOR_MUTED = "#555555";
const COLOR_BG = "#f5f7fb";
const COLOR_BORDER = "#c7d2e6";

const MARGIN = 50;
const FOOTER_SPACE = 40;

export interface JustificacionPdfMeta {
  /** "dd/mm/aaaa" — la fecha del informe (la de creación de la versión). */
  fecha: string;
}

type Fonts = { regular: string; bold: string };

export async function generateJustificacionPotenciaPdf(
  datos: DatosJustificacion,
  meta: JustificacionPdfMeta,
): Promise<Buffer> {
  const balance = calcularBalance(datos);
  const textos = textosFinales(datos, balance);

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Title: `Justificación de potencia - ${datos.cliente.nombre}`, Author: "Voltia" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (fs.existsSync(ROBOTO_REGULAR)) doc.registerFont("Roboto", ROBOTO_REGULAR);
    if (fs.existsSync(ROBOTO_BOLD)) doc.registerFont("Roboto-Bold", ROBOTO_BOLD);
    const f: Fonts = {
      regular: fs.existsSync(ROBOTO_REGULAR) ? "Roboto" : "Helvetica",
      bold: fs.existsSync(ROBOTO_BOLD) ? "Roboto-Bold" : "Helvetica-Bold",
    };

    drawEncabezado(doc, f, datos);
    drawDatos(doc, f, datos, meta);

    let n = 1;
    drawSeccion(doc, f, `${n++}. OBJETO DEL INFORME`);
    drawParrafos(doc, f, textos.objeto);

    drawSeccion(doc, f, `${n++}. ANTECEDENTES`);
    drawParrafos(doc, f, textos.antecedentes);

    drawSeccion(doc, f, `${n++}. INCREMENTO DE CONSUMO PREVISTO`);
    drawParrafos(doc, f, "Se prevé un aumento del consumo eléctrico del suministro debido a:");
    drawVinetas(doc, f, datos);

    // Título + tabla juntos: una tabla corta no se parte entre páginas.
    drawSeccion(doc, f, `${n++}. ESTIMACIÓN DE NUEVAS CARGAS`, Math.min(70 + 24 * (balance.cargas.length + 2), 380));
    drawParrafos(doc, f, "A efectos de esta justificación se adopta la siguiente estimación conservadora:");
    drawTablaCargas(doc, f, balance);

    drawSeccion(doc, f, `${n++}. BALANCE ANUAL DE ENERGÍA`, 160);
    drawTablaBalance(doc, f, balance);

    drawSeccion(doc, f, `${n++}. JUSTIFICACIÓN DEL SISTEMA FOTOVOLTAICO`);
    drawParrafos(doc, f, textos.justificacion);

    drawSeccion(doc, f, `${n++}. CONCLUSIÓN`);
    drawParrafos(doc, f, textos.conclusion);

    drawFirma(doc, f, datos);
    drawPies(doc, f);
    doc.end();
  });
}

// ─── Bloques ────────────────────────────────────────────────────────────────

function contentWidth(doc: PDFKit.PDFDocument): number {
  return doc.page.width - MARGIN * 2;
}

function bottomLimit(doc: PDFKit.PDFDocument): number {
  return doc.page.height - MARGIN - FOOTER_SPACE;
}

/** Salta de página si lo que viene (alto estimado) no entra. */
function ensureSpace(doc: PDFKit.PDFDocument, alto: number): void {
  if (doc.y + alto > bottomLimit(doc)) {
    doc.addPage();
    doc.y = MARGIN;
  }
}

function drawEncabezado(doc: PDFKit.PDFDocument, f: Fonts, d: DatosJustificacion): void {
  const w = contentWidth(doc);
  try {
    doc.image(LOGO, MARGIN + (w - 90) / 2, MARGIN - 10, { width: 90 });
    doc.y = MARGIN - 10 + 90 * (2048 / 2860) + 12;
  } catch {
    doc.font(f.bold).fontSize(22).fillColor(COLOR_PRIMARY).text("VOLTIA", MARGIN, MARGIN, { width: w, align: "center" });
    doc.moveDown(0.4);
  }
  doc.font(f.bold).fontSize(15).fillColor(COLOR_TEXT).text("INFORME TÉCNICO", MARGIN, doc.y, { width: w, align: "center" });
  doc.font(f.bold).fontSize(12).fillColor(COLOR_PRIMARY)
    .text("JUSTIFICACIÓN DE AUMENTO DE CONSUMO ELÉCTRICO", MARGIN, doc.y + 2, { width: w, align: "center" });
  const sub =
    d.tipoSolicitud === "AMPLIACION"
      ? "Solicitud de ampliación de potencia para sistema de microgeneración"
      : "Solicitud de microgeneración fotovoltaica";
  doc.font(f.regular).fontSize(10).fillColor(COLOR_MUTED).text(sub, MARGIN, doc.y + 2, { width: w, align: "center" });
  doc.y += 14;
}

function drawDatos(doc: PDFKit.PDFDocument, f: Fonts, d: DatosJustificacion, meta: JustificacionPdfMeta): void {
  const w = contentWidth(doc);
  const filas: [string, string][] = [
    ["Cliente", d.cliente.nombre],
    [d.cliente.esEmpresa ? "RUT" : "C.I.", d.cliente.documento],
    ["Cuenta UTE", d.cliente.cuentaUte],
    ["Ubicación", d.cliente.ubicacion],
    ["Ingeniero responsable", d.firmante.ci ? `${d.firmante.nombre} · C.I. ${d.firmante.ci}` : d.firmante.nombre],
    ["Fecha", meta.fecha],
  ].filter(([, v]) => v.trim() !== "") as [string, string][];

  const labelW = 130;
  const padX = 10;
  const top = doc.y;
  doc.fontSize(9.5);
  const alturas = filas.map(([, v]) => Math.max(15, doc.font(f.regular).heightOfString(v, { width: w - labelW - padX * 2 }) + 4));
  const alto = alturas.reduce((a, b) => a + b, 0) + 12;

  doc.save().rect(MARGIN, top, w, alto).fillAndStroke(COLOR_BG, COLOR_BORDER).restore();
  let y = top + 6;
  filas.forEach(([k, v], i) => {
    doc.font(f.bold).fontSize(9.5).fillColor(COLOR_MUTED).text(`${k}:`, MARGIN + padX, y + 2, { width: labelW });
    doc.font(f.regular).fontSize(9.5).fillColor(COLOR_TEXT).text(v, MARGIN + padX + labelW, y + 2, { width: w - labelW - padX * 2 });
    y += alturas[i];
  });
  doc.x = MARGIN;
  doc.y = top + alto + 14;
}

function drawSeccion(doc: PDFKit.PDFDocument, f: Fonts, titulo: string, altoMinimo = 70): void {
  // El título nunca queda solo al pie: pide lugar para él y lo que lo sigue.
  ensureSpace(doc, altoMinimo);
  doc.y += 4;
  doc.font(f.bold).fontSize(11).fillColor(COLOR_PRIMARY).text(titulo, MARGIN, doc.y, { width: contentWidth(doc) });
  const yLinea = doc.y + 2;
  doc.save().moveTo(MARGIN, yLinea).lineTo(MARGIN + contentWidth(doc), yLinea).lineWidth(0.6).strokeColor(COLOR_BORDER).stroke().restore();
  doc.y = yLinea + 7;
}

function drawParrafos(doc: PDFKit.PDFDocument, f: Fonts, texto: string): void {
  const parrafos = texto.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of parrafos) {
    doc.font(f.regular).fontSize(10).fillColor(COLOR_TEXT)
      .text(p, MARGIN, doc.y, { width: contentWidth(doc), align: "justify", lineGap: 2 });
    doc.y += 6;
  }
}

function drawVinetas(doc: PDFKit.PDFDocument, f: Fonts, d: DatosJustificacion): void {
  const w = contentWidth(doc);
  for (const c of d.cargas) {
    const texto = c.detalle?.trim() ? `${c.concepto.trim()}: ${c.detalle.trim()}` : c.concepto.trim();
    doc.font(f.regular).fontSize(10);
    ensureSpace(doc, doc.heightOfString(texto, { width: w - 16 }) + 4);
    const y = doc.y;
    doc.fillColor(COLOR_PRIMARY).text("•", MARGIN + 4, y);
    doc.fillColor(COLOR_TEXT).text(texto, MARGIN + 16, y, { width: w - 16, lineGap: 1.5 });
    doc.y += 3;
  }
  doc.y += 4;
}

interface Col {
  titulo: string;
  ancho: number;
  align: "left" | "right" | "center";
}

function drawFilaTabla(
  doc: PDFKit.PDFDocument,
  fuente: string,
  cols: Col[],
  valores: string[],
  opts: { fondo?: string; colorTexto?: string; size?: number } = {},
): void {
  const size = opts.size ?? 9;
  const padX = 6;
  const padY = 4;
  doc.font(fuente).fontSize(size);
  const alto = Math.max(...valores.map((v, i) => doc.heightOfString(v, { width: cols[i].ancho - padX * 2 }))) + padY * 2;
  ensureSpace(doc, alto);
  const y = doc.y;
  let x = MARGIN;
  const total = cols.reduce((a, c) => a + c.ancho, 0);
  if (opts.fondo) doc.save().rect(MARGIN, y, total, alto).fill(opts.fondo).restore();
  doc.save().rect(MARGIN, y, total, alto).lineWidth(0.5).strokeColor(COLOR_BORDER).stroke().restore();
  cols.forEach((c, i) => {
    doc.font(fuente).fontSize(size).fillColor(opts.colorTexto ?? COLOR_TEXT)
      .text(valores[i], x + padX, y + padY, { width: c.ancho - padX * 2, align: c.align });
    x += c.ancho;
  });
  doc.x = MARGIN;
  doc.y = y + alto;
}

function drawTablaCargas(doc: PDFKit.PDFDocument, f: Fonts, b: Balance): void {
  const w = contentWidth(doc);
  const cols: Col[] = [
    { titulo: "Concepto", ancho: w * 0.4, align: "left" },
    { titulo: "Estimación", ancho: w * 0.4, align: "left" },
    { titulo: "kWh/mes", ancho: w * 0.2, align: "right" },
  ];
  drawFilaTabla(doc, f.bold, cols, cols.map((c) => c.titulo), { fondo: COLOR_PRIMARY, colorTexto: "#ffffff" });
  for (const c of b.cargas) {
    drawFilaTabla(doc, f.regular, cols, [c.carga.concepto, c.formula, fmtNum(c.kwhMes)]);
  }
  drawFilaTabla(doc, f.bold, cols, ["Total nuevas cargas", "", fmtNum(b.incrementoMensualKwh)], { fondo: COLOR_BG });
  doc.y += 12;
}

function drawTablaBalance(doc: PDFKit.PDFDocument, f: Fonts, b: Balance): void {
  const w = contentWidth(doc);
  const cols: Col[] = [
    { titulo: "", ancho: w * 0.7, align: "left" },
    { titulo: "", ancho: w * 0.3, align: "right" },
  ];
  // Cuenta nueva (sin consumo cargado): "actual + incremento" no se entiende sin
  // una base, así que el consumo proyectado sale directo de las cargas.
  const filasConsumo: [string, string, boolean][] =
    b.consumoAnualActualKwh > 0
      ? [
          // Estimado: va como aproximado y sin la cuenta (no se le explica a UTE su
          // propia respuesta).
          [
            "Consumo anual actual de la cuenta",
            `${b.consumoActualEstimadoDesdeUte ? "≈ " : ""}${fmtNum(b.consumoAnualActualKwh)} kWh`,
            false,
          ],
          ["Incremento anual estimado (nuevas cargas × 12)", `${fmtNum(b.incrementoAnualKwh)} kWh`, false],
          ["Consumo anual proyectado", `${fmtNum(b.consumoAnualProyectadoKwh)} kWh`, true],
        ]
      : [["Consumo anual proyectado (cargas previstas × 12)", `${fmtNum(b.consumoAnualProyectadoKwh)} kWh`, true]];
  const filas: [string, string, boolean][] = [
    ...filasConsumo,
    ["Potencia de generación solicitada", `${fmtNum(b.potenciaSolicitadaKw, 2)} kW`, false],
    [`Generación anual estimada (${fmtNum(b.productividadKwhKw)} kWh por kW instalado)`, `${fmtNum(b.generacionAnualKwh)} kWh`, true],
  ];
  for (const [k, v, destacado] of filas) {
    drawFilaTabla(doc, destacado ? f.bold : f.regular, cols, [k, v], destacado ? { fondo: COLOR_BG } : {});
  }
  doc.y += 12;
}

function drawFirma(doc: PDFKit.PDFDocument, f: Fonts, d: DatosJustificacion): void {
  ensureSpace(doc, 110);
  doc.y += 40;
  const ancho = 220;
  const x = MARGIN + contentWidth(doc) - ancho;
  doc.font(f.regular).fontSize(9).fillColor(COLOR_MUTED).text("Firma:", x, doc.y, { width: ancho });
  const yLinea = doc.y + 30;
  doc.save().moveTo(x, yLinea).lineTo(x + ancho, yLinea).lineWidth(0.7).strokeColor(COLOR_TEXT).stroke().restore();
  doc.font(f.bold).fontSize(10).fillColor(COLOR_TEXT).text(d.firmante.nombre, x, yLinea + 5, { width: ancho, align: "center" });
  if (d.firmante.ci) {
    doc.font(f.regular).fontSize(9).fillColor(COLOR_MUTED).text(`C.I. ${d.firmante.ci}`, x, doc.y + 1, { width: ancho, align: "center" });
  }
}

function drawPies(doc: PDFKit.PDFDocument, f: Fonts): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - MARGIN - 12;
    // Sin el margen inferior en 0, PDFKit agrega una página al escribir el pie.
    const prevBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(f.regular).fontSize(8).fillColor(COLOR_MUTED)
      .text(`Voltia · Energía solar fotovoltaica · voltia.com.uy`, MARGIN, y, { width: contentWidth(doc), align: "left", lineBreak: false })
      .text(`Página ${i - range.start + 1} de ${range.count}`, MARGIN, y, { width: contentWidth(doc), align: "right", lineBreak: false });
    doc.page.margins.bottom = prevBottom;
  }
}

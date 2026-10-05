// Lectura del CONTENIDO de un adjunto, para que lo pueda leer una persona o
// un modelo sin abrir el archivo.
//
// Según el tipo:
//  - PDF con texto (memorias, informes, propuestas) → el texto.
//  - Unifilar o lámina de gabinete nuestros → el plano vuelto a dibujar como
//    imagen: en PDF no tienen texto, porque los rótulos van como trazos.
//  - Planilla de Excel (listas de materiales, formularios de UTE) → las filas.
//  - Imagen (foto de obra, plano escaneado, documento fotografiado) → la
//    imagen reducida, para mandarla como imagen y que se vea.
//
// Un PDF escaneado que no sea un unifilar no se puede leer acá: no hay un
// renderer de PDF en el servidor. Se avisa y queda el enlace de descarga.

import ExcelJS from "exceljs";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { PDFParse } from "pdf-parse";

import { prisma } from "../../lib/prisma.js";
import { getStoredFilePath } from "../file-storage.service.js";
import { buildGabineteSvgs, type GabineteInputs } from "../gabineteSvg/index.js";
import { generateUnifilarSvg } from "../unifilarSvg/index.js";
import { inputsFromVersion } from "../unifilarSvg/from-version.js";

/** Lado más largo al que se reduce una foto antes de mandarla. */
const LADO_MAX_PX = 1400;

/** Los planos van más grandes: hay que poder leer los rótulos y las cotas. */
const LADO_MAX_PLANO_PX = 1700;

/** Tope de filas que se vuelcan de una planilla. */
const FILAS_MAX = 400;

/**
 * Menos texto que esto es un PDF sin texto de verdad (un escaneado, o un plano
 * con los rótulos dibujados como trazos): lo que sale es basura de la caja de
 * página, no contenido.
 */
const MINIMO_TEXTO_PDF = 40;

export interface ImagenAdjunta {
  base64: string;
  mediaType: "image/jpeg";
}

export type ContenidoAdjunto =
  | { tipo: "texto"; texto: string }
  /** Una o varias imágenes (un plano puede tener varias hojas). */
  | { tipo: "imagen"; imagenes: ImagenAdjunta[]; nota?: string }
  | { tipo: "no-legible"; motivo: string };

export interface AdjuntoLeible {
  /** Id del FileAttachment: hace falta para volver a dibujar una lámina. */
  id?: string;
  filename: string;
  mimeType: string | null;
  /** Ruta relativa dentro del storage (`FileAttachment.url`). */
  url: string;
  /** Herramienta que lo generó, si salió de una (`unifilar`, `preing`, …). */
  toolSource?: string | null;
  /** Id de la entidad que lo generó (la versión del unifilar, por ejemplo). */
  toolEntityId?: string | null;
}

function esImagen(mimeType: string | null | undefined, filename: string): boolean {
  if (mimeType?.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(filename);
}

function esPdf(mimeType: string | null | undefined, filename: string): boolean {
  return mimeType === "application/pdf" || /\.pdf$/i.test(filename);
}

function esExcel(mimeType: string | null | undefined, filename: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(filename) || (mimeType ?? "").includes("spreadsheetml");
}

/** El texto de un PDF, o vacío si no tiene. */
async function textoDePdf(ruta: string): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(await readFile(ruta)) });
  try {
    const r = await parser.getText();
    return (r.text ?? "").trim();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/**
 * Vuelve a dibujar un unifilar a partir de la versión guardada y lo devuelve
 * como imagen. El dibujo sale del generador de hoy sobre los datos de esa
 * versión: si el generador cambió desde que se emitió el PDF, puede no ser
 * idéntico al archivo (los datos sí son los de esa versión).
 */
async function svgsAImagenes(svgs: string[]): Promise<ImagenAdjunta[]> {
  const salida: ImagenAdjunta[] = [];
  for (const svg of svgs) {
    const jpeg = await sharp(Buffer.from(svg), { density: 150 })
      .resize({ width: LADO_MAX_PLANO_PX, height: LADO_MAX_PLANO_PX, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 })
      .toBuffer();
    salida.push({ base64: jpeg.toString("base64"), mediaType: "image/jpeg" });
  }
  return salida;
}

const NOTA_REDIBUJADO =
  "Plano vuelto a dibujar con los datos guardados de esa versión (el PDF no tiene texto que se pueda leer).";

async function dibujarUnifilar(versionId: string): Promise<ContenidoAdjunto | null> {
  const version = await prisma.unifilarVersion.findUnique({ where: { id: versionId } });
  if (!version) return null;
  try {
    const imagenes = await svgsAImagenes([generateUnifilarSvg(inputsFromVersion(version))]);
    return { tipo: "imagen", imagenes, nota: NOTA_REDIBUJADO };
  } catch {
    return null;
  }
}

/**
 * La lámina del gabinete, vuelta a dibujar desde el snapshot que quedó guardado
 * con esa versión. Son varias hojas: cada una va como una imagen.
 */
async function dibujarGabinete(attachmentId: string): Promise<ContenidoAdjunto | null> {
  const version = await prisma.cabinetDesignVersion.findFirst({
    where: { fileAttachmentId: attachmentId },
    select: { snapshot: true },
  });
  if (!version?.snapshot) return null;
  try {
    const imagenes = await svgsAImagenes(buildGabineteSvgs(version.snapshot as unknown as GabineteInputs));
    return { tipo: "imagen", imagenes, nota: NOTA_REDIBUJADO };
  } catch {
    return null;
  }
}

/** El valor de una celda como texto, incluyendo fórmulas, links y texto con formato. */
function valorDeCelda(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (Array.isArray(o.richText)) {
      return (o.richText as Array<{ text?: string }>).map((t) => t.text ?? "").join("");
    }
    if ("result" in o) return String(o.result ?? "");
    if ("text" in o) return String(o.text ?? "");
    if ("hyperlink" in o) return String(o.hyperlink ?? "");
    return "";
  }
  return String(v);
}

/** Las filas de una planilla como texto, hoja por hoja. */
async function textoDeExcel(ruta: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ruta);
  const partes: string[] = [];
  for (const hoja of wb.worksheets) {
    const filas: string[] = [];
    hoja.eachRow({ includeEmpty: false }, (row, numero) => {
      if (numero > FILAS_MAX) return;
      const celdas = (row.values as unknown[]).slice(1).map(valorDeCelda);
      // Las celdas combinadas repiten el mismo valor en cada columna que
      // ocupan: se deja una sola, si no una fila de título sale catorce veces.
      const limpias = celdas.filter((c, i) => c.trim() !== "" && c !== celdas[i - 1]);
      if (limpias.length > 0) filas.push(limpias.join(" | "));
    });
    if (filas.length === 0) continue;
    const corte = hoja.rowCount > FILAS_MAX ? `\n[…${hoja.rowCount - FILAS_MAX} filas más]` : "";
    partes.push(`Hoja "${hoja.name}"\n${filas.join("\n")}${corte}`);
  }
  return partes.join("\n\n") || "La planilla está vacía.";
}

/**
 * Devuelve el contenido legible de un adjunto. Nunca lanza: si no se puede
 * leer, lo dice con el motivo, que es lo que se le muestra a la persona.
 */
export async function leerContenidoAdjunto(adjunto: AdjuntoLeible): Promise<ContenidoAdjunto> {
  const ruta = getStoredFilePath(adjunto.url);
  if (!fs.existsSync(ruta)) {
    return { tipo: "no-legible", motivo: "el archivo no está en el servidor" };
  }

  if (esPdf(adjunto.mimeType, adjunto.filename)) {
    // Un unifilar nuestro es un PDF sin texto, pero sus datos están guardados:
    // se vuelve a dibujar y se manda como imagen, que es la única forma de
    // "leer" un plano.
    if (adjunto.toolSource === "unifilar" && adjunto.toolEntityId) {
      const dibujo = await dibujarUnifilar(adjunto.toolEntityId);
      if (dibujo) return dibujo;
    }
    if (adjunto.toolSource === "gabinete" && adjunto.id) {
      const dibujo = await dibujarGabinete(adjunto.id);
      if (dibujo) return dibujo;
    }
    let texto: string;
    try {
      texto = await textoDePdf(ruta);
    } catch {
      // PDF roto o con una estructura que la librería no abre.
      return { tipo: "no-legible", motivo: "el PDF está dañado o no se puede abrir" };
    }
    if (texto.length >= MINIMO_TEXTO_PDF) return { tipo: "texto", texto };
    return {
      tipo: "no-legible",
      motivo:
        "es un PDF sin texto: un escaneado, o un plano con los rótulos dibujados como trazos. " +
        "Hay que abrirlo con el enlace para verlo",
    };
  }

  if (esImagen(adjunto.mimeType, adjunto.filename)) {
    try {
      const jpeg = await sharp(ruta)
        .rotate()
        .resize({ width: LADO_MAX_PX, height: LADO_MAX_PX, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      return { tipo: "imagen", imagenes: [{ base64: jpeg.toString("base64"), mediaType: "image/jpeg" }] };
    } catch {
      return { tipo: "no-legible", motivo: "no se pudo procesar la imagen" };
    }
  }

  if (esExcel(adjunto.mimeType, adjunto.filename)) {
    try {
      return { tipo: "texto", texto: await textoDeExcel(ruta) };
    } catch {
      return { tipo: "no-legible", motivo: "no se pudo leer la planilla" };
    }
  }

  return {
    tipo: "no-legible",
    motivo: `no se puede leer el contenido de un ${adjunto.filename.split(".").pop() ?? "archivo"} desde el chat`,
  };
}

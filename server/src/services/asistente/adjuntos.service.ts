// Archivos que la persona le pasa al asistente: fotos, PDF, Excel, Word y texto.
//
// Se suben antes de mandar el mensaje (`guardarAdjunto`), y en el mensaje se
// convierten en bloques que Claude lee (`bloquesDeAdjuntos`):
// - fotos → imagen (HEIC se pasa a JPEG; las grandes se achican, porque el
//   modelo igual las reduce y cada píxel de más es costo);
// - PDF → documento (Claude lee el texto y las páginas como imagen);
// - Excel → texto, hoja por hoja;
// - Word → texto (un .docx es un zip: se lee word/document.xml);
// - .txt / .csv / .md → texto.
// Se analizan solo en el mensaje en que se mandan; en los siguientes viajan
// como una referencia con el nombre, para no cobrarlos en cada mensaje.

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import type Anthropic from "@anthropic-ai/sdk";
import type { MultipartFile } from "@fastify/multipart";
import ExcelJS from "exceljs";
import sharp from "sharp";

import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { badRequest } from "../../utils/errors.js";
import { convertirHeicABufferJpeg, esHeic, renombrarAJpeg } from "../heic.service.js";

export const MAX_ADJUNTO_MB = 25;
export const MAX_ADJUNTOS_POR_MENSAJE = 5;
/** Tope del texto que se saca de un Excel o un Word. */
const MAX_TEXTO = 150_000;
/** Lado mayor de una imagen: más que esto el modelo lo reduce igual. */
const MAX_LADO_IMAGEN = 1568;

type Tipo = "imagen" | "pdf" | "excel" | "word" | "texto";

const POR_EXTENSION: Record<string, Tipo> = {
  ".jpg": "imagen",
  ".jpeg": "imagen",
  ".png": "imagen",
  ".webp": "imagen",
  ".gif": "imagen",
  ".heic": "imagen",
  ".heif": "imagen",
  ".pdf": "pdf",
  ".xlsx": "excel",
  ".docx": "word",
  ".txt": "texto",
  ".csv": "texto",
  ".md": "texto",
};

export const EXTENSIONES_ADJUNTO = Object.keys(POR_EXTENSION);

function tipoDe(nombre: string): Tipo | null {
  return POR_EXTENSION[path.extname(nombre).toLowerCase()] ?? null;
}

function dirUsuario(userId: string) {
  return path.resolve(process.cwd(), "..", env.storagePath, "asistente", userId);
}

export function rutaAbsoluta(ruta: string) {
  return path.resolve(process.cwd(), "..", env.storagePath, ruta);
}

export async function guardarAdjunto(part: MultipartFile, userId: string) {
  let nombre = part.filename || "archivo";
  const heic = esHeic({ filename: nombre, mimetype: part.mimetype });
  const tipo = heic ? "imagen" : tipoDe(nombre);
  if (!tipo) {
    throw badRequest(
      "TIPO_NO_ADMITIDO",
      "Ese tipo de archivo no se puede adjuntar. Sirven fotos, PDF, Excel (.xlsx), Word (.docx) y texto.",
    );
  }

  let buffer = await part.toBuffer();
  if (part.file.truncated) throw badRequest("ARCHIVO_GRANDE", `El archivo supera los ${MAX_ADJUNTO_MB} MB.`);
  let mimeType = part.mimetype || "application/octet-stream";

  if (heic) {
    buffer = await convertirHeicABufferJpeg(buffer);
    nombre = renombrarAJpeg(nombre);
    mimeType = "image/jpeg";
  } else if (tipo === "imagen") {
    // Normaliza a algo que la API acepte siempre y achica lo grande.
    const img = sharp(buffer, { animated: false }).rotate();
    const meta = await img.metadata();
    const grande = Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_LADO_IMAGEN;
    if (grande || !["jpeg", "png", "webp", "gif"].includes(meta.format ?? "")) {
      buffer = await img
        .resize({ width: MAX_LADO_IMAGEN, height: MAX_LADO_IMAGEN, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      mimeType = "image/jpeg";
      nombre = nombre.replace(/\.[^.]+$/, ".jpg");
    } else {
      mimeType = `image/${meta.format}`;
    }
  }

  const dir = dirUsuario(userId);
  await fs.mkdir(dir, { recursive: true });
  const archivo = `${randomUUID()}${path.extname(nombre).toLowerCase()}`;
  await fs.writeFile(path.join(dir, archivo), buffer);

  const fila = await prisma.asistenteAdjunto.create({
    data: {
      userId,
      nombre,
      mimeType,
      ruta: `asistente/${userId}/${archivo}`,
      sizeBytes: buffer.length,
    },
    select: { id: true, nombre: true, mimeType: true, sizeBytes: true },
  });
  return fila;
}

/** Los adjuntos del usuario que todavía no se mandaron, en el orden pedido. */
export async function adjuntosPendientes(userId: string, ids: string[]) {
  if (ids.length === 0) return [];
  const filas = await prisma.asistenteAdjunto.findMany({
    where: { id: { in: ids }, userId, mensajeId: null },
  });
  if (filas.length !== ids.length) {
    throw badRequest("ADJUNTO_INVALIDO", "Algún adjunto ya no está disponible. Volvé a adjuntarlo.");
  }
  return ids.map((id) => filas.find((f) => f.id === id)!);
}

export async function adjuntoDeUsuario(userId: string, id: string) {
  const a = await prisma.asistenteAdjunto.findUnique({ where: { id } });
  return a && a.userId === userId ? a : null;
}

export async function atarAdjuntos(ids: string[], mensajeId: string) {
  if (ids.length === 0) return;
  await prisma.asistenteAdjunto.updateMany({ where: { id: { in: ids } }, data: { mensajeId } });
}

// ─── Lectura ────────────────────────────────────────────────────────────────

/** Una entrada de un zip, sin librerías: directorio central + inflate. */
function entradaZip(zip: Buffer, buscada: string): Buffer | null {
  // Fin del directorio central: firma 0x06054b50, buscando desde el final.
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const entradas = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < entradas; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) return null;
    const metodo = zip.readUInt16LE(p + 10);
    const comprimido = zip.readUInt32LE(p + 20);
    const largoNombre = zip.readUInt16LE(p + 28);
    const largoExtra = zip.readUInt16LE(p + 30);
    const largoComentario = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const nombre = zip.toString("utf8", p + 46, p + 46 + largoNombre);
    if (nombre === buscada) {
      const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const datos = zip.subarray(inicio, inicio + comprimido);
      return metodo === 0 ? datos : inflateRawSync(datos);
    }
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return null;
}

function textoDeWord(buffer: Buffer): string {
  const xml = entradaZip(buffer, "word/document.xml");
  if (!xml) return "(no se pudo leer el documento de Word)";
  return xml
    .toString("utf8")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function textoDeExcel(buffer: Buffer): Promise<string> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  const partes: string[] = [];
  libro.eachSheet((hoja) => {
    const filas: string[] = [];
    hoja.eachRow({ includeEmpty: false }, (fila) => {
      const valores = (fila.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (v instanceof Date) return v.toISOString().slice(0, 16).replace("T", " ");
        if (typeof v === "object") {
          const o = v as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> };
          if (o.richText) return o.richText.map((r) => r.text).join("");
          return String(o.result ?? o.text ?? "");
        }
        return String(v);
      });
      filas.push(valores.join("\t"));
    });
    partes.push(`### Hoja "${hoja.name}" (${filas.length} filas)\n${filas.join("\n")}`);
  });
  return partes.join("\n\n");
}

function recortar(texto: string) {
  return texto.length > MAX_TEXTO ? `${texto.slice(0, MAX_TEXTO)}\n[…recortado: el archivo es más largo]` : texto;
}

type Adjunto = { id: string; nombre: string; mimeType: string; ruta: string };

export async function bloquesDeAdjuntos(adjuntos: Adjunto[]): Promise<Anthropic.ContentBlockParam[]> {
  const bloques: Anthropic.ContentBlockParam[] = [];
  for (const a of adjuntos) {
    const buffer = await fs.readFile(rutaAbsoluta(a.ruta));
    const tipo = a.mimeType.startsWith("image/") ? "imagen" : tipoDe(a.nombre);
    if (tipo === "imagen") {
      bloques.push({ type: "text", text: `Adjunto: ${a.nombre}` });
      bloques.push({
        type: "image",
        source: {
          type: "base64",
          media_type: a.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: buffer.toString("base64"),
        },
      });
    } else if (tipo === "pdf") {
      bloques.push({
        type: "document",
        title: a.nombre,
        source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
      });
    } else {
      const texto =
        tipo === "excel" ? await textoDeExcel(buffer) : tipo === "word" ? textoDeWord(buffer) : buffer.toString("utf8");
      bloques.push({ type: "text", text: `<adjunto nombre="${a.nombre}">\n${recortar(texto)}\n</adjunto>` });
    }
  }
  return bloques;
}

/** Documentos pesados (PDF, Word, Excel): el modo automático los manda a Opus. */
export function hayDocumentos(adjuntos: Adjunto[]) {
  return adjuntos.some((a) => !a.mimeType.startsWith("image/"));
}

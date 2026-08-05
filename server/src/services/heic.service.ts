// Conversión de HEIC/HEIF a JPEG al momento de subir.
//
// Los iPhone sacan las fotos en HEIC. Ese formato entra a la app por todos los
// caminos de subida, pero no sirve para nada de lo que viene después: Chrome y
// Firefox no lo muestran en un `<img>`, sharp no lo decodifica (el build que
// trae el paquete tiene libheif pero sin el decodificador HEVC), el PDF de
// pre-ingeniería lo procesa con sharp, y la API de Claude —que lee las cédulas—
// solo acepta jpeg, png, gif y webp.
//
// Por eso se convierte al entrar, y no se guarda nunca el HEIC: así hay un solo
// lugar que sabe del formato y todo lo de río abajo sigue viendo un JPEG común.
//
// Se usa `heic-convert` (libheif compilado a WebAssembly) en vez de instalar un
// decodificador del sistema: el mismo paquete npm anda igual en el contenedor,
// en macOS y en cualquier arquitectura, sin tocar el Dockerfile.

import { promises as fsPromises } from "node:fs";
import path from "node:path";

import convert from "heic-convert";
import sharp from "sharp";

/**
 * Calidad del JPEG resultante. 85 con mozjpeg deja una foto de 12 MP en 2-3 MB
 * sin pérdida visible: alcanza para leer el display de un inversor o el número
 * de una cédula, que es para lo que se usan estas fotos.
 */
const JPEG_QUALITY = 85;

export const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

/**
 * Mimetypes que mandan los navegadores para un HEIC. Safari manda `image/heic`;
 * varios browsers de escritorio no reconocen la extensión y mandan
 * `application/octet-stream`, por eso la extensión del archivo es el criterio
 * principal y el mimetype solo confirma.
 */
export const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export function esHeic(args: { filename?: string | null; mimetype?: string | null }): boolean {
  const extension = args.filename ? path.extname(args.filename).toLowerCase() : "";
  if (HEIC_EXTENSIONS.has(extension)) return true;
  const base = (args.mimetype ?? "").split(";")[0].trim().toLowerCase();
  return HEIC_MIME_TYPES.has(base);
}

/**
 * Convierte un buffer HEIC a JPEG.
 *
 * Son dos pasos a propósito: `heic-convert` decodifica pero su encoder ignora la
 * calidad pedida y devuelve archivos enormes (11 MB para una foto de 12 MP), así
 * que la codificación final la hace sharp, que además normaliza la orientación.
 * libheif ya aplica la rotación del contenedor, y el JPEG intermedio no lleva
 * EXIF, así que el `.rotate()` no la duplica.
 */
export async function convertirHeicABufferJpeg(buffer: Buffer): Promise<Buffer> {
  const decodificado = await convert({ buffer, format: "JPEG", quality: 0.92 });
  return sharp(Buffer.from(decodificado)).rotate().jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
}

export interface ArchivoConvertido {
  absolutePath: string;
  storedFilename: string;
  sizeBytes: number;
}

/**
 * Convierte un HEIC que ya está en disco y **borra el original**. Devuelve la
 * ruta y el nombre del JPEG resultante, que conserva el mismo UUID con otra
 * extensión.
 *
 * Si la conversión falla, el HEIC original queda intacto y el error sube: es
 * preferible que la subida falle con un mensaje a guardar un archivo que después
 * no se va a poder ni mostrar ni procesar.
 */
export async function convertirArchivoHeicAJpeg(absolutePath: string): Promise<ArchivoConvertido> {
  const buffer = await fsPromises.readFile(absolutePath);
  const jpeg = await convertirHeicABufferJpeg(buffer);

  const dir = path.dirname(absolutePath);
  const base = path.basename(absolutePath, path.extname(absolutePath));
  const storedFilename = `${base}.jpg`;
  const destino = path.join(dir, storedFilename);

  await fsPromises.writeFile(destino, jpeg);
  await fsPromises.unlink(absolutePath).catch(() => undefined);

  return { absolutePath: destino, storedFilename, sizeBytes: jpeg.length };
}

/** `IMG_1234.HEIC` → `IMG_1234.jpg`, para que el nombre que ve el usuario no mienta. */
export function renombrarAJpeg(filename: string): string {
  const extension = path.extname(filename);
  return extension ? `${filename.slice(0, -extension.length)}.jpg` : `${filename}.jpg`;
}

/**
 * Banco de prueba de la conversión HEIC → JPEG.
 *
 *   docker compose exec server node --import tsx scripts/probar-conversion-heic.ts [ruta-a-un-heic]
 *
 * Sin argumento solo verifica la detección y avisa que no hay con qué probar la
 * conversión: no se puede generar un HEIC sintético desde acá, porque el
 * decodificador que usa la app no encodea. Para conseguir uno en una Mac:
 *
 *   sips -s format heic foto.jpg --out foto.heic
 *
 * Sirve sobre todo después de un deploy o de tocar dependencias: confirma que el
 * WASM de libheif quedó bien en la imagen y mide cuánto tarda de verdad en el
 * hardware del servidor.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

import { convertirArchivoHeicAJpeg, esHeic, renombrarAJpeg } from "../src/services/heic.service.js";

const CASOS_DETECCION = [
  { filename: "IMG_1234.HEIC", mimetype: "image/heic", esperado: true },
  { filename: "IMG_1234.heic", mimetype: "application/octet-stream", esperado: true },
  { filename: "sin-extension", mimetype: "image/heif", esperado: true },
  { filename: "x.HEIF", mimetype: "image/heic;charset=binary", esperado: true },
  { filename: "foto.jpg", mimetype: "image/jpeg", esperado: false },
  { filename: "doc.pdf", mimetype: "application/pdf", esperado: false },
];

async function probarDeteccion(): Promise<boolean> {
  console.log("Detección:");
  let ok = true;
  for (const caso of CASOS_DETECCION) {
    const resultado = esHeic(caso);
    const bien = resultado === caso.esperado;
    if (!bien) ok = false;
    console.log(
      `  ${bien ? "ok  " : "MAL "} esHeic("${caso.filename}", "${caso.mimetype}") = ${resultado}`,
    );
  }
  console.log(`  renombrarAJpeg("IMG_1234.HEIC") = ${renombrarAJpeg("IMG_1234.HEIC")}`);
  return ok;
}

async function probarConversion(origen: string) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "heic-"));
  const copia = path.join(tmp, "prueba.heic");
  await fs.copyFile(origen, copia);

  const bytesAntes = (await fs.stat(copia)).size;
  const inicio = Date.now();
  const convertido = await convertirArchivoHeicAJpeg(copia);
  const ms = Date.now() - inicio;

  const meta = await sharp(convertido.absolutePath).metadata();
  const quedoElOriginal = await fs
    .access(copia)
    .then(() => true)
    .catch(() => false);

  console.log("\nConversión:");
  console.log(`  ${kb(bytesAntes)} HEIC → ${kb(convertido.sizeBytes)} ${meta.format} en ${ms} ms`);
  console.log(`  ${meta.width}×${meta.height}, archivo: ${convertido.storedFilename}`);
  console.log(`  ${quedoElOriginal ? "MAL  el .heic original NO se borró" : "ok   el .heic original se borró"}`);

  // La miniatura es lo que fallaba antes: sharp no puede con un HEIC.
  const thumb = path.join(tmp, "thumb.jpg");
  await sharp(convertido.absolutePath)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toFile(thumb);
  const metaThumb = await sharp(thumb).metadata();
  console.log(`  miniatura ${metaThumb.width}×${metaThumb.height}, ${kb((await fs.stat(thumb)).size)}`);

  await fs.rm(tmp, { recursive: true, force: true });
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`;
}

async function main() {
  const deteccionOk = await probarDeteccion();

  const origen = process.argv[2];
  if (!origen) {
    console.log("\nSin archivo: pasá la ruta de un .heic para probar la conversión.");
  } else {
    await probarConversion(path.resolve(origen));
  }

  if (!deteccionOk) process.exit(1);
}

main().catch((error) => {
  console.error("Falló:", error);
  process.exit(1);
});

// Storage helpers de versiones de propuesta v2. Paths relativos a STORAGE_PATH,
// resueltos con la misma base que getStoredFilePath (lectura y escritura
// comparten base). Ver FASE_E_SPEC.md sección 5.
//
//   leads/{leadId}/proposals-v2/{versionId}/proposal-full.pdf
//   leads/{leadId}/proposals-v2/{versionId}/proposal-summary.pdf

import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { getStoredFilePath } from "../file-storage.service.js";

function versionDir(leadId: string, versionId: string): string {
  return `leads/${leadId}/proposals-v2/${versionId}`;
}

export function getVersionPdfPaths(leadId: string, versionId: string): {
  fullPath: string;
  summaryPath: string;
} {
  const dir = versionDir(leadId, versionId);
  return {
    fullPath: `${dir}/proposal-full.pdf`,
    summaryPath: `${dir}/proposal-summary.pdf`,
  };
}

/**
 * Escribe los dos PDFs a las rutas finales (mkdir recursivo). Si el segundo
 * write falla, borra el primero para no dejar un parcial. Devuelve los paths
 * relativos que van a la BD.
 */
export async function writeVersionPdfs(
  leadId: string,
  versionId: string,
  buffers: { fullBuffer: Buffer; summaryBuffer: Buffer },
): Promise<{ fullPath: string; summaryPath: string }> {
  const { fullPath, summaryPath } = getVersionPdfPaths(leadId, versionId);
  const absFull = getStoredFilePath(fullPath);
  const absSummary = getStoredFilePath(summaryPath);

  await fsPromises.mkdir(path.dirname(absFull), { recursive: true });
  await fsPromises.writeFile(absFull, buffers.fullBuffer);
  try {
    await fsPromises.writeFile(absSummary, buffers.summaryBuffer);
  } catch (err) {
    await fsPromises.unlink(absFull).catch(() => undefined);
    throw err;
  }

  return { fullPath, summaryPath };
}

/**
 * Lee un PDF de versión a Buffer. Tira si el archivo no existe (el route lo
 * mapea a 500). Buffer en vez de stream: los PDFs son chicos (~cientos de KB) y
 * el manejo de error → HTTP queda más simple.
 */
export async function readVersionPdf(relativePath: string): Promise<Buffer> {
  return fsPromises.readFile(getStoredFilePath(relativePath));
}

/**
 * Borra la carpeta de una versión (con lo que tenga). Uso EXCLUSIVO: cleanup del
 * catch de la publicación (fallo posterior a escribir, o reintento por P2002).
 * NO se usa en discard: el soft-delete conserva los archivos a propósito, por
 * eso no existe un `deleteVersionPdfsPhysically` general.
 */
export async function cleanupVersionDir(leadId: string, versionId: string): Promise<void> {
  const absDir = getStoredFilePath(versionDir(leadId, versionId));
  await fsPromises.rm(absDir, { recursive: true, force: true });
}

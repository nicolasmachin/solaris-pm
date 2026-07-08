// Storage helpers de versiones de contrato. Paths relativos a STORAGE_PATH,
// resueltos con getStoredFilePath (misma base para lectura y escritura).
//
//   projects/{projectId}/contracts/{versionId}/contract.pdf

import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { getStoredFilePath } from "../file-storage.service.js";

function versionDir(projectId: string, versionId: string): string {
  return `projects/${projectId}/contracts/${versionId}`;
}

export function getContractPdfPath(projectId: string, versionId: string): string {
  return `${versionDir(projectId, versionId)}/contract.pdf`;
}

// Escribe el PDF a su ruta final (mkdir recursivo). Devuelve el path relativo
// que va a la BD.
export async function writeContractPdf(
  projectId: string,
  versionId: string,
  buffer: Buffer,
): Promise<string> {
  const rel = getContractPdfPath(projectId, versionId);
  const abs = getStoredFilePath(rel);
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, buffer);
  return rel;
}

// Lee un PDF de versión a Buffer. Tira si no existe (el route lo mapea a error).
export async function readContractPdf(relativePath: string): Promise<Buffer> {
  return fsPromises.readFile(getStoredFilePath(relativePath));
}

// Borra la carpeta de una versión. Uso EXCLUSIVO: cleanup del catch de la
// publicación (fallo posterior a escribir, o reintento por P2002).
export async function cleanupContractVersionDir(
  projectId: string,
  versionId: string,
): Promise<void> {
  const absDir = getStoredFilePath(versionDir(projectId, versionId));
  await fsPromises.rm(absDir, { recursive: true, force: true });
}

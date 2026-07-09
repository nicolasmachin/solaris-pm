// Storage helpers de versiones de proforma. Paths relativos a STORAGE_PATH.
//   projects/{projectId}/proformas/{versionId}/proforma.pdf

import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { getStoredFilePath } from "../file-storage.service.js";

function versionDir(projectId: string, versionId: string): string {
  return `projects/${projectId}/proformas/${versionId}`;
}

export function getProformaPdfPath(projectId: string, versionId: string): string {
  return `${versionDir(projectId, versionId)}/proforma.pdf`;
}

export async function writeProformaPdf(
  projectId: string,
  versionId: string,
  buffer: Buffer,
): Promise<string> {
  const rel = getProformaPdfPath(projectId, versionId);
  const abs = getStoredFilePath(rel);
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, buffer);
  return rel;
}

export async function readProformaPdf(relativePath: string): Promise<Buffer> {
  return fsPromises.readFile(getStoredFilePath(relativePath));
}

export async function cleanupProformaVersionDir(
  projectId: string,
  versionId: string,
): Promise<void> {
  const absDir = getStoredFilePath(versionDir(projectId, versionId));
  await fsPromises.rm(absDir, { recursive: true, force: true });
}

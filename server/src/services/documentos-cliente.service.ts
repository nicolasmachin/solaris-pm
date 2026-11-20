/**
 * Cédula y factura de UTE del cliente como adjuntos del proyecto.
 *
 * Se suben desde "Documentos del cliente" de la ficha (o por suministro) para
 * que la IA extraiga los datos, y se guardan en
 * `storage/projects/{id}/ute-docs/...` con la ruta en `cedulaPath` /
 * `facturaUtePath`. Hasta nov-2026 no creaban un FileAttachment: el archivo
 * estaba en el server pero no había dónde descargarlo.
 *
 * El adjunto **apunta al mismo archivo** (no lo copia): `url` es la misma ruta
 * relativa que `cedulaPath` / `facturaUtePath`. Hay uno vigente por documento y
 * suministro; volver a subir lo reemplaza y quitar el documento lo retira. Desde
 * la lista de Documentos no se puede borrar (tiene toolSource): se reemplaza o
 * se quita desde su bloque.
 *
 * `sincronizarDocumentoCliente()` es idempotente. La llaman la subida y el
 * borrado, y el backfill `prisma/scripts/backfill-documentos-cliente.ts`.
 */

import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { FileAttachmentTipo } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { getStoredFilePath } from "./file-storage.service.js";
import { SUMINISTRO_PRINCIPAL, uteConfigKey } from "./suministros.service.js";

export const TOOL_SOURCE_CEDULA = "cedula-cliente";
export const TOOL_SOURCE_FACTURA_UTE = "factura-ute-cliente";

export type DocumentoCliente = "cedula" | "factura_ute";

const TOOL_SOURCE: Record<DocumentoCliente, string> = {
  cedula: TOOL_SOURCE_CEDULA,
  factura_ute: TOOL_SOURCE_FACTURA_UTE,
};

const NOMBRE: Record<DocumentoCliente, string> = {
  cedula: "Cédula",
  factura_ute: "Factura UTE",
};

/** Rótulo del adjunto ("Factura UTE", "Cédula · suministro 2"), o null si no es de estos. */
export function etiquetaDocumentoCliente(toolSource: string | null, suministro: number | null): string | null {
  const tipo = (Object.keys(TOOL_SOURCE) as DocumentoCliente[]).find((k) => TOOL_SOURCE[k] === toolSource);
  if (!tipo) return null;
  return suministro && suministro !== SUMINISTRO_PRINCIPAL ? `${NOMBRE[tipo]} · suministro ${suministro}` : NOMBRE[tipo];
}

const MIME_POR_EXT: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function nombreArchivo(tipo: DocumentoCliente, clientName: string, suministro: number, ext: string): string {
  const cliente = clientName.replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "Cliente";
  const sum = suministro === SUMINISTRO_PRINCIPAL ? "" : ` - suministro ${suministro}`;
  return `${NOMBRE[tipo]} - ${cliente}${sum}${ext}`;
}

export type ResultadoDocumentoCliente = "creado" | "ya-estaba" | "retirado" | "sin-documento" | "archivo-faltante";

/**
 * Deja el adjunto de `tipo` y `suministro` alineado con la ruta guardada en el
 * proyecto (o en la config UTE del suministro): lo crea si falta, retira los
 * que apuntan a otra ruta y, si ya no hay documento, retira todos. Retirar es
 * solo soft-delete: el archivo lo maneja quien sube o borra el documento.
 */
export async function sincronizarDocumentoCliente(
  projectId: string,
  tipo: DocumentoCliente,
  suministro: number,
  opts: { userId?: string; dryRun?: boolean; reemplazar?: boolean } = {},
): Promise<ResultadoDocumentoCliente> {
  const campo = tipo === "cedula" ? "cedulaPath" : "facturaUtePath";
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientName: true, createdById: true, cedulaPath: true, facturaUtePath: true },
  });
  if (!project) return "sin-documento";
  const ruta =
    suministro === SUMINISTRO_PRINCIPAL
      ? project[campo]
      : ((await prisma.uteDocumentConfig.findUnique({ where: uteConfigKey(projectId, suministro), select: { [campo]: true } }))?.[campo] as
          | string
          | null
          | undefined) ?? null;

  const suministroArchivo = suministro === SUMINISTRO_PRINCIPAL ? null : suministro;
  const actuales = await prisma.fileAttachment.findMany({
    where: { projectId, toolSource: TOOL_SOURCE[tipo], suministro: suministroArchivo, deletedAt: null },
    select: { id: true, url: true },
  });
  const retirar = async (ids: string[]) => {
    if (ids.length === 0 || opts.dryRun) return;
    await prisma.fileAttachment.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
  };

  if (!ruta) {
    await retirar(actuales.map((a) => a.id));
    return actuales.length > 0 ? "retirado" : "sin-documento";
  }

  let sizeBytes: number;
  try {
    sizeBytes = (await fsPromises.stat(getStoredFilePath(ruta))).size;
  } catch {
    return "archivo-faltante";
  }

  // La misma ruta se reutiliza al volver a subir (factura_ute.pdf pisa a
  // factura_ute.pdf): con `reemplazar` el adjunto se recrea igual para que tome
  // tamaño y fecha nuevos. Sin él (backfill), el que ya apunta ahí se respeta.
  const yaEsta = opts.reemplazar ? undefined : actuales.find((a) => a.url === ruta);
  if (yaEsta) {
    await retirar(actuales.filter((a) => a.id !== yaEsta.id).map((a) => a.id));
    return "ya-estaba";
  }
  if (opts.dryRun) return "creado";

  const ext = path.extname(ruta).toLowerCase();
  await prisma.fileAttachment.create({
    data: {
      projectId,
      filename: nombreArchivo(tipo, project.clientName, suministro, ext),
      storedFilename: path.basename(ruta),
      mimeType: MIME_POR_EXT[ext] ?? "application/octet-stream",
      sizeBytes,
      url: ruta,
      tipo: FileAttachmentTipo.OTRO,
      toolSource: TOOL_SOURCE[tipo],
      suministro: suministroArchivo,
      uploadedById: opts.userId ?? project.createdById,
    },
  });
  await retirar(actuales.map((a) => a.id));
  return "creado";
}

/** Best-effort: si falla, la extracción con IA no se cae (el archivo ya quedó guardado). */
export async function sincronizarDocumentoClienteSeguro(
  projectId: string,
  tipo: DocumentoCliente,
  suministro: number,
  userId: string,
  log?: { warn: (obj: unknown, msg: string) => void },
): Promise<void> {
  try {
    await sincronizarDocumentoCliente(projectId, tipo, suministro, { userId, reemplazar: true });
  } catch (err) {
    log?.warn({ err }, `No se pudo dejar la ${NOMBRE[tipo].toLowerCase()} en Documentos del proyecto`);
  }
}

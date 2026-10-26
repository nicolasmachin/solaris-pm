// Publicación automática de los manuales del equipo en Documentación.
//
// Los PDF publicados viven en `server/manuales/` (dentro de la imagen del
// server) junto con `manuales.json`, que dice qué es cada uno. Al arrancar —o
// sea, en cada deploy— se compara el hash de cada PDF con el de su última
// versión publicada; si cambió, se publica una versión nueva y se avisa a los
// roles del manual. Si no cambió, no pasa nada: arrancar dos veces no duplica.
//
// El número de versión se lee de la portada del PDF ("Versión 1.4 · del
// 22/10/26"), que es lo que el lector ve impreso; el del manifiesto queda como
// respaldo. Las notas ("qué cambió") salen de `notas` del manifiesto, que
// completa `docs/publicar-manual.mjs` con el registro de cambios del .md.
//
// Título, categoría y roles del manifiesto se usan solo al crear el documento:
// después mandan los que se ajusten desde la app.

import { createHash } from "node:crypto";
import fsPromises from "node:fs/promises";
import path from "node:path";

import { DocumentoOrigen } from "@prisma/client";
import { PDFParse } from "pdf-parse";

import { prisma } from "../../lib/prisma.js";
import { saveBufferAsAttachment } from "../file-storage.service.js";
import { avisarNuevaVersion } from "./documentacion.service.js";

export const DIR_MANUALES = path.resolve(process.cwd(), "manuales");

export type EntradaManifiesto = {
  slug: string;
  titulo: string;
  descripcion?: string;
  categoria: string;
  archivo: string;
  // Nombres de rol, o "INTERNOS" para todos menos el portal de clientes.
  roles: string[] | "INTERNOS";
  requiereLectura?: boolean;
  // Respaldo si la portada no se puede leer.
  version?: string;
  // Qué cambió en cada versión, por número de versión.
  notas?: Record<string, string>;
};

/** "Versión 1.4 · del 22/10/26" → { version: "1.4", vigenteDesde: "2026-10-22" }. */
export function leerPortada(texto: string): { version: string | null; vigenteDesde: string | null } {
  const v = texto.match(/Versi[oó]n\s+(\d+(?:\.\d+)*)/i);
  const f = texto.match(/Versi[oó]n\s+\d+(?:\.\d+)*\s*[·—-]\s*del\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
  let vigenteDesde: string | null = null;
  if (f) {
    const anio = f[3].length === 2 ? `20${f[3]}` : f[3];
    vigenteDesde = `${anio}-${f[2].padStart(2, "0")}-${f[1].padStart(2, "0")}`;
  }
  return { version: v ? v[1] : null, vigenteDesde };
}

async function textoPortada(buffer: Buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const r = await parser.getText({ first: 2 });
    return r.text ?? "";
  } catch {
    return "";
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function roleIdsDe(roles: EntradaManifiesto["roles"]) {
  const todos = await prisma.role.findMany({ select: { id: true, name: true } });
  if (roles === "INTERNOS") return todos.filter((r) => r.name !== "CLIENT").map((r) => r.id);
  const porNombre = new Map(todos.map((r) => [r.name, r.id]));
  return roles.flatMap((n) => {
    const id = porNombre.get(n);
    if (!id) console.warn(`[manuales] El rol ${n} no existe: se omite.`);
    return id ? [id] : [];
  });
}

async function sincronizarUno(e: EntradaManifiesto, log: (m: string) => void) {
  const ruta = path.join(DIR_MANUALES, e.archivo);
  let buffer: Buffer;
  try {
    buffer = await fsPromises.readFile(ruta);
  } catch {
    log(`${e.slug}: falta ${e.archivo}, se saltea.`);
    return;
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  let doc = await prisma.documento.findUnique({
    where: { slug: e.slug },
    select: { id: true, versiones: { orderBy: { createdAt: "desc" }, take: 1, select: { sha256: true, version: true } } },
  });
  const ultima = doc?.versiones[0];
  // Ese PDF ya se publicó alguna vez: no se republica. Contra cualquier versión
  // y no solo la última, para que una corrección subida a mano no la pise el
  // deploy siguiente con el PDF viejo del repo.
  if (doc && (await prisma.documentoVersion.count({ where: { documentoId: doc.id, sha256 } })) > 0) return;

  const portada = leerPortada(await textoPortada(buffer));
  const version = portada.version ?? e.version ?? "s/n";

  if (!doc) {
    const roleIds = await roleIdsDe(e.roles);
    doc = await prisma.documento.create({
      data: {
        slug: e.slug,
        titulo: e.titulo,
        descripcion: e.descripcion ?? null,
        categoria: e.categoria,
        origen: DocumentoOrigen.MANUAL_SINCRONIZADO,
        requiereLectura: e.requiereLectura ?? false,
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
      select: { id: true, versiones: { take: 0, select: { sha256: true, version: true } } },
    });
  }

  const saved = await saveBufferAsAttachment(buffer, `${e.titulo} v${version}.pdf`, "application/pdf", "documentacion");
  await prisma.documentoVersion.create({
    data: {
      documentoId: doc.id,
      version,
      vigenteDesde: portada.vigenteDesde ? new Date(portada.vigenteDesde) : null,
      notas: e.notas?.[version] ?? null,
      filename: saved.filename,
      storedFilename: saved.storedFilename,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      url: saved.url,
      sha256,
      publicadoPorId: null,
    },
  });
  await prisma.documento.update({ where: { id: doc.id }, data: { updatedAt: new Date() } });

  // Avisa solo cuando hay una versión de verdad nueva. No avisa la primera carga
  // de un manual (es el estreno de la sección, no un cambio), ni un PDF rehecho
  // con el mismo número (un ajuste de maquetado).
  const avisados = !ultima || ultima.version === version ? 0 : await avisarNuevaVersion(doc.id, version, null);
  log(`${e.slug}: publicada la versión ${version}${avisados ? ` (aviso a ${avisados} personas)` : ""}.`);
}

export async function sincronizarManuales(log: (m: string) => void = (m) => console.log(`[manuales] ${m}`)) {
  let manifiesto: EntradaManifiesto[];
  try {
    manifiesto = JSON.parse(await fsPromises.readFile(path.join(DIR_MANUALES, "manuales.json"), "utf8"));
  } catch (err) {
    log(`No se pudo leer manuales.json: ${(err as Error).message}`);
    return;
  }
  // De a uno: un manual roto no frena a los demás.
  for (const e of manifiesto) {
    try {
      await sincronizarUno(e, log);
    } catch (err) {
      console.error(`[manuales] ${e.slug} falló:`, err);
    }
  }
}

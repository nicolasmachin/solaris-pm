// Miniaturas y descarga de documentos de capacitación.
//
// No se linkea el CDN de Bunny directo desde el navegador: la biblioteca tiene
// "Block direct url file access" (rechaza pedidos sin referer) y, sobre todo,
// una URL de Bunny la ve cualquiera que la copie. Las sirve la app desde su
// propio dominio:
//   1. la primera vez las baja de Bunny (mandando Referer) y las cachea en
//      `storage/capacitacion/miniaturas/`;
//   2. después salen del disco, sin pegarle a Bunny ni gastar su ancho de banda.
//
// Ni un `<img>` ni un enlace de descarga pueden mandar el header Authorization,
// así que el permiso viaja como token firmado de vida corta en la query — el
// mismo patrón que el stream de los videos de ensayo (`videos.routes.ts`). El
// mismo token sirve para miniaturas y documentos: lo emiten los endpoints
// normales, que sí pasan por `authenticate` + `authorize`.

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";

import jwt from "jsonwebtoken";

import { env } from "../../config/env.js";
import { badRequest, unauthorized } from "../../utils/errors.js";
import { descargarMiniatura } from "../bunny-stream.service.js";

const TOKEN_TYP = "capacitacion-media";
const TOKEN_TTL = "2h";
// Un nombre de archivo de Bunny ("thumbnail.jpg"): sin barras ni "..".
const FILENAME_OK = /^[A-Za-z0-9._-]{1,120}$/;

export type ThumbToken = { sub: string; role: string; typ: string };

export function firmarTokenMedia(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role, typ: TOKEN_TYP }, env.jwtSecret, {
    expiresIn: TOKEN_TTL,
  });
}

export function verificarTokenMedia(token: string) {
  let payload: ThumbToken;
  try {
    payload = jwt.verify(token, env.jwtSecret) as ThumbToken;
  } catch {
    throw unauthorized("El enlace venció: recargá la página");
  }
  if (payload.typ !== TOKEN_TYP) throw unauthorized("Este token no habilita ver este contenido");
  return { id: payload.sub, role: payload.role };
}

function rutaCache(bunnyVideoId: string, filename: string) {
  if (!FILENAME_OK.test(bunnyVideoId) || !FILENAME_OK.test(filename)) {
    throw badRequest("MINIATURA_INVALIDA", "Nombre de miniatura inválido");
  }
  return path.resolve(
    process.cwd(),
    "..",
    env.storagePath,
    "capacitacion",
    "miniaturas",
    `${bunnyVideoId}__${filename}`,
  );
}

/**
 * Ruta local de la miniatura, bajándola de Bunny la primera vez. Devuelve null
 * si Bunny no la tiene (video borrado allá): la UI cae al placeholder.
 */
export async function miniaturaLocal(bunnyVideoId: string, filename: string) {
  const destino = rutaCache(bunnyVideoId, filename);
  const stat = await fsPromises.stat(destino).catch(() => null);
  if (stat?.isFile() && stat.size > 0) return destino;

  const descargada = await descargarMiniatura(bunnyVideoId, filename);
  if (!descargada) return null;
  await fsPromises.mkdir(path.dirname(destino), { recursive: true });
  // Escritura atómica: dos pedidos simultáneos del mismo thumbnail no se pisan
  // dejando un archivo a medio escribir en la cache.
  const tmp = `${destino}.${process.pid}.tmp`;
  await fsPromises.writeFile(tmp, descargada.buffer);
  await fsPromises.rename(tmp, destino);
  return destino;
}

export function streamMiniatura(absolutePath: string) {
  return fs.createReadStream(absolutePath);
}

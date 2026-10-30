/**
 * Lo que va y viene con el servidor de indicadores (indicadores.voltia.com.uy):
 * de allá viene el token de Meta (ver meta.ts) y, en modo sombra, la copia de
 * los avisos de Meta; para allá van las consultas por día para la planilla.
 *
 * Un solo secreto compartido (`INSTAGRAM_CONECTOR_SECRETO` acá,
 * `VOLTIA_PM_SECRETO` allá), como Bearer en los dos sentidos. Nunca se loguea.
 */

import { timingSafeEqual } from "node:crypto";

import { instagramConectorConfig } from "./config.js";

/** ¿La cabecera Authorization trae el secreto compartido? Sin secreto configurado, nunca. */
export function secretoValido(authorization: string | undefined): boolean {
  const { secreto } = instagramConectorConfig();
  if (!secreto || !authorization?.startsWith("Bearer ")) return false;
  const a = Buffer.from(authorization.slice("Bearer ".length).trim());
  const b = Buffer.from(secreto);
  return a.length === b.length && timingSafeEqual(a, b);
}

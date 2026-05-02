// Parser y marker IEC para etiquetas de cables (sección 7.4 spec).

import { COLOR } from "./layout.js";

/**
 * Parsea texto de cable y devuelve cantidad de conductores activos + flag PE.
 *
 *   "2x6 PVC 1m"        → { activos: 2, tienePe: false }
 *   "2x4+4PE PVC 15m"   → { activos: 2, tienePe: true }
 *   "4x10+10PE PVC 1m"  → { activos: 4, tienePe: true }
 *   "2x6 solar +6PE"    → { activos: 2, tienePe: true }
 *   "6PE PVC 3m"        → { activos: 0, tienePe: true }
 */
export function parseCableCount(text: string): { activos: number; tienePe: boolean } {
  const m = text.match(/^\s*(\d+)x/);
  const activos = m ? parseInt(m[1], 10) : 0;
  const tienePe = /\+\s*\d+\s*PE\b|^\s*\d+\s*PE\b/.test(text);
  return { activos, tienePe };
}

/** Marker IEC vertical (rayitas diagonales sobre cable vertical). */
export function cableMarker(xEje: number, y: number, text: string, dyPerLine = 4): string {
  const { activos, tienePe } = parseCableCount(text);
  const longLen = 5;
  const shortLen = 2.5;
  const totalMarks = activos + (tienePe ? 1 : 0);

  if (totalMarks === 0) {
    return `<line x1="${xEje - 4}" y1="${y + 4}" x2="${xEje + 4}" y2="${y - 4}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  }

  const spacing = dyPerLine;
  const startY = y - ((totalMarks - 1) * spacing) / 2;
  let out = "";

  for (let i = 0; i < activos; i++) {
    const my = startY + i * spacing;
    out += `<line x1="${xEje - longLen}" y1="${my + longLen}" x2="${xEje + longLen}" y2="${my - longLen}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  }

  if (tienePe) {
    const my = startY + activos * spacing;
    out += `<line x1="${xEje - shortLen}" y1="${my + shortLen}" x2="${xEje + shortLen}" y2="${my - shortLen}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  }

  return out;
}

/** Marker IEC horizontal (rayitas diagonales sobre cable horizontal). */
export function cableMarkerH(x: number, yEje: number, text: string, dxPerLine = 4): string {
  const { activos, tienePe } = parseCableCount(text);
  const longLen = 5;
  const shortLen = 2.5;
  const totalMarks = activos + (tienePe ? 1 : 0);

  if (totalMarks === 0) {
    return `<line x1="${x - 3}" y1="${yEje - 3}" x2="${x + 3}" y2="${yEje + 3}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  }

  const spacing = dxPerLine;
  const startX = x - ((totalMarks - 1) * spacing) / 2;
  let out = "";

  for (let i = 0; i < activos; i++) {
    const mx = startX + i * spacing;
    out += `<line x1="${mx - longLen}" y1="${yEje + longLen}" x2="${mx + longLen}" y2="${yEje - longLen}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  }

  if (tienePe) {
    const mx = startX + activos * spacing;
    out += `<line x1="${mx - shortLen}" y1="${yEje + shortLen}" x2="${mx + shortLen}" y2="${yEje - shortLen}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  }

  return out;
}

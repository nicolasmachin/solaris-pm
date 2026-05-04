// Símbolos IEC simplificados para el unifilar (sección 7.3 spec).
// Cada función devuelve markup SVG dado (x, y) y opciones.

import { COLOR, FONT } from "./layout.js";

export function label(
  x: number,
  y: number,
  text: string,
  opts: { size?: number; anchor?: "start" | "middle" | "end"; weight?: "normal" | "bold"; color?: string } = {},
): string {
  const size = opts.size ?? 9;
  const anchor = opts.anchor ?? "start";
  const weight = opts.weight ?? "normal";
  const color = opts.color ?? COLOR.text;
  const safe = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${color}" text-anchor="${anchor}" font-weight="${weight}">${safe}</text>`;
}

export function vline(x: number, y1: number, y2: number, color: string = COLOR.wire, width = 1.2): string {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
}

export function hline(x1: number, x2: number, y: number, color: string = COLOR.wire, width = 1.2): string {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${width}"/>`;
}

export function symPanel(x: number, y: number, _nPaneles: number, nStrings: number): string {
  let out = '<g class="panel-array">';
  const nShow = Math.min(nStrings, 4);
  const modW = 70;
  const modH = 38;
  const gap = 14;
  const totalW = nShow * modW + (nShow - 1) * gap;
  const startX = x - totalW / 2;

  for (let s = 0; s < nShow; s++) {
    const mx = startX + s * (modW + gap);
    out += `<rect x="${mx}" y="${y - modH / 2}" width="${modW}" height="${modH}" fill="white" stroke="${COLOR.panelBorder}" stroke-width="1.5"/>`;
    for (let i = 1; i < 6; i++) {
      const cxGrid = mx + (i * modW) / 6;
      out += `<line x1="${cxGrid}" y1="${y - modH / 2}" x2="${cxGrid}" y2="${y + modH / 2}" stroke="${COLOR.panelBorder}" stroke-width="0.5"/>`;
    }
    out += `<line x1="${mx}" y1="${y}" x2="${mx + modW}" y2="${y}" stroke="${COLOR.panelBorder}" stroke-width="0.5"/>`;
  }

  // sol estilizado a la izquierda
  const solX = startX - 18;
  out += `<circle cx="${solX}" cy="${y - 6}" r="5" fill="#FBBF24" stroke="#F59E0B" stroke-width="1"/>`;
  for (let ang = 0; ang < 360; ang += 45) {
    const rad = (ang * Math.PI) / 180;
    const rx = solX + 8 * Math.cos(rad);
    const ry = y - 6 + 8 * Math.sin(rad);
    const rx2 = solX + 11 * Math.cos(rad);
    const ry2 = y - 6 + 11 * Math.sin(rad);
    out += `<line x1="${rx}" y1="${ry}" x2="${rx2}" y2="${ry2}" stroke="#F59E0B" stroke-width="1.2"/>`;
  }

  out += "</g>";
  return out;
}

export function symInverter(x: number, y: number, esTri: boolean): string {
  const w = 65;
  const h = 55;
  let out = '<g class="inverter">';
  out += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="white" stroke="${COLOR.wire}" stroke-width="1.8"/>`;
  // diagonal divisoria
  out += `<line x1="${x - w / 2 + 4}" y1="${y + h / 2 - 4}" x2="${x + w / 2 - 4}" y2="${y - h / 2 + 4}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  // DC: dos líneas horizontales
  const dcX = x - w / 4;
  const dcY = y - h / 4;
  out += `<line x1="${dcX - 7}" y1="${dcY - 2}" x2="${dcX + 7}" y2="${dcY - 2}" stroke="${COLOR.wire}" stroke-width="1.5"/>`;
  out += `<line x1="${dcX - 7}" y1="${dcY + 2}" x2="${dcX + 7}" y2="${dcY + 2}" stroke="${COLOR.wire}" stroke-width="1.5" stroke-dasharray="2,1.5"/>`;
  // AC: sinusoide
  const acX = x + w / 4;
  const acY = y + h / 4;
  out += `<path d="M ${acX - 9} ${acY} Q ${acX - 4.5} ${acY - 5} ${acX} ${acY} T ${acX + 9} ${acY}" fill="none" stroke="${COLOR.wire}" stroke-width="1.5"/>`;
  // marca de fase
  out += label(x, y + h / 2 - 4, esTri ? "3~" : "1~", { size: 9, anchor: "middle", weight: "bold" });
  out += "</g>";
  return out;
}

export function symMeterBidir(x: number, y: number): string {
  const w = 38;
  const h = 26;
  let out = '<g class="meter">';
  out += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="white" stroke="${COLOR.wire}" stroke-width="1.2"/>`;
  // flecha derecha
  const a1 = y - 5;
  out += `<line x1="${x - 10}" y1="${a1}" x2="${x + 8}" y2="${a1}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  out += `<polygon points="${x + 8},${a1 - 3} ${x + 12},${a1} ${x + 8},${a1 + 3}" fill="${COLOR.wire}"/>`;
  // flecha izquierda
  const a2 = y + 5;
  out += `<line x1="${x + 10}" y1="${a2}" x2="${x - 8}" y2="${a2}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  out += `<polygon points="${x - 8},${a2 - 3} ${x - 12},${a2} ${x - 8},${a2 + 3}" fill="${COLOR.wire}"/>`;
  out += "</g>";
  return out;
}

export function symMeterSimple(x: number, y: number): string {
  let out = '<g class="meter-mon">';
  out += `<circle cx="${x}" cy="${y}" r="13" fill="white" stroke="${COLOR.wire}" stroke-width="1.4"/>`;
  out += label(x, y + 4, "M", { size: 12, anchor: "middle", weight: "bold" });
  out += "</g>";
  return out;
}

export function symBreaker(x: number, y: number): string {
  // Símbolo IEC 60617: palanca diagonal entre dos contactos circulares.
  // Sin rectángulo cerrado. Ocupa altura ~28 entre lineIn y lineOut para que
  // las conexiones encastren con los cables vline() del layout.
  const h = 28;
  const topY = y - h / 2;
  const bottomY = y + h / 2;
  const contactTopY = topY + 5;
  const contactBottomY = bottomY - 5;
  let out = '<g class="breaker">';
  // Tramo superior (entrada del cable principal hasta el contacto).
  out += `<line x1="${x}" y1="${topY}" x2="${x}" y2="${contactTopY}" stroke="${COLOR.wire}" stroke-width="1.5"/>`;
  // Contacto superior (círculo relleno).
  out += `<circle cx="${x}" cy="${contactTopY}" r="2" fill="${COLOR.wire}"/>`;
  // Palanca diagonal: del contacto superior hacia el costado derecho.
  out += `<line x1="${x}" y1="${contactTopY}" x2="${x + 9}" y2="${contactBottomY}" stroke="${COLOR.wire}" stroke-width="1.5"/>`;
  // Contacto inferior.
  out += `<circle cx="${x}" cy="${contactBottomY}" r="2" fill="${COLOR.wire}"/>`;
  // Tramo inferior (salida).
  out += `<line x1="${x}" y1="${contactBottomY}" x2="${x}" y2="${bottomY}" stroke="${COLOR.wire}" stroke-width="1.5"/>`;
  out += "</g>";
  return out;
}

export function symResidual(x: number, y: number): string {
  // RCD = breaker + cuadrado pequeño de test al lado (botón).
  let out = symBreaker(x, y);
  out += `<rect x="${x + 12}" y="${y - 3}" width="6" height="6" fill="${COLOR.wire}"/>`;
  return out;
}

export function symFuse(x: number, y: number): string {
  const h = 28;
  const w = 12;
  let out = '<g class="fuse">';
  out += `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="white" stroke="${COLOR.wire}" stroke-width="1.2"/>`;
  out += `<rect x="${x - w / 2 + 2}" y="${y - h / 2 + 3}" width="${w - 4}" height="${h - 6}" fill="#FCD34D"/>`;
  out += "</g>";
  return out;
}

export function symSpd(x: number, y: number): string {
  // Triángulo con vértice abajo + cable a tierra + 3 líneas decrecientes
  // (símbolo de tierra). El cable principal entra por arriba del triángulo
  // (la conexión la hace el layout exterior con vline).
  let out = '<g class="spd">';
  // Triángulo (base arriba, vértice abajo).
  out += `<polygon points="${x - 9},${y - 12} ${x + 9},${y - 12} ${x},${y + 5}" fill="white" stroke="${COLOR.wire}" stroke-width="1.4"/>`;
  // Cable del triángulo a tierra.
  out += `<line x1="${x}" y1="${y + 5}" x2="${x}" y2="${y + 13}" stroke="${COLOR.wire}" stroke-width="1.4"/>`;
  // Símbolo de tierra (3 líneas decrecientes).
  out += `<line x1="${x - 8}" y1="${y + 13}" x2="${x + 8}" y2="${y + 13}" stroke="${COLOR.wire}" stroke-width="1.5"/>`;
  out += `<line x1="${x - 5}" y1="${y + 16}" x2="${x + 5}" y2="${y + 16}" stroke="${COLOR.wire}" stroke-width="1.3"/>`;
  out += `<line x1="${x - 2.5}" y1="${y + 19}" x2="${x + 2.5}" y2="${y + 19}" stroke="${COLOR.wire}" stroke-width="1.1"/>`;
  out += "</g>";
  return out;
}

export function symGround(x: number, y: number): string {
  let out = '<g class="ground">';
  out += vline(x, y, y + 6, COLOR.ground, 1.5);
  out += `<line x1="${x - 12}" y1="${y + 6}" x2="${x + 12}" y2="${y + 6}" stroke="${COLOR.ground}" stroke-width="2.2"/>`;
  out += `<line x1="${x - 8}" y1="${y + 10}" x2="${x + 8}" y2="${y + 10}" stroke="${COLOR.ground}" stroke-width="1.8"/>`;
  out += `<line x1="${x - 5}" y1="${y + 14}" x2="${x + 5}" y2="${y + 14}" stroke="${COLOR.ground}" stroke-width="1.4"/>`;
  out += label(x + 16, y + 12, "PAT", { size: 8, weight: "bold", color: COLOR.ground });
  out += "</g>";
  return out;
}

export function symBusbar(x: number, y: number): string {
  return `<circle cx="${x}" cy="${y}" r="3.5" fill="${COLOR.wire}"/>`;
}

export function symLoadPanel(x: number, y: number): string {
  const s = 12;
  let out = `<rect x="${x - s}" y="${y - s}" width="${2 * s}" height="${2 * s}" fill="white" stroke="${COLOR.wire}" stroke-width="1.2"/>`;
  out += `<line x1="${x - s}" y1="${y - s}" x2="${x + s}" y2="${y + s}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  out += `<line x1="${x + s}" y1="${y - s}" x2="${x - s}" y2="${y + s}" stroke="${COLOR.wire}" stroke-width="1"/>`;
  return out;
}

export function redUteMarker(x: number, y: number): string {
  let out = label(x, y, "RED UTE", { anchor: "middle", size: 11, weight: "bold" });
  out += `<polygon points="${x - 5},${y + 4} ${x + 5},${y + 4} ${x},${y + 13}" fill="${COLOR.wire}"/>`;
  return out;
}

export function tableroBox(
  x: number,
  y: number,
  w: number,
  h: number,
  titulo: string,
  colorBorder: string = COLOR.tableroBorder,
): string {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${colorBorder}" stroke-width="1.5"/>`;
  out += label(x + 4, y - 4, titulo, { size: 8, weight: "bold", color: colorBorder });
  return out;
}

// Primitivas de dibujo de la lámina: texto, chapa y cotas acotadas.
// Todo devuelve strings de SVG que el index concatena.

import { COLOR, FONT } from "./layout.js";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function text(
  x: number,
  y: number,
  content: string,
  opts: {
    size?: number;
    bold?: boolean;
    color?: string;
    anchor?: "start" | "middle" | "end";
  } = {},
): string {
  const { size = 11, bold = false, color = COLOR.text, anchor = "start" } = opts;
  return `<text x="${r(x)}" y="${r(y)}" font-family="${FONT}" font-size="${size}"${
    bold ? ' font-weight="bold"' : ""
  } fill="${color}" text-anchor="${anchor}">${esc(content)}</text>`;
}

/** Texto multilínea con interlineado fijo. Devuelve el SVG y el alto usado. */
export function textLines(
  x: number,
  y: number,
  lines: string[],
  opts: { size?: number; lineHeight?: number; bold?: boolean; color?: string } = {},
): { svg: string; height: number } {
  const { size = 11, lineHeight = size * 1.45 } = opts;
  const svg = lines
    .map((l, i) => text(x, y + i * lineHeight, l, { ...opts, size }))
    .join("");
  return { svg, height: lines.length * lineHeight };
}

/**
 * Parte un texto en líneas que entren en `maxWidth` px. La medida es
 * aproximada (0.5 em por carácter para Roboto a tamaños chicos): alcanza para
 * que las especificaciones no se salgan de su columna.
 */
export function wrap(content: string, maxWidth: number, size: number): string[] {
  const perChar = size * 0.5;
  const maxChars = Math.max(8, Math.floor(maxWidth / perChar));
  const words = content.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function rect(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: string; stroke?: string; strokeWidth?: number; dash?: string } = {},
): string {
  const {
    fill = COLOR.metalFill,
    stroke = COLOR.metalStroke,
    strokeWidth = 1,
    dash,
  } = opts;
  return `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${
    dash ? ` stroke-dasharray="${dash}"` : ""
  } />`;
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: { color?: string; width?: number; dash?: string } = {},
): string {
  const { color = COLOR.metalStroke, width = 1, dash } = opts;
  return `<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${color}" stroke-width="${width}"${
    dash ? ` stroke-dasharray="${dash}"` : ""
  } />`;
}

export function polygon(
  points: [number, number][],
  opts: { fill?: string; stroke?: string; strokeWidth?: number } = {},
): string {
  const { fill = COLOR.metalFill, stroke = COLOR.metalStroke, strokeWidth = 1 } = opts;
  const pts = points.map(([x, y]) => `${r(x)},${r(y)}`).join(" ");
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
}

// ─── Cotas ────────────────────────────────────────────────────────────────────
// Línea con punta de flecha en ambos extremos y la medida en el medio, como en
// un plano de taller. Las flechas se dibujan a mano (triángulos) en vez de con
// markers para que resvg las rasterice igual que un navegador.

const ARROW = 4.5;

function arrowH(x: number, y: number, dir: 1 | -1): string {
  return polygon(
    [
      [x, y],
      [x + dir * ARROW * 1.8, y - ARROW * 0.7],
      [x + dir * ARROW * 1.8, y + ARROW * 0.7],
    ],
    { fill: COLOR.dim, stroke: COLOR.dim },
  );
}

function arrowV(x: number, y: number, dir: 1 | -1): string {
  return polygon(
    [
      [x, y],
      [x - ARROW * 0.7, y + dir * ARROW * 1.8],
      [x + ARROW * 0.7, y + dir * ARROW * 1.8],
    ],
    { fill: COLOR.dim, stroke: COLOR.dim },
  );
}

/** Cota horizontal entre x1 y x2, dibujada a la altura y. */
export function dimH(x1: number, x2: number, y: number, label: string, opts: { size?: number } = {}): string {
  const { size = 11 } = opts;
  return [
    line(x1, y, x2, y, { color: COLOR.dim }),
    arrowH(x1, y, 1),
    arrowH(x2, y, -1),
    // Fondo blanco detrás del número para que no se pise con la línea.
    `<rect x="${r((x1 + x2) / 2 - label.length * size * 0.32)}" y="${r(y - size * 0.95)}" width="${r(
      label.length * size * 0.64,
    )}" height="${r(size * 1.3)}" fill="#FFFFFF" />`,
    text((x1 + x2) / 2, y + size * 0.36, label, { size, color: COLOR.dim, anchor: "middle" }),
  ].join("");
}

/** Cota vertical entre y1 e y2, dibujada sobre la abscisa x. */
export function dimV(y1: number, y2: number, x: number, label: string, opts: { size?: number } = {}): string {
  const { size = 11 } = opts;
  return [
    line(x, y1, x, y2, { color: COLOR.dim }),
    arrowV(x, y1, 1),
    arrowV(x, y2, -1),
    `<rect x="${r(x - label.length * size * 0.34)}" y="${r((y1 + y2) / 2 - size * 0.95)}" width="${r(
      label.length * size * 0.68,
    )}" height="${r(size * 1.3)}" fill="#FFFFFF" />`,
    text(x, (y1 + y2) / 2 + size * 0.36, label, { size, color: COLOR.dim, anchor: "middle" }),
  ].join("");
}

/** Línea de extensión fina, del dibujo hacia la cota. */
export function extLine(x1: number, y1: number, x2: number, y2: number): string {
  return line(x1, y1, x2, y2, { color: COLOR.dim, width: 0.6 });
}

/** Llamada con línea quebrada: apunta a (tx,ty) y escribe el texto en (lx,ly). */
export function leader(
  tx: number,
  ty: number,
  lx: number,
  ly: number,
  lines: string[],
  opts: { size?: number; anchor?: "start" | "end" } = {},
): string {
  const { size = 9.5, anchor = "start" } = opts;
  const elbowX = anchor === "start" ? lx - 10 : lx + 10;
  return [
    line(tx, ty, elbowX, ly - size * 0.3, { color: COLOR.dim, width: 0.8 }),
    polygon(
      [
        [tx, ty],
        [tx + (elbowX > tx ? 6 : -6), ty - 3],
        [tx + (elbowX > tx ? 6 : -6), ty + 3],
      ],
      { fill: COLOR.dim, stroke: COLOR.dim },
    ),
    lines
      .map((l, i) => text(lx, ly + i * (size * 1.35), l, { size, color: COLOR.dim, anchor }))
      .join(""),
  ].join("");
}

/** Redondeo a 2 decimales: mantiene el SVG legible y chico. */
export function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Escala para que un objeto de `wCm × hCm` entre en una caja de `boxW × boxH`
 * px, dejando el margen pedido. Devuelve px por cm.
 */
export function fitScale(wCm: number, hCm: number, boxW: number, boxH: number): number {
  if (wCm <= 0 || hCm <= 0) return 1;
  return Math.min(boxW / wCm, boxH / hCm);
}

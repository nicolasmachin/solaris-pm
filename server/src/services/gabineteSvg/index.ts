// Lámina de fabricación del gabinete metálico: A4 vertical con las vistas
// acotadas, las especificaciones de taller y las notas.
//
// Está calcada del plano que Voltia ya venía mandando al fabricante (ver
// `docs/manual/05-ingenieria.md`), con todo lo que ahí era texto fijo ahora
// tomado de los datos del gabinete: lo que el fabricante suele preguntar
// —espesor, chapa, cómo se arma— tiene que estar respondido en la hoja.

import { rect, text, textLines, wrap } from "./draw.js";
import { COLOR, FONT, MARGIN, PAGE_H, PAGE_W } from "./layout.js";
import type { GabineteInputs } from "./types.js";
import {
  cm,
  corteMarcoPuerta,
  detallePestana,
  escalaFrontalLateral,
  vistaFrontal,
  vistaInterior,
  vistaIsometrica,
  vistaLateral,
  vistaPosterior,
  type Box,
} from "./views.js";

export type { GabineteInputs, SpecExtra } from "./types.js";
export { PAGE_H, PAGE_W } from "./layout.js";

/** Las especificaciones de la columna derecha, en orden de lectura del taller. */
export function especificaciones(g: GabineteInputs): string[] {
  const specs: string[] = [
    "Gabinete metálico para exterior",
    "Con tapa frontal",
    `Construcción: ${g.fondoAbierto ? "fondo abierto (sin fondo)" : "con fondo de chapa"}`,
  ];
  if (g.pestanaAmure) {
    specs.push(`Pestaña perimetral para amure de ${cm(g.pestanaAnchoCm)} en toda la vuelta (posterior)`);
  }
  if (g.alaTapaCm) specs.push(`Ala/reborde de la tapa: ${cm(g.alaTapaCm)}`);
  specs.push(`Material: ${g.material}`);
  specs.push(`Espesor de chapa: ${fmtMm(g.espesorMm)} mm`);
  if (g.union) specs.push(`Armado: ${g.union}`);
  if (g.tornillos) specs.push(`Fijación: ${g.tornillos}`);
  specs.push(`Cierre: ${g.tipoCierre}`);
  specs.push(
    g.ventilacion ? "Con orificios / rejillas de ventilación" : "Sin orificios ni rejillas de ventilación",
  );
  specs.push(`Bisagras: ${g.bisagras}`);
  if (g.gradoIp) specs.push(`Grado de protección sugerido: ${g.gradoIp}`);
  specs.push(`Acabado: ${g.acabado}`);
  for (const extra of g.specsExtra ?? []) {
    if (extra.etiqueta?.trim()) specs.push(`${extra.etiqueta}: ${extra.valor}`);
  }
  return specs;
}

function fmtMm(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function notas(g: GabineteInputs): string[] {
  const out = [
    "Todas las medidas son exteriores.",
    "Medidas en centímetros.",
    `Tolerancia general: ± ${fmtMm(g.toleranciaMm)} mm.`,
  ];
  if (g.fondoAbierto) out.push("Fondo abierto 100% (sin placa).");
  if (g.pestanaAmure) out.push(`Pestaña de amure de ${cm(g.pestanaAnchoCm)} en toda la vuelta posterior.`);
  if (g.notas?.trim()) {
    for (const linea of g.notas.split("\n")) {
      if (linea.trim()) out.push(linea.trim());
    }
  }
  return out;
}

/**
 * Lista con viñetas. Devuelve el SVG y el alto ocupado: el alto real importa
 * porque debajo va el corte de puerta, y estimarlo por cantidad de ítems lo
 * encimaba en cuanto una especificación ocupaba dos renglones.
 */
function bulletList(
  x: number,
  y: number,
  width: number,
  items: string[],
  size: number,
): { svg: string; height: number } {
  const lineH = size * 1.5;
  let cursor = y;
  const parts: string[] = [];
  for (const item of items) {
    const lines = wrap(item, width - 12, size);
    parts.push(text(x, cursor, "•", { size, color: COLOR.text }));
    const { svg } = textLines(x + 11, cursor, lines, { size, lineHeight: lineH });
    parts.push(svg);
    cursor += lines.length * lineH + size * 0.25;
  }
  return { svg: parts.join(""), height: cursor - y };
}

/**
 * Recuadro de notas. Envuelve el texto ANTES de dibujar el marco para que el
 * alto salga del contenido real: estimarlo por cantidad de ítems desbordaba la
 * caja en cuanto una nota ocupaba dos renglones.
 */
function notasBox(x: number, y: number, width: number, items: string[]): { svg: string; height: number } {
  const size = 9.5;
  const lineH = 13;
  const wrapped = items.map((n) => wrap(`- ${n}`, width - 26, size));
  const totalLines = wrapped.reduce((acc, l) => acc + l.length, 0);
  const height = 34 + totalLines * lineH + 10;

  const parts = [
    rect(x, y, width, height, { fill: "#FFFFFF", stroke: COLOR.boxBorder, strokeWidth: 1 }),
    text(x + 12, y + 20, "NOTAS:", { size: 10.5, bold: true }),
  ];
  let cursor = y + 36;
  for (const lines of wrapped) {
    const { svg, height: h } = textLines(x + 12, cursor, lines, { size, lineHeight: lineH });
    parts.push(svg);
    cursor += h;
  }
  return { svg: parts.join(""), height };
}

export function buildGabineteSvg(g: GabineteInputs): string {
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#FFFFFF" />`,
  ];

  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const contentW = right - left;

  // ─── Encabezado ───
  let y = MARGIN + 18;
  parts.push(text(left, y, g.titulo.toUpperCase(), { size: 19, bold: true }));
  y += 22;
  parts.push(
    text(
      left,
      y,
      `Dimensiones exteriores: ${cm(g.anchoCm)} (ancho) x ${cm(g.altoCm)} (alto) x ${cm(g.profundidadCm)} (profundidad)`,
      { size: 11.5 },
    ),
  );
  y += 16;
  const construccion = [
    g.fondoAbierto ? "fondo abierto (sin placa)" : "con fondo de chapa",
    g.pestanaAmure ? `con pestaña perimetral de ${cm(g.pestanaAnchoCm)} para amure` : null,
  ]
    .filter(Boolean)
    .join(", ");
  parts.push(text(left, y, `Construcción: ${construccion}`, { size: 11.5 }));
  y += 15;

  // Línea del pedido: de qué obra es y cuántas unidades.
  const pedido = [
    g.cliente ? `Obra: ${g.cliente}` : null,
    g.proyectoCodigo,
    `Cantidad a fabricar: ${g.cantidad} ${g.cantidad === 1 ? "unidad" : "unidades"}`,
    g.fecha,
  ]
    .filter(Boolean)
    .join("  ·  ");
  parts.push(text(left, y, pedido, { size: 10, color: "#4B5563" }));

  // ─── Fila 1: frontal + lateral (escala compartida) + especificaciones ───
  // Tres columnas por fila: cada dibujo tiene su celda y ninguno invade al de
  // al lado, que es lo que pasaba cuando el corte colgaba de la lista de
  // especificaciones y su largo dependía del texto.
  const colA = left;
  const colB = left + contentW * 0.34;
  const colC = left + contentW * 0.66;
  const wA = contentW * 0.32;
  const wB = contentW * 0.3;
  const wC = right - colC;

  const row1Y = y + 24;
  const row1H = 370;
  const colFrontal: Box = { x: colA, y: row1Y, w: wA, h: row1H };
  const colLateral: Box = { x: colB, y: row1Y, w: wB, h: row1H };

  // Una sola escala para las dos vistas: están lado a lado y tienen que
  // leerse como el mismo objeto.
  const sVista = escalaFrontalLateral(g, colFrontal, colLateral);
  parts.push(vistaFrontal(colFrontal, g, sVista));
  parts.push(vistaLateral(colLateral, g, sVista));

  parts.push(
    text(colC + wC / 2, row1Y - 6, "ESPECIFICACIONES GENERALES", {
      size: 11,
      bold: true,
      anchor: "middle",
    }),
  );
  parts.push(bulletList(colC, row1Y + 18, wC, especificaciones(g), 10).svg);

  // ─── Fila 2: posterior + isométrica + notas ───
  const row2Y = row1Y + row1H + 30;
  const row2H = 262;
  parts.push(vistaPosterior({ x: colA, y: row2Y, w: wA + 30, h: row2H }, g));
  parts.push(vistaIsometrica({ x: colB + 30, y: row2Y, w: wB, h: row2H }, g));
  parts.push(notasBox(colC, row2Y - 4, wC, notas(g)).svg);

  // ─── Fila 3: interior + detalle de pestaña + corte de puerta ───
  const row3Y = row2Y + row2H + 30;
  const row3H = 196;
  parts.push(vistaInterior({ x: colA, y: row3Y, w: wA, h: row3H }, g));
  parts.push(detallePestana({ x: colB, y: row3Y, w: wB, h: row3H }, g));
  parts.push(corteMarcoPuerta({ x: colC, y: row3Y, w: wC, h: row3H }, g));

  // ─── Pie: quién pide ───
  if (g.contacto) {
    const c = g.contacto;
    const pie = [c.nombre, c.telefono, c.email].filter(Boolean).join("  ·  ");
    parts.push(
      text(left, PAGE_H - 16, `Solicita: ${pie}`, { size: 9.5, color: "#4B5563" }),
      text(right, PAGE_H - 16, "Voltia", { size: 9.5, color: "#4B5563", anchor: "end" }),
    );
  }

  parts.push(`<style>text { font-family: ${FONT}; }</style>`);
  parts.push("</svg>");
  return parts.join("\n");
}

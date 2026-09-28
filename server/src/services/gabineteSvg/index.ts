// Lámina de fabricación del gabinete metálico: UNA hoja A4 vertical con las
// vistas acotadas, las especificaciones, las notas y la tabla de medidas.
//
// Hubo una segunda hoja con dibujos de detalle (corte del encuentro
// tapa/cuerpo, despiece de las dos piezas en L, la tapa suelta). Se sacó: el
// fabricante y el instalador ya saben cómo se arma un gabinete, y los dibujos
// no se entendían solos. Las medidas que esos detalles acotaban **siguen
// estando**, escritas en la tabla y en las especificaciones.
//
// El principio que ordena la lámina: **el dibujo nunca asume una medida en
// silencio**. Cada cosa que se dibuja sale de un campo con valor por defecto
// editable, y toda medida está además escrita en la tabla, para que ninguna
// dependa de que se interprete bien un trazo.

import { line, rect, text, textLines, wrap } from "./draw.js";
import { COLOR, FONT, MARGIN, PAGE_H, PAGE_W } from "./layout.js";
import type { GabineteInputs } from "./types.js";
import {
  cm,
  escalaFrontalLateral,
  vistaFrontal,
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
    "Gabinete metálico para exterior, íntegramente en CHAPA PLEGADA",
    `Material: ${g.material}`,
    `Espesor de chapa: ${fmtMm(g.espesorMm)} mm`,
    `Construcción: ${g.fondoAbierto ? "fondo abierto (sin fondo)" : "con fondo de chapa"}`,
    `Cuerpo: ${g.union}`,
    `Fijación entre piezas: ${g.tornillos}, cada ${cm(g.pasoTornillosCm)}`,
    `Frente del cuerpo con reborde plegado de ${cm(g.rebordeFrenteCm)} hacia adentro (asiento de la tapa)`,
    `Tapa suelta, plegada en las cuatro caras, reborde de ${cm(g.rebordeTapaCm)}`,
    // Lo que NO se pide va escrito: sin esto el fabricante cotiza herrajes que
    // no queremos y el pedido vuelve con preguntas.
    "SE ENTREGA SIN HERRAJES: sin bisagras y sin cierre",
    "SIN NINGUNA PERFORACIÓN: los agujeros de amure los hace el instalador",
  ];
  if (g.pestanaAmure) {
    specs.push(`Pestaña perimetral para amure de ${cm(g.pestanaAnchoCm)} en toda la vuelta (posterior)`);
  }
  specs.push(`Acabado: ${g.acabado}`);
  for (const extra of g.specsExtra ?? []) {
    if (extra.etiqueta?.trim()) specs.push(`${extra.etiqueta}: ${extra.valor}`);
  }
  return specs;
}

function fmtMm(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

/**
 * Tabla completa de medidas de taller. Existe para que **ninguna medida quede
 * sujeta a que se lea bien un dibujo**: todo lo que el fabricante necesita está
 * también acá, escrito. Las que el fabricante no especificó salen con el valor
 * por defecto, que es una decisión tomada y no un hueco.
 */
export function tablaMedidas(g: GabineteInputs): { etiqueta: string; valor: string }[] {
  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: "Ancho exterior", valor: cm(g.anchoCm) },
    { etiqueta: "Alto exterior", valor: cm(g.altoCm) },
    { etiqueta: "Profundidad exterior", valor: cm(g.profundidadCm) },
    { etiqueta: "Espesor de chapa", valor: `${fmtMm(g.espesorMm)} mm` },
    { etiqueta: "Solape de unión entre las piezas en L", valor: cm(g.solapeUnionCm) },
    { etiqueta: "Paso de tornillos de unión", valor: `cada ${cm(g.pasoTornillosCm)}` },
  ];
  if (g.pestanaAmure) {
    filas.push({ etiqueta: "Ancho de pestaña de amure", valor: cm(g.pestanaAnchoCm) });
  }
  filas.push(
    { etiqueta: "Reborde plegado del frente del cuerpo", valor: cm(g.rebordeFrenteCm) },
    { etiqueta: "Reborde plegado de la tapa", valor: cm(g.rebordeTapaCm) },
    { etiqueta: "Solape de la tapa sobre el cuerpo", valor: cm(g.solapeTapaCm) },
    { etiqueta: "Holgura tapa / cuerpo", valor: `${fmtMm(g.holguraTapaMm)} mm` },
    { etiqueta: "Herrajes", valor: "no se proveen" },
    { etiqueta: "Perforaciones", valor: "ninguna — se hacen en obra" },
    { etiqueta: "Tolerancia general", valor: `± ${fmtMm(g.toleranciaMm)} mm` },
  );
  for (const extra of g.specsExtra ?? []) {
    if (extra.etiqueta?.trim()) filas.push({ etiqueta: extra.etiqueta, valor: extra.valor });
  }
  return filas;
}

function notas(g: GabineteInputs): string[] {
  const out = [
    "Todo el gabinete se fabrica en chapa plegada.",
    "Todas las medidas son exteriores.",
    "Medidas en centímetros salvo donde se indica mm.",
    `Tolerancia general: ± ${fmtMm(g.toleranciaMm)} mm.`,
    "La tapa se entrega suelta, sin bisagras ni cierre.",
    "El gabinete se entrega sin perforar: los agujeros de amure se hacen en obra.",
  ];
  // La tabla de medidas va en esta misma hoja, al pie.
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
 * para apilar bloques sin que se pisen, y estimarlo por cantidad de ítems
 * fallaba en cuanto una línea ocupaba dos renglones.
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
    parts.push(text(x, cursor, "\u2022", { size, color: COLOR.text }));
    const { svg } = textLines(x + 11, cursor, lines, { size, lineHeight: lineH });
    parts.push(svg);
    cursor += lines.length * lineH + size * 0.25;
  }
  return { svg: parts.join(""), height: cursor - y };
}

/** Recuadro de notas, dimensionado por el texto ya envuelto. */
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

/** Tabla de dos columnas con las medidas. */
function tablaBox(
  x: number,
  y: number,
  width: number,
  filas: { etiqueta: string; valor: string }[],
): { svg: string; height: number } {
  const size = 9;
  const rowH = 14;
  const header = 26;
  const height = header + filas.length * rowH + 8;
  const valorX = x + width - 12;

  const parts = [
    rect(x, y, width, height, { fill: "#FFFFFF", stroke: COLOR.boxBorder, strokeWidth: 1 }),
    text(x + 12, y + 16, "TABLA DE MEDIDAS", { size: 10, bold: true }),
    // La línea iba a la misma altura que el texto y lo tachaba.
    line(x, y + header - 2, x + width, y + header - 2, { color: COLOR.boxBorder, width: 0.8 }),
  ];
  filas.forEach((f, i) => {
    const ry = y + header + 7 + i * rowH;
    // Fondo alternado: la tabla es larga y sin esto se salta de renglón.
    if (i % 2 === 1) {
      parts.push(rect(x + 1, ry - 10, width - 2, rowH, { fill: "#F3F4F6", stroke: "none" }));
    }
    parts.push(
      text(x + 12, ry, f.etiqueta, { size, color: COLOR.text }),
      text(valorX, ry, f.valor, { size, color: COLOR.text, anchor: "end", bold: true }),
    );
  });
  return { svg: parts.join(""), height };
}

function svgOpen(): string[] {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="#FFFFFF" />`,
  ];
}

function svgClose(parts: string[]): string {
  parts.push(`<style>text { font-family: ${FONT}; }</style>`);
  parts.push("</svg>");
  return parts.join("\n");
}

function pie(g: GabineteInputs): string[] {
  const out: string[] = [];
  if (g.contacto) {
    const c = g.contacto;
    const datos = [c.nombre, c.telefono, c.email].filter(Boolean).join("  \u00b7  ");
    out.push(text(MARGIN, PAGE_H - 16, `Solicita: ${datos}`, { size: 9.5, color: "#4B5563" }));
  }
  out.push(
    text(PAGE_W - MARGIN, PAGE_H - 16, "Voltia", {
      size: 9.5,
      color: "#4B5563",
      anchor: "end",
    }),
  );
  return out;
}

// ─── La lámina ────────────────────────────────────────────────────────────────

function hoja(g: GabineteInputs): string {
  const parts = svgOpen();
  const left = MARGIN;
  const right = PAGE_W - MARGIN;
  const contentW = right - left;

  let y = MARGIN + 18;
  parts.push(text(left, y, g.titulo.toUpperCase(), { size: 18, bold: true }));
  y += 21;
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
    "chapa plegada",
    g.fondoAbierto ? "fondo abierto (sin placa)" : "con fondo de chapa",
    g.pestanaAmure ? `pestaña perimetral de ${cm(g.pestanaAnchoCm)} para amure` : null,
    // Sin toLowerCase: comerse la mayúscula dejaba "dos piezas en l".
    g.union.charAt(0).toLowerCase() + g.union.slice(1),
  ]
    .filter(Boolean)
    .join(", ");
  parts.push(text(left, y, `Construcción: ${construccion}`, { size: 11.5 }));
  y += 15;

  const pedido = [
    g.cliente ? `Obra: ${g.cliente}` : null,
    g.proyectoCodigo,
    `Cantidad a fabricar: ${g.cantidad} ${g.cantidad === 1 ? "unidad" : "unidades"}`,
    g.fecha,
  ]
    .filter(Boolean)
    .join("  \u00b7  ");
  parts.push(text(left, y, pedido, { size: 10, color: "#4B5563" }));

  const colA = left;
  const colB = left + contentW * 0.34;
  const colC = left + contentW * 0.66;
  const wA = contentW * 0.32;
  const wB = contentW * 0.3;
  const wC = right - colC;

  // Fila 1: frontal + lateral (escala compartida) + especificaciones.
  const row1Y = y + 30;
  const row1H = 360;
  const colFrontal: Box = { x: colA, y: row1Y, w: wA, h: row1H };
  const colLateral: Box = { x: colB, y: row1Y, w: wB, h: row1H };
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
  parts.push(bulletList(colC, row1Y + 18, wC, especificaciones(g), 9.5).svg);

  // Fila 2: posterior + isométrica + notas.
  const row2Y = row1Y + row1H + 26;
  const row2H = 272;
  parts.push(vistaPosterior({ x: colA, y: row2Y, w: wA + 40, h: row2H }, g));
  parts.push(vistaIsometrica({ x: colB + 40, y: row2Y, w: wB, h: row2H }, g));
  parts.push(notasBox(colC, row2Y - 4, wC, notas(g)).svg);

  // Al pie, la tabla con todas las medidas escritas.
  parts.push(tablaBox(left, row2Y + row2H + 18, contentW, tablaMedidas(g)).svg);

  parts.push(...pie(g));
  return svgClose(parts);
}

/**
 * Las hojas de la lámina. Hoy es una sola; sigue devolviendo un array porque el
 * preview y el PDF ya saben pintar N hojas y no cuesta nada dejarlo abierto.
 */
export function buildGabineteSvgs(g: GabineteInputs): string[] {
  return [hoja(g)];
}

/** La lámina, para quien quiere un SVG suelto. */
export function buildGabineteSvg(g: GabineteInputs): string {
  return hoja(g);
}

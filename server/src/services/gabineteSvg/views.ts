// Las vistas de la lámina. Cada una recibe la caja donde tiene que entrar y se
// escala sola con `fitScale`, así el dibujo sigue siendo legible tanto con un
// gabinete alto y angosto como con uno bajo y ancho.
//
// Convención: `s` es la escala en px por cm; todas las medidas del gabinete
// están en cm y se multiplican por `s` al dibujar.

import { dimH, dimV, extLine, fitScale, leader, line, polygon, rect, text } from "./draw.js";
import { COLOR } from "./layout.js";
import type { GabineteInputs } from "./types.js";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Espesor visual de la chapa en el dibujo (px), independiente de la escala. */
const WALL = 5;

/**
 * Escala común para la frontal y la lateral. Van una al lado de la otra: si
 * cada una se escalara sola, el mismo gabinete se vería de distinto alto en
 * cada vista y el taller lo lee mal.
 */
export function escalaFrontalLateral(g: GabineteInputs, frontal: Box, lateral: Box): number {
  const fAvailW = frontal.w - 60;
  const fAvailH = frontal.h - 48;
  const lAvailW = lateral.w - 28;
  const lAvailH = lateral.h - 48;
  return Math.min(
    fitScale(g.anchoCm, g.altoCm, fAvailW, fAvailH),
    fitScale(g.profundidadCm, g.altoCm, lAvailW, lAvailH),
  );
}

function viewTitle(box: Box, label: string): string {
  return text(box.x + box.w / 2, box.y - 6, label, {
    size: 11,
    bold: true,
    anchor: "middle",
  });
}

function fmt(n: number): string {
  // Sin decimales cuando es entero: "50 cm", no "50.0 cm".
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10).replace(".", ",");
}

export function cm(n: number): string {
  return `${fmt(n)} cm`;
}

// ─── Vista frontal ────────────────────────────────────────────────────────────
// Rectángulo ancho × alto con el marco de la tapa y el alero superior que
// sobresale. Acotada en ancho (abajo) y alto (izquierda).

export function vistaFrontal(box: Box, g: GabineteInputs, scale?: number): string {
  const pad = { left: 46, right: 20, top: 20, bottom: 34 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;
  const s = scale ?? fitScale(g.anchoCm, g.altoCm, availW, availH);

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;

  // Lo que se ve de frente es la tapa puesta: una chapa a ras del cuerpo con
  // su reborde plegado marcando el perímetro. No hay alero ni herrajes.
  const borde = Math.max(4, Math.min(g.rebordeTapaCm * s, 16));

  return [
    viewTitle(box, "VISTA FRONTAL (TAPA PUESTA)"),
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    rect(x + borde, y + borde, w - borde * 2, h - borde * 2, {
      fill: COLOR.metalFillLight,
      stroke: COLOR.metalStroke,
    }),
    // Cotas.
    extLine(x, y + h, x, y + h + 26),
    extLine(x + w, y + h, x + w, y + h + 26),
    dimH(x, x + w, y + h + 20, cm(g.anchoCm)),
    extLine(x, y, x - 34, y),
    extLine(x, y + h, x - 34, y + h),
    dimV(y, y + h, x - 28, cm(g.altoCm)),
    // El reborde de la tapa, acotado arriba a la derecha (a la izquierda se
    // salía de la hoja).
    extLine(x + w - borde, y - 4, x + w - borde, y - 22),
    extLine(x + w, y - 4, x + w, y - 22),
    line(x + w - borde - 4, y - 18, x + w + 28, y - 18, { color: COLOR.dim }),
    text(x + w + 32, y - 14, `reborde ${cm(g.rebordeTapaCm)}`, {
      size: 9,
      color: COLOR.dim,
    }),
  ].join("");
}

// ─── Vista lateral ────────────────────────────────────────────────────────────

export function vistaLateral(box: Box, g: GabineteInputs, scale?: number): string {
  const pad = { left: 20, right: 20, top: 20, bottom: 34 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;
  const s = scale ?? fitScale(g.profundidadCm, g.altoCm, availW, availH);

  const w = g.profundidadCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;

  const parts = [
    viewTitle(box, "VISTA LATERAL DERECHA"),
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    // Canto de la tapa, al frente (izquierda de esta vista).
    rect(x, y, Math.max(3, WALL * 0.8), h, {
      fill: COLOR.metalFillDark,
      stroke: COLOR.metalStrokeDark,
    }),
  ];

  // Pestaña de amure: el doblez del fondo, contra el muro (derecha).
  if (g.pestanaAmure) {
    const f = Math.max(5, Math.min(g.pestanaAnchoCm * s, 18));
    parts.push(
      rect(x + w, y, 3, h, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
      extLine(x + w, y - 4, x + w, y - 22),
      extLine(x + w + 3, y - 4, x + w + 3, y - 22),
      line(x + w - 30, y - 18, x + w + 6, y - 18, { color: COLOR.dim }),
      text(x + w + 10, y - 14, `pestaña ${cm(g.pestanaAnchoCm)}`, { size: 9, color: COLOR.dim }),
    );
    void f;
  }

  parts.push(
    extLine(x, y + h, x, y + h + 26),
    extLine(x + w, y + h, x + w, y + h + 26),
    dimH(x, x + w, y + h + 20, cm(g.profundidadCm)),
  );
  return parts.join("");
}

// ─── Vista posterior ──────────────────────────────────────────────────────────
// Muestra la pestaña perimetral de amure y, si el fondo es abierto, el hueco.

export function vistaPosterior(box: Box, g: GabineteInputs): string {
  const pad = { left: 40, right: 100, top: 14, bottom: 40 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;
  const s = fitScale(g.anchoCm, g.altoCm, availW, availH);

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;

  // Ancho de la pestaña a escala, con mínimo visual para que se vea el doblez.
  const flange = g.pestanaAmure ? Math.max(10, Math.min(g.pestanaAnchoCm * s, 26)) : WALL;

  const parts: string[] = [
    viewTitle(box, g.fondoAbierto ? "VISTA POSTERIOR (SIN FONDO)" : "VISTA POSTERIOR"),
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    // Hueco del fondo abierto (blanco) o chapa de fondo.
    rect(x + flange, y + flange, w - flange * 2, h - flange * 2, {
      fill: g.fondoAbierto ? "#FFFFFF" : COLOR.metalFillLight,
      stroke: COLOR.metalStrokeDark,
    }),
  ];

  // La pestaña va LISA: los agujeros de amure los hace Voltia en obra, así que
  // el dibujo no los muestra y lo dice, para que el taller no los interprete
  // como un olvido.
  if (g.pestanaAmure) {
    // Cota del ancho de pestaña, abajo a la izquierda. La cota es más angosta
    // que su etiqueta, así que el número va corrido a la izquierda con una
    // llamada en vez de encimado sobre la línea.
    parts.push(
      extLine(x, y + h, x, y + h + 30),
      extLine(x + flange, y + h, x + flange, y + h + 30),
      line(x - 26, y + h + 26, x + flange + 4, y + h + 26, { color: COLOR.dim }),
      text(x - 30, y + h + 30, cm(g.pestanaAnchoCm), {
        size: 10,
        color: COLOR.dim,
        anchor: "end",
      }),
      leader(x + w - flange / 2, y + flange * 1.6, x + w + 16, y + flange * 1.6, [
        `Pestaña perimetral`,
        `de ${cm(g.pestanaAnchoCm)} para amure`,
        `(en toda la vuelta)`,
      ]),
      // Lo que NO lleva, dicho en el dibujo.
      leader(x + w - flange / 2, y + h - flange / 2, x + w + 16, y + h - flange * 1.2, [
        `Pestaña SIN perforar:`,
        `los agujeros de amure`,
        `se hacen en obra`,
      ]),
    );
  }

  return parts.join("");
}

// ─── Vista isométrica ─────────────────────────────────────────────────────────
// Proyección simple: la profundidad se dibuja como un desplazamiento diagonal.

export function vistaIsometrica(box: Box, g: GabineteInputs): string {
  const pad = { left: 24, right: 24, top: 20, bottom: 26 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;

  // Proyección a 30°: la profundidad se dibuja como un corrimiento diagonal.
  const DX = Math.cos(Math.PI / 6);
  const DY = Math.sin(Math.PI / 6);
  const s = fitScale(
    g.anchoCm + g.profundidadCm * DX,
    g.altoCm + g.profundidadCm * DY,
    availW,
    availH,
  );

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const dx = g.profundidadCm * DX * s;
  const dy = g.profundidadCm * DY * s;
  // (x, y) = esquina superior izquierda de la cara frontal.
  const x = box.x + pad.left + (availW - (w + dx)) / 2;
  const y = box.y + pad.top + dy + (availH - (h + dy)) / 2;

  // El gabinete es un prisma recto: la tapa va a ras del frente, sin alero ni
  // techo que sobresalga. Lo único que se marca en el frente es el reborde
  // plegado de la tapa.
  const borde = Math.max(3, Math.min(g.rebordeTapaCm * s, 12));

  return [
    viewTitle(box, "VISTA ISOMÉTRICA"),

    // Techo del cuerpo.
    polygon(
      [
        [x, y],
        [x + w, y],
        [x + w + dx, y - dy],
        [x + dx, y - dy],
      ],
      { fill: COLOR.metalFillLight, stroke: COLOR.metalStrokeDark },
    ),

    // Lateral derecho (la cara que se aleja): el tono más oscuro.
    polygon(
      [
        [x + w, y],
        [x + w + dx, y - dy],
        [x + w + dx, y - dy + h],
        [x + w, y + h],
      ],
      { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark },
    ),

    // Frente: la tapa puesta, con su reborde perimetral.
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    rect(x + borde, y + borde, w - borde * 2, h - borde * 2, {
      fill: COLOR.metalFill,
      stroke: COLOR.metalStroke,
      strokeWidth: 0.8,
    }),

    text(x + (w + dx) / 2, y + h + 18, "Tapa a ras del frente; fondo abierto al muro", {
      size: 8.5,
      color: "#6B7280",
      anchor: "middle",
    }),
  ].join("");
}

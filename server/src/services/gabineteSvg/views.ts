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
  ].join("");
}

// ─── Vista lateral ────────────────────────────────────────────────────────────

export function vistaLateral(box: Box, g: GabineteInputs, scale?: number): string {
  const pad = { left: 86, right: 96, top: 20, bottom: 40 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;
  const s = scale ?? fitScale(g.profundidadCm, g.altoCm, availW, availH);

  const w = g.profundidadCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;

  // De costado se ve el canto de la tapa: su reborde plegado es la
  // profundidad de la tapa como pieza, y es la medida que el taller necesita
  // para plegarla. Va a escala, no como un canto decorativo.
  const rebTapa = Math.max(4, g.rebordeTapaCm * s);
  const rebFrente = Math.max(4, g.rebordeFrenteCm * s);
  const solape = Math.max(3, g.solapeTapaCm * s);

  const parts = [
    viewTitle(box, "VISTA LATERAL DERECHA"),
    // Cuerpo.
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    // Tapa: monta por fuera del frente (izquierda), solapando sobre la pared.
    rect(x - rebTapa + solape, y, rebTapa, h, {
      fill: COLOR.metalFillDark,
      stroke: COLOR.metalStrokeDark,
    }),
    // Reborde del frente del cuerpo, que dobla hacia adentro: queda oculto
    // detrás de la pared lateral, así que va punteado.
    line(x + rebFrente, y, x + rebFrente, y + h, {
      color: COLOR.metalStroke,
      width: 0.8,
      dash: "4 3",
    }),

    // ── Cotas de la tapa y del frente, a la izquierda.
    extLine(x - rebTapa + solape, y - 4, x - rebTapa + solape, y - 26),
    extLine(x + solape, y - 4, x + solape, y - 26),
    line(x - rebTapa + solape - 40, y - 22, x + solape + 4, y - 22, { color: COLOR.dim }),
    text(x - rebTapa + solape - 44, y - 18, `reborde tapa ${cm(g.rebordeTapaCm)}`, {
      size: 9,
      color: COLOR.dim,
      anchor: "end",
    }),

    extLine(x, y + h + 4, x, y + h + 40),
    extLine(x + rebFrente, y + h + 4, x + rebFrente, y + h + 40),
    line(x - 40, y + h + 36, x + rebFrente + 4, y + h + 36, { color: COLOR.dim }),
    text(x - 44, y + h + 40, `reborde frente ${cm(g.rebordeFrenteCm)}`, {
      size: 9,
      color: COLOR.dim,
      anchor: "end",
    }),

    // Solape de la tapa sobre el cuerpo y holgura entre ambos.
    leader(x + solape / 2, y + h * 0.34, x + w + 14, y + h * 0.3, [
      `solape ${cm(g.solapeTapaCm)}`,
      `holgura ${fmt(g.holguraTapaMm)} mm`,
    ]),
  ];

  // Pestaña de amure: el doblez del fondo, contra el muro (derecha).
  if (g.pestanaAmure) {
    const f = Math.max(4, g.pestanaAnchoCm * s);
    parts.push(
      rect(x + w, y, f, 4, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
      rect(x + w, y + h - 4, f, 4, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
      extLine(x + w, y - 4, x + w, y - 26),
      extLine(x + w + f, y - 4, x + w + f, y - 26),
      line(x + w - 4, y - 22, x + w + f + 14, y - 22, { color: COLOR.dim }),
      text(x + w + f + 18, y - 18, `pestaña ${cm(g.pestanaAnchoCm)}`, { size: 9, color: COLOR.dim }),
    );
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
      leader(x + w - flange / 2, y + flange * 1.6, x + w + 14, y + flange * 1.4, [
        `Pestaña perimetral de ${cm(g.pestanaAnchoCm)}`,
        `para amure, en toda la vuelta.`,
        `SIN perforar: los agujeros`,
        `se hacen en obra.`,
      ], { size: 9 }),
    );
  }

  // Unión de las dos piezas en L: cae sobre el canto lateral y se acota acá,
  // que es donde se ve el largo del solape.
  const xUnion = x + flange * 0.5;
  parts.push(
    line(xUnion, y, xUnion, y + h, { color: COLOR.metalStrokeDark, width: 0.8, dash: "5 3" }),
    // El rótulo de la unión va debajo del dibujo: a los costados no entra sin
    // salirse del margen o pisar la vista de al lado.
    line(xUnion, y + h, xUnion, y + h + 46, { color: COLOR.dim, width: 0.6 }),
    text(x + w / 2, y + h + 58, `Unión de las dos piezas en L: solape ${cm(g.solapeUnionCm)}`, {
      size: 8.5,
      color: COLOR.dim,
      anchor: "middle",
    }),
    text(x + w / 2, y + h + 70, `${g.tornillos} cada ${cm(g.pasoTornillosCm)}`, {
      size: 8.5,
      color: COLOR.dim,
      anchor: "middle",
    }),
  );

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

// ─── La tapa, como pieza ──────────────────────────────────────────────────────
// La tapa se fabrica aparte, así que lleva su propio plano: de frente con sus
// medidas y de canto, donde se ve la profundidad de su reborde plegado — lo que
// en el taller se llama el espesor de la tapa.

export function planoTapa(box: Box, g: GabineteInputs): string {
  const pad = { left: 44, right: 22, top: 26, bottom: 48 };
  const availH = box.h - pad.top - pad.bottom;
  // El canto va al lado del frente, a la misma escala, para que se lea que es
  // la misma pieza vista de otro lado.
  const anchoCanto = g.rebordeTapaCm;
  const sepCm = 5;
  const availW = box.w - pad.left - pad.right;
  const s = fitScale(g.anchoCm + sepCm + anchoCanto, g.altoCm, availW, availH);

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const reb = Math.max(4, g.rebordeTapaCm * s);
  const chapa = Math.max(2.5, g.espesorMm * s * 0.4);

  const x = box.x + pad.left;
  const y = box.y + pad.top + (availH - h) / 2;
  const xCanto = x + w + sepCm * s;

  return [
    viewTitle(box, "LA TAPA — PIEZA SUELTA"),

    // ── De frente: la chapa con la línea del plegado perimetral.
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    rect(x + reb, y + reb, w - reb * 2, h - reb * 2, {
      fill: COLOR.metalFillLight,
      stroke: COLOR.metalStroke,
      dash: "4 3",
    }),
    text(x + w / 2, y + h / 2, "línea de plegado", {
      size: 8.5,
      color: "#6B7280",
      anchor: "middle",
    }),

    // Ancho y alto de la tapa: son los del frente del gabinete.
    extLine(x, y + h, x, y + h + 26),
    extLine(x + w, y + h, x + w, y + h + 26),
    dimH(x, x + w, y + h + 20, cm(g.anchoCm), { size: 9.5 }),
    extLine(x, y, x - 30, y),
    extLine(x, y + h, x - 30, y + h),
    dimV(y, y + h, x - 24, cm(g.altoCm), { size: 9.5 }),

    // ── De canto: la tapa es una bandeja poco profunda. Acá se ve cuánto
    //    dobla el reborde, que es la medida que el taller pide.
    rect(xCanto, y, chapa, h, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
    rect(xCanto, y, reb, chapa, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
    rect(xCanto, y + h - chapa, reb, chapa, {
      fill: COLOR.metalFillDark,
      stroke: COLOR.metalStrokeDark,
    }),
    text(xCanto + reb / 2, y - 8, "de canto", { size: 8.5, color: "#6B7280", anchor: "middle" }),

    // El reborde, acotado: es el "espesor" de la tapa.
    extLine(xCanto, y + h + 4, xCanto, y + h + 22),
    extLine(xCanto + reb, y + h + 4, xCanto + reb, y + h + 22),
    line(xCanto - 4, y + h + 18, xCanto + reb + 10, y + h + 18, { color: COLOR.dim }),
    text(xCanto + reb + 14, y + h + 22, `reborde`, { size: 9, color: COLOR.dim }),
    text(xCanto + reb + 14, y + h + 33, cm(g.rebordeTapaCm), { size: 9, color: COLOR.dim }),

    text(x, box.y + box.h - 4, "Plegada en las cuatro caras · sin perforar", {
      size: 8.5,
      color: COLOR.text,
    }),
  ].join("");
}

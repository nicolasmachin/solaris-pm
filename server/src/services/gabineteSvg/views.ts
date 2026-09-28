// Las vistas de la lámina. Cada una recibe la caja donde tiene que entrar y se
// escala sola con `fitScale`, así el dibujo sigue siendo legible tanto con un
// gabinete alto y angosto como con uno bajo y ancho.
//
// Convención: `s` es la escala en px por cm; todas las medidas del gabinete
// están en cm y se multiplican por `s` al dibujar.

import { circle, dimH, dimV, extLine, fitScale, leader, line, polygon, r, rect, text } from "./draw.js";
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

  // Agujeros de amure repartidos sobre la pestaña, en la cantidad declarada.
  if (g.pestanaAmure) {
    const rad = Math.max(1.6, flange * 0.14);
    const inset = flange / 2;
    const colsX = [x + inset, x + w - inset];
    const rowsY = [y + inset, y + h - inset];
    const nV = Math.max(2, g.agujerosAmureVertical);
    const nH = Math.max(1, g.agujerosAmureHorizontal);
    for (const cx of colsX) {
      for (let i = 0; i < nV; i++) {
        parts.push(circle(cx, y + inset + ((h - inset * 2) * i) / (nV - 1), rad));
      }
    }
    // Los del lado horizontal van entre los de las esquinas, sin repetirlos.
    for (const cy of rowsY) {
      for (let i = 1; i < nH + 1; i++) {
        parts.push(circle(x + inset + ((w - inset * 2) * i) / (nH + 1), cy, rad));
      }
    }
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
      // Los agujeros, acotados: cuántos por lado y de qué diámetro.
      leader(
        x + w - flange / 2,
        y + h - flange / 2,
        x + w + 16,
        y + h - flange * 1.2,
        [
          `Agujeros Ø ${fmt(g.agujeroAmureDiamMm)} mm`,
          `${g.agujerosAmureVertical} por lado vertical`,
          `${g.agujerosAmureHorizontal} por lado horizontal`,
          `repartidos parejo`,
        ],
      ),
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

// ─── Frente del cuerpo, sin la tapa ────────────────────────────────────────
// Es la vista que muestra el reborde plegado del frente, contra el que asienta
// la tapa. Reemplazó a la "vista interior con la puerta abierta": sin bisagras,
// la tapa no se abre — se saca.

export function frenteSinTapa(box: Box, g: GabineteInputs): string {
  const pad = { left: 24, right: 24, top: 24, bottom: 40 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;
  const s = fitScale(g.anchoCm, g.altoCm, availW, availH);

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;

  const borde = Math.max(6, Math.min(g.rebordeFrenteCm * s, 20));

  return [
    viewTitle(box, "FRENTE DEL CUERPO (SIN TAPA)"),
    // El reborde perimetral plegado hacia adentro.
    rect(x, y, w, h, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
    // El hueco: por acá se ve el muro, porque el fondo es abierto.
    rect(x + borde, y + borde, w - borde * 2, h - borde * 2, {
      fill: g.fondoAbierto ? "#FFFFFF" : COLOR.metalFillLight,
      stroke: COLOR.metalStrokeDark,
    }),
    extLine(x, y - 4, x, y - 20),
    extLine(x + borde, y - 4, x + borde, y - 20),
    line(x, y - 16, x + borde + 26, y - 16, { color: COLOR.dim }),
    text(x + borde + 30, y - 12, `reborde ${cm(g.rebordeFrenteCm)}`, {
      size: 9,
      color: COLOR.dim,
    }),
    text(
      x + w / 2,
      y + h + 20,
      g.fondoAbierto ? "Sin fondo: se ve el muro" : "Con fondo de chapa",
      { size: 8.5, color: "#6B7280", anchor: "middle" },
    ),
  ].join("");
}

// ─── La tapa, como pieza suelta ───────────────────────────────────────────────
// Se entrega sin herrajes y sin perforaciones: es una chapa con su reborde
// plegado en las cuatro caras.

export function tapaSuelta(box: Box, g: GabineteInputs): string {
  const pad = { left: 28, right: 28, top: 24, bottom: 46 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;

  // La tapa mide lo mismo que el frente del gabinete.
  const s = fitScale(g.anchoCm, g.altoCm, availW, availH);
  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;
  const borde = Math.max(5, Math.min(g.rebordeTapaCm * s, 16));

  return [
    viewTitle(box, "LA TAPA (PIEZA SUELTA)"),
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    // Línea del plegado perimetral.
    rect(x + borde, y + borde, w - borde * 2, h - borde * 2, {
      fill: COLOR.metalFillLight,
      stroke: COLOR.metalStroke,
      dash: "4 3",
    }),
    extLine(x, y - 4, x, y - 22),
    extLine(x + borde, y - 4, x + borde, y - 22),
    line(x - 28, y - 18, x + borde + 4, y - 18, { color: COLOR.dim }),
    text(x - 32, y - 14, `reborde ${cm(g.rebordeTapaCm)}`, {
      size: 9,
      color: COLOR.dim,
      anchor: "end",
    }),
    extLine(x, y + h, x, y + h + 24),
    extLine(x + w, y + h, x + w, y + h + 24),
    dimH(x, x + w, y + h + 18, cm(g.anchoCm), { size: 9.5 }),
    text(x + w / 2, y + h + 36, "Plegada en las cuatro caras", {
      size: 8.5,
      color: "#6B7280",
      anchor: "middle",
    }),
    text(x + w / 2, y + h + 48, "Sin perforaciones ni herrajes", {
      size: 8.5,
      color: COLOR.text,
      anchor: "middle",
    }),
  ].join("");
}

// ─── Detalle de la pestaña ────────────────────────────────────────────────────
// Corte del doblez en L: la pared del gabinete y la pestaña de amure, acotadas.

export function detallePestana(box: Box, g: GabineteInputs): string {
  const parts = [viewTitle(box, "DETALLE PESTAÑA DE AMURE")];
  if (!g.pestanaAmure) {
    parts.push(
      text(box.x + box.w / 2, box.y + box.h / 2, "Sin pestaña de amure", {
        size: 10,
        color: COLOR.text,
        anchor: "middle",
      }),
    );
    return parts.join("");
  }

  // Dibujo esquemático a tamaño fijo: el detalle se lee por sus cotas, no por
  // su escala respecto del resto de la lámina.
  const t = 8; // espesor visual de la chapa
  const armV = Math.min(box.h - 60, 84); // tramo de pared
  const armH = Math.min(box.w - 90, 70); // tramo de pestaña

  const x = box.x + 40;
  const y = box.y + 26;

  parts.push(
    // Pared vertical.
    rect(x, y, t, armV, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    // Doblez horizontal (la pestaña que se amura).
    rect(x, y + armV - t, armH + t, t, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    // Agujero de amure en la pestaña.
    circle(x + t + armH / 2, y + armV - t / 2, 3.2),
    // Cotas: largo de la pestaña y altura del tramo.
    extLine(x + t, y + armV - t - 6, x + t, y + armV - t - 20),
    extLine(x + t + armH, y + armV - t - 6, x + t + armH, y + armV - t - 20),
    dimH(x + t, x + t + armH, y + armV - t - 14, cm(g.pestanaAnchoCm), { size: 10 }),
    dimV(y + armV - t - 44, y + armV - t, x + t + armH + 26, cm(g.pestanaAnchoCm), { size: 10 }),
    extLine(x + t + armH, y + armV - t, x + t + armH + 26, y + armV - t),
  );
  return parts.join("");
}

// ─── Corte transversal: perfil de puerta y marco ──────────────────────────────
// Sección horizontal por el lateral del gabinete, mostrando cómo el ala de la
// puerta monta sobre el ala del marco y dónde asienta. Es lo que el taller
// necesita para doblar los perfiles: sin esto hay que llamar por teléfono.
//
// El dibujo NO está a escala del resto de la lámina: es un detalle ampliado y
// se lee por sus cotas, como en cualquier plano de taller.

export function corteTapaCuerpo(box: Box, g: GabineteInputs): string {
  const t = 6; // espesor visual de la chapa en el detalle
  const rebordeFrente = g.rebordeFrenteCm;
  const rebordeTapa = g.rebordeTapaCm;
  const solape = g.solapeTapaCm;
  const holgura = g.holguraTapaMm;

  // Escala del detalle: que el reborde más largo ocupe ~46 px.
  const maxCm = Math.max(rebordeFrente, rebordeTapa, solape, 1);
  const s = 46 / maxCm;
  const gap = Math.max(3, (holgura / 10) * s); // holgura: mm → cm → px

  const frenteAla = rebordeFrente * s;
  const tapaAla = rebordeTapa * s;
  const solapePx = Math.max(solape * s, 10);

  // Corte por un lateral: el eje horizontal es la profundidad (izquierda =
  // frente del gabinete), el vertical va hacia el interior.
  const xPared = box.x + 96; // arista del frente del cuerpo
  const yPared = box.y + 54;
  const paredLen = Math.min(box.w - 150, 84);

  const xTapa = xPared - gap - t;
  const yTapaTop = yPared - 24;
  const tapaCaraLen = frenteAla + 34;

  return [
    viewTitle(box, "CORTE — ENCUENTRO TAPA / CUERPO"),

    // Cuerpo: pared lateral + reborde del frente plegado hacia adentro.
    rect(xPared, yPared, paredLen, t, {
      fill: COLOR.metalFillDark,
      stroke: COLOR.metalStrokeDark,
    }),
    rect(xPared, yPared + t, t, frenteAla, {
      fill: COLOR.metalFillDark,
      stroke: COLOR.metalStrokeDark,
    }),

    // Tapa: su cara + el reborde plegado que monta sobre el cuerpo.
    rect(xTapa, yTapaTop, t, tapaCaraLen, {
      fill: COLOR.metalFill,
      stroke: COLOR.metalStrokeDark,
    }),
    rect(xTapa, yTapaTop, solapePx + t, t, {
      fill: COLOR.metalFill,
      stroke: COLOR.metalStrokeDark,
    }),

    // Cotas.
    extLine(xTapa, yTapaTop, xTapa, yTapaTop - 22),
    extLine(xTapa + solapePx + t, yTapaTop, xTapa + solapePx + t, yTapaTop - 22),
    dimH(xTapa, xTapa + solapePx + t, yTapaTop - 16, cm(solape), { size: 9.5 }),
    text(xTapa + solapePx + t + 8, yTapaTop - 12, "solape", { size: 8.5, color: COLOR.dim }),

    extLine(xPared + t, yPared + t, xPared + t + 44, yPared + t),
    extLine(xPared + t, yPared + t + frenteAla, xPared + t + 44, yPared + t + frenteAla),
    dimV(yPared + t, yPared + t + frenteAla, xPared + t + 38, cm(rebordeFrente), { size: 9.5 }),

    extLine(xTapa, yTapaTop + t, xTapa - 40, yTapaTop + t),
    extLine(xTapa, yTapaTop + t + tapaAla, xTapa - 40, yTapaTop + t + tapaAla),
    dimV(yTapaTop + t, yTapaTop + t + tapaAla, xTapa - 34, cm(rebordeTapa), { size: 9.5 }),

    // Holgura y asiento, en renglones distintos para que no se pisen.
    line(xTapa + t / 2, yTapaTop + tapaCaraLen, xTapa + t / 2, yTapaTop + tapaCaraLen + 10, {
      color: COLOR.dim,
      width: 0.6,
    }),
    line(xPared + t / 2, yPared + t + frenteAla, xPared + t / 2, yTapaTop + tapaCaraLen + 10, {
      color: COLOR.dim,
      width: 0.6,
      dash: "2 2",
    }),
    text(xTapa + t / 2, yTapaTop + tapaCaraLen + 22, `holgura ${fmt(holgura)} mm`, {
      size: 8.5,
      color: COLOR.dim,
      anchor: "middle",
    }),
    text(xPared + t + 14, yPared + t + frenteAla + 44, "asiento de la tapa", {
      size: 8.5,
      color: COLOR.text,
    }),
    line(xPared + t + 10, yPared + t + frenteAla + 40, xPared + t, yPared + t + frenteAla, {
      color: COLOR.dim,
      width: 0.6,
    }),
    text(box.x + box.w - 2, box.y + 8, "Detalle sin escala", {
      size: 8,
      color: "#6B7280",
      anchor: "end",
    }),
  ].join("");
}

// ─── Despiece: las dos piezas en L ────────────────────────────────────────────
// Planta esquemática del cuerpo visto desde arriba, separando las dos piezas y
// marcando dónde solapan y cada cuánto van los tornillos. Es la vista que
// faltaba: el armado estaba dicho con palabras ("dos piezas en L") pero sin
// ninguna medida.

export function despieceL(box: Box, g: GabineteInputs): string {
  // Las dos piezas van separadas, como en cualquier despiece: dibujarlas
  // ensambladas no dejaba ver dónde termina una y empieza la otra, que es
  // justamente el dato.
  //
  // Cada pieza es una L de dos tramos: uno del largo del frente (o del fondo) y
  // otro del largo del lateral. En el extremo libre del tramo largo va el
  // solape sobre el que monta la otra pieza.
  // top generoso: arriba de cada pieza va su cota, y con menos aire se pisaba
  // con el subtítulo del bloque.
  const pad = { left: 24, right: 24, top: 68, bottom: 52 };
  const availW = (box.w - pad.left - pad.right - 54) / 2; // dos piezas + aire
  const availH = box.h - pad.top - pad.bottom;
  const s = fitScale(g.anchoCm, g.profundidadCm, availW, availH);
  const t = 5;

  const largo = g.anchoCm * s; // frente / fondo
  const ala = g.profundidadCm * s; // lateral
  const solape = Math.max(7, Math.min(g.solapeUnionCm * s, 26));

  function pieza(px: number, py: number, nombre: string, detalle: string, fill: string): string {
    return [
      // Tramo largo (frente o fondo) + tramo lateral, formando la L.
      rect(px, py, largo, t, { fill, stroke: COLOR.metalStrokeDark }),
      rect(px, py, t, ala, { fill, stroke: COLOR.metalStrokeDark }),
      // Solape en el extremo libre del tramo largo.
      rect(px + largo - solape, py, solape, t, {
        fill: COLOR.metalFillDark,
        stroke: COLOR.metalStrokeDark,
      }),
      // Cotas de los dos tramos.
      extLine(px, py - 4, px, py - 26),
      extLine(px + largo, py - 4, px + largo, py - 26),
      dimH(px, px + largo, py - 20, cm(g.anchoCm), { size: 9.5 }),
      extLine(px - 4, py, px - 26, py),
      extLine(px - 4, py + ala, px - 26, py + ala),
      dimV(py, py + ala, px - 20, cm(g.profundidadCm), { size: 9.5 }),
      // Cota del solape: solo el número bajo el tramo sombreado. La palabra
      // "solape" va en la nota al pie del bloque — puesta acá al lado se metía
      // encima de la cota de la otra pieza.
      extLine(px + largo - solape, py + t, px + largo - solape, py + t + 28),
      extLine(px + largo, py + t, px + largo, py + t + 28),
      line(px + largo - solape, py + t + 22, px + largo, py + t + 22, { color: COLOR.dim }),
      text(px + largo - solape / 2, py + t + 34, cm(g.solapeUnionCm), {
        size: 8.5,
        color: COLOR.dim,
        anchor: "middle",
      }),
      // Rótulo.
      text(px, py + ala + 26, nombre, { size: 9.5, bold: true }),
      text(px, py + ala + 38, detalle, { size: 8.5, color: "#4B5563" }),
    ].join("");
  }

  const yTop = box.y + pad.top;
  const xA = box.x + pad.left + 26;
  // La separación entre piezas tiene que dejar lugar a la cota del solape de la
  // izquierda y a la cota vertical de la derecha, que si no se encimaban.
  const xB = xA + availW + 54;

  const parts = [
    viewTitle(box, "DESPIECE — LAS DOS PIEZAS EN L"),
    text(box.x + box.w / 2, box.y + 22, "Cada pieza doblada en L; se unen por el solape", {
      size: 8.5,
      color: "#6B7280",
      anchor: "middle",
    }),
    pieza(xA, yTop, "PIEZA A", "frente + lateral", COLOR.metalFill),
    pieza(xB, yTop, "PIEZA B", "fondo + lateral", COLOR.metalFillLight),
  ];

  // Un tornillo dibujado sobre el solape de cada pieza, y el paso al pie: el
  // solape es corto y repartirlos ahí no se leería.
  parts.push(
    circle(xA + largo - solape / 2, yTop + t / 2, 2, { fill: COLOR.hole }),
    circle(xB + largo - solape / 2, yTop + t / 2, 2, { fill: COLOR.hole }),
    text(
      box.x + box.w / 2,
      box.y + box.h - 22,
      `Tramo sombreado = solape de unión (${cm(g.solapeUnionCm)})`,
      { size: 8.5, color: COLOR.text, anchor: "middle" },
    ),
    text(
      box.x + box.w / 2,
      box.y + box.h - 8,
      `${g.tornillos}, cada ${cm(g.pasoTornillosCm)} a lo largo del solape`,
      { size: 8.5, color: COLOR.text, anchor: "middle" },
    ),
  );

  return parts.join("");
}

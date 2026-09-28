// Las vistas de la lámina. Cada una recibe la caja donde tiene que entrar y se
// escala sola con `fitScale`, así el dibujo sigue siendo legible tanto con un
// gabinete alto y angosto como con uno bajo y ancho.
//
// Convención: `s` es la escala en px por cm; todas las medidas del gabinete
// están en cm y se multiplican por `s` al dibujar.

import { circle, dimH, dimV, extLine, fitScale, leader, line, polygon, rect, text } from "./draw.js";
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
  const pad = { left: 46, right: 14, top: 14, bottom: 34 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;
  const s = scale ?? fitScale(g.anchoCm, g.altoCm, availW, availH);

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;

  // Alero de la tapa: sobresale a los lados. Si hay ala declarada se usa esa
  // medida a escala; si no, un saliente fijo chico para que se lea el volumen.
  const over = g.alaTapaCm ? Math.min(g.alaTapaCm * s, 14) : 5;
  const capH = Math.max(7, WALL * 1.6);

  const parts = [
    viewTitle(box, "VISTA FRONTAL"),
    // Cuerpo + tapa (marco interior).
    rect(x, y, w, h, { fill: COLOR.metalFill }),
    rect(x + WALL, y + capH + WALL, w - WALL * 2, h - capH - WALL * 2, {
      fill: COLOR.metalFillLight,
      stroke: COLOR.metalStroke,
    }),
    // Alero superior.
    rect(x - over, y, w + over * 2, capH, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
    // Cotas.
    extLine(x, y + h, x, y + h + 26),
    extLine(x + w, y + h, x + w, y + h + 26),
    dimH(x, x + w, y + h + 20, cm(g.anchoCm)),
    extLine(x, y, x - 30, y),
    extLine(x, y + h, x - 30, y + h),
    dimV(y, y + h, x - 24, cm(g.altoCm)),
  ];
  return parts.join("");
}

// ─── Vista lateral ────────────────────────────────────────────────────────────

export function vistaLateral(box: Box, g: GabineteInputs, scale?: number): string {
  const pad = { left: 14, right: 14, top: 14, bottom: 34 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;
  const s = scale ?? fitScale(g.profundidadCm, g.altoCm, availW, availH);

  const w = g.profundidadCm * s;
  const h = g.altoCm * s;
  const x = box.x + pad.left + (availW - w) / 2;
  const y = box.y + pad.top + (availH - h) / 2;

  const over = g.alaTapaCm ? Math.min(g.alaTapaCm * s, 12) : 5;
  const capH = Math.max(7, WALL * 1.6);

  const parts = [
    viewTitle(box, "VISTA LATERAL DERECHA"),
    rect(x, y, w, h, { fill: COLOR.metalFill }),
    // Alero: sobresale hacia el frente (izquierda de esta vista).
    rect(x - over, y, w + over, capH, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
    // Pestaña de amure: se ve como un pie doblado al fondo (derecha).
    ...(g.pestanaAmure
      ? [
          line(x + w, y + capH, x + w, y + h, { color: COLOR.metalStrokeDark }),
          rect(x + w, y + h - Math.min(g.pestanaAnchoCm * s, 18), 3, Math.min(g.pestanaAnchoCm * s, 18), {
            fill: COLOR.metalFillDark,
            stroke: COLOR.metalStrokeDark,
          }),
        ]
      : []),
    extLine(x, y + h, x, y + h + 26),
    extLine(x + w, y + h, x + w, y + h + 26),
    dimH(x, x + w, y + h + 20, cm(g.profundidadCm)),
  ];
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

  // Agujeros de amure repartidos sobre la pestaña.
  if (g.pestanaAmure) {
    const rad = Math.max(1.6, flange * 0.14);
    const inset = flange / 2;
    const colsX = [x + inset, x + w - inset];
    const rowsY = [y + inset, y + h - inset];
    const nV = 4; // agujeros por lado vertical
    const nH = 3; // agujeros por lado horizontal
    for (const cx of colsX) {
      for (let i = 0; i < nV; i++) {
        parts.push(circle(cx, y + inset + ((h - inset * 2) * i) / (nV - 1), rad));
      }
    }
    for (const cy of rowsY) {
      for (let i = 1; i < nH - 1 + 1; i++) {
        parts.push(circle(x + inset + ((w - inset * 2) * i) / nH, cy, rad));
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
    );
  }

  return parts.join("");
}

// ─── Vista isométrica ─────────────────────────────────────────────────────────
// Proyección simple: la profundidad se dibuja como un desplazamiento diagonal.

export function vistaIsometrica(box: Box, g: GabineteInputs): string {
  const pad = { left: 20, right: 20, top: 16, bottom: 20 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;

  // Ángulo de 30°: dx/dy por cm de profundidad.
  const DX = Math.cos(Math.PI / 6);
  const DY = Math.sin(Math.PI / 6);
  // El bounding box de la proyección mide (ancho + prof·cos) × (alto + prof·sen).
  const totalCmW = g.anchoCm + g.profundidadCm * DX;
  const totalCmH = g.altoCm + g.profundidadCm * DY;
  const s = fitScale(totalCmW, totalCmH, availW, availH);

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const dx = g.profundidadCm * DX * s;
  const dy = g.profundidadCm * DY * s;

  const x = box.x + pad.left + (availW - (w + dx)) / 2;
  const y = box.y + pad.top + (availH - (h + dy)) / 2 + dy;

  const capH = Math.max(7, WALL * 1.6);
  const over = g.alaTapaCm ? Math.min(g.alaTapaCm * s, 10) : 4;

  const parts = [
    viewTitle(box, "VISTA ISOMÉTRICA"),
    // Cara lateral (derecha, hacia el fondo).
    polygon(
      [
        [x + w, y],
        [x + w + dx, y - dy],
        [x + w + dx, y - dy + h],
        [x + w, y + h],
      ],
      { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark },
    ),
    // Cara frontal.
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    // Tapa superior (alero).
    polygon(
      [
        [x - over, y],
        [x + w + over, y],
        [x + w + over + dx, y - dy],
        [x - over + dx, y - dy],
      ],
      { fill: COLOR.metalFillLight, stroke: COLOR.metalStrokeDark },
    ),
    // Canto del alero sobre la cara frontal.
    rect(x - over, y, w + over * 2, capH, { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark }),
  ];

  // Pestaña de amure asomando por detrás: una banda fina en el plano del
  // fondo, corrida hacia afuera del cuerpo.
  if (g.pestanaAmure) {
    const f = Math.max(4, Math.min(g.pestanaAnchoCm * s, 11));
    parts.push(
      polygon(
        [
          [x + dx, y - dy + h],
          [x + w + dx, y - dy + h],
          [x + w + dx, y - dy + h + f],
          [x + dx, y - dy + h + f],
        ],
        { fill: COLOR.metalFillDark, stroke: COLOR.metalStrokeDark },
      ),
    );
  }

  return parts.join("");
}

// ─── Vista interior (tapa abierta) ────────────────────────────────────────────

export function vistaInterior(box: Box, g: GabineteInputs): string {
  const pad = { left: 14, right: 14, top: 14, bottom: 18 };
  const availW = box.w - pad.left - pad.right;
  const availH = box.h - pad.top - pad.bottom;

  // La puerta abierta ocupa ~55% del ancho del cuerpo a la izquierda.
  const doorRatio = 0.55;
  const s = fitScale(g.anchoCm * (1 + doorRatio), g.altoCm, availW, availH);

  const w = g.anchoCm * s;
  const h = g.altoCm * s;
  const doorW = w * doorRatio;
  const totalW = w + doorW;
  const x = box.x + pad.left + (availW - totalW) / 2 + doorW;
  const y = box.y + pad.top + (availH - h) / 2;

  const flange = g.pestanaAmure ? Math.max(8, Math.min(g.pestanaAnchoCm * s, 20)) : WALL;

  const parts = [
    viewTitle(box, g.fondoAbierto ? "VISTA INTERIOR (SIN FONDO)" : "VISTA INTERIOR"),
    // Puerta abierta hacia la izquierda, en perspectiva plana.
    polygon(
      [
        [x - doorW, y - 8],
        [x, y],
        [x, y + h],
        [x - doorW, y + h + 8],
      ],
      { fill: COLOR.metalFillLight, stroke: COLOR.metalStrokeDark },
    ),
    // Cuerpo con la pestaña perimetral y el fondo.
    rect(x, y, w, h, { fill: COLOR.metalFill, stroke: COLOR.metalStrokeDark }),
    rect(x + flange, y + flange, w - flange * 2, h - flange * 2, {
      fill: g.fondoAbierto ? "#FFFFFF" : COLOR.metalFillLight,
      stroke: COLOR.metalStrokeDark,
    }),
    // Bisagras sobre el canto izquierdo.
    rect(x - 3, y + h * 0.18, 6, h * 0.1, { fill: COLOR.metalStrokeDark, stroke: COLOR.metalStrokeDark }),
    rect(x - 3, y + h * 0.72, 6, h * 0.1, { fill: COLOR.metalStrokeDark, stroke: COLOR.metalStrokeDark }),
  ];
  return parts.join("");
}

// ─── Detalle de la pestaña ────────────────────────────────────────────────────
// Corte del doblez en L: la pared del gabinete y la pestaña de amure, acotadas.

export function detallePestana(box: Box, g: GabineteInputs): string {
  const parts = [viewTitle(box, "DETALLE PESTAÑA POSTERIOR")];
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

export function corteMarcoPuerta(box: Box, g: GabineteInputs): string {
  const t = 6; // espesor visual de la chapa en el detalle
  const perfilMarco = g.perfilMarcoCm ?? 2;
  const perfilPuerta = g.perfilPuertaCm ?? 2;
  const solape = g.solapePuertaCm ?? 1;
  const holgura = g.holguraPuertaMm ?? 2;

  // Escala del detalle: que el ala más larga ocupe ~54 px.
  const maxCm = Math.max(perfilMarco, perfilPuerta, solape, 1);
  const s = 46 / maxCm;
  const gap = Math.max(3, (holgura / 10) * s); // holgura: mm → cm → px

  const marcoAla = perfilMarco * s;
  const puertaAla = perfilPuerta * s;
  const solapePx = Math.max(solape * s, 10);

  // Corte por un lateral: el eje horizontal es la profundidad (izquierda =
  // frente del gabinete), el vertical es hacia el interior.
  const xPared = box.x + 96; // arista del frente del cuerpo
  const yPared = box.y + 54;
  const paredLen = Math.min(box.w - 150, 84); // tramo de pared que se muestra

  // La puerta monta por fuera: su ala corre paralela a la pared, separada por
  // la holgura, y su canto apoya contra el ala del marco.
  const xPuerta = xPared - gap - t;
  const yPuertaTop = yPared - 24;
  const puertaCaraLen = marcoAla + 34;

  return [
    viewTitle(box, "CORTE — PERFIL DE PUERTA Y MARCO"),

    // ── Cuerpo (marco): pared lateral + ala doblada hacia el interior.
    rect(xPared, yPared, paredLen, t, {
      fill: COLOR.metalFillDark,
      stroke: COLOR.metalStrokeDark,
    }),
    rect(xPared, yPared + t, t, marcoAla, {
      fill: COLOR.metalFillDark,
      stroke: COLOR.metalStrokeDark,
    }),

    // ── Puerta: cara frontal (de canto) + ala que envuelve el borde.
    rect(xPuerta, yPuertaTop, t, puertaCaraLen, {
      fill: COLOR.metalFill,
      stroke: COLOR.metalStrokeDark,
    }),
    rect(xPuerta, yPuertaTop, solapePx + t, t, {
      fill: COLOR.metalFill,
      stroke: COLOR.metalStrokeDark,
    }),

    // ── Cotas.
    // Ala de la puerta (el tramo que envuelve), arriba.
    extLine(xPuerta, yPuertaTop, xPuerta, yPuertaTop - 22),
    extLine(xPuerta + solapePx + t, yPuertaTop, xPuerta + solapePx + t, yPuertaTop - 22),
    dimH(xPuerta, xPuerta + solapePx + t, yPuertaTop - 16, cm(solape), { size: 9.5 }),
    text(xPuerta + solapePx + t + 8, yPuertaTop - 12, "solape", { size: 8.5, color: COLOR.dim }),

    // Ala del marco (hacia adentro), a la derecha.
    extLine(xPared + t, yPared + t, xPared + t + 44, yPared + t),
    extLine(xPared + t, yPared + t + marcoAla, xPared + t + 44, yPared + t + marcoAla),
    dimV(yPared + t, yPared + t + marcoAla, xPared + t + 38, cm(perfilMarco), { size: 9.5 }),

    // Ala de la puerta (su tramo de canto), a la izquierda.
    extLine(xPuerta, yPuertaTop + t, xPuerta - 40, yPuertaTop + t),
    extLine(xPuerta, yPuertaTop + t + puertaAla, xPuerta - 40, yPuertaTop + t + puertaAla),
    dimV(yPuertaTop + t, yPuertaTop + t + puertaAla, xPuerta - 34, cm(perfilPuerta), { size: 9.5 }),

    // Holgura y asiento: rótulos cortos, pegados a lo que nombran y en
    // renglones distintos para que no se pisen entre sí.
    line(xPuerta + t / 2, yPuertaTop + puertaCaraLen, xPuerta + t / 2, yPuertaTop + puertaCaraLen + 10, {
      color: COLOR.dim,
      width: 0.6,
    }),
    line(xPared + t / 2, yPared + t + marcoAla, xPared + t / 2, yPuertaTop + puertaCaraLen + 10, {
      color: COLOR.dim,
      width: 0.6,
      dash: "2 2",
    }),
    text(xPuerta + t / 2, yPuertaTop + puertaCaraLen + 22, `holgura ${holgura} mm`, {
      size: 8.5,
      color: COLOR.dim,
      anchor: "middle",
    }),
    // Un renglón más abajo que "holgura": compartían altura y se pisaban.
    text(xPared + t + 14, yPared + t + marcoAla + 44, "asiento de la puerta", {
      size: 8.5,
      color: COLOR.text,
    }),
    line(xPared + t + 10, yPared + t + marcoAla + 40, xPared + t, yPared + t + marcoAla, {
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

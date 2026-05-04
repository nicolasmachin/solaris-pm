// Generador de unifilar SVG para Voltia PM.
// Portado del prototipo Python (docs/features/unifilar/prototipo_referencia.py).
// Produce SVG A4 vertical (794×1123 @ 96dpi).

import type { TipoProteccionDC, TipoRed } from "@prisma/client";

import { cableMarker, cableMarkerH } from "./cable.js";
import {
  CUADRO_H,
  CUADRO_W,
  CX_CASA,
  CX_DERIV,
  CX_JAB,
  CX_MAIN,
  COLOR,
  HEADER_H,
  MARGIN,
  PAGE_H,
  PAGE_W,
} from "./layout.js";
import {
  diferencialCalibre,
  esTrifasico,
  polaridad,
  prefijoCable,
  seccionAc,
  seccionDc,
  seccionPeJabalina,
  termicaCalibre,
} from "./rules.js";
import {
  hline,
  label,
  redUteMarker,
  symBreaker,
  symBusbar,
  symFuse,
  symGround,
  symInverter,
  symLoadPanel,
  symMeterBidir,
  symMeterSimple,
  symMiiMeter,
  symPanel,
  symResidual,
  symSpd,
  tableroBox,
  vline,
} from "./symbols.js";

export type UnifilarInputs = {
  cliente: string;
  ubicacion: string;
  /** Texto pre-formateado tipo "Mayo 2026". */
  fecha: string;
  autor: string;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel?: string | null;
  cantidadStrings: number;
  potenciaContratadaKw: number;
  modeloInversor: string;
  potenciaInversorKw: number;
  tipoProteccionDc: TipoProteccionDC;
  calibreProteccionDc: string;
  modeloMedidorMonitoreo?: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
};

function cableLabelLeft(xEje: number, y: number, text: string): string {
  // Marker IEC sobre el cable + label a la izquierda del eje
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return (
    cableMarker(xEje, y, text) +
    `<text x="${xEje - 11}" y="${y + 3}" font-family="Arial, Helvetica, sans-serif" font-size="8" fill="${COLOR.text}" text-anchor="end">${safe}</text>`
  );
}

function cuadroIdentificacion(p: UnifilarInputs): string {
  const cw = CUADRO_W;
  const ch = CUADRO_H;
  const cx = PAGE_W - MARGIN - cw;
  const cy = PAGE_H - MARGIN - ch;
  const rows: Array<[string, string]> = [
    ["PROYECTO:", p.cliente],
    ["UBICACIÓN:", p.ubicacion],
    ["PLANO:", "Unifilar"],
    ["FECHA:", p.fecha],
    ["AUTOR:", p.autor],
  ];
  const rh = ch / rows.length;
  let out = '<g id="cuadro">';
  out += `<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="white" stroke="${COLOR.frame}" stroke-width="1.2"/>`;
  rows.forEach(([k, v], i) => {
    const ry = cy + i * rh;
    out += `<line x1="${cx}" y1="${ry}" x2="${cx + cw}" y2="${ry}" stroke="${COLOR.frame}" stroke-width="0.6"/>`;
    out += `<line x1="${cx + 78}" y1="${ry}" x2="${cx + 78}" y2="${ry + rh}" stroke="${COLOR.frame}" stroke-width="0.6"/>`;
    out += label(cx + 5, ry + rh / 2 + 3, k, { size: 8, weight: "bold" });
    const vStr = v.length <= 35 ? v : v.slice(0, 33) + "...";
    out += label(cx + 82, ry + rh / 2 + 3, vStr, { size: 8 });
  });
  out += "</g>";
  return out;
}

export function generateUnifilarSvg(p: UnifilarInputs): string {
  const pol = polaridad(p.tipoRed);
  const pref = prefijoCable(p.tipoRed);
  const esTri = esTrifasico(p.tipoRed);
  const secDc = seccionDc(p.largoDcEsLargo);
  const secAcInvIcp = seccionAc(p.potenciaInversorKw, p.tipoRed);
  const secAcCasa = seccionAc(p.potenciaContratadaKw, p.tipoRed);
  const termCal = termicaCalibre(p.potenciaInversorKw);
  const difCal = diferencialCalibre(p.potenciaInversorKw);
  const secPe = seccionPeJabalina(p.potenciaInversorKw, p.tipoRed);

  // ─── Layout vertical ───
  const Y_TOP = MARGIN + HEADER_H + 18;

  const Y: Record<string, number> = {};
  Y.red = Y_TOP + 5;
  Y.medidaTabTop = Y.red + 25;
  const H_MEDIDA = 56;
  Y.medidaCenter = Y.medidaTabTop + H_MEDIDA / 2;
  Y.medidaTabBot = Y.medidaTabTop + H_MEDIDA;

  Y.cableMedIcp = Y.medidaTabBot + 18;

  Y.icpTabTop = Y.medidaTabBot + 36;
  const H_ICP = 56;
  Y.icpCenter = Y.icpTabTop + H_ICP / 2;
  Y.icpTabBot = Y.icpTabTop + H_ICP;

  Y.cableIcpImg = Y.icpTabBot + 16;

  Y.imgTabTop = Y.icpTabBot + 32;
  const H_IMG = 130;
  Y.imgMedCenter = Y.imgTabTop + 32;
  Y.imgBusbar = Y.imgTabTop + 65;
  Y.imgIcpCenter = Y.imgTabTop + 100;
  Y.imgTabBot = Y.imgTabTop + H_IMG;

  Y.cableImgAc = Y.imgTabBot + 18;

  Y.acTabTop = Y.imgTabBot + 36;
  const H_AC = 95;
  Y.acDifCenter = Y.acTabTop + 30;
  Y.acDeriv = Y.acTabTop + 65;
  Y.acTabBot = Y.acTabTop + H_AC;

  Y.cableAcInv = Y.acTabBot + 18;

  Y.invCenter = Y.acTabBot + 56;

  // Medidor MII (rectángulo separado debajo del inversor) — formato canónico
  // del plano de Voltia: el medidor del Ministerio de Industria tiene su
  // propio rectángulo aunque venga integrado al inversor.
  Y.miiCenter = Y.invCenter + 48;

  Y.cableInvDc = Y.miiCenter + 28;

  Y.dcTabTop = Y.miiCenter + 38;
  const H_DC = 90;
  Y.dcProtCenter = Y.dcTabTop + 30;
  Y.dcDeriv = Y.dcTabTop + 60;
  Y.dcTabBot = Y.dcTabTop + H_DC;

  Y.cableDcPanel = Y.dcTabBot + 18;

  Y.panelCenter = Y.dcTabBot + 50;

  // ─── Inicio SVG ───
  const parts: string[] = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_W}" height="${PAGE_H}" viewBox="0 0 ${PAGE_W} ${PAGE_H}">`,
    `<rect width="${PAGE_W}" height="${PAGE_H}" fill="white"/>`,
    `<rect x="${MARGIN}" y="${MARGIN}" width="${PAGE_W - 2 * MARGIN}" height="${PAGE_H - 2 * MARGIN}" fill="none" stroke="${COLOR.frame}" stroke-width="1.2"/>`,
  );

  // Header
  parts.push(
    `<rect x="${MARGIN}" y="${MARGIN}" width="${PAGE_W - 2 * MARGIN}" height="${HEADER_H}" fill="${COLOR.voltiaBlue}"/>`,
    label(MARGIN + 8, MARGIN + 16, "VOLTIA", { size: 14, weight: "bold", color: "white" }),
    label(MARGIN + 70, MARGIN + 16, "— Plano Unifilar", { size: 10, color: "white" }),
    label(PAGE_W - MARGIN - 8, MARGIN + 16, `FV_MICROGEN — ${p.tipoRed}`, {
      size: 9,
      anchor: "end",
      color: "white",
    }),
  );

  // RED UTE
  parts.push(redUteMarker(CX_MAIN, Y.red), vline(CX_MAIN, Y.red + 14, Y.medidaTabTop));

  // B6: Puesto de Medida
  parts.push(
    tableroBox(CX_MAIN - 80, Y.medidaTabTop, 160, H_MEDIDA, "Puesto de Medida", COLOR.frame),
    vline(CX_MAIN, Y.medidaTabTop, Y.medidaCenter - 9),
    symMeterBidir(CX_MAIN, Y.medidaCenter + 4),
    label(CX_MAIN + 28, Y.medidaCenter, "Medidor", { size: 8 }),
    label(CX_MAIN + 28, Y.medidaCenter + 9, "bidireccional", { size: 8 }),
    vline(CX_MAIN, Y.medidaCenter + 17, Y.medidaTabBot),
    vline(CX_MAIN, Y.medidaTabBot, Y.icpTabTop),
  );

  // B6: Puesto de ICP
  parts.push(
    tableroBox(CX_MAIN - 80, Y.icpTabTop, 160, H_ICP, "Puesto de ICP", COLOR.puestoIcpBorder),
    vline(CX_MAIN, Y.icpTabTop, Y.icpCenter - 14),
    symBreaker(CX_MAIN, Y.icpCenter),
    label(CX_MAIN + 18, Y.icpCenter - 4, "ICP de UTE", { size: 8 }),
    label(CX_MAIN + 18, Y.icpCenter + 6, `(${pol})`, { size: 8 }),
    vline(CX_MAIN, Y.icpCenter + 14, Y.icpTabBot),
    vline(CX_MAIN, Y.icpTabBot, Y.imgTabTop),
    cableLabelLeft(CX_MAIN, Y.cableIcpImg, `${pref}${secAcCasa} PVC 1m`),
  );

  // B5: Tablero ICP IMG
  const imgX = CX_MAIN - 115;
  const imgW = 230;
  parts.push(
    tableroBox(imgX, Y.imgTabTop, imgW, H_IMG, "Tablero de ICP de la IMG"),
    vline(CX_MAIN, Y.imgTabTop, Y.imgMedCenter - 13),
    symMeterSimple(CX_MAIN, Y.imgMedCenter),
    label(CX_MAIN + 18, Y.imgMedCenter - 2, "Medidor para", { size: 8 }),
    label(CX_MAIN + 18, Y.imgMedCenter + 7, "monitoreo", { size: 8 }),
    vline(CX_MAIN, Y.imgMedCenter + 13, Y.imgBusbar),
    symBusbar(CX_MAIN, Y.imgBusbar),
    label(imgX + 6, Y.imgBusbar - 3, "Punto de conexión", { size: 8 }),
  );

  // Derivación a tablero general (sale a la derecha)
  const derivToCasaY = Y.imgBusbar;
  parts.push(hline(CX_MAIN, CX_CASA - 50, derivToCasaY));
  const labelMidX = Math.floor((imgX + imgW + CX_CASA - 50) / 2);
  const cableTextH = `${pref}${secAcCasa} PVC ${p.largoAcIcpTableroM}m`;
  parts.push(
    cableMarkerH(labelMidX, derivToCasaY, cableTextH),
    label(labelMidX, derivToCasaY - 9, cableTextH, { size: 7, anchor: "middle" }),
  );

  // ICP IMG
  parts.push(
    vline(CX_MAIN, Y.imgBusbar + 4, Y.imgIcpCenter - 14),
    symBreaker(CX_MAIN, Y.imgIcpCenter),
    label(CX_MAIN + 18, Y.imgIcpCenter - 2, "ICP de la IMG", { size: 8 }),
    label(CX_MAIN + 18, Y.imgIcpCenter + 7, `${termCal} ${pol}`, { size: 8 }),
    vline(CX_MAIN, Y.imgIcpCenter + 14, Y.imgTabBot),
    vline(CX_MAIN, Y.imgTabBot, Y.acTabTop),
    cableLabelLeft(CX_MAIN, Y.cableImgAc, `${pref}${secAcInvIcp} PVC ${p.largoAcInversorIcpM}m`),
  );

  // B4: Tablero protecciones AC
  const acX = CX_MAIN - 115;
  parts.push(
    tableroBox(acX, Y.acTabTop, 230, H_AC, "Tablero protecciones AC"),
    vline(CX_MAIN, Y.acTabTop, Y.acDifCenter - 14),
    symResidual(CX_MAIN, Y.acDifCenter),
    label(CX_MAIN + 22, Y.acDifCenter - 4, "Protección Diferencial", { size: 8 }),
    label(CX_MAIN + 22, Y.acDifCenter + 6, difCal, { size: 7 }),
    vline(CX_MAIN, Y.acDifCenter + 14, Y.acDeriv),
    symBusbar(CX_MAIN, Y.acDeriv),
    hline(CX_MAIN, CX_DERIV, Y.acDeriv),
    symSpd(CX_DERIV, Y.acDeriv + 12),
    label(CX_DERIV + 12, Y.acDeriv + 7, "Descargador", { size: 8, weight: "bold" }),
  );
  const spdV = esTri ? "440Vac" : "275Vac";
  parts.push(label(CX_DERIV + 12, Y.acDeriv + 17, `${spdV} 20kA`, { size: 7 }));

  parts.push(
    vline(CX_MAIN, Y.acDeriv + 4, Y.acTabBot),
    vline(CX_MAIN, Y.acTabBot, Y.invCenter - 28),
    cableLabelLeft(CX_MAIN, Y.cableAcInv, `${pref}${secAcInvIcp}+${secAcInvIcp}PE PVC 1m`),
  );

  const peAcTop = Y.acDeriv + 26;

  // B3: Inversor + medidor MII separado
  parts.push(
    symInverter(CX_MAIN, Y.invCenter, esTri),
    label(CX_MAIN + 40, Y.invCenter - 8, p.modeloInversor, { size: 8, weight: "bold" }),
    label(CX_MAIN + 40, Y.invCenter + 2, `${p.potenciaInversorKw} kW`, { size: 8 }),
    label(CX_MAIN + 40, Y.invCenter + 12, "Inversor", { size: 7 }),
    // Línea inversor → medidor MII.
    vline(CX_MAIN, Y.invCenter + 28, Y.miiCenter - 9),
    // Medidor MII (rectángulo separado).
    symMiiMeter(CX_MAIN, Y.miiCenter),
    label(CX_MAIN + 30, Y.miiCenter - 3, "Medidor para", { size: 7 }),
    label(CX_MAIN + 30, Y.miiCenter + 4, "Ministerio de Industria", { size: 7 }),
    label(CX_MAIN + 30, Y.miiCenter + 11, "(Incluido en inversor)", { size: 7 }),
    // Línea medidor MII → tablero DC.
    vline(CX_MAIN, Y.miiCenter + 9, Y.dcTabTop),
    cableLabelLeft(CX_MAIN, Y.cableInvDc, `2x${secDc}+${secDc}PE PVC 1m`),
  );

  // B2: Tablero protecciones DC
  parts.push(
    tableroBox(CX_MAIN - 115, Y.dcTabTop, 230, H_DC, "Tablero protecciones DC"),
    vline(CX_MAIN, Y.dcTabTop, Y.dcProtCenter - 14),
  );

  if (p.tipoProteccionDc === "TERMOMAGNETICO") {
    parts.push(
      symBreaker(CX_MAIN, Y.dcProtCenter),
      label(CX_MAIN + 18, Y.dcProtCenter - 4, "Termomagnético DC", { size: 8 }),
      label(CX_MAIN + 18, Y.dcProtCenter + 6, p.calibreProteccionDc, { size: 7 }),
    );
  } else {
    parts.push(
      symFuse(CX_MAIN, Y.dcProtCenter),
      label(CX_MAIN + 18, Y.dcProtCenter - 4, "Portafusibles DC", { size: 8 }),
      label(CX_MAIN + 18, Y.dcProtCenter + 6, p.calibreProteccionDc, { size: 7 }),
    );
  }

  parts.push(
    vline(CX_MAIN, Y.dcProtCenter + 14, Y.dcDeriv),
    symBusbar(CX_MAIN, Y.dcDeriv),
    hline(CX_MAIN, CX_DERIV, Y.dcDeriv),
    symSpd(CX_DERIV, Y.dcDeriv + 12),
    label(CX_DERIV + 12, Y.dcDeriv + 7, "Descargador", { size: 8, weight: "bold" }),
    label(CX_DERIV + 12, Y.dcDeriv + 17, "500Vdc 20kA", { size: 7 }),
    vline(CX_MAIN, Y.dcDeriv + 4, Y.dcTabBot),
    vline(CX_MAIN, Y.dcTabBot, Y.panelCenter - 22),
    cableLabelLeft(CX_MAIN, Y.cableDcPanel, `2x${secDc} solar +${secDc}PE PVC ${p.largoDcPanelesM}m`),
  );

  const peDcTop = Y.dcDeriv + 26;

  // B1: Paneles
  parts.push(
    symPanel(CX_MAIN, Y.panelCenter, p.cantidadPaneles, p.cantidadStrings),
    label(CX_MAIN, Y.panelCenter + 30, "Paneles fotovoltaicos", {
      anchor: "middle",
      size: 9,
      weight: "bold",
    }),
    label(
      CX_MAIN,
      Y.panelCenter + 41,
      `${p.cantidadPaneles} × ${p.potenciaPanelW}W (${p.cantidadStrings} string${p.cantidadStrings > 1 ? "s" : ""})`,
      { anchor: "middle", size: 8 },
    ),
  );

  // Jabalina común (PE de SPD AC + DC → unión → jabalina)
  const CX_PE = CX_DERIV + 60;
  const peHorizY = Y.dcTabBot + 8;
  parts.push(
    hline(CX_DERIV, CX_PE, peAcTop, COLOR.ground, 1.5),
    hline(CX_DERIV, CX_PE, peDcTop, COLOR.ground, 1.5),
    vline(CX_PE, peAcTop, peHorizY, COLOR.ground, 1.5),
    `<circle cx="${CX_PE}" cy="${peDcTop}" r="2" fill="${COLOR.ground}"/>`,
    hline(CX_PE, CX_JAB, peHorizY, COLOR.ground, 1.5),
  );
  const jabY = peHorizY + 28;
  parts.push(
    vline(CX_JAB, peHorizY, jabY, COLOR.ground, 1.5),
    symGround(CX_JAB, jabY),
    label(Math.floor((CX_PE + CX_JAB) / 2), peHorizY - 4, `${secPe}PE PVC 3m`, {
      size: 7,
      anchor: "middle",
      color: COLOR.ground,
    }),
  );

  // Tablero general casa (derivación lateral)
  const casaW = 130;
  const casaH = 165;
  const casaX = CX_CASA - 45;
  const casaY = Y.imgBusbar - 10;
  parts.push(tableroBox(casaX, casaY, casaW, casaH, "Tablero GRAL casa"));
  const cxCasa = casaX + casaW / 2;
  parts.push(
    vline(cxCasa, casaY, casaY + 28 - 14),
    symBreaker(cxCasa, casaY + 28),
    label(cxCasa + 12, casaY + 24, "Interruptor", { size: 7 }),
    label(cxCasa + 12, casaY + 32, "general", { size: 7 }),
    vline(cxCasa, casaY + 42, casaY + 70 - 14),
    symResidual(cxCasa, casaY + 70),
    label(cxCasa + 14, casaY + 67, "Diferencial", { size: 7 }),
    vline(cxCasa, casaY + 84, casaY + 115),
    symLoadPanel(cxCasa, casaY + 127),
    label(cxCasa, casaY + 153, "Tablero de cargas", { anchor: "middle", size: 7 }),
    vline(casaX - 5, derivToCasaY, casaY),
    hline(casaX - 5, cxCasa, casaY),
  );

  // Cuadro de identificación
  parts.push(cuadroIdentificacion(p));

  parts.push("</svg>");
  return parts.join("\n");
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Handlebars from "handlebars";

import type { ProposalCalculated, ProposalData } from "./types.js";

const TEMPLATES_DIR = fileURLToPath(new URL("../../templates/proposal-v2", import.meta.url));

// ── Formato uruguayo (miles con ".", decimal con ",") — manual, sin depender de ICU.
function fmtNum(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = value < 0 ? "-" : "";
  return decPart ? `${sign}${withThousands},${decPart}` : `${sign}${withThousands}`;
}

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// ── Helpers ──
Handlebars.registerHelper("currency", (value: number, currency = "USD") =>
  `${typeof currency === "string" ? currency : "USD"} ${fmtNum(value)}`,
);
Handlebars.registerHelper("pesos", (value: number) => `$ ${fmtNum(value)}`);
Handlebars.registerHelper("number", (value: number, decimals = 0) =>
  fmtNum(value, typeof decimals === "number" ? decimals : 0),
);
Handlebars.registerHelper("percent", (value: number, decimals = 1) =>
  `${fmtNum(value * 100, typeof decimals === "number" ? decimals : 1)} %`,
);
Handlebars.registerHelper("mult", (a: number, b: number) => (Number(a) || 0) * (Number(b) || 0));
Handlebars.registerHelper("dateLong", (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map((p) => Number.parseInt(p, 10));
  return `${d} de ${MESES_LARGOS[(m ?? 1) - 1] ?? ""} de ${y}`;
});

let initialized = false;
function init() {
  if (initialized) return;
  const partialsDir = path.join(TEMPLATES_DIR, "partials");
  if (fs.existsSync(partialsDir)) {
    for (const file of fs.readdirSync(partialsDir)) {
      if (!file.endsWith(".hbs")) continue;
      const name = file.replace(/\.hbs$/, "");
      Handlebars.registerPartial(name, fs.readFileSync(path.join(partialsDir, file), "utf8"));
    }
  }
  initialized = true;
}

function readStyles(): string {
  return fs.readFileSync(path.join(TEMPLATES_DIR, "styles", "base.css"), "utf8");
}

// Logos oficiales de Voltia embebidos como data URL (PDF self-contained).
const logoCache = new Map<string, string>();
function readLogo(file: string): string {
  const cached = logoCache.get(file);
  if (cached) return cached;
  const buf = fs.readFileSync(path.join(TEMPLATES_DIR, "assets", file));
  const url = `data:image/png;base64,${buf.toString("base64")}`;
  logoCache.set(file, url);
  return url;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Barras del gráfico de generación mensual: el más alto ocupa el 86% del alto.
function buildGenChart(generacionMensualKwh: number[]) {
  const max = Math.max(1, ...generacionMensualKwh);
  return generacionMensualKwh.map((v, i) => ({
    label: fmtNum(v),
    h: round2((v / max) * 86),
    m: MESES_CORTOS[i] ?? "",
  }));
}

// Gráfico de retorno acumulado divergente: la línea de equilibrio (y=0) se ubica
// proporcionalmente entre el máximo positivo y el máximo negativo; cada barra se
// escala al 86% de su región.
function buildRoiChart(retornoInversion16Anios: number[]) {
  const maxPos = Math.max(0, ...retornoInversion16Anios.filter((v) => v >= 0));
  const maxNeg = Math.max(0, ...retornoInversion16Anios.filter((v) => v < 0).map((v) => -v));
  const total = maxPos + maxNeg || 1;
  const zeroPct = round2((maxPos / total) * 100);
  const botPct = round2(100 - zeroPct);
  const bars = retornoInversion16Anios.map((v, i) => {
    const isPos = v >= 0;
    return {
      year: `A${i}`,
      isPos,
      isNeg: !isPos,
      h: isPos ? round2((v / (maxPos || 1)) * 86) : round2((-v / (maxNeg || 1)) * 86),
      // Minus tipográfico (U+2212) como en el diseño validado.
      label: isPos ? fmtNum(v) : `−${fmtNum(-v)}`,
    };
  });
  // Retorno acumulado al año 15, redondeado hacia abajo a miles ("supera los USD 22.000").
  const ultimo = retornoInversion16Anios[retornoInversion16Anios.length - 1] ?? 0;
  const finalMilUsd = Math.max(0, Math.floor(ultimo / 1000) * 1000);
  return { zeroPct, botPct, bars, finalMilUsd };
}

export interface RenderContext {
  data: ProposalData;
  calculated: ProposalCalculated;
}

function render(templateFile: string, ctx: RenderContext): string {
  init();
  const source = fs.readFileSync(path.join(TEMPLATES_DIR, templateFile), "utf8");
  const compiled = Handlebars.compile(source);
  return compiled({
    ...ctx,
    styles: readStyles(),
    logoMarkBlue: readLogo("voltia-mark-blue.png"),
    logoStackedWhite: readLogo("voltia-stacked-white.png"),
    genChart: buildGenChart(ctx.calculated.generacionMensualKwh),
    roi: buildRoiChart(ctx.calculated.retornoInversion16Anios),
  });
}

export function renderProposalFull(ctx: RenderContext): string {
  return render("full.hbs", ctx);
}

export function renderProposalSummary(ctx: RenderContext): string {
  return render("summary.hbs", ctx);
}

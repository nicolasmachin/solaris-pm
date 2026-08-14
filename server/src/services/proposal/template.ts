import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Handlebars from "handlebars";

import type { ProposalCalculated, ProposalData, ProposalVariante } from "./types.js";

const TEMPLATES_ROOT = fileURLToPath(new URL("../../templates", import.meta.url));

// Una carpeta de plantillas por variante. La de empresa contiene SOLO los
// archivos que difieren; todo lo que no esté ahí se toma de la residencial.
const VARIANT_DIRS: Record<ProposalVariante, string> = {
  RESIDENCIAL: "proposal-v2",
  EMPRESA: "proposal-v2-empresa",
};
const variantDir = (v: ProposalVariante) => path.join(TEMPLATES_ROOT, VARIANT_DIRS[v]);

// Resuelve un archivo con fallback a la carpeta residencial: así los estilos,
// los assets y los partials compartidos no se duplican.
function resolveFile(variante: ProposalVariante, ...segments: string[]): string {
  const own = path.join(variantDir(variante), ...segments);
  if (fs.existsSync(own)) return own;
  return path.join(variantDir("RESIDENCIAL"), ...segments);
}

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
// Nombre de la tarifa UTE para mostrar en los textos (el enum es Simple/Doble/
// Triple; UTE las llama "Doble Horario"/"Triple Horario").
Handlebars.registerHelper("tarifaLabel", (tarifa: string): string => {
  const map: Record<string, string> = {
    Simple: "Simple",
    Doble: "Doble Horario",
    Triple: "Triple Horario",
  };
  return map[tarifa] ?? tarifa;
});
// Texto según variante: `{{t "tu hogar" "su empresa"}}`. Para las frases
// sueltas que solo cambian de tratamiento (tuteo vs. institucional) es mucho
// más legible que un {{#if}} por oración, y evita forkear el partial entero
// por un título.
Handlebars.registerHelper("t", function (
  residencial: string,
  empresa: string,
  options: Handlebars.HelperOptions,
) {
  const esEmpresa = (options?.data?.root as { esEmpresa?: boolean })?.esEmpresa === true;
  return esEmpresa ? empresa : residencial;
});

// Resuelve el nombre namespaceado de un partial según la variante del
// contexto: `{{> (p "carta")}}` carga EMPRESA/carta o RESIDENCIAL/carta. Con
// esto el layout es UNO SOLO para las dos variantes y la carpeta de empresa
// solo lleva los partials que cambian.
Handlebars.registerHelper("p", function (name: string, options: Handlebars.HelperOptions) {
  const variante = (options?.data?.root as { variante?: string })?.variante ?? "RESIDENCIAL";
  return `${variante}/${name}`;
});
Handlebars.registerHelper("dateLong", (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map((p) => Number.parseInt(p, 10));
  return `${d} de ${MESES_LARGOS[(m ?? 1) - 1] ?? ""} de ${y}`;
});

// El registro de partials de Handlebars es GLOBAL al proceso: si las dos
// carpetas registraran su `carta.hbs` con el nombre plano, una pisaría a la
// otra según el orden de lectura. Por eso cada partial se registra como
// "<variante>/<nombre>" y los layouts los invocan así.
const initialized = new Set<ProposalVariante>();
function init(variante: ProposalVariante) {
  if (initialized.has(variante)) return;
  // Primero la base (para que la variante herede todo), después los propios
  // de la variante, que pisan al homónimo.
  const dirs =
    variante === "RESIDENCIAL"
      ? [variantDir("RESIDENCIAL")]
      : [variantDir("RESIDENCIAL"), variantDir(variante)];
  for (const dir of dirs) {
    const partialsDir = path.join(dir, "partials");
    if (!fs.existsSync(partialsDir)) continue;
    for (const file of fs.readdirSync(partialsDir)) {
      if (!file.endsWith(".hbs")) continue;
      const name = file.replace(/\.hbs$/, "");
      Handlebars.registerPartial(
        `${variante}/${name}`,
        fs.readFileSync(path.join(partialsDir, file), "utf8"),
      );
    }
  }
  initialized.add(variante);
}

function readStyles(variante: ProposalVariante): string {
  return fs.readFileSync(resolveFile(variante, "styles", "base.css"), "utf8");
}

// Logos oficiales de Voltia embebidos como data URL (PDF self-contained).
// Cache por variante + archivo: si la carpeta de empresa trae un logo propio
// con el mismo nombre, cachear solo por nombre serviría el equivocado.
const logoCache = new Map<string, string>();
function readLogo(variante: ProposalVariante, file: string): string {
  const key = `${variante}:${file}`;
  const cached = logoCache.get(key);
  if (cached) return cached;
  const buf = fs.readFileSync(resolveFile(variante, "assets", file));
  const url = `data:image/png;base64,${buf.toString("base64")}`;
  logoCache.set(key, url);
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

// Datos del asesor que firman la carta de presentación. Los valores ya vienen
// resueltos con fallback (ver services/proposal/advisor.ts): jobTitle nunca es
// null acá, name nunca vacío.
export interface ProposalAdvisor {
  name: string;
  jobTitle: string;
  email: string;
}

export interface RenderContext {
  data: ProposalData;
  calculated: ProposalCalculated;
  advisor: ProposalAdvisor;
}

function render(templateFile: string, ctx: RenderContext): string {
  // Los snapshots publicados antes del cotizador B2B no traen variante: se
  // renderizan como residenciales, que es lo que eran.
  const variante = ctx.data.variante ?? "RESIDENCIAL";
  init(variante);
  const source = fs.readFileSync(resolveFile(variante, templateFile), "utf8");
  const compiled = Handlebars.compile(source);
  return compiled({
    ...ctx,
    variante,
    esEmpresa: variante === "EMPRESA",
    styles: readStyles(variante),
    logoMarkBlue: readLogo(variante, "voltia-mark-blue.png"),
    logoStackedWhite: readLogo(variante, "voltia-stacked-white.png"),
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

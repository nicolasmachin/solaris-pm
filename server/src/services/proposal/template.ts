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

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

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
Handlebars.registerHelper("dateLong", (iso: string) => {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map((p) => Number.parseInt(p, 10));
  return `${d} de ${MESES[(m ?? 1) - 1] ?? ""} de ${y}`;
});

// Sprite de íconos (SVG inline, tomado del mockup Imagine validado).
const ICON_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="logo" viewBox="0 0 48 48"><path class="v-fill" d="M9 7h8.5l6.5 20 6.5-20H45L31 41h-9L9 7z" fill="#1836B2"/><path class="v-bolt" d="M26 13l-9 13h6l-2.5 10 11-15h-6.5L26 13z" fill="#F5B700"/></symbol>
<symbol id="grid" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></symbol>
<symbol id="cpu" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></symbol>
<symbol id="zap" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></symbol>
<symbol id="maximize" viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></symbol>
<symbol id="sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
<symbol id="search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></symbol>
<symbol id="pencil" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></symbol>
<symbol id="package" viewBox="0 0 24 24"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></symbol>
<symbol id="calendar" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></symbol>
<symbol id="wrench" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></symbol>
<symbol id="check-circle" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></symbol>
<symbol id="file-text" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8M16 17H8M10 9H8"/></symbol>
<symbol id="settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></symbol>
<symbol id="shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></symbol>
<symbol id="home" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></symbol>
<symbol id="gauge" viewBox="0 0 24 24"><path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/><circle cx="12" cy="14" r="1.5"/></symbol>
<symbol id="arrow-right" viewBox="0 0 24 24"><path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/></symbol>
<symbol id="mail" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></symbol>
<symbol id="phone" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></symbol>
<symbol id="globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></symbol>
<symbol id="trending-up" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></symbol>
</defs></svg>`;

let initialized = false;
function init() {
  if (initialized) return;
  // Registrar todas las partials.
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
  return ["base.css", "components.css", "print.css"]
    .map((f) => fs.readFileSync(path.join(TEMPLATES_DIR, "styles", f), "utf8"))
    .join("\n");
}

export interface RenderContext {
  data: ProposalData;
  calculated: ProposalCalculated;
  advisor: { name: string; jobTitle: string; email: string; phone: string };
  plazos: {
    diasPagoInicial: number;
    diasCoordinacion: number;
    diasInstalacion: number;
    diasHabilitacion: number;
    textoFirma: string;
    textoCoordinacion: string;
    textoInstalacion: string;
    textoHabilitacion: string;
  };
  precioSeguroGranizoUsdPorPanelAno: number;
  charts: { generacion: string; retorno: string };
}

function render(templateFile: string, ctx: RenderContext): string {
  init();
  const source = fs.readFileSync(path.join(TEMPLATES_DIR, templateFile), "utf8");
  const compiled = Handlebars.compile(source);
  return compiled({ ...ctx, styles: readStyles(), iconSprite: ICON_SPRITE });
}

export function renderProposalFull(ctx: RenderContext): string {
  return render("full.hbs", ctx);
}

export function renderProposalSummary(ctx: RenderContext): string {
  return render("summary.hbs", ctx);
}

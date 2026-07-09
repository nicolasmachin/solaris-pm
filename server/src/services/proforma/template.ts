// Template HTML de la proforma BBVA de Voltia. Función pura data → HTML string que
// Puppeteer renderiza a PDF (full-bleed, margen 0). Diseño con bandas de olas
// azules (SVG), logo y firma embebidos. TODO el texto sale de `data` (valores +
// `data.textos`); acá sólo viven el diseño y los assets.

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import type { ProformaDataPublish } from "./schemas/proforma.schema.js";

// ── Assets (logo azul + firma), embebidos como data URL (PDF self-contained) ──
const assetCache = new Map<string, string>();
function asset(file: string): string {
  const cached = assetCache.get(file);
  if (cached) return cached;
  const p = fileURLToPath(new URL(`../../templates/proforma/assets/${file}`, import.meta.url));
  const url = `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
  assetCache.set(file, url);
  return url;
}

function esc(s: string | number | undefined | null): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtMiles(n: number | undefined, dec = 0): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const fixed = Math.abs(n).toFixed(dec);
  const [i, d] = fixed.split(".");
  const withDots = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return d ? `${withDots},${d}` : withDots;
}

function fmtFecha(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return esc(iso);
  return `${d}/${m}/${y}`;
}

// Íconos SVG del pie (emoji renderiza como cuadrado en Chromium sin fuente emoji).
const ICON: Record<string, string> = {
  phone: `<svg width="10" height="10" viewBox="0 0 24 24" fill="#16357a"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.3 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.3 1l-2.2 2.2z"/></svg>`,
  mail: `<svg width="10" height="10" viewBox="0 0 24 24" fill="#16357a"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
  web: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16357a" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 3 2.8 15 0 18M12 3c-2.8 3-2.8 15 0 18"/></svg>`,
  pin: `<svg width="10" height="10" viewBox="0 0 24 24" fill="#16357a"><path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>`,
};

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; color: #223; -webkit-print-color-adjust: exact; }
  .page { position: relative; width: 210mm; min-height: 297mm; overflow: hidden; background: #fff; }
  .wave-top, .wave-bottom { position: absolute; left: 0; width: 100%; z-index: 0; display: block; }
  .wave-top { top: 0; height: 150px; }
  .wave-bottom { bottom: 0; height: 165px; }
  .logo { position: absolute; top: 26px; right: 40px; height: 60px; z-index: 2; }
  .content { position: relative; z-index: 1; padding: 150px 46px 175px; }
  .title { text-align: center; color: #16357a; font-weight: 800; letter-spacing: .3px; line-height: 1.35; margin-bottom: 26px; }
  .title .t1 { font-size: 14pt; }
  .title .t2 { font-size: 13pt; }
  .h-sec { color: #16357a; font-weight: 800; font-size: 12pt; margin: 6px 0 8px; }
  .cliente div { color: #6f8bcb; font-size: 11pt; margin: 2px 0; }
  .cliente b { color: #1c2b63; }
  .fecha { color: #16357a; font-weight: 800; font-size: 11.5pt; margin: 22px 0 8px; }
  table.fin { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
  table.fin th { background: #8aa9dd; color: #fff; font-weight: 600; font-size: 10.5pt; padding: 8px 10px; text-align: center; }
  table.fin th:first-child { text-align: left; }
  table.fin td { padding: 9px 10px; text-align: center; font-size: 11pt; color: #33415f; border-bottom: 1px solid #dde6f5; }
  table.fin td:first-child { text-align: left; color: #16357a; font-weight: 700; }
  table.fin td.monto { font-weight: 700; color: #1c2b63; }
  .banner { background: #9fbceb; color: #fff; text-align: center; font-weight: 600; font-size: 11pt; padding: 7px; border-radius: 3px; margin-bottom: 10px; }
  .desc { color: #33415f; font-size: 11pt; line-height: 1.5; white-space: pre-line; }
  .divider { border: none; border-top: 1px solid #c9d6ee; margin: 22px 0 14px; width: 55%; }
  .cierre { display: flex; justify-content: space-between; align-items: flex-end; gap: 30px; margin-top: 8px; }
  .nota { color: #6f8bcb; font-size: 11pt; }
  .firma { text-align: center; min-width: 240px; }
  .firma img { height: 70px; margin-bottom: -6px; }
  .firma .line { border-top: 1px solid #333; margin: 0 auto 4px; width: 230px; }
  .firma .n { font-weight: 700; color: #1c2b63; font-size: 10.5pt; }
  .firma .c { color: #556; font-size: 10pt; }
  .footer { position: absolute; bottom: 0; left: 0; width: 100%; z-index: 2; padding: 0 46px 26px; display: flex; justify-content: space-between; gap: 20px; }
  .footer .col { font-size: 8.5pt; line-height: 1.5; color: #33415f; }
  .footer .brand { color: #16357a; font-weight: 800; font-size: 11pt; margin-bottom: 2px; }
  .footer b { color: #1c2b63; }
  .footer .contact div { display: flex; align-items: center; gap: 6px; justify-content: flex-end; }
`;

function waveTop(): string {
  return `<svg class="wave-top" viewBox="0 0 1200 200" preserveAspectRatio="none">
    <path d="M0,0 L1200,0 L1200,110 C980,175 800,55 590,105 C380,155 210,60 0,130 Z" fill="#dce9fb"/>
    <path d="M0,0 L1200,0 L1200,70 C1000,140 820,35 600,85 C380,135 220,45 0,100 Z" fill="#c6daf6"/>
  </svg>`;
}
function waveBottom(): string {
  return `<svg class="wave-bottom" viewBox="0 0 1200 200" preserveAspectRatio="none">
    <path d="M0,70 C250,15 450,125 650,85 C880,40 1010,145 1200,80 L1200,200 L0,200 Z" fill="#dce9fb"/>
    <path d="M0,105 C250,55 450,160 650,120 C880,75 1010,175 1200,110 L1200,200 L0,200 Z" fill="#c6daf6"/>
  </svg>`;
}

// Un dato del cliente: sólo se muestra si tiene valor (los opcionales vacíos se omiten).
function clienteRow(label: string, value: string | undefined): string {
  if (!value || !value.trim()) return "";
  return `<div>${esc(label)}: <b>${esc(value)}</b></div>`;
}

export function renderProformaHtml(data: ProformaDataPublish): string {
  const c = data.cliente;
  const f = data.financiacion;
  const t = data.textos;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${STYLES}</style></head><body>
  <div class="page">
    ${waveTop()}
    <img class="logo" src="${asset("voltia-stacked-blue.png")}" />

    <div class="content">
      <div class="title">
        <div class="t1">${esc(t.tituloLinea1)}</div>
        <div class="t2">${esc(t.tituloLinea2)}</div>
      </div>

      <div class="h-sec">${esc(t.headingCliente)}</div>
      <div class="cliente">
        ${clienteRow(t.labelNombre, c.nombre)}
        ${clienteRow(t.labelCi, c.documento)}
        ${clienteRow(t.labelDireccion, c.direccion)}
        ${clienteRow(t.labelTelefono, c.telefono)}
        ${clienteRow(t.labelMail, c.email)}
      </div>

      <div class="fecha">${esc(t.labelFecha)}: ${fmtFecha(data.fecha)}</div>

      <table class="fin">
        <thead>
          <tr><th>${esc(t.thConcepto)}</th><th>${esc(t.thMonto)}</th><th>${esc(t.thPlazo)}</th><th>${esc(t.thTasa)}</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${esc(f.concepto)}</td>
            <td class="monto">USD ${fmtMiles(f.montoSolicitadoUsd)}</td>
            <td>${esc(f.plazoMeses)}</td>
            <td>${fmtMiles(f.tasaUi, f.tasaUi % 1 === 0 ? 0 : 2)}%</td>
          </tr>
        </tbody>
      </table>

      <div class="banner">${esc(t.bannerDescripcion)}</div>
      <div class="desc">${esc(data.descripcion)}</div>

      <hr class="divider" />
      <div class="cierre">
        <div class="nota">${esc(t.nota)}</div>
        <div class="firma">
          <img src="${asset("firma-nicolas.png")}" />
          <div class="line"></div>
          <div class="n">${esc(t.firmante)}</div>
          <div class="c">${esc(t.cargo)}</div>
        </div>
      </div>
    </div>

    ${waveBottom()}
    <div class="footer">
      <div class="col">
        <div class="brand">${esc(t.footerMarca)}</div>
        <div>Razón social: <b>${esc(t.footerRazonSocial)}</b></div>
        <div>RUT: <b>${esc(t.footerRut)}</b></div>
        <div>Cuenta BBVA: <b>${esc(t.footerCuentaBbva)}</b></div>
      </div>
      <div class="col contact">
        <div>${ICON.phone} ${esc(t.footerTel)}</div>
        <div>${ICON.mail} ${esc(t.footerEmail)}</div>
        <div>${ICON.web} ${esc(t.footerWeb)}</div>
        <div>${ICON.pin} ${esc(t.footerDomicilio)}</div>
      </div>
    </div>
  </div>
  </body></html>`;
}

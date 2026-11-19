// Template HTML del PDF de una cotización a medida (data → HTML que Puppeteer
// pasa a PDF). Copia el formato de las cotizaciones que Voltia armaba a mano
// (2026-004 Álvarez, 2026-005 Penedo): encabezado con logo, datos del cliente y
// de la cotización, detalle, totales, condiciones y observaciones.
//
// Pensado para entrar en UNA hoja A4: un script al final mide la altura y, si
// se pasa, achica todo hasta un 80 %. Si ni así entra, se deja en tamaño
// normal y sigue en una segunda hoja (sin cortar un bloque al medio).

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import type { Renglon } from "./cotizaciones.schema.js";

export type CotizacionPdfData = {
  numero: string | null;
  clienteNombre: string;
  clienteDireccion?: string | null;
  clienteCiudad?: string | null;
  clienteTelefono?: string | null;
  clienteEmail?: string | null;
  fecha: string;
  validaHasta: string;
  moneda: "USD" | "UYU";
  vendedorNombre: string | null;
  formaTrabajo?: string | null;
  alcanceTitulo?: string | null;
  alcanceTexto?: string | null;
  items: Renglon[];
  ivaTasa: number;
  subtotal: number;
  iva: number;
  total: number;
  condicionesPago?: string | null;
  plazoEntrega?: string | null;
  incluye?: string | null;
  noIncluye?: string | null;
  observaciones?: string | null;
};

/** Márgenes de la hoja (los usa también el generador). */
export const MARGEN_PAGINA = { top: "12mm", right: "13mm", bottom: "12mm", left: "13mm" };
// Alto útil de la hoja en px de CSS: (297 − 24) mm a 96 dpi.
const ALTO_UTIL_PX = Math.floor(((297 - 24) * 96) / 25.4);

const assets = new Map<string, string>();
function dataUri(rel: string, mime: string): string {
  const cached = assets.get(rel);
  if (cached) return cached;
  const url = `data:${mime};base64,${fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url))).toString("base64")}`;
  assets.set(rel, url);
  return url;
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto libre → HTML: respeta los saltos de línea y **negrita**. */
function parrafo(s: string): string {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

function lista(s: string): string {
  const lineas = s
    .split("\n")
    .map((l) => l.replace(/^\s*[-•·*]\s*/, "").trim())
    .filter(Boolean);
  return `<ul>${lineas.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

function num(n: number, dec = 2): string {
  const [i, d] = Math.abs(n).toFixed(dec).split(".");
  const miles = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}${d ? `${miles},${d}` : miles}`;
}

function cantidad(n: number): string {
  return Number.isInteger(n) ? String(n) : num(n, 2).replace(/,?0+$/, "");
}

function fecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const SIMBOLO = { USD: "US$", UYU: "$" } as const;
const MONEDA = { USD: "Dólares (USD)", UYU: "Pesos uruguayos (UYU)" } as const;

function fila(label: string, valor: string | null | undefined): string {
  const v = valor && valor.trim() ? esc(valor) : "-";
  return `<div class="fila"><span class="lbl">${label}:</span> <span class="val">${v}</span></div>`;
}

function bloque(titulo: string, cuerpo: string, clase = ""): string {
  return `<section class="bloque ${clase}"><h2>${esc(titulo)}</h2><div class="cuerpo">${cuerpo}</div></section>`;
}

export function renderCotizacionHtml(d: CotizacionPdfData): string {
  const $ = SIMBOLO[d.moneda];
  const items = d.items.filter((r) => r.descripcion.trim() || r.tipo === "item");
  const conUnidad = items.some((r) => r.tipo === "item" && r.unidad && r.unidad.trim());
  const columnas = conUnidad ? 5 : 4;

  const filasDetalle = items
    .map((r) => {
      if (r.tipo === "seccion") return `<tr class="seccion"><td colspan="${columnas}">${esc(r.descripcion)}</td></tr>`;
      const sub = Math.round(r.cantidad * r.precioUnitario * 100) / 100;
      return `<tr class="item">
        <td class="desc"><div class="nombre">${esc(r.descripcion)}</div>${r.detalle?.trim() ? `<div class="detalle">${parrafo(r.detalle.trim())}</div>` : ""}</td>
        <td class="c">${cantidad(r.cantidad)}</td>
        ${conUnidad ? `<td class="c">${esc(r.unidad ?? "")}</td>` : ""}
        <td class="r">${num(r.precioUnitario)}</td>
        <td class="r sub ${sub === 0 ? "cero" : ""}">${$} ${num(sub)}</td>
      </tr>`;
    })
    .join("");

  const incluye = d.incluye?.trim();
  const noIncluye = d.noIncluye?.trim();
  const pago = d.condicionesPago?.trim();
  const plazo = d.plazoEntrega?.trim();

  const fuente = (archivo: string) => dataUri(`../unifilarSvg/fonts/${archivo}`, "font/ttf");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  @font-face { font-family: "Roboto"; font-weight: 400; src: url(${fuente("Roboto-Regular.ttf")}) format("truetype"); }
  @font-face { font-family: "Roboto"; font-weight: 700; src: url(${fuente("Roboto-Bold.ttf")}) format("truetype"); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: "Roboto", "Liberation Sans", Arial, sans-serif; color: #1f2433; font-size: 11px; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  :root { --azul: #1d38b4; --borde: #c9d0ea; --gris: #8a90a6; }
  header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 3px solid var(--azul); margin-bottom: 18px; }
  header img { height: 62px; margin-top: -4px; margin-left: -8px; }
  header .der { text-align: right; }
  header .rubro { font-size: 9px; letter-spacing: 3px; color: var(--gris); font-weight: 700; }
  header h1 { font-size: 30px; color: var(--azul); font-weight: 700; margin: 4px 0 2px; }
  header .numero { font-size: 11px; color: #555b70; }
  header .numero b { color: var(--azul); }
  .dos { display: flex; gap: 16px; margin-bottom: 16px; }
  .dos > * { flex: 1; }
  .bloque { border: 1px solid var(--azul); margin-bottom: 14px; break-inside: avoid; }
  .dos .bloque { margin-bottom: 0; }
  .bloque h2 { background: var(--azul); color: #fff; font-size: 9px; letter-spacing: 2.6px; text-transform: uppercase; padding: 6px 10px; font-weight: 700; }
  .bloque .cuerpo { padding: 9px 10px; }
  .bloque.datos .cuerpo { padding: 0; }
  .fila { padding: 5px 10px; border-top: 1px solid var(--borde); }
  .fila:first-child { border-top: 0; }
  .lbl { color: #555b70; }
  .val { color: var(--azul); font-weight: 700; }
  .alcance .cuerpo { line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: var(--azul); color: #fff; font-size: 8px; letter-spacing: 1.6px; text-transform: uppercase; padding: 6px 10px; text-align: left; border-top: 1px solid rgba(255,255,255,.25); }
  thead th.c { text-align: center; } thead th.r { text-align: right; }
  .detalle-bloque { border: 0; }
  .detalle-bloque h2 { border: 1px solid var(--azul); }
  tr.item td { padding: 8px 10px; border-bottom: 1px solid #e3e6f1; vertical-align: top; }
  tr.item { break-inside: avoid; }
  td.c { text-align: center; white-space: nowrap; }
  td.r { text-align: right; white-space: nowrap; }
  td.desc { width: 62%; }
  .nombre { font-weight: 700; font-size: 11.5px; }
  .detalle { color: var(--gris); font-size: 9.5px; margin-top: 1px; line-height: 1.35; }
  td.sub { color: var(--azul); font-weight: 700; }
  td.sub.cero { color: var(--gris); font-style: italic; }
  tr.seccion td { padding: 9px 10px 4px; color: var(--azul); font-size: 9px; letter-spacing: 2.4px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid var(--borde); }
  .totales { width: 50%; margin: 12px 0 18px auto; break-inside: avoid; }
  .totales .t { display: flex; justify-content: space-between; padding: 7px 10px; border-bottom: 1px solid #e3e6f1; }
  .totales .t b { font-weight: 700; }
  .totales .iva span:first-child span { margin-left: 22px; }
  .totales .total { background: var(--azul); color: #fff; padding: 10px; margin-top: 4px; align-items: center; border: 0; }
  .totales .total span:first-child { font-size: 9px; letter-spacing: 2.6px; font-weight: 700; }
  .totales .total b { font-size: 17px; }
  ul { padding-left: 14px; } li { margin: 1px 0; }
  footer { display: flex; justify-content: space-between; border-top: 1px solid var(--borde); padding-top: 10px; margin-top: 8px; color: var(--gris); font-size: 9px; break-inside: avoid; }
  footer b { color: var(--azul); }
</style></head><body><div id="hoja">
<header>
  <img src="${dataUri("../../templates/proforma/assets/voltia-stacked-blue.png", "image/png")}" alt="Voltia">
  <div class="der">
    <div class="rubro">INSTALACIONES ELÉCTRICAS · ENERGÍA SOLAR</div>
    <h1>Cotización</h1>
    <div class="numero">N° <b>${d.numero ? esc(d.numero) : "(sin número)"}</b></div>
  </div>
</header>

<div class="dos">
  ${bloque(
    "Datos del cliente",
    fila("Nombre", d.clienteNombre.toUpperCase()) +
      fila("Dirección", d.clienteDireccion) +
      fila("Ciudad", d.clienteCiudad) +
      fila("Celular", d.clienteTelefono) +
      (d.clienteEmail?.trim() ? fila("Email", d.clienteEmail) : ""),
    "datos",
  )}
  ${bloque(
    "Datos de la cotización",
    fila("Fecha", fecha(d.fecha)) +
      fila("Válida hasta", fecha(d.validaHasta)) +
      fila("Moneda", MONEDA[d.moneda]) +
      fila("Vendedor", d.vendedorNombre) +
      (d.formaTrabajo?.trim() ? fila("Forma de trabajo", d.formaTrabajo) : ""),
    "datos",
  )}
</div>

${d.alcanceTexto?.trim() ? bloque(d.alcanceTitulo?.trim() || "Alcance", parrafo(d.alcanceTexto.trim()), "alcance") : ""}

<section class="bloque detalle-bloque">
  <h2>Detalle de la cotización</h2>
  <table>
    <thead><tr>
      <th>Descripción</th><th class="c">Cant.</th>${conUnidad ? `<th class="c">Unidad</th>` : ""}<th class="r">P. unitario</th><th class="r">Subtotal</th>
    </tr></thead>
    <tbody>${filasDetalle}</tbody>
  </table>
</section>

<div class="totales">
  <div class="t"><span>Subtotal</span><b>${$} ${num(d.subtotal)}</b></div>
  <div class="t iva"><span>IVA<span>${num(d.ivaTasa, d.ivaTasa % 1 ? 2 : 0)} %</span></span><b>${$} ${num(d.iva)}</b></div>
  <div class="t total"><span>TOTAL</span><b>${$} ${num(d.total)}</b></div>
</div>

${
  pago || plazo
    ? pago && plazo
      ? `<div class="dos">${bloque("Condiciones de pago", parrafo(pago))}${bloque("Plazo de entrega", parrafo(plazo))}</div>`
      : bloque(pago ? "Condiciones de pago" : "Plazo de entrega", parrafo((pago || plazo)!))
    : ""
}
${
  incluye || noIncluye
    ? incluye && noIncluye
      ? `<div class="dos">${bloque("Incluye", lista(incluye))}${bloque("No incluye", lista(noIncluye))}</div>`
      : bloque(incluye ? "Incluye" : "No incluye", lista((incluye || noIncluye)!))
    : ""
}
${d.observaciones?.trim() ? bloque("Observaciones", parrafo(d.observaciones.trim())) : ""}

<footer>
  <span><b>VOLTIA</b> · RUT 150733900014 · Tel. 099 640 651 · contacto@voltia.com.uy</span>
  <span>Gracias por confiar en Voltia.</span>
</footer>
</div>
<script>
  (function () {
    var hoja = document.getElementById("hoja");
    function ajustar() {
      hoja.style.zoom = "1";
      var alto = hoja.scrollHeight;
      var util = ${ALTO_UTIL_PX};
      if (alto <= util) return;
      var z = util / alto;
      if (z >= 0.8) hoja.style.zoom = String(Math.floor(z * 1000) / 1000);
    }
    ajustar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustar);
  })();
</script>
</body></html>`;
}

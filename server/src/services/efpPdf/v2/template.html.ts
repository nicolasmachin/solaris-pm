// Renderer del template del PDF EFP v2. Función pura: data → HTML completo.
// No hace queries, no fetchea archivos remotos (Inter se carga vía Google
// Fonts pero el fallback del sistema cubre offline).
//
// Reglas (heredadas del diagnóstico):
//   - NO mostrar código de proyecto
//   - NO mostrar caso UTE ni currentStage/currentStatus
//   - potenciaTotalKwp se calcula en computed.* (NO se lee de la IA)

import { marked } from "marked";

import { PDF_STYLES } from "./styles.js";
import type { EFPPdfInput, EFPVersionStatus } from "./types.js";

marked.setOptions({ gfm: true, breaks: false });

const STATUS_LABEL: Record<EFPVersionStatus, string> = {
  DRAFT: "Borrador",
  REVIEW: "En revisión",
  APPROVED: "Aprobado",
  ARCHIVED: "Archivado",
};

const MES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} de ${MES_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mdToHtml(md: string): string {
  if (!md.trim()) return '<p class="empty">(sin contenido)</p>';
  // marked.parse devuelve string en modo síncrono cuando async no se pide.
  return marked.parse(md, { async: false }) as string;
}

function renderSectionsPages(input: EFPPdfInput): string {
  // Página 2: Datos generales + Resumen ejecutivo (cortos).
  // Página 3: Análisis del sitio.
  // Página 4: Equipamiento + Diseño eléctrico.
  // Página 5: Diseño mecánico + Anexos (texto IA).
  // Si una sección es muy larga Puppeteer paginará dentro de la "page" via
  // CSS page-break-after — no forzamos saltos finos.
  return `
    <section class="page">
      ${sectionBlock("01", "Datos generales del proyecto", input.sections.datosGenerales)}
      ${sectionBlock("02", "Resumen ejecutivo del sistema", input.sections.resumenEjecutivo)}
    </section>
    <section class="page">
      ${sectionBlock("03", "Análisis del sitio", input.sections.analisisSitio)}
    </section>
    <section class="page">
      ${sectionBlock("04", "Equipamiento y materiales", input.sections.equipamiento)}
      ${sectionBlock("05", "Diseño eléctrico", input.sections.disenoElectrico)}
    </section>
    <section class="page">
      ${sectionBlock("06", "Diseño mecánico", input.sections.disenoMecanico)}
      ${sectionBlock("07", "Anexos (descripción)", input.sections.anexos)}
    </section>
  `;
}

function sectionBlock(num: string, title: string, markdown: string): string {
  return `
    <div class="section-block">
      <div class="section-title-row">
        <p class="section-title">${escapeHtml(num)} · ${escapeHtml(title)}</p>
        <div class="section-rule"></div>
      </div>
      <div class="section-content">${mdToHtml(markdown)}</div>
    </div>
  `;
}

function renderCover(input: EFPPdfInput): string {
  const addressParts = [
    input.project.clientAddress,
    [input.project.locationCity, input.project.locationProvince]
      .filter((x): x is string => !!x?.trim())
      .join(", "),
  ].filter((x): x is string => !!x?.trim());

  // Si la versión está aprobada incluimos la fecha sin repetir la palabra
  // "Aprobado" (el status ya la imprime). Si no, mostramos la fecha de
  // generación como referencia temporal.
  const fechaApro =
    input.versionApprovedAt != null
      ? ` · ${fmtFecha(input.versionApprovedAt)}`
      : ` · Generado ${fmtFecha(input.generatedAt)}`;

  const potenciaCard = input.computed.potenciaTotalKwp != null
    ? `<div class="cover-kpis__value">${formatNumber(input.computed.potenciaTotalKwp)}<span class="cover-kpis__unit">kWp</span></div>`
    : `<div class="cover-kpis__value">—</div>`;

  const panelesCard = input.computed.paneles.cantidad != null
    ? `<div class="cover-kpis__value">${input.computed.paneles.cantidad}${
        input.computed.paneles.potenciaW != null
          ? `<span class="cover-kpis__unit">× ${input.computed.paneles.potenciaW} W</span>`
          : ""
      }</div>`
    : `<div class="cover-kpis__value">—</div>`;

  const inversorCard = input.computed.inversor
    ? `<div class="cover-kpis__value" style="font-size:13px;">${escapeHtml(
        input.computed.inversor,
      )}</div>`
    : `<div class="cover-kpis__value">—</div>`;

  return `
    <section class="page cover">
      <div class="header-band">
        <div class="header-band__brand">
          <span>VOLTIA · SOLUCIONES ELÉCTRICAS</span>
          <span>voltia.com.uy</span>
        </div>
      </div>
      <p class="cover-title">Proyecto Final de Ingeniería</p>
      <p class="cover-version-meta">Versión ${input.versionNumber} · ${escapeHtml(
        STATUS_LABEL[input.versionStatus] ?? input.versionStatus,
      )}${escapeHtml(fechaApro)}</p>

      <div class="client-block">
        <p class="client-block__label">Cliente</p>
        <p class="client-block__name">${escapeHtml(input.project.clientName)}</p>
        ${
          addressParts.length > 0
            ? `<p class="client-block__address">${escapeHtml(addressParts.join(" · "))}</p>`
            : ""
        }
      </div>

      <div class="cover-kpis">
        <div class="cover-kpis__cell">
          <p class="cover-kpis__label">Potencia DC</p>
          ${potenciaCard}
        </div>
        <div class="cover-kpis__cell">
          <p class="cover-kpis__label">Paneles</p>
          ${panelesCard}
        </div>
        <div class="cover-kpis__cell">
          <p class="cover-kpis__label">Inversor</p>
          ${inversorCard}
        </div>
      </div>
    </section>
  `;
}

function renderAnexoDividers(input: EFPPdfInput): string {
  if (input.attachments.length === 0) return "";
  return input.attachments
    .map((a) => {
      // Si el title cayó al filename (no hay descripción), no duplicamos abajo.
      const showFilename = a.title !== a.filename;
      return `
    <section class="page anexo-divider">
      <p class="anexo-divider__label">${escapeHtml(a.label)}</p>
      <h2 class="anexo-divider__title">${escapeHtml(a.title)}</h2>
      <div class="anexo-divider__rule"></div>
      ${showFilename ? `<p class="anexo-divider__filename">${escapeHtml(a.filename)}</p>` : ""}
      ${a.category ? `<p class="anexo-divider__category">${escapeHtml(a.category)}</p>` : ""}
    </section>
  `;
    })
    .join("\n");
}

function formatNumber(n: number): string {
  return n.toLocaleString("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function renderEFPHtml(input: EFPPdfInput): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Proyecto Final de Ingeniería — ${escapeHtml(input.project.clientName)} v${input.versionNumber}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>${PDF_STYLES}</style>
</head>
<body>
${renderCover(input)}
${renderSectionsPages(input)}
${renderAnexoDividers(input)}
</body>
</html>`;
}

// Header y footer del PDF (los inyecta Puppeteer en `displayHeaderFooter: true`).
// Inline styles: Puppeteer requiere CSS dentro del template, no clases del body.

export function buildHeaderHtml(input: EFPPdfInput): string {
  return `
    <div style="
      width: 100%; font-size: 9px; padding: 6mm 18mm 0;
      color: #555; display: flex; justify-content: space-between;
      font-family: 'Inter', -apple-system, sans-serif;
      letter-spacing: 0.4px;
    ">
      <span>VOLTIA · Proyecto Final de Ingeniería · v${input.versionNumber}</span>
      <span>${escapeHtml(input.project.clientName)}</span>
    </div>
  `;
}

export function buildFooterHtml(): string {
  return `
    <div style="
      width: 100%; font-size: 9px; padding: 0 18mm 6mm;
      color: #888; display: flex; justify-content: space-between;
      font-family: 'Inter', -apple-system, sans-serif;
    ">
      <span>voltia.com.uy</span>
      <span>
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </span>
    </div>
  `;
}

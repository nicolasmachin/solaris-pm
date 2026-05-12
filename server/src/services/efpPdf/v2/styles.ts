// CSS embebido del PDF EFP v2. Paleta Voltia (clásico técnico):
//   azul Francia #002395, amarillo Voltia #FFD100, blanco, negro/grises.
// Tipografía Inter (Google Fonts en <head>) con fallback al sistema.
// Página A4. Header/footer del PDF los gestiona Puppeteer (no estos estilos).

export const PDF_STYLES = String.raw`
:root {
  --voltia-blue: #002395;
  --voltia-blue-soft: #f3f5fb;
  --voltia-yellow: #FFD100;
  --text-primary: #0a0a0a;
  --text-secondary: #555555;
  --text-muted: #888888;
  --border-light: #e8e8e8;
  --bg-subtle: #f9f9f7;
}

@page {
  size: A4;
  /* Los márgenes los aplica page.pdf({margin}) — coincide con el header/footer
     templates de Puppeteer. Acá repetimos para que setContent renderice
     correcto el preview interno. */
  margin: 22mm 18mm 22mm 18mm;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

/* ─── Página ────────────────────────────────────────────────────────── */
.page {
  page-break-after: always;
}
.page:last-child {
  page-break-after: auto;
}

/* ─── Banner azul superior (sólo en portada) + hairline amarillo ───── */
.header-band {
  background: var(--voltia-blue);
  color: white;
  padding: 12px 16px 10px;
  /* sin letter-spacing acá: el banner mezcla "VOLTIA · SOLUCIONES" en
     mayúsculas con "voltia.com.uy" en minúsculas. El tracking va sólo en
     el span uppercase. */
  font-size: 10px;
  font-weight: 500;
  position: relative;
  margin-bottom: 0;
}
.header-band__brand > span:first-child {
  letter-spacing: 1px;
}
.header-band::after {
  content: '';
  display: block;
  height: 2px;
  background: var(--voltia-yellow);
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
}

.header-band__brand {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* ─── Portada ───────────────────────────────────────────────────────── */
.cover {
  display: flex;
  flex-direction: column;
}

.cover-title {
  margin-top: 26mm;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
}

.cover-h1 {
  font-size: 28px;
  font-weight: 500;
  color: var(--text-primary);
  margin-top: 6px;
  letter-spacing: -0.5px;
}

.cover-version-meta {
  margin-top: 18px;
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.client-block {
  margin-top: 36mm;
  padding-bottom: 16px;
  border-bottom: 0.5px solid var(--border-light);
}
.client-block__label {
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 500;
}
.client-block__name {
  font-size: 22px;
  font-weight: 500;
  margin-top: 8px;
  color: var(--text-primary);
}
.client-block__address {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.cover-kpis {
  margin-top: 24mm;
  background: var(--voltia-blue);
  color: white;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 2px solid var(--voltia-yellow);
}
.cover-kpis__cell {
  padding: 16px 14px;
  border-right: 1px solid rgba(255, 255, 255, 0.18);
}
.cover-kpis__cell:last-child { border-right: none; }
.cover-kpis__label {
  font-size: 9px;
  letter-spacing: 1px;
  font-weight: 500;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
}
.cover-kpis__value {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.3px;
}
.cover-kpis__unit {
  font-size: 11px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.8);
  margin-left: 4px;
}

/* ─── Secciones técnicas ───────────────────────────────────────────── */
.section-block {
  margin-top: 6mm;
}
.section-block:first-child {
  margin-top: 0;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.section-title {
  color: var(--voltia-blue);
  font-size: 11px;
  letter-spacing: 1px;
  font-weight: 500;
  text-transform: uppercase;
}
.section-rule {
  flex: 1;
  height: 0.5px;
  background: var(--border-light);
}

.section-content {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--text-primary);
}
.section-content h1,
.section-content h2,
.section-content h3 {
  font-size: 13px;
  font-weight: 500;
  margin-top: 10px;
  margin-bottom: 4px;
  color: var(--voltia-blue);
}
.section-content p {
  margin: 6px 0;
}
.section-content ul,
.section-content ol {
  margin: 6px 0 6px 18px;
}
.section-content li {
  margin: 2px 0;
}
.section-content strong {
  font-weight: 500;
}
.section-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 8px 0;
  font-size: 11px;
}
.section-content th,
.section-content td {
  border: 0.5px solid var(--border-light);
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
}
.section-content th {
  background: var(--bg-subtle);
  font-weight: 500;
  color: var(--text-primary);
}

/* ─── Anexos: separador grande ──────────────────────────────────────── */
.anexo-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80%;
  text-align: center;
  page-break-before: always;
}
.anexo-divider__label {
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--voltia-blue);
  font-weight: 500;
  text-transform: uppercase;
}
.anexo-divider__title {
  margin-top: 18px;
  font-size: 28px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}
.anexo-divider__filename {
  margin-top: 12px;
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
}
.anexo-divider__rule {
  margin-top: 16px;
  width: 32px;
  height: 2px;
  background: var(--voltia-yellow);
}
.anexo-divider__category {
  margin-top: 18px;
  font-size: 10px;
  color: var(--text-secondary);
  letter-spacing: 1px;
  text-transform: uppercase;
}
`;

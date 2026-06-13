import Handlebars from "handlebars";

import type { EmailTemplateContext } from "../../api/email.api";

// Render de una plantilla Handlebars a TEXTO plano (igual que el backend:
// noEscape porque el mail es texto, no HTML).
export function renderTemplate(tpl: string, context: EmailTemplateContext): string {
  if (!tpl) return "";
  try {
    return Handlebars.compile(tpl, { noEscape: true })(context);
  } catch {
    return tpl; // si la plantilla tiene un error de sintaxis, mostramos el crudo
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ESPEJO EXACTO de bodyToHtml del backend (server/src/services/email/send.service.ts):
// rótulos "Datos…" y la etiqueta antes de ":" en negrita; saltos de línea → <br>.
// El preview DEBE coincidir con lo que envía el server (WYSIWYG).
export function bodyToHtml(text: string): string {
  const lines = text.split("\n").map((raw) => {
    const line = escapeHtml(raw);
    if (/^Datos\b/.test(raw.trim())) return `<strong>${line}</strong>`;
    const idx = line.indexOf(":");
    if (idx > 0) return `<strong>${line.slice(0, idx + 1)}</strong>${line.slice(idx + 1)}`;
    return line;
  });
  return `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:normal;line-height:1.5">${lines.join("<br>")}</div>`;
}

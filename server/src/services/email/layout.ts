// Layout HTML compartido para TODOS los correos (notificaciones automáticas y
// mails de plantilla). Da un marco de marca Voltia consistente: header, franja
// de acento, "kicker" (categoría), título grande = referencia clara de lo que
// se informa, cuerpo legible, CTA opcional y footer. Pensado email-safe
// (tablas + estilos inline, tema claro) para que se vea bien en Gmail/Outlook/
// Hotmail.

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ¿El html ya es un documento completo? (para no doble-envolver lo que ya viene
// con su propio layout, p. ej. las plantillas ricas).
export function isFullHtmlDoc(html: string): boolean {
  return /^\s*(<!doctype html|<html[\s>])/i.test(html);
}

// Caja de datos clave (etiqueta → valor), para resaltar la info principal sin
// que se pierda en el texto. Los valores se escapan.
export function renderMetaRows(rows: Array<[string, string]>): string {
  const trs = rows
    .filter(([, v]) => v != null && v !== "")
    .map(
      ([k, v]) =>
        `<tr>` +
        `<td style="padding:5px 0;font-size:12px;color:#8a9099;width:140px;vertical-align:top;">${escapeHtml(k)}</td>` +
        `<td style="padding:5px 0;font-size:13px;color:#12151c;font-weight:600;">${escapeHtml(v)}</td>` +
        `</tr>`,
    )
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
    `style="width:100%;margin:18px 0;background:#f7f8fa;border:1px solid #eceef0;border-radius:8px;">` +
    `<tr><td style="padding:6px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" width="100%">` +
    `<tbody>${trs}</tbody></table></td></tr></table>`
  );
}

export interface EmailLayoutParams {
  /** Título grande del correo = referencia clara de lo que se informa. */
  title: string;
  /** Cuerpo ya en HTML (no se escapa). */
  contentHtml: string;
  /** Texto oculto de preview en la bandeja (opcional). */
  preheader?: string;
  /** Etiqueta chica sobre el título (categoría). Default "Notificación". */
  kicker?: string;
  /** Botón de acción opcional. */
  cta?: { label: string; url: string };
  /** Nota del pie. */
  footerNote?: string;
}

export function renderEmailLayout(p: EmailLayoutParams): string {
  const kicker = p.kicker ?? "Notificación";
  const preheader = p.preheader ?? "";
  const footerNote =
    p.footerNote ?? "Notificación automática de Voltia PM · Por favor, no respondas a este correo.";
  const ctaBlock = p.cta
    ? `<tr><td style="padding:8px 32px 30px;">` +
      `<a href="${p.cta.url}" style="display:inline-block;background:#f59e0b;color:#1a1206;` +
      `text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">` +
      `${escapeHtml(p.cta.label)} &rarr;</a></td></tr>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(p.title)}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f3;-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e6e8eb;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <tr><td style="background:#12151c;padding:18px 32px;">
        <span style="font-size:16px;font-weight:800;letter-spacing:.14em;color:#ffffff;text-transform:uppercase;">VOLTIA <span style="color:#f59e0b;">PM</span></span>
      </td></tr>
      <tr><td style="height:4px;line-height:4px;font-size:0;background:#f59e0b;">&nbsp;</td></tr>
      <tr><td style="padding:28px 32px 4px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#e08c00;margin:0 0 8px;">${escapeHtml(kicker)}</div>
        <h1 style="margin:0;font-size:20px;line-height:1.3;color:#12151c;font-weight:700;">${escapeHtml(p.title)}</h1>
      </td></tr>
      <tr><td style="padding:12px 32px 6px;">
        <div style="font-size:14px;line-height:1.65;color:#3a3f47;">${p.contentHtml}</div>
      </td></tr>
      ${ctaBlock}
      <tr><td style="padding:18px 32px;border-top:1px solid #eceef0;background:#fafbfc;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9aa0a6;">${escapeHtml(footerNote)}</p>
      </td></tr>
    </table>
    <div style="font-size:11px;color:#b3b8bd;margin-top:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      <a href="${BASE_URL}" style="color:#b3b8bd;text-decoration:none;">Voltia PM</a> · Energía solar · Uruguay
    </div>
  </td></tr>
</table>
</body>
</html>`;
}

import { env } from "../../config/env.js";

// Redirección de correo en DESARROLLO.
//
// Motivo: mientras se testea en localhost, los mails automáticos (traspasos de
// etapa, notificaciones, plantillas) llegaban a las casillas reales de todo el
// equipo y les llenaban la bandeja de spam, tapando los mails reales.
//
// Si `DEV_EMAIL_REDIRECT_TO` está seteada y NO estamos en producción, TODOS los
// destinatarios (to/cc/bcc) de cada envío se reemplazan por esa única casilla.
// El asunto se prefija con los destinatarios originales para no perder el
// contexto de a quién habría ido. El registro (emailLog) sigue guardando los
// destinatarios reales; solo cambia la entrega efectiva.
//
// Guarda de seguridad: en producción se ignora aunque la variable esté seteada,
// para que nunca redirija correo real por un env mal copiado.

export function devRedirectActive(): boolean {
  return Boolean(env.devEmailRedirectTo) && env.nodeEnv !== "production";
}

export interface RedirectableMail {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

function flatten(v?: string | string[]): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Banner rojo al tope del cuerpo HTML, para que se vea de una que es de prueba.
function htmlBanner(resumen: string): string {
  return (
    `<div style="background:#b91c1c;color:#fff;padding:12px 16px;` +
    `font-family:Arial,sans-serif;font-size:13px;line-height:1.45;` +
    `border-radius:8px;margin:0 0 16px 0">` +
    `⚠️ <strong>CORREO DE PRUEBA</strong> — enviado desde el entorno de ` +
    `<strong>desarrollo</strong> de Voltia PM. No es un mail real.<br>` +
    `Destinatario(s) real(es): <strong>${escapeHtml(resumen)}</strong>` +
    `</div>`
  );
}

// Inserta el banner justo después de <body …> si el html es un documento
// completo; si no, lo antepone. Evita meter markup antes del <!doctype>.
function injectHtmlBanner(html: string, resumen: string): string {
  const banner = htmlBanner(resumen);
  const m = html.match(/<body[^>]*>/i);
  if (m && m.index != null) {
    const at = m.index + m[0].length;
    return html.slice(0, at) + banner + html.slice(at);
  }
  return banner + html;
}

// Banner equivalente para la parte de texto plano.
function textBanner(resumen: string): string {
  return (
    `======================================================\n` +
    `  ⚠️  CORREO DE PRUEBA — entorno de DESARROLLO (Voltia PM)\n` +
    `  No es un mail real.\n` +
    `  Destinatario(s) real(es): ${resumen}\n` +
    `======================================================\n\n`
  );
}

// Devuelve los campos de destinatario/asunto/cuerpo ya redirigidos si
// corresponde; si la redirección no está activa, devuelve los mismos valores
// sin tocar (en producción no altera nada).
export function redirectInDev(mail: RedirectableMail): RedirectableMail {
  if (!devRedirectActive()) return mail;
  const originales = [...flatten(mail.to), ...flatten(mail.cc), ...flatten(mail.bcc)];
  const resumen = originales.join(", ") || "(sin destinatarios)";
  return {
    to: env.devEmailRedirectTo,
    cc: undefined,
    bcc: undefined,
    subject: `[PRUEBA · para: ${resumen}] ${mail.subject}`,
    html: mail.html != null ? injectHtmlBanner(mail.html, resumen) : mail.html,
    text: mail.text != null ? textBanner(resumen) + mail.text : mail.text,
  };
}

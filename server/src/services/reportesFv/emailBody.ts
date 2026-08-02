// Cuerpo del email del reporte fotovoltaico (port del CUERPO_HTML_BASE del
// sistema Python). Marca Voltia. El PDF va como adjunto; el mail solo presenta.

const AZUL = "#1a3fd4";

export function asuntoReporteFv(mesEs: string): string {
  return `Reporte fotovoltaico - ${mesEs}`;
}

export function cuerpoTextoReporteFv(cliente: string, mesEs: string): string {
  return [
    `Hola${cliente ? ` ${cliente}` : ""},`,
    "",
    `Adjuntamos tu reporte fotovoltaico correspondiente a ${mesEs}, con el detalle`,
    "de la generación, el consumo y el ahorro económico del mes.",
    "",
    "Cualquier consulta sobre el reporte, respondé este correo.",
    "",
    "Saludos,",
    "Equipo de Voltia",
  ].join("\n");
}

export function cuerpoHtmlReporteFv(cliente: string, mesEs: string): string {
  const saludo = cliente ? `Hola ${escapeHtml(cliente)},` : "Hola,";
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f6fa;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fa;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td style="background:${AZUL};padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px;">VOLTIA</span>
        </td></tr>
        <tr><td style="padding:28px;color:#1f2937;font-size:14px;line-height:1.6;">
          <p style="margin:0 0 14px;">${saludo}</p>
          <p style="margin:0 0 14px;">
            Adjuntamos tu <strong>reporte fotovoltaico</strong> correspondiente a
            <strong>${escapeHtml(mesEs)}</strong>, con el detalle de la generación, el consumo
            y el ahorro económico del mes.
          </p>
          <p style="margin:0 0 14px;">
            El reporte compara cuánto habrías pagado sin paneles contra lo que pagás hoy,
            y muestra el avance del retorno de tu inversión.
          </p>
          <p style="margin:0 0 4px;color:#4b5563;">Cualquier consulta, respondé este correo.</p>
          <p style="margin:18px 0 0;">Saludos,<br>Equipo de Voltia</p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;">
          Voltia · Energía solar · voltia.com.uy
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

function projectLink(projectId: string) {
  return `${BASE_URL}/projects/${projectId}`;
}

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 32px auto; background: #161b22; border: 1px solid #30363d; border-radius: 10px; overflow: hidden; }
    .header { background: #1a1000; border-bottom: 1px solid #30363d; padding: 20px 28px; }
    .logo { font-size: 15px; font-weight: 700; color: #f59e0b; letter-spacing: 0.08em; text-transform: uppercase; }
    .body { padding: 28px; }
    h2 { font-size: 16px; font-weight: 600; color: #f0f6fc; margin: 0 0 12px; }
    p { font-size: 13px; color: #8b949e; margin: 0 0 10px; line-height: 1.6; }
    .meta { background: #0d1117; border-radius: 6px; padding: 12px 16px; margin: 16px 0; }
    .meta-row { display: flex; gap: 8px; font-size: 12px; color: #8b949e; margin-bottom: 4px; }
    .meta-label { color: #6e7681; min-width: 90px; }
    .meta-value { color: #c9d1d9; }
    .btn { display: inline-block; margin-top: 18px; padding: 10px 20px; background: #f59e0b; color: #000; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600; }
    .footer { padding: 14px 28px; border-top: 1px solid #30363d; font-size: 11px; color: #484f58; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><span class="logo">☀ Voltia PM</span></div>
    <div class="body">${content}</div>
    <div class="footer">Notificación automática de Voltia PM — No respondas este correo.</div>
  </div>
</body>
</html>`;
}

// ─── Ingeniería completada (listo para Operaciones) ─────────────────────────

export function emailEngineeringCompleted(params: {
  projectName: string;
  projectCode?: string | null;
  projectId: string;
  trigger: "stage_completed" | "efp_approved";
}) {
  const triggerLabel =
    params.trigger === "efp_approved"
      ? "Proyecto Final de Ingeniería aprobado"
      : "Etapa de Ingeniería completada";
  return {
    subject: `Proyecto ${params.projectName} — Listo para Operaciones`,
    html: layout(`
      <h2>Listo para Operaciones</h2>
      <p>El proyecto <strong>${params.projectName}</strong> completó la etapa de Ingeniería y está listo para que Operaciones inicie la planificación de la instalación.</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Proyecto</span><span class="meta-value">${params.projectName}</span></div>
        ${params.projectCode ? `<div class="meta-row"><span class="meta-label">Código</span><span class="meta-value">${params.projectCode}</span></div>` : ""}
        <div class="meta-row"><span class="meta-label">Disparador</span><span class="meta-value">${triggerLabel}</span></div>
      </div>
      <a class="btn" href="${projectLink(params.projectId)}">Ver proyecto →</a>
    `),
    text: `Proyecto ${params.projectName} listo para Operaciones (${triggerLabel}).\nVer: ${projectLink(params.projectId)}`,
  };
}

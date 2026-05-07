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

// ─── Template 1 — Tarea por vencer ────────────────────────────────────────────

export function emailTaskDue(params: {
  projectName: string;
  projectId: string;
  taskTitle: string;
  dueDate: string;
}) {
  return {
    subject: `⚠ Tarea por vencer: ${params.taskTitle}`,
    html: layout(`
      <h2>⚠ Tarea por vencer</h2>
      <p>Una tarea en tu proyecto está próxima a su fecha límite.</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Proyecto</span><span class="meta-value">${params.projectName}</span></div>
        <div class="meta-row"><span class="meta-label">Tarea</span><span class="meta-value">${params.taskTitle}</span></div>
        <div class="meta-row"><span class="meta-label">Fecha límite</span><span class="meta-value">${params.dueDate}</span></div>
      </div>
      <a class="btn" href="${projectLink(params.projectId)}">Ver proyecto →</a>
    `),
    text: `Tarea por vencer: ${params.taskTitle}\nProyecto: ${params.projectName}\nFecha límite: ${params.dueDate}\nVer: ${projectLink(params.projectId)}`,
  };
}

// ─── Template 2 — Etapa vencida ───────────────────────────────────────────────

export function emailStageOverdue(params: {
  projectName: string;
  projectId: string;
  stageName: string;
  delayDays: number;
}) {
  return {
    subject: `🔴 Etapa retrasada: ${params.stageName} — ${params.projectName}`,
    html: layout(`
      <h2>🔴 Etapa retrasada</h2>
      <p>Una etapa del proyecto superó su fecha planificada.</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Proyecto</span><span class="meta-value">${params.projectName}</span></div>
        <div class="meta-row"><span class="meta-label">Etapa</span><span class="meta-value">${params.stageName}</span></div>
        <div class="meta-row"><span class="meta-label">Retraso</span><span class="meta-value">${params.delayDays} días</span></div>
      </div>
      <a class="btn" href="${projectLink(params.projectId)}">Ver proyecto →</a>
    `),
    text: `Etapa retrasada: ${params.stageName}\nProyecto: ${params.projectName}\nRetraso: ${params.delayDays} días\nVer: ${projectLink(params.projectId)}`,
  };
}

// ─── Template 3 — Hito de progreso ───────────────────────────────────────────

export function emailProgressMilestone(params: {
  projectName: string;
  projectId: string;
  percent: number;
  currentStage?: string;
}) {
  return {
    subject: `✅ ${params.projectName} alcanzó el ${params.percent}%`,
    html: layout(`
      <h2>✅ Hito de progreso alcanzado</h2>
      <p>Tu proyecto llegó a un nuevo hito de avance.</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Proyecto</span><span class="meta-value">${params.projectName}</span></div>
        <div class="meta-row"><span class="meta-label">Avance</span><span class="meta-value">${params.percent}%</span></div>
        ${params.currentStage ? `<div class="meta-row"><span class="meta-label">Etapa actual</span><span class="meta-value">${params.currentStage}</span></div>` : ""}
      </div>
      <a class="btn" href="${projectLink(params.projectId)}">Ver proyecto →</a>
    `),
    text: `${params.projectName} alcanzó el ${params.percent}%\nVer: ${projectLink(params.projectId)}`,
  };
}

// ─── Template 4 — Subetapa bloqueada ─────────────────────────────────────────

export function emailSubstageBlocked(params: {
  projectName: string;
  projectId: string;
  stageName: string;
  substageName: string;
  responsible?: string | null;
}) {
  return {
    subject: `🔒 Subetapa bloqueada: ${params.substageName}`,
    html: layout(`
      <h2>🔒 Subetapa bloqueada</h2>
      <p>Una subetapa del proyecto quedó bloqueada.</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Proyecto</span><span class="meta-value">${params.projectName}</span></div>
        <div class="meta-row"><span class="meta-label">Etapa</span><span class="meta-value">${params.stageName}</span></div>
        <div class="meta-row"><span class="meta-label">Subetapa</span><span class="meta-value">${params.substageName}</span></div>
        ${params.responsible ? `<div class="meta-row"><span class="meta-label">Responsable</span><span class="meta-value">${params.responsible}</span></div>` : ""}
      </div>
      <a class="btn" href="${projectLink(params.projectId)}">Ver proyecto →</a>
    `),
    text: `Subetapa bloqueada: ${params.substageName}\nProyecto: ${params.projectName}\nEtapa: ${params.stageName}\nVer: ${projectLink(params.projectId)}`,
  };
}

// ─── Template 5 — Proyecto retrasado ─────────────────────────────────────────

export function emailProjectDelayed(params: {
  projectName: string;
  projectId: string;
  delayDays: number;
}) {
  return {
    subject: `📅 Proyecto con desvío: ${params.projectName}`,
    html: layout(`
      <h2>📅 Proyecto con desvío acumulado</h2>
      <p>El proyecto acumula días de retraso respecto al cronograma planificado.</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Proyecto</span><span class="meta-value">${params.projectName}</span></div>
        <div class="meta-row"><span class="meta-label">Desvío acumulado</span><span class="meta-value">${params.delayDays} días</span></div>
      </div>
      <a class="btn" href="${projectLink(params.projectId)}">Ver proyecto →</a>
    `),
    text: `Proyecto con desvío: ${params.projectName}\nDesvío: ${params.delayDays} días\nVer: ${projectLink(params.projectId)}`,
  };
}

// ─── Template 6 — Cambio de etapa ────────────────────────────────────────────

export function emailStageChanged(params: {
  projectName: string;
  projectId: string;
  stageName: string;
  oldStatus: string;
  newStatus: string;
  changedBy?: string;
}) {
  return {
    subject: `📋 ${params.projectName}: ${params.stageName} cambió a ${params.newStatus}`,
    html: layout(`
      <h2>📋 Cambio de estado en etapa</h2>
      <p>El estado de una etapa del proyecto fue actualizado.</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Proyecto</span><span class="meta-value">${params.projectName}</span></div>
        <div class="meta-row"><span class="meta-label">Etapa</span><span class="meta-value">${params.stageName}</span></div>
        <div class="meta-row"><span class="meta-label">Estado anterior</span><span class="meta-value">${params.oldStatus}</span></div>
        <div class="meta-row"><span class="meta-label">Estado nuevo</span><span class="meta-value">${params.newStatus}</span></div>
        ${params.changedBy ? `<div class="meta-row"><span class="meta-label">Realizado por</span><span class="meta-value">${params.changedBy}</span></div>` : ""}
      </div>
      <a class="btn" href="${projectLink(params.projectId)}">Ver proyecto →</a>
    `),
    text: `Cambio de etapa en ${params.projectName}\n${params.stageName}: ${params.oldStatus} → ${params.newStatus}\nVer: ${projectLink(params.projectId)}`,
  };
}

// ─── Template 7 — Ingeniería completada (listo para Operaciones) ─────────────

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

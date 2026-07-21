import { renderEmailLayout, renderMetaRows } from "./email/layout.js";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

function projectLink(projectId: string) {
  return `${BASE_URL}/projects/${projectId}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  const contentHtml =
    `<p style="margin:0 0 12px;">El proyecto <strong>${escapeHtml(params.projectName)}</strong> completó la etapa de ` +
    `Ingeniería y está listo para que <strong>Operaciones</strong> inicie la planificación de la instalación.</p>` +
    renderMetaRows([
      ["Proyecto", params.projectName],
      ["Código", params.projectCode ?? ""],
      ["Disparador", triggerLabel],
    ]);
  return {
    subject: `Proyecto ${params.projectName} — Listo para Operaciones`,
    html: renderEmailLayout({
      title: `${params.projectName} — Listo para Operaciones`,
      kicker: "Ingeniería completada",
      preheader: "El proyecto está listo para que Operaciones planifique la instalación.",
      contentHtml,
      cta: { label: "Ver proyecto", url: projectLink(params.projectId) },
    }),
    text: `Proyecto ${params.projectName} listo para Operaciones (${triggerLabel}).\nVer: ${projectLink(params.projectId)}`,
  };
}

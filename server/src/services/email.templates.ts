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

// ─── Resumen diario (digest) ────────────────────────────────────────────────
// Un solo mail por persona con lo que pasó en sus proyectos en las últimas 24h.
// Reemplaza los mails por evento (traspasos, escalaciones, ingeniería, avisos)
// para bajar el ruido; las notificaciones in-app siguen siendo inmediatas.

export interface DigestGroup {
  projectName: string | null;
  projectId: string | null;
  items: Array<{ title: string; message: string }>;
}

export function emailDailyDigest(params: {
  userName: string;
  groups: DigestGroup[];
  totalCount: number;
}) {
  const groupsHtml = params.groups
    .map((g) => {
      const header = g.projectName
        ? `<div style="margin:18px 0 6px;font-size:13px;font-weight:700;color:#12151c;">${escapeHtml(g.projectName)}</div>`
        : `<div style="margin:18px 0 6px;font-size:13px;font-weight:700;color:#12151c;">General</div>`;
      const rows = g.items
        .map(
          (it) =>
            `<li style="margin:0 0 8px;"><strong>${escapeHtml(it.title)}</strong>` +
            `<div style="color:#5a616b;font-size:13px;">${escapeHtml(it.message)}</div></li>`,
        )
        .join("");
      return `${header}<ul style="margin:0;padding-left:18px;">${rows}</ul>`;
    })
    .join("");

  const contentHtml =
    `<p style="margin:0 0 4px;">Hola ${escapeHtml(params.userName)}, esto es lo que pasó en tus proyectos en las últimas 24 horas ` +
    `(<strong>${params.totalCount}</strong> novedad${params.totalCount === 1 ? "" : "es"}):</p>` +
    groupsHtml +
    `<p style="margin:18px 0 0;color:#8a9099;font-size:12px;">Ves este resumen una vez al día. Cada novedad ya está también en la campana de Voltia PM apenas ocurre.</p>`;

  const plural = params.totalCount === 1 ? "novedad" : "novedades";
  return {
    subject: `[Voltia PM] Resumen del día — ${params.totalCount} ${plural}`,
    html: renderEmailLayout({
      title: "Resumen del día",
      kicker: "Digest diario",
      preheader: `${params.totalCount} ${plural} en tus proyectos.`,
      contentHtml,
      cta: { label: "Abrir Voltia PM", url: BASE_URL },
    }),
    text: `Resumen del día: ${params.totalCount} ${plural} en tus proyectos. Entrá a ${BASE_URL} para el detalle.`,
  };
}

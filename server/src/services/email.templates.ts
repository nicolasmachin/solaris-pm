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

// ─── Resumen diario de Experiencia Solar ────────────────────────────────────
// Espejo de la pantalla del Recorrido, en tres secciones que se leen de arriba
// abajo por urgencia: Pendientes (tienen reloj y ya venció, lo más arrastrado
// primero), Novedades (algo nuevo sin mirar) y Fuera de cadencia (les debemos el
// contacto del período). Se manda solo si hay algo.

export type ExpAlerta = {
  tipo: "habilitacion" | "check" | "reclamo";
  projectId: string;
  cliente: string;
  titulo: string;
  detalle: string;
  dias: number | null;
};

export type ExpBloque = {
  nombre: string;
  total: number;
  clientes: Array<{
    projectId: string;
    nombre: string;
    diasSinContacto: number | null;
    fueraDeCadencia: boolean;
    hayNovedad: boolean;
  }>;
};

function clienteLink(projectId: string) {
  return `${BASE_URL}/clientes/${projectId}`;
}

// Topes de lo que se lista. Un mail con 50 renglones no se lee: se muestra lo
// más urgente de cada sección y el resto queda como "y N más" con el link a la
// vista, que es donde se trabaja.
const EXP_MAX_ALERTAS = 12;
const EXP_MAX_POR_BLOQUE = 8;

function expYMas(restantes: number): string {
  if (restantes <= 0) return "";
  return (
    `<div style="margin:6px 0 0;font-size:12px;color:#8a9099;">y ${restantes} más — ` +
    `<a href="${BASE_URL}/clientes/recorrido" style="color:#8a9099;">verlos en el Recorrido</a></div>`
  );
}

export function emailExperienciaDigest(params: {
  userName: string;
  alertas: ExpAlerta[];
  novedades: ExpBloque[];
  cadencia: ExpBloque[];
  total: number;
}) {
  const alertasHtml = params.alertas.length
    ? `<div style="margin:18px 0 6px;font-size:13px;font-weight:700;color:#b91c1c;">` +
      `Pendientes (${params.alertas.length})</div>` +
      `<div style="margin:0 0 6px;font-size:12px;color:#8a9099;">` +
      `Tienen plazo y ya venció.</div>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ` +
      `style="width:100%;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">` +
      params.alertas
        .slice(0, EXP_MAX_ALERTAS)
        .map(
          (a) =>
            `<tr><td style="padding:10px 14px;border-bottom:1px solid #fee2e2;">` +
            `<a href="${clienteLink(a.projectId)}" style="color:#12151c;font-weight:600;font-size:13px;text-decoration:none;">` +
            `${escapeHtml(a.cliente)}</a>` +
            `<div style="font-size:13px;color:#b91c1c;margin-top:2px;">${escapeHtml(a.titulo)}</div>` +
            `<div style="font-size:12px;color:#8a9099;">${escapeHtml(a.detalle)}</div>` +
            `</td></tr>`,
        )
        .join("") +
      `</table>` +
      expYMas(params.alertas.length - EXP_MAX_ALERTAS)
    : "";

  // Los días sin contacto se muestran siempre que el cliente esté fuera de
  // cadencia, también en la sección de novedades: al llamarlo para enterarse de
  // la novedad se salda el contacto, así que hace falta saberlo ahí mismo.
  const sinContacto = (dias: number | null) =>
    dias === null ? "sin contacto registrado" : `${dias} días sin contacto`;

  const renderBloques = (bloques: ExpBloque[], marcasDe: (c: ExpBloque["clientes"][number]) => string) =>
    bloques
      .map((b) => {
        const rows = b.clientes
          .slice(0, EXP_MAX_POR_BLOQUE)
          .map((c) => {
            const marcas = marcasDe(c);
            return (
              `<li style="margin:0 0 6px;">` +
              `<a href="${clienteLink(c.projectId)}" style="color:#12151c;font-weight:600;font-size:13px;text-decoration:none;">` +
              `${escapeHtml(c.nombre)}</a>` +
              (marcas
                ? `<div style="color:#5a616b;font-size:12px;">${escapeHtml(marcas)}</div>`
                : "") +
              `</li>`
            );
          })
          .join("");
        return (
          `<div style="margin:14px 0 6px;font-size:13px;font-weight:700;color:#12151c;">` +
          `${escapeHtml(b.nombre)} <span style="font-weight:400;color:#8a9099;">` +
          `${b.clientes.length} de ${b.total}</span></div>` +
          `<ul style="margin:0;padding-left:18px;">${rows}</ul>` +
          expYMas(b.clientes.length - EXP_MAX_POR_BLOQUE)
        );
      })
      .join("");

  // Los tres números se cuentan por separado y NO se suman: un total único daba
  // un número grande que asustaba y escondía las pocas alertas con reloj, que son
  // las únicas que hay que accionar hoy.
  const contar = (bloques: ExpBloque[]) => bloques.reduce((acc, b) => acc + b.clientes.length, 0);
  const pendientes = params.alertas.length;
  const nNovedades = contar(params.novedades);
  const nCadencia = contar(params.cadencia);
  const plural = (n: number, sing: string, plur: string) => `${n} ${n === 1 ? sing : plur}`;
  const resumenCorto = [
    pendientes > 0 ? plural(pendientes, "pendiente", "pendientes") : null,
    nNovedades > 0 ? plural(nNovedades, "novedad", "novedades") : null,
    nCadencia > 0 ? `${nCadencia} fuera de cadencia` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const seccion = (titulo: string, subtitulo: string, cuerpo: string) =>
    `<div style="margin:22px 0 2px;font-size:13px;font-weight:700;color:#12151c;">${titulo}</div>` +
    `<div style="margin:0 0 2px;font-size:12px;color:#8a9099;">${subtitulo}</div>` +
    cuerpo;

  const novedadesHtml =
    nNovedades > 0
      ? seccion(
          `Novedades (${nNovedades})`,
          "Pasó algo del lado del cliente y todavía nadie lo miró.",
          renderBloques(params.novedades, (c) =>
            c.fueraDeCadencia ? sinContacto(c.diasSinContacto) : "",
          ),
        )
      : "";

  const cadenciaHtml =
    nCadencia > 0
      ? seccion(
          `Fuera de cadencia (${nCadencia})`,
          "Sin novedad, pero les debemos el contacto del período.",
          renderBloques(params.cadencia, (c) => sinContacto(c.diasSinContacto)),
        )
      : "";

  const contentHtml =
    `<p style="margin:0 0 4px;">Hola ${escapeHtml(params.userName)}, esto es lo que hay ` +
    `en el recorrido de los Generadores:</p>` +
    alertasHtml +
    novedadesHtml +
    cadenciaHtml +
    `<p style="margin:18px 0 0;color:#8a9099;font-size:12px;">Este resumen es la misma vista del Recorrido ` +
    `en Experiencia Solar. Si no hay nada pendiente, no se manda.</p>`;

  return {
    subject: `[Voltia PM] Experiencia Solar — ${resumenCorto}`,
    html: renderEmailLayout({
      title: "Recorrido de Experiencia Solar",
      kicker: "Resumen del día",
      preheader:
        pendientes > 0
          ? `${plural(pendientes, "pendiente", "pendientes")} para hoy.`
          : "Sin pendientes para hoy.",
      contentHtml,
      cta: { label: "Abrir el Recorrido", url: `${BASE_URL}/clientes/recorrido` },
    }),
    text:
      `Experiencia Solar — ${resumenCorto}.\n` +
      params.alertas
        .slice(0, EXP_MAX_ALERTAS)
        .map((a) => `- ${a.cliente}: ${a.titulo} (${a.detalle})`)
        .join("\n") +
      `\nVer: ${BASE_URL}/clientes/recorrido`,
  };
}

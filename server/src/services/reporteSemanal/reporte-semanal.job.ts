// Reporte semanal de indicadores por email.
//
// Todos los lunes a las 00:01 (hora de Uruguay) manda un resumen de la semana
// que acaba de cerrar (lunes a domingo) con los indicadores que la app ya
// calcula. Las definiciones replican las del dashboard (`/metrics/sales` y
// `/metrics/overview`) para que los números coincidan con lo que se ve en
// pantalla.
//
// Estructura testeable: funciones puras de fecha (`calcularSemana`,
// `calcularTrimestre`, `numeroSemanaIso`) + `recolectarDatos` (DB) +
// `renderHtml` (puro) + `ejecutarReporteSemanal` (orquesta y envía) +
// `startReporteSemanalJob` (cron).

import cron from "node-cron";
import {
  GoalArea,
  GoalMetric,
  GoalPeriod,
  ProjectStatus,
  SalesStage,
  StageStatus,
  StageType,
  TipoMovimiento,
} from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { sendEmail } from "../email.service.js";

// Uruguay es UTC-3 fijo (sin horario de verano). Trabajamos el "reloj de pared"
// de Montevideo restando el offset al instante UTC, y volvemos a UTC sumándolo.
const OFFSET_MVD_MIN = 180;

function aRelojMvd(instante: Date): Date {
  return new Date(instante.getTime() - OFFSET_MVD_MIN * 60_000);
}
function desdeRelojMvd(pared: Date): Date {
  return new Date(pared.getTime() + OFFSET_MVD_MIN * 60_000);
}

export interface RangoSemana {
  /** Instante UTC del lunes 00:00 (hora Uruguay) que abre la semana. */
  inicio: Date;
  /** Instante UTC del lunes siguiente 00:00: la semana es [inicio, fin). */
  fin: Date;
  semanaIso: number;
  anioIso: number;
  /** Ej. "lunes 28/07 – domingo 03/08/2026". */
  etiqueta: string;
}

/** Número de semana ISO-8601 de una fecha (usando sus campos UTC). */
export function numeroSemanaIso(d: Date): { semana: number; anio: number } {
  const fecha = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const diaLun0 = (fecha.getUTCDay() + 6) % 7; // Lun=0 … Dom=6
  // Jueves de esta semana define el año ISO.
  fecha.setUTCDate(fecha.getUTCDate() - diaLun0 + 3);
  const primerJueves = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 4));
  const diaLun0Enero = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaLun0Enero + 3);
  const semana = 1 + Math.round((fecha.getTime() - primerJueves.getTime()) / (7 * 86_400_000));
  return { semana, anio: fecha.getUTCFullYear() };
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function ddmm(paredUtcFields: Date): string {
  const dd = String(paredUtcFields.getUTCDate()).padStart(2, "0");
  const mm = String(paredUtcFields.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

/**
 * Semana (lunes 00:00 → lunes siguiente 00:00, hora Uruguay) que YA cerró al
 * momento `now`. Corriendo el lunes 00:01, devuelve la semana lunes-a-domingo
 * inmediata anterior.
 */
export function calcularSemana(now: Date): RangoSemana {
  const pared = aRelojMvd(now);
  const diaLun0 = (pared.getUTCDay() + 6) % 7; // Lun=0
  // Lunes de la semana en curso (00:00 hora Uruguay), en campos de pared.
  const lunesActualPared = new Date(
    Date.UTC(pared.getUTCFullYear(), pared.getUTCMonth(), pared.getUTCDate() - diaLun0, 0, 0, 0),
  );
  const inicioPared = new Date(lunesActualPared);
  inicioPared.setUTCDate(inicioPared.getUTCDate() - 7); // lunes de la semana cerrada
  const finPared = new Date(lunesActualPared); // lunes que abre la semana en curso

  const inicio = desdeRelojMvd(inicioPared);
  const fin = desdeRelojMvd(finPared);

  const domingoPared = new Date(finPared);
  domingoPared.setUTCDate(domingoPared.getUTCDate() - 1); // domingo que cierra la semana
  const { semana, anio } = numeroSemanaIso(inicioPared);
  const etiqueta = `lunes ${ddmm(inicioPared)} – domingo ${ddmm(domingoPared)}/${domingoPared.getUTCFullYear()}`;

  return { inicio, fin, semanaIso: semana, anioIso: anio, etiqueta };
}

export interface RangoTrimestre {
  inicio: Date;
  fin: Date;
  anio: number;
  trimestre: number; // 1..4
}

/** Trimestre calendario en curso al momento `now` (hora Uruguay). */
export function calcularTrimestre(now: Date): RangoTrimestre {
  const pared = aRelojMvd(now);
  const anio = pared.getUTCFullYear();
  const trimestre = Math.floor(pared.getUTCMonth() / 3) + 1;
  const inicioPared = new Date(Date.UTC(anio, (trimestre - 1) * 3, 1, 0, 0, 0));
  const finPared = new Date(Date.UTC(anio, trimestre * 3, 1, 0, 0, 0));
  return { inicio: desdeRelojMvd(inicioPared), fin: desdeRelojMvd(finPared), anio, trimestre };
}

// ─── Recolección de datos ─────────────────────────────────────────────────────

export interface VentaGanada {
  cliente: string;
  asesor: string | null;
  montoUsd: number | null;
}

export interface VisitaComercial {
  cliente: string;
  asesor: string | null;
}

interface ConteosPeriodo {
  leads: number;
  propuestas: number;
  ganados: number;
  instalaciones: number;
  kwp: number;
}

export interface MetaAvance {
  etiqueta: string;
  actual: number;
  objetivo: number;
  porcentaje: number;
  enRitmo: boolean;
}

export interface DatosReporte {
  semana: RangoSemana;
  trimestre: RangoTrimestre;
  leads: number;
  propuestasEnviadas: number;
  ventas: VentaGanada[];
  facturacionVendidaUsd: number;
  visitas: VisitaComercial[];
  gastosRegistrados: number;
  instalaciones: number;
  kwp: number;
  metas: MetaAvance[];
}

/** Monto de la cotización ganadora, con IVA. Fallback: presupuesto del lead. */
function montoDeVenta(lead: {
  estimatedBudgetUsd: unknown;
  commission: { proposalVersion: { snapshot: unknown } | null } | null;
}): number | null {
  const snap = lead.commission?.proposalVersion?.snapshot as { calc?: { totalConIva?: number } } | null | undefined;
  const totalConIva = snap?.calc?.totalConIva;
  if (typeof totalConIva === "number" && Number.isFinite(totalConIva)) return totalConIva;
  if (lead.estimatedBudgetUsd != null) {
    const n = Number(lead.estimatedBudgetUsd);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Conteos de ventas/leads/propuestas/instalaciones sobre un rango [inicio, fin). */
async function contarPeriodo(inicio: Date, fin: Date): Promise<ConteosPeriodo> {
  const [leads, propuestas, ganados, obras] = await Promise.all([
    prisma.salesLead.count({ where: { deletedAt: null, createdAt: { gte: inicio, lt: fin } } }),
    prisma.salesLead.count({ where: { deletedAt: null, proposalSentAt: { gte: inicio, lt: fin } } }),
    prisma.salesLead.count({
      where: { deletedAt: null, stage: SalesStage.CERRADO_GANADO, closedAt: { gte: inicio, lt: fin } },
    }),
    contarObras(inicio, fin),
  ]);
  return { leads, propuestas, ganados, instalaciones: obras.count, kwp: obras.kwp };
}

/**
 * "Obra realizada" en el rango: proyecto con etapa EJECUCION_OBRA finalizada
 * (o proyecto COMPLETED), fechado por actualEndDate de la obra (o del proyecto).
 * Incluye obras livianas importadas por CSV, fechadas por plannedEndDate.
 * Réplica de la definición de `/metrics/overview`.
 */
async function contarObras(inicio: Date, fin: Date): Promise<{ count: number; kwp: number }> {
  const proyectos = await prisma.project.findMany({
    where: { deletedAt: null },
    select: {
      status: true,
      actualEndDate: true,
      plannedEndDate: true,
      capacityKwp: true,
      importedFromCsv: true,
      stages: {
        where: { name: StageType.EJECUCION_OBRA, status: StageStatus.COMPLETED },
        select: { actualEndDate: true },
      },
    },
  });

  let count = 0;
  let kwp = 0;
  const enRango = (d: Date | null): boolean => d != null && d >= inicio && d < fin;

  for (const p of proyectos) {
    let instaladoEn: Date | null = null;
    if (p.importedFromCsv) {
      instaladoEn = p.plannedEndDate ?? null;
    } else {
      const obra = p.stages.find((s) => s.actualEndDate != null);
      const finalizado = p.status === ProjectStatus.COMPLETED;
      if (!obra && !finalizado) continue;
      instaladoEn = obra?.actualEndDate ?? p.actualEndDate ?? null;
    }
    if (!enRango(instaladoEn)) continue;
    count += 1;
    kwp += p.capacityKwp != null ? Number(p.capacityKwp) : 0;
  }
  return { count, kwp: Number(kwp.toFixed(2)) };
}

const META_LABEL: Record<string, string> = {
  [GoalMetric.LEADS_CREATED]: "Leads",
  [GoalMetric.PROPOSALS_SENT]: "Propuestas enviadas",
  [GoalMetric.CLOSED_WON]: "Nuevas ventas",
  [GoalMetric.INSTALLATIONS_COUNT]: "Instalaciones",
  [GoalMetric.KWP_INSTALLED]: "kWp instalados",
};

export async function recolectarDatos(now: Date): Promise<DatosReporte> {
  const semana = calcularSemana(now);
  const trimestre = calcularTrimestre(now);

  const [
    leads,
    propuestasEnviadas,
    ganadosRaw,
    visitasRaw,
    gastosRegistrados,
    obrasSemana,
    conteosTrim,
    goals,
  ] = await Promise.all([
    prisma.salesLead.count({ where: { deletedAt: null, createdAt: { gte: semana.inicio, lt: semana.fin } } }),
    prisma.salesLead.count({ where: { deletedAt: null, proposalSentAt: { gte: semana.inicio, lt: semana.fin } } }),
    prisma.salesLead.findMany({
      where: {
        deletedAt: null,
        stage: SalesStage.CERRADO_GANADO,
        closedAt: { gte: semana.inicio, lt: semana.fin },
      },
      select: {
        clientName: true,
        estimatedBudgetUsd: true,
        assignedTo: { select: { name: true } },
        commission: { select: { proposalVersion: { select: { snapshot: true } } } },
      },
      orderBy: { closedAt: "asc" },
    }),
    prisma.salesLead.findMany({
      where: { deletedAt: null, visitCompletedAt: { gte: semana.inicio, lt: semana.fin } },
      select: { clientName: true, assignedTo: { select: { name: true } } },
      orderBy: { visitCompletedAt: "asc" },
    }),
    prisma.financeMovement.count({
      where: { deletedAt: null, tipoMovimiento: TipoMovimiento.GASTO, fecha: { gte: semana.inicio, lt: semana.fin } },
    }),
    contarObras(semana.inicio, semana.fin),
    contarPeriodo(trimestre.inicio, trimestre.fin),
    prisma.goal.findMany({
      where: {
        year: trimestre.anio,
        OR: [{ period: GoalPeriod.QUARTERLY, quarter: trimestre.trimestre }, { period: GoalPeriod.ANNUAL }],
      },
    }),
  ]);

  const ventas: VentaGanada[] = ganadosRaw.map((l) => ({
    cliente: l.clientName,
    asesor: l.assignedTo?.name ?? null,
    montoUsd: montoDeVenta(l),
  }));
  const facturacionVendidaUsd = Number(
    ventas.reduce((sum, v) => sum + (v.montoUsd ?? 0), 0).toFixed(2),
  );

  const visitas: VisitaComercial[] = visitasRaw.map((l) => ({
    cliente: l.clientName,
    asesor: l.assignedTo?.name ?? null,
  }));

  // Avance de meta: acumulado del trimestre vs objetivo (solo trimestrales, que
  // es como sigue el tablero semanal). Fracción de ritmo = tiempo transcurrido.
  const trimTotalMs = trimestre.fin.getTime() - trimestre.inicio.getTime();
  const trimTranscurridoMs = Math.min(Math.max(now.getTime() - trimestre.inicio.getTime(), 0), trimTotalMs);
  const fraccionTiempo = trimTotalMs > 0 ? trimTranscurridoMs / trimTotalMs : 1;

  const actualPorMetrica: Record<string, number> = {
    [GoalMetric.LEADS_CREATED]: conteosTrim.leads,
    [GoalMetric.PROPOSALS_SENT]: conteosTrim.propuestas,
    [GoalMetric.CLOSED_WON]: conteosTrim.ganados,
    [GoalMetric.INSTALLATIONS_COUNT]: conteosTrim.instalaciones,
    [GoalMetric.KWP_INSTALLED]: conteosTrim.kwp,
  };

  const metas: MetaAvance[] = goals
    .filter((g) => g.period === GoalPeriod.QUARTERLY) // preferimos la meta trimestral
    .map((g) => {
      const objetivo = Number(g.targetValue);
      const actual = actualPorMetrica[g.metric] ?? 0;
      const porcentaje = objetivo > 0 ? Number(((actual / objetivo) * 100).toFixed(0)) : 0;
      const enRitmo = objetivo > 0 ? actual / objetivo >= fraccionTiempo : true;
      return { etiqueta: META_LABEL[g.metric] ?? g.metric, actual, objetivo, porcentaje, enRitmo };
    });

  return {
    semana,
    trimestre,
    leads,
    propuestasEnviadas,
    ventas,
    facturacionVendidaUsd,
    visitas,
    gastosRegistrados,
    instalaciones: obrasSemana.count,
    kwp: obrasSemana.kwp,
    metas,
  };
}

// ─── Render HTML ──────────────────────────────────────────────────────────────

function usd(n: number): string {
  return `US$ ${n.toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function renderHtml(d: DatosReporte): string {
  const kpi = (label: string, valor: string): string => `
    <td style="padding:12px 14px; border:1px solid #e6e8f0; border-radius:8px;">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#8a90a6;">${label}</div>
      <div style="font-size:24px; font-weight:700; color:#1836B2; margin-top:4px;">${valor}</div>
    </td>`;

  const ventasHtml = d.ventas.length
    ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tr style="color:#8a90a6; text-align:left;">
          <th style="padding:6px 8px; border-bottom:1px solid #e6e8f0;">Cliente</th>
          <th style="padding:6px 8px; border-bottom:1px solid #e6e8f0;">Asesor</th>
          <th style="padding:6px 8px; border-bottom:1px solid #e6e8f0; text-align:right;">Monto c/IVA</th>
        </tr>
        ${d.ventas
          .map(
            (v) => `<tr>
              <td style="padding:6px 8px; border-bottom:1px solid #f0f1f6;">${escapar(v.cliente)}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f0f1f6;">${escapar(v.asesor ?? "—")}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f0f1f6; text-align:right;">${v.montoUsd != null ? usd(v.montoUsd) : "s/dato"}</td>
            </tr>`,
          )
          .join("")}
        <tr>
          <td colspan="2" style="padding:8px; font-weight:700; text-align:right;">Facturación vendida</td>
          <td style="padding:8px; font-weight:700; text-align:right; color:#1836B2;">${usd(d.facturacionVendidaUsd)}</td>
        </tr>
      </table>`
    : `<p style="color:#8a90a6; font-size:13px;">Sin ventas cerradas esta semana.</p>`;

  const visitasHtml = d.visitas.length
    ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
        <tr style="color:#8a90a6; text-align:left;">
          <th style="padding:6px 8px; border-bottom:1px solid #e6e8f0;">Cliente</th>
          <th style="padding:6px 8px; border-bottom:1px solid #e6e8f0;">Asesor</th>
        </tr>
        ${d.visitas
          .map(
            (v) => `<tr>
              <td style="padding:6px 8px; border-bottom:1px solid #f0f1f6;">${escapar(v.cliente)}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f0f1f6;">${escapar(v.asesor ?? "—")}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : `<p style="color:#8a90a6; font-size:13px;">Sin visitas comerciales esta semana.</p>`;

  const metasHtml = d.metas.length
    ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
        ${d.metas
          .map(
            (m) => `<tr>
              <td style="padding:6px 8px; border-bottom:1px solid #f0f1f6;">${escapar(m.etiqueta)}</td>
              <td style="padding:6px 8px; border-bottom:1px solid #f0f1f6; text-align:right;">
                ${m.actual.toLocaleString("es-UY")} / ${m.objetivo.toLocaleString("es-UY")}
                <span style="color:${m.enRitmo ? "#1a9c56" : "#c0392b"}; font-weight:700;"> ${m.porcentaje}%</span>
              </td>
            </tr>`,
          )
          .join("")}
      </table>
      <p style="color:#8a90a6; font-size:11px; margin-top:6px;">Acumulado del trimestre (Q${d.trimestre.trimestre} ${d.trimestre.anio}) vs objetivo. Verde = en ritmo.</p>`
    : `<p style="color:#8a90a6; font-size:13px;">No hay metas trimestrales cargadas.</p>`;

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:#2b2f3a; max-width:640px;">
    <p style="font-size:12px; color:#8a90a6; margin:0 0 2px;">Reporte semanal de indicadores</p>
    <h2 style="margin:0 0 2px; color:#1836B2;">Semana ${d.semana.semanaIso} · ${d.semana.anioIso}</h2>
    <p style="font-size:13px; color:#5a6070; margin:0 0 18px;">${d.semana.etiqueta}</p>

    <table style="width:100%; border-collapse:separate; border-spacing:8px 0; margin-bottom:20px;">
      <tr>
        ${kpi("Leads", String(d.leads))}
        ${kpi("Propuestas", String(d.propuestasEnviadas))}
        ${kpi("Ventas", String(d.ventas.length))}
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        ${kpi("Facturación", usd(d.facturacionVendidaUsd))}
        ${kpi("Visitas", String(d.visitas.length))}
        ${kpi("Gastos reg.", String(d.gastosRegistrados))}
      </tr>
      <tr><td style="height:8px;"></td></tr>
      <tr>
        ${kpi("Instalaciones", String(d.instalaciones))}
        ${kpi("kWp", d.kwp.toLocaleString("es-UY"))}
        <td></td>
      </tr>
    </table>

    <h3 style="color:#2b2f3a; font-size:15px; margin:18px 0 8px;">Ventas cerradas</h3>
    ${ventasHtml}

    <h3 style="color:#2b2f3a; font-size:15px; margin:22px 0 8px;">Visitas comerciales</h3>
    ${visitasHtml}

    <h3 style="color:#2b2f3a; font-size:15px; margin:22px 0 8px;">Avance de metas</h3>
    ${metasHtml}

    <p style="color:#b0b4c0; font-size:11px; margin-top:24px;">Generado automáticamente los lunes 00:01 (hora Uruguay) por Voltia PM.</p>
  </div>`;
}

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTexto(d: DatosReporte): string {
  const lineas = [
    `Reporte semanal · Semana ${d.semana.semanaIso}/${d.semana.anioIso}`,
    d.semana.etiqueta,
    "",
    `Leads: ${d.leads}`,
    `Propuestas enviadas: ${d.propuestasEnviadas}`,
    `Nuevas ventas: ${d.ventas.length}`,
    `Facturación vendida: ${usd(d.facturacionVendidaUsd)}`,
    `Visitas: ${d.visitas.length}`,
    `Gastos registrados: ${d.gastosRegistrados}`,
    `Instalaciones: ${d.instalaciones} (${d.kwp} kWp)`,
    "",
    "Ventas cerradas:",
    ...(d.ventas.length
      ? d.ventas.map((v) => `  · ${v.cliente} — ${v.montoUsd != null ? usd(v.montoUsd) : "s/dato"} (${v.asesor ?? "—"})`)
      : ["  (ninguna)"]),
    "",
    "Visitas comerciales:",
    ...(d.visitas.length ? d.visitas.map((v) => `  · ${v.cliente} (${v.asesor ?? "—"})`) : ["  (ninguna)"]),
  ];
  return lineas.join("\n");
}

// ─── Orquestación + cron ──────────────────────────────────────────────────────

function destinatario(): string {
  return process.env.REPORTE_SEMANAL_EMAIL || "nfmj@hotmail.com";
}

export async function ejecutarReporteSemanal(now: Date = new Date()): Promise<boolean> {
  const datos = await recolectarDatos(now);
  const to = destinatario();
  const ok = await sendEmail({
    to,
    // Casilla personal externa del destinatario: client_facing evita el
    // guardrail de "solo usuarios internos" del envío interno.
    type: "client_facing",
    subject: `Indicadores · Semana ${datos.semana.semanaIso} (${datos.semana.etiqueta})`,
    html: renderHtml(datos),
    text: renderTexto(datos),
  });
  if (ok) console.log(`[reporte-semanal] enviado a ${to} — semana ${datos.semana.semanaIso}/${datos.semana.anioIso}`);
  else console.warn("[reporte-semanal] no se pudo enviar (¿SMTP configurado?)");
  return ok;
}

export function startReporteSemanalJob() {
  if (process.env.REPORTE_SEMANAL_ENABLED === "false") {
    console.log("[reporte-semanal] deshabilitado por REPORTE_SEMANAL_ENABLED=false");
    return null;
  }
  // Lunes 00:01 hora de Uruguay.
  const expr = process.env.CRON_REPORTE_SEMANAL || "1 0 * * 1";
  return cron.schedule(
    expr,
    async () => {
      try {
        await ejecutarReporteSemanal();
      } catch (err) {
        console.error("[reporte-semanal] error:", err);
      }
    },
    { timezone: "America/Montevideo" },
  );
}

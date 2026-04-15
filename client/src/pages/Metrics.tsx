import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getMetricsOverview,
  getMetricsProjects,
  getMetricsSales,
  getMetricsStages,
} from "../api/metrics.api";
import { Spinner } from "../components/ui/Spinner";
import { Badge } from "../components/ui/Badge";
import type { GoalProgress } from "../types/api.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("es-UY", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? 1 : 0,
  });
}

function currentQuarter() {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

const GOAL_METRIC_LABELS: Record<string, string> = {
  INSTALLATIONS_COUNT: "Instalaciones",
  KWP_INSTALLED: "kWp instalados",
  LEADS_CREATED: "Leads creados",
  PROPOSALS_SENT: "Propuestas enviadas",
  CLOSED_WON: "Ventas ganadas",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  suffix,
  helper,
}: {
  label: string;
  value: string;
  suffix?: string;
  helper?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <div className="flex items-end gap-2">
        <span className="font-display text-3xl font-bold text-[var(--color-text-primary)]">{value}</span>
        {suffix && <span className="pb-1 text-xs text-[var(--color-text-muted)]">{suffix}</span>}
      </div>
      {helper && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{helper}</p>}
    </div>
  );
}

function GoalCard({
  label,
  value,
  goal,
  suffix,
  subValues,
}: {
  label: string;
  value: number;
  goal: GoalProgress | undefined;
  suffix?: string;
  subValues?: { label: string; value: number }[];
}) {
  const hasGoal = !!goal;
  const pct = goal?.percentAchieved ?? 0;
  const target = goal?.targetValue ?? 0;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <div className="flex items-end gap-2 mb-3">
        <span className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
          {fmtNumber(value)}
        </span>
        {suffix && <span className="pb-1 text-xs text-[var(--color-text-muted)]">{suffix}</span>}
      </div>

      {subValues && subValues.length > 0 && (
        <div className="flex gap-3 mb-3">
          {subValues.map((sv) => (
            <div key={sv.label} className="text-center">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">{fmtNumber(sv.value)}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{sv.label}</p>
            </div>
          ))}
        </div>
      )}

      {hasGoal ? (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[var(--color-text-muted)]">Objetivo: {fmtNumber(target)}</span>
            <span className={`text-[10px] font-semibold ${goal.onTrack ? "text-green-400" : "text-red-400"}`}>
              {fmtNumber(pct, 1)}% {goal.onTrack ? "✓" : "↓"}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-bg-app)]">
            <div
              className={`h-1.5 rounded-full transition-all ${goal.onTrack ? "bg-green-500" : "bg-[var(--color-accent)]"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Sin objetivo configurado ·{" "}
          <Link to="/admin" className="text-[var(--color-accent)] hover:underline">
            Configurar
          </Link>
        </p>
      )}
    </div>
  );
}

function PipelineTimeCard({ label, days, globalDays }: { label: string; days: number | null | undefined; globalDays?: number | null }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">{label}</p>
      {days != null ? (
        <>
          <p className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
            {fmtNumber(days, 1)}<span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">días</span>
          </p>
          {globalDays != null && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
              Global: {fmtNumber(globalDays, 1)} días
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">Sin datos suficientes</p>
      )}
    </div>
  );
}

// ─── Period Selector ──────────────────────────────────────────────────────────

interface PeriodState {
  year: number;
  quarter: number | undefined;
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodState;
  onChange: (v: PeriodState) => void;
}) {
  const thisYear = new Date().getFullYear();
  const years = [thisYear - 1, thisYear, thisYear + 1];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <select
        value={value.quarter ?? ""}
        onChange={(e) => onChange({ ...value, quarter: e.target.value ? Number(e.target.value) : undefined })}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
      >
        <option value="">Año completo</option>
        <option value="1">Q1 (Ene–Mar)</option>
        <option value="2">Q2 (Abr–Jun)</option>
        <option value="3">Q3 (Jul–Sep)</option>
        <option value="4">Q4 (Oct–Dic)</option>
      </select>

      {value.quarter && (
        <button
          onClick={() => onChange({ ...value, quarter: undefined })}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Ver año completo
        </button>
      )}

      <span className="text-xs text-[var(--color-text-muted)]">
        {value.quarter ? `Q${value.quarter} ${value.year}` : `Año ${value.year}`}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Metrics() {
  const thisYear = new Date().getFullYear();
  const [period, setPeriod] = useState<PeriodState>({
    year: thisYear,
    quarter: currentQuarter(),
  });

  const periodParams = { year: period.year, quarter: period.quarter };

  const overviewQuery = useQuery({
    queryKey: ["metrics", "overview", period],
    queryFn: () => getMetricsOverview(periodParams),
  });
  const stagesQuery = useQuery({
    queryKey: ["metrics", "stages"],
    queryFn: getMetricsStages,
  });
  const projectsQuery = useQuery({
    queryKey: ["metrics", "projects"],
    queryFn: getMetricsProjects,
  });
  const salesQuery = useQuery({
    queryKey: ["metrics", "sales", period],
    queryFn: () => getMetricsSales(periodParams),
  });

  const isLoading =
    overviewQuery.isLoading ||
    stagesQuery.isLoading ||
    projectsQuery.isLoading ||
    salesQuery.isLoading;

  const hasError =
    overviewQuery.error ||
    stagesQuery.error ||
    projectsQuery.error ||
    salesQuery.error;

  const { globalExecutedPercent, co2Trees, maxStageDays } = useMemo(() => {
    const ov = overviewQuery.data;
    const st = stagesQuery.data ?? [];
    return {
      globalExecutedPercent: ov && ov.totalBudgetUsd > 0 ? (ov.totalExecutedUsd / ov.totalBudgetUsd) * 100 : 0,
      co2Trees: ov ? Math.round(ov.totalCo2Tons * 45) : 0,
      maxStageDays: Math.max(1, ...st.flatMap((s) => [s.avgPlannedDays, s.avgActualDays])),
    };
  }, [overviewQuery.data, stagesQuery.data]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (hasError || !overviewQuery.data || !stagesQuery.data || !projectsQuery.data || !salesQuery.data) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-secondary)]">
        No se pudieron cargar las métricas. Verificá que el backend esté reiniciado y que tu usuario tenga permiso de{" "}
        <span className="font-mono">METRICAS:VIEW</span>.
      </div>
    );
  }

  const ov = overviewQuery.data;
  const stages = stagesQuery.data;
  const projects = projectsQuery.data;
  const sales = salesQuery.data;

  const periodLabel = period.quarter ? `Q${period.quarter} ${period.year}` : `Año ${period.year}`;

  // Pick relevant goal for a metric
  function salesGoal(metric: string): GoalProgress | undefined {
    return sales.goals.find(
      (g) => g.metric === metric && (period.quarter ? g.period === "QUARTERLY" : g.period === "ANNUAL"),
    );
  }

  const instGoal = ov.installationsThisYear; // We'll use overview data
  const instValue = period.quarter ? ov.installationsThisQuarter : ov.installationsThisYear;
  const kwpValue = period.quarter ? ov.kwpInstalledThisQuarter : ov.kwpInstalledThisYear;

  return (
    <div className="space-y-8 px-1 py-3">
      {/* Header + period selector */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--color-text-primary)]">Métricas</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Visión global de operaciones y ventas — {periodLabel}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ── SECCIÓN OPERACIONES ─────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <span className="text-sky-400">⚙</span> Operaciones
        </h2>

        {/* Sub-sección Instalaciones */}
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
          Instalaciones
        </p>
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <GoalCard
            label="Instalaciones realizadas"
            value={instValue}
            goal={undefined}
            suffix=""
          />
          <GoalCard
            label="kWp instalados"
            value={kwpValue}
            goal={undefined}
            suffix="kWp"
          />
          <KpiCard
            label="Proyectos activos ahora"
            value={fmtNumber(ov.activeProjects)}
            helper={`${ov.totalProjects} totales`}
          />
          <div className="rounded-2xl border border-[var(--color-border-hover)] bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(34,197,94,0.08))] p-4">
            <p className="mb-1 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
              CO₂ evitado
            </p>
            <p className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
              {fmtNumber(ov.totalCo2Tons, 1)} <span className="text-base font-normal">tCO₂</span>
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              ≈ {fmtNumber(co2Trees)} árboles
            </p>
          </div>
        </div>

        {/* Sub-sección Tiempos */}
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
          Tiempos
        </p>
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">Días promedio para agendar obra</p>
            {ov.avgDaysToScheduleFirstDate != null ? (
              <>
                <p className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
                  {fmtNumber(ov.avgDaysToScheduleFirstDate, 1)}
                  <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">días</span>
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Desde cierre hasta fecha tentativa de obra</p>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">Sin datos suficientes</p>
            )}
          </div>
          <KpiCard label="Desvío promedio" value={fmtNumber(ov.avgDelayDays, 1)} suffix="días" helper="Proyectos activos y completados" />
          <KpiCard label="Eficiencia tiempo promedio" value={fmtNumber(ov.avgTimeEfficiency, 1)} suffix="%" />
        </div>

        {/* Gráfico de etapas */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-6">
          <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mb-1">
            Duración promedio por etapa
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Comparación plan vs real en proyectos completados.
          </p>

          {stages.every((s) => s.completedCount === 0) ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Todavía no hay proyectos completados para calcular promedios
            </p>
          ) : (
            <div className="space-y-4">
              {stages
                .filter((s) => s.stageName !== "POSTVENTA")
                .map((stage) => (
                  <div key={stage.stageName} className="grid gap-3 md:grid-cols-[180px_1fr_100px] md:items-center">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{stage.stageLabel}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{stage.completedCount} proyectos</p>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="mb-1 flex justify-between text-[11px] text-[var(--color-text-muted)]">
                          <span>Plan</span>
                          <span>{fmtNumber(stage.avgPlannedDays, 1)} días</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--color-bg-app)]">
                          <div
                            className="h-2 rounded-full bg-sky-500/70"
                            style={{ width: `${(stage.avgPlannedDays / maxStageDays) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-[11px] text-[var(--color-text-muted)]">
                          <span>Real</span>
                          <span>{fmtNumber(stage.avgActualDays, 1)} días</span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--color-bg-app)]">
                          <div
                            className="h-2 rounded-full bg-[var(--color-accent)]"
                            style={{ width: `${(stage.avgActualDays / maxStageDays) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        stage.avgDelayDays > 0
                          ? "text-red-400"
                          : stage.avgDelayDays < 0
                            ? "text-[var(--color-state-done-text)]"
                            : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {stage.avgDelayDays > 0 ? "+" : ""}
                      {fmtNumber(stage.avgDelayDays, 1)} días
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Ranking proyectos */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
          <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mb-1">
            Ranking de proyectos por desvío
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            Priorizá los proyectos más comprometidos en tiempo.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <th className="pb-3">Proyecto</th>
                  <th className="pb-3">Capacidad</th>
                  <th className="pb-3">Avance</th>
                  <th className="pb-3">Desvío</th>
                  <th className="pb-3">Eficiencia</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className={project.delayDays > 5 ? "bg-red-500/5" : ""}>
                    <td className="border-t border-[var(--color-border)] py-3">
                      <div className="font-medium text-[var(--color-text-primary)]">{project.clientName}</div>
                      <div className="font-mono text-[11px] text-[var(--color-text-muted)]">{project.code}</div>
                    </td>
                    <td className="border-t border-[var(--color-border)] py-3 text-[var(--color-text-secondary)]">
                      {fmtNumber(project.capacityKwp, 1)} kWp
                    </td>
                    <td className="border-t border-[var(--color-border)] py-3">
                      <div className="w-32 rounded-full bg-[var(--color-bg-app)]">
                        <div
                          className="h-2 rounded-full bg-[var(--color-accent)]"
                          style={{ width: `${project.progressPercent}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">{project.progressPercent}%</div>
                    </td>
                    <td
                      className={`border-t border-[var(--color-border)] py-3 font-medium ${
                        project.delayDays > 0 ? "text-red-400" : project.delayDays < 0 ? "text-[var(--color-state-done-text)]" : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {project.delayDays > 0 ? "+" : ""}
                      {project.delayDays} días
                    </td>
                    <td className="border-t border-[var(--color-border)] py-3 text-[var(--color-text-secondary)]">
                      {fmtNumber(project.timeEfficiency, 1)}%
                    </td>
                    <td className="border-t border-[var(--color-border)] py-3">
                      <Badge variant={project.status} />
                    </td>
                    <td className="border-t border-[var(--color-border)] py-3 text-right">
                      <Link className="text-sm text-[var(--color-accent)] hover:underline" to={`/projects/${project.id}`}>
                        Ver proyecto
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN VENTAS ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 font-display text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <span className="text-green-400">💼</span> Ventas
        </h2>

        {/* Sub-sección Volumen */}
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
          Volumen
        </p>
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <GoalCard
            label="Leads creados"
            value={period.quarter ? (sales.leadsCreatedThisQuarter ?? 0) : sales.leadsCreatedThisYear}
            goal={salesGoal("LEADS_CREATED")}
            subValues={[
              { label: "año", value: sales.leadsCreatedThisYear },
              { label: "semana", value: sales.leadsCreatedThisWeek },
            ]}
          />
          <GoalCard
            label="Propuestas enviadas"
            value={period.quarter ? (sales.proposalsSentThisQuarter ?? 0) : sales.proposalsSentThisYear}
            goal={salesGoal("PROPOSALS_SENT")}
            subValues={[
              { label: "año", value: sales.proposalsSentThisYear },
              { label: "semana", value: sales.proposalsSentThisWeek },
            ]}
          />
          <GoalCard
            label="Ventas ganadas"
            value={period.quarter ? (sales.closedWonThisQuarter ?? 0) : sales.closedWonThisYear}
            goal={salesGoal("CLOSED_WON")}
            subValues={[
              { label: "año", value: sales.closedWonThisYear },
              { label: "semana", value: sales.closedWonThisWeek },
            ]}
          />
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">Tasa de conversión</p>
            {sales.conversionRate != null ? (
              <>
                <p className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
                  {fmtNumber(sales.conversionRate, 1)}
                  <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">%</span>
                </p>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {sales.closedWonThisYear} ganadas / {sales.closedWonThisYear + (sales.closedLostThisYear ?? 0)} cerradas
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">Sin datos suficientes</p>
            )}
          </div>
        </div>

        {/* Sub-sección Tiempos pipeline */}
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
          Tiempos promedio del pipeline
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <PipelineTimeCard label="Lead → Propuesta" days={sales.avgLeadToProposal} />
          <PipelineTimeCard label="Propuesta → Visita" days={sales.avgProposalToVisit} />
          <PipelineTimeCard label="Visita → Cierre" days={sales.avgVisitToClose} />
          <PipelineTimeCard label="Propuesta → Cierre" days={sales.avgProposalToClose} />
        </div>
      </section>
    </div>
  );
}

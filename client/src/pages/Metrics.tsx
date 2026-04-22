import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getMetricsOverview,
  getMetricsProjects,
  getMetricsSales,
  getMetricsStages,
} from "../api/metrics.api";
import { MetricCard } from "../components/metrics/MetricCard";
import { PeriodSelector } from "../components/metrics/PeriodSelector";
import { StageTimingChart } from "../components/metrics/StageTimingChart";
import { ProjectRanking } from "../components/metrics/ProjectRanking";
import type { GoalProgress } from "../types/api.types";
import type { PeriodValue } from "../components/metrics/PeriodSelector";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safe(v: number | null | undefined, d = 0): string {
  if (v == null || !isFinite(v) || isNaN(v)) return "—";
  return v.toLocaleString("es-UY", {
    maximumFractionDigits: d,
    minimumFractionDigits: d > 0 ? 1 : 0,
  });
}

function pctSafe(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null || b == null || b === 0) return null;
  const r = (a / b) * 100;
  return isFinite(r) ? Math.round(r * 10) / 10 : null;
}

function currentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

function findGoal(
  goals: GoalProgress[],
  metric: string,
  period: "ANNUAL" | "QUARTERLY",
  quarter?: number,
): GoalProgress | undefined {
  return goals.find(
    (g) =>
      g.metric === metric &&
      g.period === period &&
      (period === "QUARTERLY" ? g.quarter === quarter : true),
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 animate-pulse">
      <div className="h-3 w-28 bg-[var(--color-border)] rounded mb-3" />
      <div className="h-8 w-20 bg-[var(--color-border)] rounded mb-3" />
      <div className="h-1.5 w-full bg-[var(--color-border)] rounded mb-1.5" />
      <div className="h-1 w-full bg-[var(--color-border)] rounded opacity-60" />
    </div>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] animate-pulse ${className}`}
    />
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
      {children}
    </p>
  );
}

// ─── ConversionCard ──────────────────────────────────────────────────────────

function ConversionCard({
  label,
  pctQ,
  pctYear,
  absNumerQ,
  absNumerYear,
  absDenomQ,
  absDenomYear,
  mode,
}: {
  label: string;
  pctQ: number | null;
  pctYear: number | null;
  absNumerQ: number | null;
  absNumerYear: number;
  absDenomQ: number | null;
  absDenomYear: number;
  mode: "quarter" | "annual";
}) {
  const primaryPct = mode === "quarter" ? pctQ : pctYear;
  const primaryNumer = mode === "quarter" ? absNumerQ : absNumerYear;
  const primaryDenom = mode === "quarter" ? absDenomQ : absDenomYear;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
      <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-tight">{label}</p>
      {primaryPct !== null ? (
        <>
          <p className="font-display text-2xl font-bold text-[var(--color-text-primary)] leading-none">
            {safe(primaryPct, 1)}
            <span className="text-sm font-normal text-[var(--color-text-muted)] ml-0.5">%</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
            {safe(primaryNumer ?? 0)} de {safe(primaryDenom ?? 0)}
            {mode === "quarter" && pctYear !== null && (
              <span className="opacity-50"> · año {safe(pctYear, 1)}%</span>
            )}
          </p>
        </>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">—</p>
      )}
    </div>
  );
}

// ─── TimingCard ───────────────────────────────────────────────────────────────

function TimingCard({
  label,
  days,
}: {
  label: string;
  days: number | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
      <p className="text-[11px] text-[var(--color-text-muted)] mb-2 leading-tight">{label}</p>
      {days != null && isFinite(days) ? (
        <p className="font-display text-2xl font-bold text-[var(--color-text-primary)] leading-none">
          {safe(days, 1)}
          <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1">días</span>
        </p>
      ) : (
        <p className="text-xl font-bold text-[var(--color-text-muted)]">—</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Metrics() {
  const thisYear = new Date().getFullYear();

  const [period, setPeriod] = useState<PeriodValue>({
    year: thisYear,
    quarter: currentQuarter(),
  });

  const isQ = period.quarter != null;
  const mode: "quarter" | "annual" = isQ ? "quarter" : "annual";
  const qLabel = isQ ? `Q${period.quarter} ${period.year}` : `Año ${period.year}`;
  const apiParams = { year: period.year, quarter: period.quarter };

  // ── Queries ────────────────────────────────────────────────────────────────
  const overviewQ = useQuery({
    queryKey: ["metrics", "overview", period],
    queryFn: () => getMetricsOverview(apiParams),
  });
  const salesQ = useQuery({
    queryKey: ["metrics", "sales", period],
    queryFn: () => getMetricsSales(apiParams),
  });
  const stagesQ = useQuery({
    queryKey: ["metrics", "stages"],
    queryFn: getMetricsStages,
  });
  const projectsQ = useQuery({
    queryKey: ["metrics", "projects"],
    queryFn: getMetricsProjects,
  });

  const isLoading =
    overviewQ.isLoading ||
    salesQ.isLoading ||
    stagesQ.isLoading ||
    projectsQ.isLoading;

  const hasError =
    overviewQ.isError || salesQ.isError || stagesQ.isError || projectsQ.isError;

  // ── Derived ────────────────────────────────────────────────────────────────
  const co2Trees = useMemo(
    () => (overviewQ.data ? Math.round(overviewQ.data.totalCo2Tons * 45) : 0),
    [overviewQ.data],
  );

  // Goal lookups
  const sg = (goals: GoalProgress[], metric: string, p: "ANNUAL" | "QUARTERLY") =>
    findGoal(goals, metric, p, period.quarter);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 px-1 py-3">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
            Métricas
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Operaciones y ventas — {qLabel}
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {hasError && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 text-sm text-[var(--color-text-secondary)] flex items-center justify-between gap-4">
          <span>
            No se pudieron cargar las métricas. Verificá que el backend esté corriendo y que tu usuario
            tenga permiso <span className="font-mono">METRICAS:VIEW</span>.
          </span>
          <button
            onClick={() => {
              void overviewQ.refetch();
              void salesQ.refetch();
              void stagesQ.refetch();
              void projectsQ.refetch();
            }}
            className="shrink-0 text-[var(--color-accent)] hover:underline text-sm"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          VENTAS
      ════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="mb-5 font-display text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <span className="text-green-400">💼</span> Ventas
        </h2>

        {/* ── KPIs de volumen ─────────────────────────────────────────────── */}
        <SLabel>Volumen</SLabel>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-4 mb-6">
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : salesQ.data ? (
          <div className="grid gap-3 md:grid-cols-4 mb-6">
            <MetricCard
              label="Leads creados"
              valueQ={salesQ.data.leadsCreatedThisQuarter}
              valueYear={salesQ.data.leadsCreatedThisYear}
              goalQ={sg(salesQ.data.goals, "LEADS_CREATED", "QUARTERLY")}
              goalYear={sg(salesQ.data.goals, "LEADS_CREATED", "ANNUAL")}
              mode={mode}
              quarterLabel={qLabel}
            />
            <MetricCard
              label="Propuestas enviadas"
              valueQ={salesQ.data.proposalsSentThisQuarter}
              valueYear={salesQ.data.proposalsSentThisYear}
              goalQ={sg(salesQ.data.goals, "PROPOSALS_SENT", "QUARTERLY")}
              goalYear={sg(salesQ.data.goals, "PROPOSALS_SENT", "ANNUAL")}
              mode={mode}
              quarterLabel={qLabel}
            />
            <MetricCard
              label="Ventas ganadas"
              valueQ={salesQ.data.closedWonThisQuarter}
              valueYear={salesQ.data.closedWonThisYear}
              goalQ={sg(salesQ.data.goals, "CLOSED_WON", "QUARTERLY")}
              goalYear={sg(salesQ.data.goals, "CLOSED_WON", "ANNUAL")}
              mode={mode}
              quarterLabel={qLabel}
            />

            {/* Tasa de conversión — métrica calculada, sin objetivo */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex flex-col gap-3">
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Tasa de conversión lead → cierre
              </p>
              {salesQ.data.conversionRate != null ? (
                <>
                  <div>
                    <div className="flex items-baseline gap-1 leading-none">
                      <span className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
                        {safe(salesQ.data.conversionRate, 1)}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">%</span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {isQ ? qLabel : "este año"}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-auto">
                    {salesQ.data.closedWonThisYear} ganados de{" "}
                    {salesQ.data.closedWonThisYear + (salesQ.data.closedLostThisYear ?? 0)} cerrados
                  </p>
                </>
              ) : (
                <>
                  <p className="font-display text-3xl font-bold text-[var(--color-text-muted)]">—</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-auto">
                    Sin datos suficientes
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* ── Conversión + Tiempos ─────────────────────────────────────────── */}
        <SLabel>Conversión y tiempos del pipeline</SLabel>

        {isLoading ? (
          <SkeletonBlock className="h-52 mb-6" />
        ) : salesQ.data ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 mb-6">
            <div className="grid gap-6 md:grid-cols-2">

              {/* Izquierda: conversiones */}
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                  Conversión del pipeline
                </p>
                <div className="space-y-2">
                  <ConversionCard
                    label="Lead → Propuesta"
                    pctQ={pctSafe(salesQ.data.proposalsSentThisQuarter, salesQ.data.leadsCreatedThisQuarter)}
                    pctYear={pctSafe(salesQ.data.proposalsSentThisYear, salesQ.data.leadsCreatedThisYear)}
                    absNumerQ={salesQ.data.proposalsSentThisQuarter}
                    absNumerYear={salesQ.data.proposalsSentThisYear}
                    absDenomQ={salesQ.data.leadsCreatedThisQuarter}
                    absDenomYear={salesQ.data.leadsCreatedThisYear}
                    mode={mode}
                  />
                  <ConversionCard
                    label="Lead → Cierre ganado"
                    pctQ={pctSafe(salesQ.data.closedWonThisQuarter, salesQ.data.leadsCreatedThisQuarter)}
                    pctYear={pctSafe(salesQ.data.closedWonThisYear, salesQ.data.leadsCreatedThisYear)}
                    absNumerQ={salesQ.data.closedWonThisQuarter}
                    absNumerYear={salesQ.data.closedWonThisYear}
                    absDenomQ={salesQ.data.leadsCreatedThisQuarter}
                    absDenomYear={salesQ.data.leadsCreatedThisYear}
                    mode={mode}
                  />
                  <ConversionCard
                    label="Propuesta → Cierre ganado"
                    pctQ={pctSafe(salesQ.data.closedWonThisQuarter, salesQ.data.proposalsSentThisQuarter)}
                    pctYear={pctSafe(salesQ.data.closedWonThisYear, salesQ.data.proposalsSentThisYear)}
                    absNumerQ={salesQ.data.closedWonThisQuarter}
                    absNumerYear={salesQ.data.closedWonThisYear}
                    absDenomQ={salesQ.data.proposalsSentThisQuarter}
                    absDenomYear={salesQ.data.proposalsSentThisYear}
                    mode={mode}
                  />
                </div>
              </div>

              {/* Derecha: tiempos */}
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                  Tiempos promedio
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <TimingCard label="Lead → Propuesta" days={salesQ.data.avgLeadToProposal} />
                  <TimingCard label="Propuesta → Visita" days={salesQ.data.avgProposalToVisit} />
                  <TimingCard label="Visita → Cierre" days={salesQ.data.avgVisitToClose} />
                  <TimingCard label="Lead → Cierre" days={salesQ.data.avgProposalToClose} />
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          OPERACIONES
      ════════════════════════════════════════════════════════════════════ */}
      <section>
        <h2 className="mb-5 font-display text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <span className="text-sky-400">⚙</span> Operaciones
        </h2>

        {/* ── KPIs ────────────────────────────────────────────────────────── */}
        <SLabel>Instalaciones</SLabel>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-4 mb-6">
            {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : overviewQ.data ? (
          <div className="grid gap-3 md:grid-cols-4 mb-6">
            <MetricCard
              label="Instalaciones realizadas"
              valueQ={overviewQ.data.installationsThisQuarter}
              valueYear={overviewQ.data.installationsThisYear}
              goalQ={sg(overviewQ.data.goals, "INSTALLATIONS_COUNT", "QUARTERLY")}
              goalYear={sg(overviewQ.data.goals, "INSTALLATIONS_COUNT", "ANNUAL")}
              mode={mode}
              quarterLabel={qLabel}
            />
            <MetricCard
              label="kWp instalados"
              valueQ={overviewQ.data.kwpInstalledThisQuarter}
              valueYear={overviewQ.data.kwpInstalledThisYear}
              goalQ={sg(overviewQ.data.goals, "KWP_INSTALLED", "QUARTERLY")}
              goalYear={sg(overviewQ.data.goals, "KWP_INSTALLED", "ANNUAL")}
              mode={mode}
              suffix="kWp"
              decimals={1}
              quarterLabel={qLabel}
            />

            {/* Proyectos activos */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex flex-col gap-3">
              <p className="text-[11px] text-[var(--color-text-muted)]">Proyectos activos</p>
              <div>
                <div className="flex items-baseline gap-2 leading-none">
                  <span className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
                    {safe(overviewQ.data.activeProjects)}
                  </span>
                  <span className="font-display text-xl font-semibold text-[var(--color-text-secondary)]">
                    / {safe(overviewQ.data.totalProjects)}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  activos / total
                </p>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-auto">
                {safe(overviewQ.data.completedProjects)} completados · venta→entrega: {overviewQ.data.avgSaleToDeliveryDays != null ? `${safe(overviewQ.data.avgSaleToDeliveryDays, 0)} días prom.` : "—"}
              </p>
            </div>

            {/* CO₂ */}
            <div className="rounded-2xl border border-[var(--color-border-hover,var(--color-border))] bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(34,197,94,0.08))] p-4 flex flex-col gap-3">
              <p className="text-[11px] text-[var(--color-text-muted)]">CO₂ evitado (acum.)</p>
              <div>
                <div className="flex items-baseline gap-1 leading-none">
                  <span className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
                    {safe(overviewQ.data.totalCo2Tons, 1)}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-1">tCO₂</span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  acumulado total
                </p>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mt-auto">
                ≈ {safe(co2Trees)} árboles plantados
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Tiempos + Ranking ────────────────────────────────────────────── */}
        <SLabel>Tiempos y proyectos</SLabel>

        {isLoading ? (
          <SkeletonBlock className="h-72" />
        ) : stagesQ.data && projectsQ.data ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="grid gap-8 md:grid-cols-2">

              {/* Duración por etapa */}
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-4">
                  Duración real por etapa
                </p>
                <StageTimingChart stages={stagesQ.data} />
              </div>

              {/* Proyectos activos */}
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)] mb-4">
                  Proyectos activos
                </p>
                <ProjectRanking projects={projectsQ.data} />
              </div>

            </div>
          </div>
        ) : null}

      </section>
    </div>
  );
}

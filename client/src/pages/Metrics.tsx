import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getMetricsOverview,
  getMetricsProjects,
  getMetricsSales,
  getMetricsStages,
} from "../api/metrics.api";
import { MetricCard } from "../components/metrics/MetricCard";
import { PeriodSelector } from "../components/metrics/PeriodSelector";
import { StageTimingChart } from "../components/metrics/StageTimingChart";
import { UteEvolutionChart } from "../components/metrics/UteEvolutionChart";
import { ProjectRanking } from "../components/metrics/ProjectRanking";
import { usePermission } from "../hooks/usePermission";
import { getUteMetrics, UTE_STAGE_LABEL } from "../api/uteProcess.api";
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
    queryKey: ["metrics", "stages", period],
    queryFn: () => getMetricsStages(apiParams),
  });
  const projectsQ = useQuery({
    queryKey: ["metrics", "projects"],
    queryFn: getMetricsProjects,
  });

  const canViewUte = usePermission("TRAMITES_UTE", "VIEW");
  const uteQ = useQuery({
    queryKey: ["metrics", "ute"],
    queryFn: getUteMetrics,
    enabled: canViewUte,
    staleTime: 5 * 60_000,
  });
  const navigate = useNavigate();

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
        <p className="text-[11px] text-[var(--color-text-muted)] -mt-2 mb-3" title="Cuenta obras con la etapa 'Ejecución de obra' finalizada; en su defecto, proyectos marcados como finalizados. Se agrupa por la fecha de finalización de la obra (o, si no la tiene, la de finalización del proyecto).">
          Obras con la etapa "Ejecución de obra" finalizada (o el proyecto marcado como finalizado), agrupadas por la fecha de finalización.
        </p>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5 mb-6">
            {[0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : overviewQ.data ? (
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5 mb-6">
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
              label="Obras ponderadas"
              valueQ={overviewQ.data.obrasRealizadasPonderadasThisQuarter}
              valueYear={overviewQ.data.obrasRealizadasPonderadasThisYear}
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
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  Duración real por etapa
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-4">
                  Etapas completadas en {qLabel}
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

      {/* ═════════════════════════════ TRÁMITES UTE ═════════════════════════════ */}
      {canViewUte ? (
        <section>
          <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            📄 Trámites UTE
          </h2>

          {uteQ.isLoading ? (
            <div className="text-xs text-[var(--color-text-muted)]">Cargando…</div>
          ) : uteQ.isError || !uteQ.data ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-sm text-[var(--color-text-secondary)]">
              No se pudieron cargar las métricas UTE.
            </div>
          ) : (
            <div className="space-y-6">
              <SLabel>KPIs globales</SLabel>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <UteKpi label="Trámites activos" value={uteQ.data.kpis.activeCount} />
                <UteKpi label="Finalizados este año" value={uteQ.data.kpis.finalizedThisYearCount} />
                <UteKpi label="Duración prom. (días)" value={uteQ.data.kpis.avgTotalDays} />
                <UteKpi label="Prom. nuestro (días)" value={uteQ.data.kpis.avgOurDays} accent="#f87171" />
                <UteKpi label="Prom. UTE (días)" value={uteQ.data.kpis.avgUteDays} accent="#60a5fa" />
              </div>

              <p className="text-[11px] text-[var(--color-text-muted)]">
                Tiempo hasta iniciar trámite:{" "}
                <span className="font-semibold text-[var(--color-text-secondary)]">
                  {uteQ.data.kpis.avgTimeToStartDays ?? "—"} días
                </span>
              </p>

              <div>
                <SLabel>Duración promedio por etapa</SLabel>
                <UteStageBars byStage={uteQ.data.byStage} />
              </div>

              <div>
                <SLabel>Distribución tiempo nuestro vs UTE</SLabel>
                <UteDistributionBar
                  ourPercent={uteQ.data.distribution.ourPercent}
                  utePercent={uteQ.data.distribution.utePercent}
                  ourDays={uteQ.data.distribution.ourDays}
                  uteDays={uteQ.data.distribution.uteDays}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <SLabel>Top 5 — Más demora nuestra</SLabel>
                  <UteTopList
                    items={uteQ.data.topOurDelay}
                    color="#f87171"
                    onClick={(id) => navigate(`/tramites-ute?highlight=${id}`)}
                  />
                </div>
                <div>
                  <SLabel>Top 5 — Más demora UTE</SLabel>
                  <UteTopList
                    items={uteQ.data.topUteDelay}
                    color="#60a5fa"
                    onClick={(id) => navigate(`/tramites-ute?highlight=${id}`)}
                  />
                </div>
              </div>

              {/* Evolución de tiempos por período */}
              <div className="mt-6">
                <UteEvolutionChart />
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

// ─── UTE sub-componentes ────────────────────────────────────────────────────

function UteKpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | null;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-center">
      <div
        className="font-display text-xl font-bold"
        style={{ color: accent ?? "var(--color-text-primary)" }}
      >
        {value ?? "—"}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </div>
    </div>
  );
}

function UteStageBars({
  byStage,
}: {
  byStage: Array<{
    key: string;
    label: string;
    avg: number | null;
    min: number | null;
    max: number | null;
    count: number;
  }>;
}) {
  const withData = byStage.filter((s) => s.count > 0 && s.avg != null);
  if (withData.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        Aún no hay suficientes datos para calcular promedios por etapa.
      </p>
    );
  }
  const maxAvg = Math.max(...withData.map((s) => s.avg ?? 0), 1);
  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      {withData.map((s) => {
        const pct = Math.round(((s.avg ?? 0) / maxAvg) * 100);
        return (
          <div key={s.key}>
            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
              <span>{s.label}</span>
              <span className="font-mono">
                {s.avg} días · {s.count}{" "}
                <span className="text-[var(--color-text-muted)]">
                  (min {s.min} · max {s.max})
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[var(--color-bg-app)]">
              <div
                className="h-2 rounded-full"
                style={{ width: `${pct}%`, background: "var(--color-accent)" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UteDistributionBar({
  ourPercent,
  utePercent,
  ourDays,
  uteDays,
}: {
  ourPercent: number;
  utePercent: number;
  ourDays: number;
  uteDays: number;
}) {
  const total = ourDays + uteDays;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-[var(--color-bg-app)]">
        <div
          className="flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ width: `${ourPercent}%`, background: "#f87171" }}
          title={`Nuestro: ${ourDays} días`}
        >
          {ourPercent >= 10 ? `${ourPercent}%` : ""}
        </div>
        <div
          className="flex items-center justify-center text-[10px] font-semibold text-white"
          style={{ width: `${utePercent}%`, background: "#60a5fa" }}
          title={`UTE: ${uteDays} días`}
        >
          {utePercent >= 10 ? `${utePercent}%` : ""}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: "#f87171" }} />
          Nuestro · {ourDays} días
        </span>
        <span className="font-mono">Total acumulado: {total} días</span>
        <span>
          UTE · {uteDays} días
          <span className="ml-1 inline-block h-2 w-2 rounded-full" style={{ background: "#60a5fa" }} />
        </span>
      </div>
    </div>
  );
}

function UteTopList({
  items,
  color,
  onClick,
}: {
  items: Array<{
    id: string;
    projectCode: string;
    clientName: string;
    days: number;
    currentStage: string;
  }>;
  color: string;
  onClick: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-xs text-[var(--color-text-muted)]">
        Sin datos.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            onClick={() => onClick(it.id)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--color-bg-card-hover)]"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                {it.clientName}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)]">
                {UTE_STAGE_LABEL[it.currentStage as keyof typeof UTE_STAGE_LABEL] ?? it.currentStage}
              </div>
            </div>
            <span className="font-mono text-sm font-bold" style={{ color }}>
              {it.days}d
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

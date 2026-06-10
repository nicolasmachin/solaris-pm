import { Link } from "react-router-dom";
import type { GoalProgress } from "../../types/api.types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number, d = 0): string {
  if (!isFinite(v) || isNaN(v)) return "—";
  return v.toLocaleString("es-UY", {
    maximumFractionDigits: d,
    minimumFractionDigits: d > 0 ? 1 : 0,
  });
}

function pctHex(pct: number): string {
  if (pct < 50) return "#E24B4A";
  if (pct < 80) return "#EF9F27";
  return "#639922";
}

function pctBadgeClass(pct: number): string {
  if (pct < 50) return "text-red-300 bg-red-500/20";
  if (pct < 80) return "text-amber-300 bg-amber-500/20";
  return "text-green-300 bg-green-500/20";
}

// ─── GoalBar ─────────────────────────────────────────────────────────────────

interface GoalBarProps {
  prefix: string;
  actual: number;
  target: number;
  height: number;
  opacity?: number;
}

function GoalBar({ prefix, actual, target, height, opacity = 1 }: GoalBarProps) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const color = target > 0 ? pctHex((actual / target) * 100) : "#6B7280";

  return (
    <div style={{ opacity }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {prefix} {fmt(target)}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">
          {fmt(actual)} / {fmt(target)}
        </span>
      </div>
      <div
        className="w-full rounded-full bg-[var(--color-bg-app)]"
        style={{ height }}
      >
        <div
          className="rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, height, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

export interface MetricCardProps {
  label: string;
  valueQ?: number | null;   // valor del trimestre (solo en modo quarter)
  valueYear: number;         // valor anual
  goalQ?: GoalProgress;      // objetivo trimestral
  goalYear?: GoalProgress;   // objetivo anual
  mode: "quarter" | "annual";
  suffix?: string;
  decimals?: number;
  quarterLabel?: string;     // ej. "Q2 2026"
}

export function MetricCard({
  label,
  valueQ,
  valueYear,
  goalQ,
  goalYear,
  mode,
  suffix,
  decimals = 0,
  quarterLabel = "este Q",
}: MetricCardProps) {
  const isQ = mode === "quarter";
  const primaryValue = isQ ? (valueQ ?? 0) : valueYear;
  const primaryGoal = isQ ? goalQ : goalYear;
  // El % se calcula contra el valor mostrado en la card (no contra el
  // actualValue del goal). Para las métricas comunes da igual (valor == actual),
  // pero permite reusar el MISMO objetivo en métricas derivadas como "Obras
  // ponderadas" y que el % refleje el valor ponderado, no el conteo simple.
  const primaryTarget = primaryGoal?.targetValue ?? null;
  const pct = primaryTarget != null && primaryTarget > 0 ? (primaryValue / primaryTarget) * 100 : null;
  const hasAnyGoal = !!primaryGoal;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 flex flex-col gap-3">
      {/* Label + badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-[var(--color-text-muted)] leading-tight">{label}</p>
        {hasAnyGoal && pct !== null ? (
          <span
            className={`inline-flex shrink-0 items-center px-2 py-0.5 rounded text-[10px] font-semibold ${pctBadgeClass(pct)}`}
          >
            {fmt(pct, 1)}% {isQ ? "obj. Q" : "obj. año"}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center px-2 py-0.5 rounded text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-border)]">
            sin objetivo
          </span>
        )}
      </div>

      {/* Valores */}
      <div className="flex items-end gap-4">
        {/* Valor principal */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-1 leading-none">
            <span className="font-display text-3xl font-bold text-[var(--color-text-primary)]">
              {fmt(primaryValue, decimals)}
            </span>
            {suffix && (
              <span className="text-xs text-[var(--color-text-muted)]">{suffix}</span>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            {isQ ? quarterLabel : "este año"}
          </p>
        </div>

        {/* Valor anual (solo en modo Q) */}
        {isQ && (
          <>
            <div className="w-px self-stretch bg-[var(--color-border)]" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-1 leading-none">
                <span className="font-display text-xl font-semibold text-[var(--color-text-secondary)]">
                  {fmt(valueYear, decimals)}
                </span>
                {suffix && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">{suffix}</span>
                )}
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">en el año</p>
            </div>
          </>
        )}
      </div>

      {/* Barras de progreso */}
      <div className="space-y-2 mt-auto">
        {hasAnyGoal ? (
          <>
            {isQ && goalQ && (
              <GoalBar
                prefix="obj. Q:"
                actual={valueQ ?? 0}
                target={goalQ.targetValue}
                height={4}
              />
            )}
            {goalYear && (
              <GoalBar
                prefix="obj. año:"
                actual={valueYear}
                target={goalYear.targetValue}
                height={isQ ? 3 : 4}
                opacity={isQ ? 0.65 : 1}
              />
            )}
          </>
        ) : (
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Sin objetivo ·{" "}
            <Link to="/admin" className="text-[var(--color-accent)] hover:underline">
              Configurar
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

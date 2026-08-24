import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, AlertTriangle, ArrowRight, Users } from "lucide-react";

import {
  getVentasRiskSummary,
  getVentasLeadsTrabados,
  getVentasEmbudoPorTramo,
  getVentasPorVendedor,
  type CountdownStatus,
} from "../../api/ventasPanel.api";

// ─── helpers de semáforo (mismos que OperationsPanel) ─────────────────────────
const DOT: Record<CountdownStatus, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-500",
  overdue: "bg-red-500",
};
const DAYS_TEXT: Record<CountdownStatus, string> = {
  ok: "text-emerald-400",
  warning: "text-amber-400",
  overdue: "text-red-400",
};
function card(extra = "") {
  return `bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl ${extra}`;
}
function CardHead({ icon, title, meta }: { icon: ReactNode; title: string; meta?: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-tight">{title}</h3>
      {meta && <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">{meta}</span>}
    </div>
  );
}
const LIST = "max-h-[220px] overflow-y-auto -mr-1 pr-1";
const ROW = "flex items-center gap-2 py-1.5 border-t border-[var(--color-border)] first:border-t-0 hover:opacity-80";

function complianceColor(rate: number | null): string {
  if (rate == null) return "text-[var(--color-text-muted)]";
  if (rate >= 85) return "text-emerald-400";
  if (rate >= 70) return "text-amber-400";
  return "text-red-400";
}
function barColor(rate: number | null): string {
  if (rate == null) return "bg-[var(--color-border)]";
  if (rate >= 85) return "bg-emerald-500";
  if (rate >= 70) return "bg-amber-500";
  return "bg-red-500";
}

// ─── contenedor ──────────────────────────────────────────────────────────────
export function SalesPanel() {
  return (
    <section className="mb-6">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
          <h2 className="font-display text-base font-bold text-[var(--color-text-primary)] tracking-tight">
            Ventas · Embudo &amp; SLA
          </h2>
        </div>
        <RiskStrip />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <LeadsTrabadosCard />
        <EmbudoPorTramoCard />
      </div>

      <div className="mt-3">
        <PorVendedorCard />
      </div>
    </section>
  );
}

// ─── tira de riesgo (inline, en el header) ────────────────────────────────────
function RiskStrip() {
  const { data } = useQuery({ queryKey: ["ventas-risk-summary"], queryFn: getVentasRiskSummary, staleTime: 60_000 });
  const s = data ?? { ok: 0, warning: 0, overdue: 0, sinSla: 0, total: 0 };
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-[var(--color-text-muted)]">En riesgo:</span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-red-500" /><b className="tabular-nums text-[var(--color-text-primary)]">{s.overdue}</b> <span className="text-[var(--color-text-muted)]">vencidos</span></span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-amber-500" /><b className="tabular-nums text-[var(--color-text-primary)]">{s.warning}</b> <span className="text-[var(--color-text-muted)]">por vencer</span></span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-500" /><b className="tabular-nums text-[var(--color-text-primary)]">{s.ok}</b> <span className="text-[var(--color-text-muted)]">en plazo</span></span>
      <span className="text-[var(--color-text-muted)]">· de {s.total} leads abiertos</span>
    </div>
  );
}

// ─── Leads trabados ahora ─────────────────────────────────────────────────────
function LeadsTrabadosCard() {
  const { data, isLoading } = useQuery({ queryKey: ["ventas-leads-trabados"], queryFn: getVentasLeadsTrabados, staleTime: 60_000 });
  const rows = data?.rows ?? [];
  return (
    <div className={card("p-3")}>
      <CardHead
        icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
        title="Leads trabados ahora"
        meta={rows.length > 0 ? `${rows.length}` : undefined}
      />
      {isLoading ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Todos en plazo 🎉</p>
      ) : (
        <div className={LIST}>
          {rows.map((r) => {
            const tarde = r.remainingBusinessDays < 0;
            return (
              <Link key={r.id} to="/ventas" className={ROW}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[r.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate leading-tight">
                    {r.clientName}
                    {r.reclamosCount > 0 && <span className="ml-1 text-[10px] font-bold text-red-400">{r.reclamosCount}R</span>}
                  </p>
                  <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">
                    {r.stepLabel}{r.asesorName ? ` · ${r.asesorName}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 leading-tight">
                  <span className={`text-base font-bold tabular-nums ${DAYS_TEXT[r.status]}`}>{r.elapsedBusinessDays}<span className="text-[10px]">d</span></span>
                  <span className={`block text-[9px] ${tarde ? "text-red-400" : "text-[var(--color-text-muted)]"}`}>
                    {tarde ? `+${-r.remainingBusinessDays}d` : `${r.remainingBusinessDays}d`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ¿Dónde se rompe el embudo? ───────────────────────────────────────────────
function EmbudoPorTramoCard() {
  const { data, isLoading } = useQuery({ queryKey: ["ventas-embudo-por-tramo"], queryFn: getVentasEmbudoPorTramo, staleTime: 60_000 });
  const steps = data?.steps ?? [];
  const maxAvg = useMemo(() => Math.max(1, ...steps.map((s) => s.avgDias ?? 0)), [steps]);
  return (
    <div className={card("p-3")}>
      <CardHead icon={<ArrowRight className="w-3.5 h-3.5 text-[var(--color-accent)]" />} title="¿Dónde se rompe el embudo?" />
      {isLoading ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Cargando…</p>
      ) : steps.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Sin datos todavía</p>
      ) : (
        <div className="space-y-2">
          {steps.map((s) => (
            <div key={s.step}>
              <div className="flex items-baseline justify-between gap-2 leading-tight">
                <span className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">{s.stepLabel}</span>
                <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums whitespace-nowrap shrink-0">
                  <b className="text-[var(--color-text-secondary)]">{s.avgDias ?? "—"}d</b>
                  {s.slaDiasHabiles != null && `/${s.slaDiasHabiles}`}
                  {s.complianceRate != null && <span className={`ml-1.5 font-semibold ${complianceColor(s.complianceRate)}`}>{s.complianceRate}%</span>}
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-[var(--color-bg-app)] overflow-hidden">
                <span className={`block h-full rounded-full ${barColor(s.complianceRate)}`} style={{ width: `${Math.min(100, ((s.avgDias ?? 0) / maxAvg) * 100)}%` }} />
              </div>
              {s.masTrabado && (
                <p className="text-[10px] text-[var(--color-text-muted)] truncate leading-tight">
                  🔴 {s.masTrabado.clientName} · <span className="text-red-400 font-semibold tabular-nums">{s.masTrabado.elapsedBusinessDays}d</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Cumplimiento por vendedor (solo lo ve gerencia/admin) ─────────────────────
function PorVendedorCard() {
  const { data, isLoading } = useQuery({ queryKey: ["ventas-por-vendedor"], queryFn: getVentasPorVendedor, staleTime: 60_000 });
  const rows = data?.rows ?? [];
  // Un asesor recibe filas vacías (no ve al resto): la tarjeta no se muestra.
  if (!isLoading && rows.length === 0) return null;
  return (
    <div className={card("p-3")}>
      <CardHead icon={<Users className="w-3.5 h-3.5 text-[var(--color-accent)]" />} title="Cumplimiento por vendedor" />
      {isLoading ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] text-left">
                <th className="py-1 font-medium">Vendedor</th>
                <th className="py-1 font-medium text-right">Abiertos</th>
                <th className="py-1 font-medium text-right">Atrasados</th>
                <th className="py-1 font-medium text-right">En plazo %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.asesorId ?? r.asesorName} className="border-t border-[var(--color-border)]">
                  <td className="py-1.5 text-[var(--color-text-primary)] truncate max-w-[180px]">{r.asesorName}</td>
                  <td className="py-1.5 text-right tabular-nums text-[var(--color-text-secondary)]">{r.leadsAbiertos}</td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${r.atrasados > 0 ? "text-red-400" : "text-[var(--color-text-muted)]"}`}>{r.atrasados}</td>
                  <td className={`py-1.5 text-right tabular-nums font-semibold ${complianceColor(r.complianceRate)}`}>{r.complianceRate != null ? `${r.complianceRate}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

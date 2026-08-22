import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarClock, MessageSquare, ArrowRight, Landmark } from "lucide-react";

import {
  getOpsRiskSummary,
  getOpsSinFechaInstalacion,
  getOpsSinComunicacion,
  getOpsProcesoPorEtapa,
  getOpsUtePanel,
  type CountdownStatus,
  type OpsSinComunicacionRow,
} from "../../api/ops.api";
import { UTE_STAGE_LABEL } from "../../api/uteProcess.api";

// ─── helpers de semáforo ────────────────────────────────────────────────────
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

// Encabezado compacto de tarjeta (icono + título + meta a la derecha).
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

// ─── contenedor ──────────────────────────────────────────────────────────────
export function OperationsPanel() {
  return (
    <section className="mb-6">
      {/* Header + tira de riesgo en una sola línea */}
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-[var(--color-accent)]" />
          <h2 className="font-display text-base font-bold text-[var(--color-text-primary)] tracking-tight">
            Operaciones · Tiempos &amp; SLA
          </h2>
        </div>
        <RiskStrip />
      </div>

      {/* Fila 1: triage + proceso, 3 columnas densas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <SinFechaInstalacionCard />
        <SinComunicacionCard />
        <ProcesoPorEtapaCard />
      </div>

      {/* Fila 2: banda UTE */}
      <div className="mt-3">
        <UteBandCard />
      </div>
    </section>
  );
}

// ─── tira de riesgo (inline, en el header) ────────────────────────────────────
function RiskStrip() {
  const { data } = useQuery({ queryKey: ["ops-risk-summary"], queryFn: getOpsRiskSummary, staleTime: 60_000 });
  const s = data ?? { ok: 0, warning: 0, overdue: 0, sinSla: 0, total: 0 };
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-[var(--color-text-muted)]">En riesgo:</span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-red-500" /><b className="tabular-nums text-[var(--color-text-primary)]">{s.overdue}</b> <span className="text-[var(--color-text-muted)]">vencidos</span></span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-amber-500" /><b className="tabular-nums text-[var(--color-text-primary)]">{s.warning}</b> <span className="text-[var(--color-text-muted)]">por vencer</span></span>
      <span className="inline-flex items-center gap-1.5"><i className="w-2 h-2 rounded-full bg-emerald-500" /><b className="tabular-nums text-[var(--color-text-primary)]">{s.ok}</b> <span className="text-[var(--color-text-muted)]">en plazo</span></span>
      <span className="text-[var(--color-text-muted)]">· de {s.total} activos</span>
    </div>
  );
}

// ─── Sin fecha de instalación ────────────────────────────────────────────────
function SinFechaInstalacionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["ops-sin-fecha-instalacion"],
    queryFn: getOpsSinFechaInstalacion,
    staleTime: 60_000,
  });
  const rows = data?.rows ?? [];

  return (
    <div className={card("p-3")}>
      <CardHead
        icon={<CalendarClock className="w-3.5 h-3.5 text-red-400" />}
        title="Sin fecha de instalación"
        meta={rows.length > 0 ? `${rows.length}` : undefined}
      />
      {isLoading ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Todo agendado 🎉</p>
      ) : (
        <div className={LIST}>
          {rows.map((r) => (
            <Link key={r.id} to={`/projects/${r.id}`} className={ROW}>
              {r.status && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[r.status]}`} />}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate leading-tight">{r.clientName}</p>
                <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">
                  {r.code}{r.capacityKwp != null ? ` · ${r.capacityKwp}kWp` : ""}
                </p>
              </div>
              <span className={`text-base font-bold tabular-nums shrink-0 ${r.status ? DAYS_TEXT[r.status] : "text-[var(--color-text-primary)]"}`}>
                {r.diasDesdeVenta}<span className="text-[10px]">d</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sin comunicación ─────────────────────────────────────────────────────────
function comText(r: OpsSinComunicacionRow): { big: string; note: string } {
  if (r.sinContacto) return { big: "—", note: "Sin contacto" };
  return {
    big: `${r.diasSinContacto}d`,
    note: r.atraso != null && r.atraso > 0 ? `+${r.atraso}d` : "ok",
  };
}

function SinComunicacionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["ops-sin-comunicacion"],
    queryFn: getOpsSinComunicacion,
    staleTime: 60_000,
  });
  const rows = data?.rows ?? [];

  return (
    <div className={card("p-3")}>
      <CardHead
        icon={<MessageSquare className="w-3.5 h-3.5 text-amber-400" />}
        title="Sin comunicación"
        meta={rows.length > 0 ? `${rows.length}` : undefined}
      />
      {isLoading ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Cargando…</p>
      ) : rows.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Todos al día 🎉</p>
      ) : (
        <div className={LIST}>
          {rows.map((r) => {
            const { big, note } = comText(r);
            return (
              <Link key={r.id} to={`/projects/${r.id}`} className={ROW}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate leading-tight">{r.clientName}</p>
                  <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{r.code} · {r.recorrido}</p>
                </div>
                <div className="text-right shrink-0 leading-tight">
                  <span className={`text-base font-bold tabular-nums ${r.sinContacto ? "text-red-400" : "text-amber-400"}`}>{big}</span>
                  <span className={`block text-[9px] ${r.sinContacto ? "text-red-400" : "text-[var(--color-text-muted)]"}`}>{note}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ¿Dónde se rompe el proceso? ──────────────────────────────────────────────
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

function ProcesoPorEtapaCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["ops-proceso-por-etapa"],
    queryFn: getOpsProcesoPorEtapa,
    staleTime: 60_000,
  });
  const stages = data?.stages ?? [];
  const maxAvg = useMemo(() => Math.max(1, ...stages.map((s) => s.avgDias ?? 0)), [stages]);

  return (
    <div className={card("p-3")}>
      <CardHead icon={<ArrowRight className="w-3.5 h-3.5 text-[var(--color-accent)]" />} title="¿Dónde se rompe el proceso?" />
      {isLoading ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Cargando…</p>
      ) : (
        <div className="space-y-2">
          {stages.map((s) => (
            <div key={s.stageName}>
              <div className="flex items-baseline justify-between gap-2 leading-tight">
                <span className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">{s.stageLabel}</span>
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

// ─── Banda UTE (Fase 1b) ──────────────────────────────────────────────────────
function uteStageLabel(s: string): string {
  return (UTE_STAGE_LABEL as Record<string, string>)[s] ?? s;
}

function UteBandCard() {
  const { data, isLoading } = useQuery({ queryKey: ["ops-ute-panel"], queryFn: getOpsUtePanel, staleTime: 60_000 });
  const sinHabilitar = data?.sinHabilitar ?? [];
  const rep = data?.reparto;
  const subs = data?.promedioPorSubEtapa ?? [];
  const maxSub = useMemo(() => Math.max(1, ...subs.map((s) => s.avgDias ?? 0)), [subs]);
  const totalReparto = rep ? Math.max(1, rep.esperandoNosotros + rep.esperandoUTE) : 1;

  return (
    <div className={card("p-3")}>
      <CardHead
        icon={<Landmark className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
        title="Trámites UTE · dónde está la demora"
        meta={rep ? `${rep.totalActivos} activos` : undefined}
      />
      {isLoading ? (
        <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* (a) Sin habilitar por demora desde la venta */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Sin habilitar · demora desde venta</p>
            {sinHabilitar.length === 0 ? (
              <p className="text-[11px] text-[var(--color-text-muted)] py-4 text-center">Sin trámites activos</p>
            ) : (
              <div className={LIST}>
                {sinHabilitar.map((r) => (
                  <Link key={r.id} to={`/projects/${r.id}`} className={ROW}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate leading-tight">{r.clientName}</p>
                      <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{r.code} · {uteStageLabel(r.subEtapa)}</p>
                    </div>
                    {r.esperandoA && (
                      <span className={`text-[9px] font-mono px-1 py-0.5 rounded border shrink-0 ${
                        r.esperandoA === "US" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }`}>
                        {r.esperandoA === "US" ? "Nosotros" : "UTE"}
                      </span>
                    )}
                    <span className="text-base font-bold tabular-nums text-[var(--color-text-primary)] shrink-0">
                      {r.diasDesdeVenta}<span className="text-[10px]">d</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* (b) Reparto de espera nosotros vs UTE */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Espera · nosotros vs. UTE</p>
            {rep && (
              <>
                <div className="flex h-7 rounded-md overflow-hidden text-[10px] font-semibold">
                  <div className="bg-[var(--color-accent)] text-[var(--color-bg-app)] flex items-center px-1.5" style={{ width: `${(rep.esperandoNosotros / totalReparto) * 100}%` }}>
                    {rep.esperandoNosotros > 0 && <span className="truncate">Nosotros {rep.esperandoNosotros}</span>}
                  </div>
                  <div className="bg-amber-500 text-[var(--color-bg-app)] flex items-center justify-end px-1.5 flex-1">
                    <span className="truncate">UTE {rep.esperandoUTE}</span>
                  </div>
                </div>
                <div className="mt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Prom. nuestro</span><span className="font-semibold tabular-nums text-[var(--color-text-primary)]">{rep.avgOurDays ?? "—"}d</span></div>
                  <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Prom. UTE</span><span className="font-semibold tabular-nums text-amber-400">{rep.avgUteDays ?? "—"}d</span></div>
                  <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Espera total</span><span className="font-semibold tabular-nums text-[var(--color-text-primary)]">{rep.avgTotalDays ?? "—"}d</span></div>
                </div>
              </>
            )}
          </div>

          {/* (c) Respuesta UTE por sub-etapa */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">Respuesta UTE por sub-etapa</p>
            <div className="space-y-1.5">
              {subs.map((s) => (
                <div key={s.key}>
                  <div className="flex items-baseline justify-between gap-2 leading-tight">
                    <span className="text-[11px] font-medium text-[var(--color-text-primary)]">{s.label}</span>
                    <span className="text-[10px] tabular-nums text-[var(--color-text-secondary)]">
                      {s.avgDias != null ? `${s.avgDias}d` : "—"}<span className="ml-1 text-[9px] text-[var(--color-text-muted)]">({s.muestras})</span>
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 rounded-full bg-[var(--color-bg-app)] overflow-hidden">
                    <span className="block h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, ((s.avgDias ?? 0) / maxSub) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getCommissionMetrics, getCommissions, type CommissionStatus } from "../api/comisiones.api";
import { ComisionesEvolutionChart } from "../components/comisiones/ComisionesEvolutionChart";
import { usePermission } from "../hooks/usePermission";

const CURRENT_YEAR = new Date().getFullYear();

type StatusFilter = "todas" | "PENDIENTE" | "PAGADA";
type SortKey = "fecha" | "monto";

function fmtUsd(v: number) {
  return "US$ " + v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}
function filterBtn(active: boolean) {
  return `px-2.5 py-1 rounded text-xs font-medium ${
    active
      ? "bg-[var(--color-accent)] text-white"
      : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
  }`;
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        accent
          ? "border-[var(--color-accent)] bg-[var(--color-bg-card)]"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
      }`}
    >
      <p className="text-[11px] text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`font-display font-bold mt-1 ${
          accent ? "text-3xl text-[var(--color-accent)]" : "text-2xl text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: CommissionStatus }) {
  const paid = status === "PAGADA";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
        paid ? "text-green-300 bg-green-500/20" : "text-amber-300 bg-amber-500/20"
      }`}
    >
      {paid ? "Pagada" : "Pendiente"}
    </span>
  );
}

export function ComisionesAsesor() {
  // ADMIN/FINANZAS ven todas; el resto ve solo las propias.
  const canSeeAll = usePermission("FINANZAS", "VIEW");
  const scope = canSeeAll ? "all" : "mine";
  const [year] = useState(CURRENT_YEAR);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todas");
  const [sort, setSort] = useState<SortKey>("fecha");

  const metricsQ = useQuery({
    queryKey: ["commission-metrics", year, scope],
    queryFn: () => getCommissionMetrics({ year }),
  });
  const listQ = useQuery({
    queryKey: ["commissions", scope, year, statusFilter, sort],
    queryFn: () =>
      getCommissions({
        scope,
        year,
        sort,
        status: statusFilter === "todas" ? undefined : statusFilter,
      }),
  });

  const m = metricsQ.data;
  const rows = listQ.data ?? [];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Comisiones</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          {canSeeAll ? "Comisiones de todos los asesores." : "Tus comisiones por ventas cerradas."}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile label="Saldo total a cobrar" value={m ? fmtUsd(m.saldoAcobrarUsd) : "…"} accent />
        <Tile label={`Cobrado en ${year}`} value={m ? fmtUsd(m.cobradoEnAnioUsd) : "…"} />
        <Tile label={`Ventas cerradas ${year}`} value={m ? String(m.ventasCerradas) : "…"} />
      </div>

      {/* Gráfico */}
      {m && <ComisionesEvolutionChart evolucion={m.evolucion} />}

      {/* Tabla */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-[var(--color-border)]">
          <div className="flex gap-1">
            {([
              ["todas", "Todas"],
              ["PENDIENTE", "Pendientes"],
              ["PAGADA", "Pagas"],
            ] as const).map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)} className={filterBtn(statusFilter === v)}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([
              ["fecha", "Por fecha"],
              ["monto", "Por monto"],
            ] as const).map(([v, l]) => (
              <button key={v} onClick={() => setSort(v)} className={filterBtn(sort === v)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {listQ.isLoading ? (
          <p className="p-6 text-center text-sm text-[var(--color-text-muted)]">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--color-text-muted)]">Sin comisiones.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  {canSeeAll && <th className="px-3 py-2 font-medium">Asesor</th>}
                  <th className="px-3 py-2 font-medium">Venta</th>
                  <th className="px-3 py-2 font-medium">Vence</th>
                  <th className="px-3 py-2 font-medium text-right">Monto</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      {c.leadClientName}
                      {c.origenManual && (
                        <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">(manual)</span>
                      )}
                    </td>
                    {canSeeAll && (
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{c.asesorName}</td>
                    )}
                    <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {fmtDate(c.fechaVenta)}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {fmtDate(c.dueDate)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-primary)]">
                      {fmtUsd(c.montoUsd)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

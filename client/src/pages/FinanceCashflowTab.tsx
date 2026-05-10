import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";

import {
  getCashflow,
  updateCashflowEventFecha,
  type CashflowDto,
  type CashflowEvent,
  type CashflowSourceType,
} from "../api/cashflow.api";
import { fmtCurrency, fmtDate } from "../lib/finance";

const SOURCE_LABEL: Record<CashflowSourceType, string> = {
  FIXED_COST: "Costo fijo",
  PROJECT_MATERIAL: "Material proyectado",
  SUPPLIER_DEBT: "Deuda proveedor",
  CLIENT_COBRO: "Cobro pendiente",
};

const SOURCE_TONE: Record<CashflowSourceType, string> = {
  FIXED_COST: "bg-zinc-500/15 text-zinc-300",
  PROJECT_MATERIAL: "bg-blue-500/15 text-blue-400",
  SUPPLIER_DEBT: "bg-yellow-500/15 text-yellow-400",
  CLIENT_COBRO: "bg-green-500/15 text-green-400",
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function formatCurrencyShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

export function FinanceCashflowTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["finance-cashflow"],
    queryFn: getCashflow,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] text-center py-12">Cargando flujo de fondos…</div>
    );
  }

  const entradasTotal = data.events.filter((e) => e.impacto === "POSITIVO").reduce(
    (s, e) => s + (e.moneda === "USD" ? e.monto * data.fallbackUsdToUyu : e.monto),
    0,
  );
  const salidasTotal = data.events.filter((e) => e.impacto === "NEGATIVO").reduce(
    (s, e) => s + (e.moneda === "USD" ? e.monto * data.fallbackUsdToUyu : e.monto),
    0,
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label="Saldo actual (UYU + USD a TC)" value={fmtCurrency(data.timelineUYU[0]?.saldo ?? 0, "UYU")} />
        <Metric
          label="Entradas previstas"
          value={`+${fmtCurrency(entradasTotal, "UYU")}`}
          tone="success"
        />
        <Metric
          label="Salidas previstas"
          value={`-${fmtCurrency(salidasTotal, "UYU")}`}
          tone="danger"
        />
      </div>

      {data.alertaNegativo && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-300">
              El saldo proyectado cae por debajo de cero en los próximos 3 meses
            </p>
            <p className="text-xs text-red-200/80 mt-0.5">
              Mirá la tabla de abajo: los eventos marcados en rojo son los que llevan el saldo a
              negativo. Modificá su fecha o cubrí el evento antes de que ocurra.
            </p>
          </div>
        </div>
      )}

      <CashflowChart data={data} />

      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Eventos proyectados ({data.events.length})
        </h3>
        <CashflowEventTable events={data.events} />
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
        TC USD→UYU usado para consolidar el gráfico: {data.fallbackUsdToUyu.toFixed(2)}. Horizonte: hasta {fmtDate(data.horizonUntil)}.
      </p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const cls =
    tone === "success"
      ? "text-green-400"
      : tone === "danger"
        ? "text-red-400"
        : "text-[var(--color-text-primary)]";
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-5 py-4">
      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-mono mb-1">
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function CashflowChart({ data }: { data: CashflowDto }) {
  const chartData = useMemo(
    () =>
      data.timelineUYU.map((p) => ({
        fechaIso: p.fecha,
        fechaShort: formatDateShort(p.fecha),
        saldo: p.saldo,
        descripcion: p.descripcion,
      })),
    [data.timelineUYU],
  );

  const minSaldo = Math.min(...chartData.map((p) => p.saldo));
  const maxSaldo = Math.max(...chartData.map((p) => p.saldo));

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-mono mb-3">
        Evolución del saldo — próximos 3 meses
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="fechaShort"
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            stroke="var(--color-border)"
          />
          <YAxis
            tickFormatter={formatCurrencyShort}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            stroke="var(--color-border)"
            width={56}
          />
          <Tooltip
            formatter={(value) => [fmtCurrency(Number(value), "UYU"), "Saldo"]}
            labelFormatter={(_label, payload) => {
              const p = payload?.[0]?.payload as { fechaIso?: string; descripcion?: string } | undefined;
              const f = p?.fechaIso ? fmtDate(p.fechaIso) : "";
              return `${f} — ${p?.descripcion ?? ""}`;
            }}
            contentStyle={{
              background: "var(--color-bg-app)",
              border: "1px solid var(--color-border)",
              fontSize: 12,
            }}
          />
          <ReferenceLine y={0} stroke="#e24b4a" strokeDasharray="4 4" />
          {minSaldo < 0 && (
            <ReferenceArea y1={minSaldo} y2={0} fill="#e24b4a" fillOpacity={0.1} />
          )}
          <Line
            type="stepAfter"
            dataKey="saldo"
            stroke="#2438D6"
            strokeWidth={2}
            dot={{ r: 2, fill: "#2438D6" }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
        Saldo arranca en {fmtCurrency(chartData[0]?.saldo ?? 0, "UYU")}
        {minSaldo < 0 && (
          <span className="text-red-400 ml-2">
            · cae a {fmtCurrency(minSaldo, "UYU")} en algún punto
          </span>
        )}
        {maxSaldo > (chartData[0]?.saldo ?? 0) && (
          <span className="ml-2">· pico {fmtCurrency(maxSaldo, "UYU")}</span>
        )}
      </p>
    </div>
  );
}

function CashflowEventTable({ events }: { events: CashflowEvent[] }) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFecha, setEditFecha] = useState<string>("");

  const updateMut = useMutation({
    mutationFn: ({ ev, fecha }: { ev: CashflowEvent; fecha: string }) =>
      updateCashflowEventFecha(ev.sourceType, ev.sourceId, fecha),
    onSuccess: () => {
      toast.success("Fecha actualizada");
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
      setEditingId(null);
    },
    onError: (err) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo actualizar la fecha";
      toast.error(msg);
    },
  });

  if (events.length === 0) {
    return (
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-12 text-center text-sm text-[var(--color-text-muted)]">
        No hay eventos proyectados en los próximos 3 meses.
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-bg-app)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
            <th className="text-left px-4 py-2.5 font-medium">Descripción</th>
            <th className="text-left px-4 py-2.5 font-medium">Tipo</th>
            <th className="text-right px-4 py-2.5 font-medium">Impacto</th>
            <th className="text-left px-4 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {events.map((ev) => {
            const isFixedCost = ev.sourceType === "FIXED_COST";
            const isEditing = editingId === ev.id;
            return (
              <tr
                key={ev.id}
                className={`hover:bg-[var(--color-bg-card-hover)] ${
                  ev.causeNegative ? "bg-red-500/5" : ""
                }`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={editFecha}
                        onChange={(e) => setEditFecha(e.target.value)}
                        className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
                      />
                      <button
                        onClick={() => updateMut.mutate({ ev, fecha: editFecha })}
                        disabled={updateMut.isPending}
                        className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-[var(--color-text-muted)] hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (isFixedCost) {
                          toast(
                            "La fecha de un costo fijo se cambia desde Administración → Costos fijos.",
                            { icon: "ℹ️" },
                          );
                          return;
                        }
                        setEditingId(ev.id);
                        setEditFecha(ev.fecha.slice(0, 10));
                      }}
                      className={`tabular-nums ${
                        isFixedCost
                          ? "text-[var(--color-text-secondary)] cursor-not-allowed"
                          : "text-[var(--color-text-primary)] hover:underline"
                      }`}
                    >
                      {fmtDate(ev.fecha)}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-primary)]">{ev.descripcion}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${SOURCE_TONE[ev.tipo]}`}
                  >
                    {SOURCE_LABEL[ev.tipo]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span
                    className={
                      ev.impacto === "POSITIVO"
                        ? "text-green-400 font-semibold"
                        : "text-red-400 font-semibold"
                    }
                  >
                    {ev.impacto === "POSITIVO" ? "+" : "-"}
                    {fmtCurrency(ev.monto, ev.moneda)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ev.causeNegative && (
                    <span className="text-[11px] text-red-400">← saldo en rojo</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

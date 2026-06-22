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
  type CashflowTimelinePoint,
} from "../api/cashflow.api";
import { fmtCurrency, fmtDate } from "../lib/finance";
import { ResponsiveTable, type Column } from "../components/ui/ResponsiveTable";

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

// Punto sólido para los chips del filtro (SOURCE_TONE usa fondo translúcido).
const SOURCE_DOT: Record<CashflowSourceType, string> = {
  FIXED_COST: "bg-zinc-400",
  PROJECT_MATERIAL: "bg-blue-400",
  SUPPLIER_DEBT: "bg-yellow-400",
  CLIENT_COBRO: "bg-green-400",
};

// Orden estable de los tipos en el filtro.
const TYPE_ORDER: CashflowSourceType[] = [
  "CLIENT_COBRO",
  "SUPPLIER_DEBT",
  "FIXED_COST",
  "PROJECT_MATERIAL",
];

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

  // Tipos de evento ocultos por el filtro (vacío = se muestran todos).
  const [hiddenTypes, setHiddenTypes] = useState<Set<CashflowSourceType>>(new Set());

  if (isLoading || !data) {
    return (
      <div className="text-sm text-[var(--color-text-muted)] text-center py-12">Cargando flujo de fondos…</div>
    );
  }

  const tc = data.fallbackUsdToUyu;
  const toUsd = (monto: number, moneda: "USD" | "UYU") =>
    moneda === "UYU" ? (tc > 0 ? monto / tc : monto) : monto;

  // Tipos presentes en la proyección, para armar el filtro.
  const availableTypes = TYPE_ORDER.filter((t) => data.events.some((e) => e.tipo === t));
  const toggleType = (t: CashflowSourceType) =>
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  // Recalcular proyección + flags con los eventos visibles, partiendo del saldo
  // actual. El histórico (pasado real) no se filtra. Los eventos vienen ya
  // ordenados por fecha desde el backend.
  const saldoInicialProy = data.projectionTimeline[0]?.saldo ?? 0;
  const fechaInicialProy = data.projectionTimeline[0]?.fecha ?? data.historyFrom;
  const projectionTimelineFiltrada: CashflowTimelinePoint[] = [
    { fecha: fechaInicialProy, saldo: saldoInicialProy, descripcion: "Saldo actual" },
  ];
  const visibleEvents: CashflowEvent[] = [];
  let saldoProy = saldoInicialProy;
  let prevSaldoProy = saldoInicialProy;
  for (const ev of data.events) {
    if (hiddenTypes.has(ev.tipo)) continue;
    saldoProy = Math.round((saldoProy + toUsd(ev.monto, ev.moneda) * (ev.impacto === "POSITIVO" ? 1 : -1)) * 100) / 100;
    visibleEvents.push({ ...ev, causeNegative: saldoProy < 0 && prevSaldoProy >= 0 });
    projectionTimelineFiltrada.push({ fecha: ev.fecha, saldo: saldoProy, descripcion: ev.descripcion });
    prevSaldoProy = saldoProy;
  }

  const entradasTotal = visibleEvents
    .filter((e) => e.impacto === "POSITIVO")
    .reduce((s, e) => s + toUsd(e.monto, e.moneda), 0);
  const salidasTotal = visibleEvents
    .filter((e) => e.impacto === "NEGATIVO")
    .reduce((s, e) => s + toUsd(e.monto, e.moneda), 0);

  // Vista derivada para el gráfico y la tabla, ya filtrada.
  const viewData: CashflowDto = {
    ...data,
    events: visibleEvents,
    projectionTimeline: projectionTimelineFiltrada,
    timelineUSD: projectionTimelineFiltrada,
    alertaNegativo: projectionTimelineFiltrada.some((t) => t.saldo < 0),
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric
          label="Saldo actual (USD + UYU a TC)"
          value={fmtCurrency(data.projectionTimeline[0]?.saldo ?? 0, "USD")}
        />
        <Metric
          label="Entradas previstas"
          value={`+${fmtCurrency(entradasTotal, "USD")}`}
          tone="success"
        />
        <Metric
          label="Salidas previstas"
          value={`-${fmtCurrency(salidasTotal, "USD")}`}
          tone="danger"
        />
      </div>

      {availableTypes.length > 0 && (
        <div className="flex items-center flex-wrap gap-2">
          <span className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-mono mr-1">
            Mostrar:
          </span>
          {availableTypes.map((t) => {
            const active = !hiddenTypes.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs transition-colors ${
                  active
                    ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50"
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full ${SOURCE_DOT[t]}`} />
                {SOURCE_LABEL[t]}
              </button>
            );
          })}
          <div className="flex gap-1 ml-1">
            <button
              onClick={() => setHiddenTypes(new Set())}
              className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Todos
            </button>
            <button
              onClick={() => setHiddenTypes(new Set(availableTypes))}
              className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              Ninguno
            </button>
          </div>
        </div>
      )}

      {viewData.alertaNegativo && (
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

      <CashflowChart data={viewData} />

      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          Eventos proyectados ({viewData.events.length})
        </h3>
        <CashflowEventTable events={viewData.events} />
      </div>

      <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
        Gráfico consolidado en USD. TC UYU→USD usado: 1 USD = {data.fallbackUsdToUyu.toFixed(2)} UYU.
        Horizonte: hasta {fmtDate(data.horizonUntil)}.
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
  // Combinamos las 2 series en un solo array. Cada fila lleva `tsMs` (epoch en
  // ms) para usar XAxis con escala TEMPORAL real: cada día ocupa el mismo
  // ancho independientemente de cuántos eventos haya. saldoPasado o saldoFuturo
  // null para que recharts dibuje 2 líneas separadas con connectNulls=false.
  const chartData = useMemo(() => {
    const rows: {
      tsMs: number;
      fechaIso: string;
      saldoPasado: number | null;
      saldoFuturo: number | null;
      descripcion: string;
    }[] = [];
    for (const p of data.historicalTimeline) {
      rows.push({
        tsMs: new Date(p.fecha).getTime(),
        fechaIso: p.fecha,
        saldoPasado: p.saldo,
        saldoFuturo: null,
        descripcion: p.descripcion,
      });
    }
    // El primer punto de la proyección coincide con el último del histórico
    // (mismo timestamp). Lo dejamos como punto "puente": saldoPasado + saldoFuturo
    // ambos seteados para que las 2 líneas se toquen visualmente.
    if (data.projectionTimeline.length > 0 && rows.length > 0) {
      rows[rows.length - 1].saldoFuturo = data.projectionTimeline[0].saldo;
    }
    for (let i = 1; i < data.projectionTimeline.length; i++) {
      const p = data.projectionTimeline[i];
      rows.push({
        tsMs: new Date(p.fecha).getTime(),
        fechaIso: p.fecha,
        saldoPasado: null,
        saldoFuturo: p.saldo,
        descripcion: p.descripcion,
      });
    }
    rows.sort((a, b) => a.tsMs - b.tsMs);
    return rows;
  }, [data.historicalTimeline, data.projectionTimeline]);

  const todayMs = data.projectionTimeline[0]
    ? new Date(data.projectionTimeline[0].fecha).getTime()
    : Date.now();
  const minTs = chartData[0]?.tsMs ?? todayMs;
  const maxTs = chartData[chartData.length - 1]?.tsMs ?? todayMs;
  // Generamos ticks mensuales para que el eje X muestre marcas equiespaciadas
  // (1 por mes) en vez de una por evento.
  const monthlyTicks = useMemo(() => {
    const ticks: number[] = [];
    const start = new Date(minTs);
    start.setUTCDate(1);
    while (start.getTime() <= maxTs) {
      ticks.push(start.getTime());
      start.setUTCMonth(start.getUTCMonth() + 1);
    }
    return ticks;
  }, [minTs, maxTs]);
  const minSaldoFuturo = Math.min(...data.projectionTimeline.map((p) => p.saldo), 0);

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-mono mb-3">
        Evolución del saldo (USD) — últimos 3 meses + próximos 3 meses
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 22, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="tsMs"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={monthlyTicks}
            tickFormatter={(ms) => formatDateShort(new Date(Number(ms)).toISOString())}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            stroke="var(--color-border)"
          />
          <YAxis
            tickFormatter={formatCurrencyShort}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            stroke="var(--color-border)"
            width={64}
          />
          <Tooltip
            formatter={(value, name) => {
              const label = name === "saldoPasado" ? "Pasado" : "Proyección";
              return [fmtCurrency(Number(value), "USD"), label];
            }}
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
          <ReferenceLine y={0} stroke="#e24b4a" strokeDasharray="4 4" strokeOpacity={0.5} />
          {/* Zona roja solo donde el saldo proyectado cae a negativo. */}
          {minSaldoFuturo < 0 && (
            <ReferenceArea y1={minSaldoFuturo} y2={0} fill="#e24b4a" fillOpacity={0.1} />
          )}
          {/* Línea vertical de "Hoy" con etiqueta. */}
          <ReferenceLine
            x={todayMs}
            stroke="var(--color-text-primary)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            label={{
              value: "Hoy",
              position: "top",
              fill: "var(--color-text-primary)",
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          <Line
            type="monotone"
            dataKey="saldoPasado"
            stroke="#5A6578"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            name="saldoPasado"
          />
          <Line
            type="stepAfter"
            dataKey="saldoFuturo"
            stroke="#2438D6"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "#2438D6" }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 1.5 }}
            connectNulls={false}
            isAnimationActive={false}
            name="saldoFuturo"
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Leyenda */}
      <div className="flex items-center gap-5 mt-3 pt-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] flex-wrap">
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-0.5" style={{ background: "#5A6578" }} />
          <span>Pasado (real)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-[2.5px]" style={{ background: "#2438D6" }} />
          <span>Proyección (futuro)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3" style={{ background: "rgba(226,75,74,0.18)" }} />
          <span>Saldo bajo / negativo</span>
        </div>
      </div>
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

  const columns: Column<CashflowEvent>[] = [
    {
      key: "fecha", label: "Fecha", className: "whitespace-nowrap",
      render: (ev) => {
        const isFixedCost = ev.sourceType === "FIXED_COST";
        const isEditing = editingId === ev.id;
        return isEditing ? (
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
              className="tap-target text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="tap-target text-xs text-[var(--color-text-muted)] hover:underline"
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
        );
      },
    },
    {
      key: "descripcion", label: "Descripción", cardRole: "title",
      className: "text-[var(--color-text-primary)]",
      render: (ev) => (
        <>
          <span>{ev.descripcion}</span>
          {ev.causeNegative && (
            <div className="text-[11px] text-red-400">← saldo en rojo</div>
          )}
        </>
      ),
    },
    {
      key: "tipo", label: "Tipo",
      render: (ev) => (
        <span
          className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${SOURCE_TONE[ev.tipo]}`}
        >
          {SOURCE_LABEL[ev.tipo]}
        </span>
      ),
    },
    {
      key: "impacto", label: "Impacto", align: "right", cardRole: "highlight",
      render: (ev) => (
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
      ),
    },
  ];

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <ResponsiveTable
          columns={columns}
          data={events}
          rowKey={(ev) => ev.id}
          rowClassName={(ev) => (ev.causeNegative ? "bg-red-500/5" : undefined)}
        />
      </div>
    </div>
  );
}

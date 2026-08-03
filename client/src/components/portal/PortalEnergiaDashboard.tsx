import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getPortalEnergia, type PortalEnergiaMes } from "../../api/portal.api";

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function mesCorto(periodo: string): string {
  const [a, m] = periodo.split("-");
  return `${MESES[Number(m) - 1] ?? m} ${a.slice(2)}`;
}

const fmtKwh = (v: number | null) =>
  v == null ? "—" : `${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)} kWh`;
const fmtUsd = (v: number) => `US$ ${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)}`;
const fmtPesos = (v: number) => `$${new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v)}`;

const COLOR_GEN = "#f59e0b"; // ámbar (generación)
const COLOR_CONS = "#3b82f6"; // azul (consumo)
const COLOR_AHORRO = "#10b981"; // verde (ahorro)

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`mt-0.5 font-display font-bold ${
          accent ? "text-2xl text-[var(--color-accent)]" : "text-xl text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const chartTooltip = {
  contentStyle: {
    background: "var(--color-bg-app)",
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    fontSize: 11,
    color: "var(--color-text-primary)",
  },
  labelStyle: { color: "var(--color-text-primary)", fontWeight: 600 },
  itemStyle: { color: "var(--color-text-primary)" },
};

export function PortalEnergiaDashboard() {
  const { data: generadores = [], isLoading } = useQuery({
    queryKey: ["portal-energia"],
    queryFn: getPortalEnergia,
  });

  const [sel, setSel] = useState<string | null>(null);
  const generador = useMemo(
    () => generadores.find((g) => g.projectId === sel) ?? generadores[0] ?? null,
    [generadores, sel],
  );

  const chartData = useMemo(
    () =>
      (generador?.meses ?? []).map((m: PortalEnergiaMes) => ({
        mes: mesCorto(m.periodo),
        Generación: m.generacionKwh,
        Consumo: m.consumoKwh,
        ahorroUsd: m.ahorroAcumuladoUsd,
      })),
    [generador],
  );

  if (isLoading || !generador || generador.meses.length === 0) return null;

  const ultimo = generador.meses[generador.meses.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">Mi energía</h2>
        {generadores.length > 1 && (
          <select
            value={generador.projectId}
            onChange={(e) => setSel(e.target.value)}
            aria-label="Elegir generador"
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
          >
            {generadores.map((g) => (
              <option key={g.projectId} value={g.projectId}>
                {g.projectName}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* KPIs del último mes */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label={`Ahorro ${mesCorto(ultimo.periodo)}`} value={fmtPesos(ultimo.ahorroTotal)} accent />
        <Kpi label="Ahorro acumulado" value={fmtUsd(ultimo.ahorroAcumuladoUsd)} />
        <Kpi label={`Generación ${mesCorto(ultimo.periodo)}`} value={fmtKwh(ultimo.generacionKwh)} />
        <Kpi label="Retorno de la inversión" value={`${ultimo.retornoInversionPct.toFixed(0)}%`} />
      </div>

      {/* Generación vs consumo */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          Generación vs. consumo por mes
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={40}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                cursor={{ fill: "var(--color-bg-card-hover)", opacity: 0.4 }}
                formatter={(v) => fmtKwh(Number(v))}
                {...chartTooltip}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Generación" fill={COLOR_GEN} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Consumo" fill={COLOR_CONS} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ahorro acumulado en USD */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
          Ahorro acumulado (USD)
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id="ahorroGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLOR_AHORRO} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={COLOR_AHORRO} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip formatter={(v) => fmtUsd(Number(v))} {...chartTooltip} />
              <Area
                type="monotone"
                dataKey="ahorroUsd"
                name="Ahorro acumulado"
                stroke={COLOR_AHORRO}
                fill="url(#ahorroGrad)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

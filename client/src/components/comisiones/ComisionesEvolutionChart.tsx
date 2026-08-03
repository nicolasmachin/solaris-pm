import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CommissionMetrics } from "../../api/comisiones.api";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const COLOR_COBRADA = "#10b981"; // verde
const COLOR_GENERADA = "#3b82f6"; // azul

function fmtUsd(v: number) {
  return "US$ " + v.toLocaleString("es-UY", { maximumFractionDigits: 0 });
}

export function ComisionesEvolutionChart({ evolucion }: { evolucion: CommissionMetrics["evolucion"] }) {
  const data = evolucion.map((e) => ({
    mes: MESES[e.mes - 1] ?? String(e.mes),
    Cobradas: e.cobradas,
    Generadas: e.generadas,
  }));
  const hasData = evolucion.some((e) => e.cobradas || e.generadas);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Evolución mensual</p>
      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 mb-3">
        Cobradas por mes de pago · generadas por mes de venta.
      </p>
      {!hasData ? (
        <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
          Sin comisiones para mostrar en el año.
        </p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)" }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                cursor={{ fill: "var(--color-bg-card-hover)", opacity: 0.4 }}
                contentStyle={{
                  background: "var(--color-bg-app)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 11,
                  color: "var(--color-text-primary)",
                }}
                labelStyle={{ color: "var(--color-text-primary)", fontWeight: 600 }}
                itemStyle={{ color: "var(--color-text-primary)" }}
                formatter={(v) => fmtUsd(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Cobradas" fill={COLOR_COBRADA} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Generadas" fill={COLOR_GENERADA} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

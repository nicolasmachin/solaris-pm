import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getSoporteEvolucion, type SoporteGrupo } from "../api/soporte.api";
import { Spinner } from "../components/ui/Spinner";
import { useTheme } from "../hooks/useTheme";

// Tab "Evolución" de Soporte: cómo van los tickets abiertos y las plantas con
// problema, día por día. El server reconstruye cada día con las fechas de
// apertura y cierre (ver soporte.routes.ts → evolucion()).

const RANGOS = [
  { dias: 30, label: "30 días" },
  { dias: 90, label: "3 meses" },
  { dias: 180, label: "6 meses" },
  { dias: 365, label: "1 año" },
];

// Orden fijo (el de la mesa) y colores fijos por tipo: el color sigue al tipo,
// no a su posición. Paleta categórica validada para daltonismo, con un tono
// por modo.
const TIPOS: Array<{ grupo: SoporteGrupo; label: string; claro: string; oscuro: string }> = [
  { grupo: "FALLA", label: "Falla del inversor", claro: "#2a78d6", oscuro: "#3987e5" },
  { grupo: "NO_GENERA", label: "No genera", claro: "#eb6834", oscuro: "#d95926" },
  { grupo: "NO_COMUNICA", label: "No comunica", claro: "#1baf7a", oscuro: "#199e70" },
  { grupo: "GENERA_MENOS", label: "Genera menos", claro: "#eda100", oscuro: "#c98500" },
  { grupo: "MEDIDOR", label: "Medidor mal conectado", claro: "#e87ba4", oscuro: "#d55181" },
  { grupo: "NO_EXPORTA", label: "No exporta", claro: "#008300", oscuro: "#008300" },
  { grupo: "SIN_DATOS", label: "Sin datos de la plataforma", claro: "#4a3aa7", oscuro: "#9085e9" },
];
const AZUL = { claro: "#2a78d6", oscuro: "#3987e5" };

const tooltip = {
  contentStyle: {
    background: "var(--color-bg-app)",
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--color-text-primary)",
  },
  labelStyle: { color: "var(--color-text-primary)", fontWeight: 600 },
  itemStyle: { color: "var(--color-text-primary)" },
};
const ejeTick = { fill: "var(--color-text-muted)", fontSize: 11 };
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const fechaLarga = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("es-UY", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function SoporteEvolucion() {
  const { isDark } = useTheme();
  const [dias, setDias] = useState(90);
  const { data, isLoading } = useQuery({
    queryKey: ["soporte-evolucion", dias],
    queryFn: () => getSoporteEvolucion(dias),
  });

  const filas = useMemo(
    () =>
      (data?.dias ?? []).map((d) => ({
        dia: d.dia,
        tickets: d.ticketsAbiertos,
        nuevos: d.ticketsNuevos,
        total: TIPOS.reduce((s, t) => s + d.problemas[t.grupo], 0),
        ...d.problemas,
      })),
    [data],
  );

  if (isLoading || !data) return <Spinner />;

  const hoy = filas[filas.length - 1];
  const primero = filas[0];
  // Solo los tipos que aparecieron en el rango: los que siempre dieron cero no
  // suman nada a la gráfica ni a la leyenda.
  const tiposConDatos = TIPOS.filter((t) => filas.some((f) => f[t.grupo] > 0));
  const color = (c: { claro: string; oscuro: string }) => (isDark ? c.oscuro : c.claro);
  const antesDe = (desde: string | null) => desde != null && desde > data.desde;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {RANGOS.map((r) => (
          <button
            key={r.dias}
            type="button"
            onClick={() => setDias(r.dias)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              dias === r.dias
                ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-semibold text-[var(--color-text-primary)]">Tickets abiertos</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Cuántos tickets había sin resolver al final de cada día (abiertos, derivados o en progreso).
            </p>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Hoy <span className="font-display text-2xl font-bold text-[var(--color-text-primary)]">{hoy.tickets}</span>
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              {variacion(hoy.tickets - primero.tickets)} desde el {ddmm(primero.dia)} ·{" "}
              {filas.reduce((s, f) => s + f.nuevos, 0)} nuevos en el período
            </span>
          </p>
        </div>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filas} margin={{ top: 8, right: 20, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tickFormatter={ddmm} tick={ejeTick} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis allowDecimals={false} tick={ejeTick} tickLine={false} axisLine={false} />
              <Tooltip
                {...tooltip}
                labelFormatter={(d) => fechaLarga(String(d))}
                formatter={(v, name) => [v, name === "tickets" ? "Abiertos" : "Nuevos ese día"]}
              />
              <Area
                type="stepAfter"
                dataKey="tickets"
                stroke={color(AZUL)}
                strokeWidth={2}
                fill={color(AZUL)}
                fillOpacity={0.15}
                isAnimationActive={false}
              />
              <Area type="stepAfter" dataKey="nuevos" stroke="none" fill="none" isAnimationActive={false} legendType="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {antesDe(data.desdeTickets) && (
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Hay tickets registrados desde el {ddmm(data.desdeTickets!)}; antes de esa fecha el cero es falta de registro.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-semibold text-[var(--color-text-primary)]">Plantas con problema, por tipo</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Problemas abiertos al final de cada día, de la revisión automática y del monitoreo diario. Una planta con el
              mismo problema visto por los dos cuenta una vez; los descartados no cuentan.
            </p>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Hoy <span className="font-display text-2xl font-bold text-[var(--color-text-primary)]">{hoy.total}</span>
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              {variacion(hoy.total - primero.total)} desde el {ddmm(primero.dia)}
            </span>
          </p>
        </div>

        {/* Leyenda con el valor de hoy: identifica cada color con su nombre y su número. */}
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {tiposConDatos.map((t) => (
            <li key={t.grupo} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(t) }} />
              {t.label}
              <span className="font-semibold text-[var(--color-text-primary)]">{hoy[t.grupo]}</span>
            </li>
          ))}
        </ul>

        <div className="mt-2 h-72">
          {tiposConDatos.length === 0 ? (
            <p className="pt-10 text-center text-sm text-[var(--color-text-muted)]">No hubo problemas en este período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={filas} margin={{ top: 8, right: 20, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={ddmm} tick={ejeTick} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={ejeTick} tickLine={false} axisLine={false} />
                <Tooltip
                  {...tooltip}
                  labelFormatter={(d) => fechaLarga(String(d))}
                  formatter={(v, name) => [v, TIPOS.find((t) => t.grupo === name)?.label ?? name]}
                  itemSorter={(item) => TIPOS.findIndex((t) => t.grupo === item.dataKey)}
                />
                {tiposConDatos.map((t) => (
                  <Area
                    key={t.grupo}
                    type="stepAfter"
                    dataKey={t.grupo}
                    stackId="p"
                    stroke="var(--color-bg-card)"
                    strokeWidth={1}
                    fill={color(t)}
                    fillOpacity={0.9}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        {antesDe(data.desdeProblemas) && (
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Hay registro de problemas desde el {ddmm(data.desdeProblemas!)}; antes de esa fecha el cero es falta de registro.
          </p>
        )}
      </section>
    </div>
  );
}

function variacion(n: number) {
  if (n === 0) return "sin cambios";
  return n > 0 ? `+${n}` : `−${-n}`;
}

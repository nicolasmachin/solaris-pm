import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getGastoIA, type FilaGastoIA } from "../../api/ai-usage.api";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const COLOR_GASTO = "#3b82f6";

function fmtUsd(v: number) {
  // Montos chicos: con dos decimales "US$ 0,00" escondería el gasto real.
  const decimales = v > 0 && v < 1 ? 3 : 2;
  return "US$ " + v.toLocaleString("es-UY", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

function fmtMiles(n: number) {
  return n.toLocaleString("es-UY");
}

function etiquetaMes(mes: string) {
  const [anio, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${String(anio).slice(2)}`;
}

/** Los `n` meses terminados en el actual, del más viejo al más nuevo ("2026-05"…"2026-10"). */
function ultimosMeses(desde: string, n: number) {
  const [anio, m] = desde.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(anio, m - 1 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

function sumar(filas: FilaGastoIA[]) {
  return filas.reduce(
    (acc, f) => ({
      costo: acc.costo + f.costUsd,
      llamadas: acc.llamadas + f.llamadas,
      errores: acc.errores + f.errores,
      sinPrecio: acc.sinPrecio + f.sinPrecio,
    }),
    { costo: 0, llamadas: 0, errores: 0, sinPrecio: 0 },
  );
}

function Tarjeta({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--color-text-primary)] tabular-nums">{valor}</p>
      {detalle && <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{detalle}</p>}
    </div>
  );
}

const N_MESES = 6;

export function TabGastoIA() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ai-usage", N_MESES],
    queryFn: () => getGastoIA(N_MESES),
  });

  const vista = useMemo(() => {
    if (!data) return null;
    const meses = ultimosMeses(data.desde, N_MESES);
    const mesActual = meses[meses.length - 1];
    const mesAnterior = meses[meses.length - 2];
    const delMes = (mes: string) => data.filas.filter((f) => f.mes === mes);

    const porMes = meses.map((mes) => ({ mes: etiquetaMes(mes), costo: sumar(delMes(mes)).costo }));

    const porFuncion = new Map<string, { label: string; actual: number; anterior: number; total: number; llamadas: number }>();
    const porModelo = new Map<string, { provider: string; llamadas: number; tokensIn: number; tokensOut: number; audio: number; costo: number }>();
    for (const f of data.filas) {
      const fn = porFuncion.get(f.feature) ?? { label: f.featureLabel, actual: 0, anterior: 0, total: 0, llamadas: 0 };
      if (f.mes === mesActual) fn.actual += f.costUsd;
      if (f.mes === mesAnterior) fn.anterior += f.costUsd;
      fn.total += f.costUsd;
      fn.llamadas += f.llamadas;
      porFuncion.set(f.feature, fn);

      const mo = porModelo.get(f.model) ?? { provider: f.provider, llamadas: 0, tokensIn: 0, tokensOut: 0, audio: 0, costo: 0 };
      mo.llamadas += f.llamadas;
      mo.tokensIn += f.tokensInput;
      mo.tokensOut += f.tokensOutput;
      mo.audio += f.audioSegundos;
      mo.costo += f.costUsd;
      porModelo.set(f.model, mo);
    }

    return {
      mesActual,
      actual: sumar(delMes(mesActual)),
      anterior: sumar(delMes(mesAnterior)),
      total: sumar(data.filas),
      porMes,
      porFuncion: [...porFuncion.values()].sort((a, b) => b.total - a.total),
      porModelo: [...porModelo.entries()].sort((a, b) => b[1].costo - a[1].costo),
    };
  }, [data]);

  if (isLoading) return <p className="text-sm text-[var(--color-text-muted)]">Cargando…</p>;
  if (isError || !data || !vista) {
    return <p className="text-sm text-red-500">No se pudo cargar el gasto de IA.</p>;
  }

  const desdeRegistro = data.primerRegistro
    ? new Date(data.primerRegistro).toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Gasto de IA</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Lo que gasta Voltia PM en inteligencia artificial (Claude y la transcripción de audios), por función y por
          modelo. Montos en dólares, calculados con la tarifa de cada modelo.
        </p>
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
          {desdeRegistro ? `Se mide desde el ${desdeRegistro}; lo anterior no quedó registrado.` : "Todavía no hay registros."}{" "}
          El bot de Telegram no está incluido: usa otra clave y su gasto se ve en la consola de Anthropic.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tarjeta
          titulo={`Este mes (${etiquetaMes(vista.mesActual)})`}
          valor={fmtUsd(vista.actual.costo)}
          detalle={`${fmtMiles(vista.actual.llamadas)} llamadas`}
        />
        <Tarjeta
          titulo="Mes anterior"
          valor={fmtUsd(vista.anterior.costo)}
          detalle={`${fmtMiles(vista.anterior.llamadas)} llamadas`}
        />
        <Tarjeta
          titulo={`Últimos ${N_MESES} meses`}
          valor={fmtUsd(vista.total.costo)}
          detalle={
            vista.total.errores > 0
              ? `${fmtMiles(vista.total.errores)} llamadas fallaron (no se cobran)`
              : "Sin llamadas fallidas"
          }
        />
      </div>

      {vista.total.sinPrecio > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠️ {fmtMiles(vista.total.sinPrecio)} llamadas usaron un modelo que no está en la tabla de precios: su costo no
          está sumado. Hay que agregar ese modelo a la tabla.
        </p>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Gasto por mes</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vista.porMes} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
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
                tickFormatter={(v: number) => `$${v}`}
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
                formatter={(v) => [fmtUsd(Number(v)), "Gasto"]}
              />
              <Bar dataKey="costo" fill={COLOR_GASTO} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <p className="px-4 pt-4 text-sm font-semibold text-[var(--color-text-primary)]">Por función</p>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-2 font-medium">Función</th>
              <th className="px-4 py-2 text-right font-medium">Este mes</th>
              <th className="px-4 py-2 text-right font-medium">Mes anterior</th>
              <th className="px-4 py-2 text-right font-medium">{N_MESES} meses</th>
              <th className="px-4 py-2 text-right font-medium">Llamadas</th>
            </tr>
          </thead>
          <tbody>
            {vista.porFuncion.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                  Sin uso registrado en el período.
                </td>
              </tr>
            )}
            {vista.porFuncion.map((f) => (
              <tr key={f.label} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 text-[var(--color-text-primary)]">{f.label}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-primary)]">{fmtUsd(f.actual)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtUsd(f.anterior)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtUsd(f.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtMiles(f.llamadas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <p className="px-4 pt-4 text-sm font-semibold text-[var(--color-text-primary)]">Por modelo ({N_MESES} meses)</p>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
              <th className="px-4 py-2 font-medium">Modelo</th>
              <th className="px-4 py-2 text-right font-medium">Llamadas</th>
              <th className="px-4 py-2 text-right font-medium">Tokens entrada</th>
              <th className="px-4 py-2 text-right font-medium">Tokens salida</th>
              <th className="px-4 py-2 text-right font-medium">Gasto</th>
            </tr>
          </thead>
          <tbody>
            {vista.porModelo.map(([modelo, m]) => (
              <tr key={modelo} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 font-mono text-xs text-[var(--color-text-primary)]">{modelo}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">{fmtMiles(m.llamadas)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                  {m.provider === "openai" ? "—" : fmtMiles(m.tokensIn)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                  {m.provider === "openai" ? `${fmtMiles(Math.round(m.audio / 60))} min de audio` : fmtMiles(m.tokensOut)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-[var(--color-text-primary)]">{fmtUsd(m.costo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getUteQuarterlyEvolution,
  type UteQuarter,
  type UteResponsible,
  type UteTendencia,
} from '../../api/uteProcess.api';

const COLOR_TOTAL = '#a78bfa';
const COLOR_VOLTIA = '#10b981';
const COLOR_UTE = '#fb923c';

function colorForResponsible(r: UteResponsible) {
  return r === 'VOLTIA' ? COLOR_VOLTIA : COLOR_UTE;
}

export function UteEvolutionChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['ute-quarterly-evolution'],
    queryFn: getUteQuarterlyEvolution,
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <div className="h-64 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
          Cargando evolución…
        </div>
      </div>
    );
  }

  if (data.quarters.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Evolución de tiempos UTE</p>
        <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          Aún no hay etapas cerradas en los últimos trimestres.
        </p>
      </div>
    );
  }

  const tramiteValues = data.quarters.map((q) => ({
    label: q.label,
    value: q.tiempoTotalDias.promedio,
    n: q.cantidadTramitesFinalizados,
  }));
  const voltiaValues = data.quarters.map((q) => ({
    label: q.label,
    value: q.tiempoVoltiaDias.promedio,
    n: q.cantidadTramitesFinalizados,
  }));
  const uteValues = data.quarters.map((q) => ({
    label: q.label,
    value: q.tiempoUteDias.promedio,
    n: q.cantidadTramitesFinalizados,
  }));
  const totalFinalizados = data.quarters.reduce((s, q) => s + q.cantidadTramitesFinalizados, 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Evolución de tiempos UTE</p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          Tarjetas grandes: promedio por trámite finalizado en el Q. Mini cards: cada etapa
          cerrada asignada al Q de su cierre. Tendencia vs promedio últimos 4 Q.
        </p>
        {totalFinalizados === 0 && (
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1 italic">
            Aún no hay trámites finalizados. Las 3 tarjetas grandes se llenan al cerrar el primero;
            mientras tanto las mini cards muestran la evolución por etapa.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TrendCard
          title="Tiempo Total"
          subtitle="Por trámite finalizado (suma todas las etapas)"
          color={COLOR_TOTAL}
          tendencia={data.tendencias.tiempoTotal}
          values={tramiteValues}
        />
        <TrendCard
          title="Tiempo Voltia"
          subtitle="Por trámite: suma de etapas Voltia"
          color={COLOR_VOLTIA}
          tendencia={data.tendencias.tiempoVoltia}
          values={voltiaValues}
        />
        <TrendCard
          title="Tiempo UTE"
          subtitle="Por trámite: suma de etapas UTE"
          color={COLOR_UTE}
          tendencia={data.tendencias.tiempoUte}
          values={uteValues}
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
          Por etapa
        </p>
        <StagesGrid quarters={data.quarters} />
      </div>
    </div>
  );
}

function TrendCard({
  title,
  subtitle,
  color,
  tendencia,
  values,
}: {
  title: string;
  subtitle: string;
  color: string;
  tendencia: UteTendencia;
  values: Array<{ label: string; value: number | null; n: number }>;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">{title}</p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
          <div className="mt-2">
            <TrendBadge tendencia={tendencia} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold tabular-nums leading-none" style={{ color }}>
            {tendencia.ultimoQ != null ? tendencia.ultimoQ : '—'}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">días</p>
        </div>
      </div>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={values} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-text-muted)', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-bg-card-hover)', opacity: 0.4 }}
              contentStyle={{
                background: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 11,
                padding: '6px 10px',
                color: 'var(--color-text-primary)',
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: 2 }}
              itemStyle={{ color: 'var(--color-text-primary)' }}
              formatter={(value, _name, item) => {
                const n = (item?.payload?.n as number | undefined) ?? 0;
                return [`${value} días (${n} trámite${n === 1 ? '' : 's'})`, 'Promedio'];
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {values.map((_, i) => (
                <Cell key={i} fill={i === values.length - 1 ? color : `${color}80`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendBadge({ tendencia }: { tendencia: UteTendencia }) {
  const { direccion, cambio, promedioUltimos4Q } = tendencia;
  if (cambio == null || promedioUltimos4Q == null) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]">
        <Minus className="w-3 h-3" />
        sin datos
      </span>
    );
  }
  const sign = cambio > 0 ? '+' : '';
  if (direccion === 'MEJORANDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-400">
        <TrendingDown className="w-3 h-3" />
        {sign}{cambio}% vs últimos 4Q
      </span>
    );
  }
  if (direccion === 'EMPEORANDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-red-500/15 text-red-400">
        <TrendingUp className="w-3 h-3" />
        {sign}{cambio}% vs últimos 4Q
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-[var(--color-bg-card-hover)] text-[var(--color-text-secondary)]">
      <Minus className="w-3 h-3" />
      {sign}{cambio}% vs últimos 4Q
    </span>
  );
}

function StagesGrid({ quarters }: { quarters: UteQuarter[] }) {
  const last = quarters[quarters.length - 1];
  if (!last) return null;

  // Para cada stage, sumar count en todos los Q y filtrar las que nunca tienen
  // datos (esto evita mini-cards vacías para etapas que aún no ocurrieron).
  const stageList = last.porEtapa
    .map((stage) => {
      const series = quarters.map((q) => {
        const s = q.porEtapa.find((e) => e.stageName === stage.stageName);
        return { label: q.label, value: s?.promedio ?? null };
      });
      const totalObs = quarters.reduce((s, q) => {
        const e = q.porEtapa.find((e) => e.stageName === stage.stageName);
        return s + (e?.count ?? 0);
      }, 0);
      return { stage, series, totalObs };
    })
    .filter((s) => s.totalObs > 0);

  if (stageList.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
        Sin etapas cerradas para mostrar.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {stageList.map(({ stage, series, totalObs }) => (
        <MiniTrendCard
          key={stage.stageName}
          label={stage.stageLabel}
          responsible={stage.responsible}
          current={stage.promedio}
          totalObs={totalObs}
          series={series}
        />
      ))}
    </div>
  );
}

function MiniTrendCard({
  label,
  responsible,
  current,
  totalObs,
  series,
}: {
  label: string;
  responsible: UteResponsible;
  current: number | null;
  totalObs: number;
  series: Array<{ label: string; value: number | null }>;
}) {
  const color = colorForResponsible(responsible);
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <p className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">{label}</p>
          </div>
          <p className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono mt-0.5">
            {responsible === 'VOLTIA' ? 'Voltia' : 'UTE'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold tabular-nums leading-none" style={{ color }}>
            {current != null ? current : '—'}
            <span className="text-[10px] ml-0.5 text-[var(--color-text-muted)]">d</span>
          </p>
          <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 font-mono">{totalObs} obs</p>
        </div>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Tooltip
              cursor={{ fill: 'var(--color-bg-card-hover)', opacity: 0.4 }}
              contentStyle={{
                background: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 10,
                padding: '4px 8px',
                color: 'var(--color-text-primary)',
              }}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 600 }}
              itemStyle={{ color: 'var(--color-text-primary)' }}
              formatter={(value) => [`${value} días`, 'Promedio']}
            />
            <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {series.map((_, i) => (
                <Cell key={i} fill={i === series.length - 1 ? color : `${color}80`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

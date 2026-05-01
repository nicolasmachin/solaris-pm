import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getUteQuarterlyEvolution,
  type UteQuarter,
  type UteQuarterlyEvolution,
  type UteResponsible,
  type UteTendencia,
} from '../../api/uteProcess.api';

const COLOR_TOTAL = '#a78bfa';
const COLOR_VOLTIA = '#10b981';
const COLOR_UTE = '#fb923c';

function colorForResponsible(r: UteResponsible) {
  return r === 'VOLTIA' ? COLOR_VOLTIA : COLOR_UTE;
}

function klass(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(' ');
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
          Aún no hay trámites finalizados para mostrar evolución.
        </p>
      </div>
    );
  }

  const hasFinalizationData =
    data.tendencias.tiempoTotal.ultimoQ != null ||
    data.tendencias.tiempoVoltia.ultimoQ != null ||
    data.tendencias.tiempoUte.ultimoQ != null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Evolución de tiempos UTE</p>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          Últimos 8 trimestres con datos. Tendencia comparada vs promedio últimos 4 Q.
          {!hasFinalizationData && (
            <span className="ml-1 text-[var(--color-text-muted)]">
              · Aún no hay trámites finalizados; los totales se completan al cerrar el primero.
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TrendCard
          title="Tiempo Total"
          subtitle="Trámite completo de punta a punta"
          color={COLOR_TOTAL}
          tendencia={data.tendencias.tiempoTotal}
          values={data.quarters.map((q) => ({ label: q.label, value: q.tiempoTotalDias.promedio }))}
        />
        <TrendCard
          title="Tiempo Voltia"
          subtitle="Días bajo nuestra responsabilidad"
          color={COLOR_VOLTIA}
          tendencia={data.tendencias.tiempoVoltia}
          values={data.quarters.map((q) => ({ label: q.label, value: q.tiempoVoltiaDias.promedio }))}
        />
        <TrendCard
          title="Tiempo UTE"
          subtitle="Días esperando respuesta de UTE"
          color={COLOR_UTE}
          tendencia={data.tendencias.tiempoUte}
          values={data.quarters.map((q) => ({ label: q.label, value: q.tiempoUteDias.promedio }))}
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
  values: Array<{ label: string; value: number | null }>;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">{title}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <p className="text-3xl font-semibold tabular-nums" style={{ color }}>
            {tendencia.ultimoQ != null ? tendencia.ultimoQ : '—'}
            <span className="text-base ml-0.5 text-[var(--color-text-muted)]">d</span>
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            {values[values.length - 1]?.label ?? ''}
          </p>
        </div>
        <TrendBadge tendencia={tendencia} />
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={values} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: 'var(--color-text-muted)', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: 'var(--color-text-muted)', fontFamily: 'monospace' }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 11,
              }}
              labelStyle={{ color: 'var(--color-text-secondary)' }}
              formatter={(value) => [`${value}d`, 'Promedio']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={{ r: 2.5, fill: color }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
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
        {sign}{cambio}%
      </span>
    );
  }
  if (direccion === 'EMPEORANDO') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-red-500/15 text-red-400">
        <TrendingUp className="w-3 h-3" />
        {sign}{cambio}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-[var(--color-bg-card-hover)] text-[var(--color-text-secondary)]">
      <Minus className="w-3 h-3" />
      {sign}{cambio}%
    </span>
  );
}

function StagesGrid({ quarters }: { quarters: UteQuarter[] }) {
  const last = quarters[quarters.length - 1];
  if (!last) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {last.porEtapa.map((stage) => {
        const series = quarters.map((q) => {
          const s = q.porEtapa.find((e) => e.stageName === stage.stageName);
          return { label: q.label, value: s?.promedio ?? null };
        });
        return (
          <MiniTrendCard
            key={stage.stageName}
            label={stage.stageLabel}
            responsible={stage.responsible}
            current={stage.promedio}
            count={stage.count}
            series={series}
          />
        );
      })}
    </div>
  );
}

function MiniTrendCard({
  label,
  responsible,
  current,
  count,
  series,
}: {
  label: string;
  responsible: UteResponsible;
  current: number | null;
  count: number;
  series: Array<{ label: string; value: number | null }>;
}) {
  const color = colorForResponsible(responsible);
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <p className="text-[11px] font-medium text-[var(--color-text-primary)] truncate flex-1">{label}</p>
      </div>
      <div className="flex items-baseline justify-between">
        <p className={klass('text-xl font-semibold tabular-nums')} style={{ color }}>
          {current != null ? current : '—'}
          <span className="text-[10px] ml-0.5 text-[var(--color-text-muted)]">d</span>
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
          {count} obs
        </p>
      </div>
      <div className="h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 10,
                padding: '4px 8px',
              }}
              labelStyle={{ color: 'var(--color-text-secondary)' }}
              formatter={(value) => [`${value}d`, 'Promedio']}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={1.6}
              dot={{ r: 1.8, fill: color }}
              activeDot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

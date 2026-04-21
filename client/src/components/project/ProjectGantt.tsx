import { memo, useMemo, useState, type CSSProperties } from "react";
import type { ProjectGanttResponse, ProjectGanttStage } from "../../types/api.types";

// ─── Constantes de diseño ─────────────────────────────────────────────────────

const PLAN_COLOR = "#5DCAA5";
const REAL_COLOR = "#378ADD";
const INSTALL_COLOR = "#EF9F27";
const TODAY_COLOR = "#EF9F27";

const ROW_HEIGHT = 28;
const ROW_HEIGHT_OPS = 32;
const BAR_HEIGHT = 8;
const REAL_BAR_HEIGHT_OPS = 12;
const INSTALL_BAR_HEIGHT = 8;
const HEADER_HEIGHT = 24;
const LABEL_WIDTH = 140;
const LABEL_WIDTH_NARROW = 100;
const PADDING_PCT = 5; // % de padding a cada lado del rango temporal

const STRIPED = `repeating-linear-gradient(45deg, ${REAL_COLOR} 0, ${REAL_COLOR} 5px, transparent 5px, transparent 10px)`;

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

export type GanttInstallationBlock = {
  id: string;
  plannedWorkStart: string;
  plannedWorkEnd: string;
  teamName: string;
  clientName?: string;
};

type Tooltip = {
  x: number;
  y: number;
  title: string;
  lines: Array<{ text: string; color?: string }>;
};

// ─── Helpers de fechas ────────────────────────────────────────────────────────

function parseUtcDate(s: string | null): Date | null {
  if (!s) return null;
  // s puede ser YYYY-MM-DD o ISO datetime; en ambos casos queremos día UTC
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  const d = new Date(dateOnly ? `${s}T00:00:00Z` : s);
  return isNaN(d.getTime()) ? null : d;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function diffDaysUtc(from: Date, to: Date): number {
  return Math.round((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS);
}

function addDaysUtc(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function formatShortDate(d: Date, narrow = false): string {
  if (narrow) return `${MONTH_INITIAL[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}`;
  return `${MONTH_SHORT_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
}

function formatDayLabel(d: Date): string {
  return `${d.getUTCDate()} ${MONTH_SHORT_ES[d.getUTCMonth()]}`;
}

const MONTH_SHORT_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_INITIAL = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// ─── Cálculo del rango temporal ───────────────────────────────────────────────

type TimeRange = {
  start: Date; // con padding aplicado
  end: Date; // con padding aplicado
  totalMs: number;
  rawStart: Date;
  rawEnd: Date;
};

function computeRange(
  stages: ProjectGanttStage[],
  installations: GanttInstallationBlock[],
): TimeRange | null {
  const dates: Date[] = [];
  for (const s of stages) {
    for (const v of [s.plannedStart, s.plannedEnd, s.actualStart, s.actualEnd]) {
      const d = parseUtcDate(v);
      if (d) dates.push(d);
    }
  }
  for (const i of installations) {
    const a = parseUtcDate(i.plannedWorkStart);
    const b = parseUtcDate(i.plannedWorkEnd);
    if (a) dates.push(a);
    if (b) dates.push(b);
  }
  // Incluir hoy si tiene sentido (proyecto corriendo)
  dates.push(todayUtc());

  if (dates.length === 0) return null;

  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  const rawStart = startOfUtcDay(min);
  const rawEnd = startOfUtcDay(max);
  const span = Math.max(rawEnd.getTime() - rawStart.getTime(), DAY_MS);
  const padMs = (span * PADDING_PCT) / 100;
  const start = new Date(rawStart.getTime() - padMs);
  const end = new Date(rawEnd.getTime() + padMs);
  return {
    start,
    end,
    totalMs: end.getTime() - start.getTime(),
    rawStart,
    rawEnd,
  };
}

function pctFor(date: Date, range: TimeRange): number {
  return ((date.getTime() - range.start.getTime()) / range.totalMs) * 100;
}

function widthPctBetween(from: Date, to: Date, range: TimeRange): number {
  const a = pctFor(from, range);
  const b = pctFor(to, range);
  return Math.max(b - a, 0.4); // mínimo visible
}

// ─── Marcas del header (meses o semanas) ──────────────────────────────────────

type AxisMark = { label: string; pct: number; isMonthStart?: boolean };

function buildAxisMarks(range: TimeRange, narrow: boolean): AxisMark[] {
  const totalDays = (range.end.getTime() - range.start.getTime()) / DAY_MS;
  const marks: AxisMark[] = [];

  if (totalDays < 90) {
    // Semanas: lunes de cada semana dentro del rango
    let cursor = new Date(range.start);
    // Avanzar al próximo lunes
    const dow = cursor.getUTCDay();
    const offsetToMonday = dow === 0 ? 1 : (8 - dow) % 7;
    cursor = addDaysUtc(cursor, offsetToMonday);
    while (cursor.getTime() <= range.end.getTime()) {
      marks.push({
        label: formatDayLabel(cursor),
        pct: pctFor(cursor, range),
      });
      cursor = addDaysUtc(cursor, 7);
    }
  } else {
    // Meses: día 1 de cada mes
    let cursor = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1));
    if (cursor.getTime() < range.start.getTime()) {
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    while (cursor.getTime() <= range.end.getTime()) {
      marks.push({
        label: formatShortDate(cursor, narrow),
        pct: pctFor(cursor, range),
        isMonthStart: true,
      });
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
  }
  return marks;
}

// ─── Tooltip helpers ──────────────────────────────────────────────────────────

function formatDateRangeForTooltip(startIso: string | null, endIso: string | null): string {
  if (!startIso && !endIso) return "—";
  const s = startIso ? formatDayLabel(parseUtcDate(startIso)!) : "—";
  const e = endIso ? formatDayLabel(parseUtcDate(endIso)!) : "—";
  return `${s} → ${e}`;
}

function formatDelay(delayDays: number | null): { text: string; color: string } | null {
  if (delayDays === null) return null;
  if (delayDays === 0) return { text: "Sin desvío", color: "#9ca3af" };
  if (delayDays > 0) return { text: `+${delayDays} días`, color: "#f87171" };
  return { text: `${delayDays} días`, color: "#5DCAA5" };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const ProjectGantt = memo(function ProjectGantt({
  data,
  installationSchedules = [],
}: {
  data: ProjectGanttResponse;
  installationSchedules?: GanttInstallationBlock[];
}) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [narrow, setNarrow] = useState(false);

  // Detectar viewport estrecho con ResizeObserver simple
  // Usamos un ref callback para mediar sin useLayoutEffect
  const containerRef = (el: HTMLDivElement | null) => {
    if (!el) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setNarrow(entry.contentRect.width < 900);
    });
    observer.observe(el);
    // Nota: no devolvemos cleanup porque el ref callback no lo soporta;
    // el observer se desreferencia cuando React desmonta el nodo.
  };

  const range = useMemo(
    () => computeRange(data.stages, installationSchedules),
    [data.stages, installationSchedules],
  );

  const today = useMemo(() => todayUtc(), []);

  if (!range) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 text-sm text-[var(--color-text-secondary)]">
        Las fechas planificadas no están cargadas. Editá las etapas para agregar fechas.
      </div>
    );
  }

  const axisMarks = buildAxisMarks(range, narrow);
  const todayPct = pctFor(today, range);
  const todayInRange = todayPct >= 0 && todayPct <= 100;

  const labelWidth = narrow ? LABEL_WIDTH_NARROW : LABEL_WIDTH;

  // Alto total para la línea de hoy (header + filas)
  const totalRowsHeight = data.stages.reduce(
    (acc, s) => acc + (s.name === "OPERACIONES" ? ROW_HEIGHT_OPS : ROW_HEIGHT),
    0,
  );

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
    >
      <Legend />

      <div className="relative" style={{ display: "flex" }}>
        {/* Columna de labels */}
        <div style={{ width: labelWidth, flexShrink: 0 }}>
          <div
            className="border-b border-[var(--color-border)]"
            style={{ height: HEADER_HEIGHT }}
          />
          {data.stages.map((stage) => (
            <div
              key={stage.id}
              style={{
                height: stage.name === "OPERACIONES" ? ROW_HEIGHT_OPS : ROW_HEIGHT,
                display: "flex",
                alignItems: "center",
                paddingRight: 8,
                fontSize: narrow ? 10 : 11,
                color: "var(--color-text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={stage.label}
            >
              {stage.label}
            </div>
          ))}
        </div>

        {/* Área de chart */}
        <div className="relative flex-1 min-w-0">
          {/* Header con marcas */}
          <div
            className="relative border-b border-[var(--color-border)]"
            style={{ height: HEADER_HEIGHT }}
          >
            {axisMarks.map((mark, i) => (
              <span
                key={i}
                className="absolute top-1 font-mono text-[var(--color-text-muted)]"
                style={{
                  left: `${mark.pct}%`,
                  fontSize: 10,
                  transform: "translateX(2px)",
                }}
              >
                {mark.label}
              </span>
            ))}
          </div>

          {/* Líneas verticales guía */}
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{ top: HEADER_HEIGHT, height: totalRowsHeight }}
          >
            {axisMarks.map((mark, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${mark.pct}%`,
                  borderLeft: "1px dashed var(--color-border)",
                  opacity: 0.4,
                }}
              />
            ))}
          </div>

          {/* Filas de stages */}
          {data.stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              range={range}
              today={today}
              installations={
                stage.name === "OPERACIONES" ? installationSchedules : []
              }
              onTooltip={setTooltip}
              onClearTooltip={() => setTooltip(null)}
            />
          ))}

          {/* Línea de "Hoy" */}
          {todayInRange && (
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${todayPct}%`,
                top: 0,
                bottom: 0,
                borderLeft: `1px solid ${TODAY_COLOR}`,
                zIndex: 5,
              }}
            >
              <span
                className="absolute font-mono"
                style={{
                  top: 2,
                  left: 4,
                  fontSize: 9,
                  color: TODAY_COLOR,
                  whiteSpace: "nowrap",
                }}
              >
                Hoy
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tooltip flotante */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, maxWidth: 260 }}
        >
          <p className="mb-1 font-semibold text-[var(--color-text-primary)]">{tooltip.title}</p>
          {tooltip.lines.map((l, i) => (
            <p key={i} style={{ color: l.color ?? "var(--color-text-secondary)" }}>
              {l.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Leyenda ──────────────────────────────────────────────────────────────────

function Legend() {
  const items: Array<{ kind: "swatch" | "stripe" | "line"; color: string; label: string }> = [
    { kind: "swatch", color: PLAN_COLOR, label: "Plan" },
    { kind: "swatch", color: REAL_COLOR, label: "Real" },
    { kind: "stripe", color: REAL_COLOR, label: "En curso" },
    { kind: "swatch", color: INSTALL_COLOR, label: "Instalación" },
    { kind: "line", color: TODAY_COLOR, label: "Hoy" },
  ];
  return (
    <div className="mb-4 flex flex-wrap items-center" style={{ gap: 16 }}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          {item.kind === "swatch" ? (
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 6,
                borderRadius: 2,
                background: item.color,
              }}
            />
          ) : item.kind === "stripe" ? (
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 6,
                borderRadius: 2,
                background: STRIPED,
              }}
            />
          ) : (
            <span
              style={{
                display: "inline-block",
                width: 1,
                height: 12,
                background: item.color,
              }}
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Fila de stage ────────────────────────────────────────────────────────────

function StageRow({
  stage,
  range,
  today,
  installations,
  onTooltip,
  onClearTooltip,
}: {
  stage: ProjectGanttStage;
  range: TimeRange;
  today: Date;
  installations: GanttInstallationBlock[];
  onTooltip: (t: Tooltip) => void;
  onClearTooltip: () => void;
}) {
  const isOps = stage.name === "OPERACIONES";
  const rowHeight = isOps ? ROW_HEIGHT_OPS : ROW_HEIGHT;
  const realBarHeight = isOps ? REAL_BAR_HEIGHT_OPS : BAR_HEIGHT;

  const plannedStart = parseUtcDate(stage.plannedStart);
  const plannedEnd = parseUtcDate(stage.plannedEnd);
  const actualStart = parseUtcDate(stage.actualStart);
  const actualEnd = parseUtcDate(stage.actualEnd);

  // Posición vertical: plan arriba, real abajo, separación 4px
  const planTop = 4;
  const realTop = 4 + BAR_HEIGHT + 4;

  const showPending = stage.status === "PENDING";

  function planTooltip(e: React.MouseEvent) {
    onTooltip({
      x: e.clientX,
      y: e.clientY,
      title: stage.label,
      lines: [
        { text: `Plan: ${formatDateRangeForTooltip(stage.plannedStart, stage.plannedEnd)}` },
        actualStart || actualEnd
          ? { text: `Real: ${formatDateRangeForTooltip(stage.actualStart, stage.actualEnd)}` }
          : { text: "Real: —" },
        ...(formatDelay(stage.delayDays)
          ? [{ text: `Desvío: ${formatDelay(stage.delayDays)!.text}`, color: formatDelay(stage.delayDays)!.color }]
          : []),
      ],
    });
  }

  function installTooltip(e: React.MouseEvent, inst: GanttInstallationBlock) {
    onTooltip({
      x: e.clientX,
      y: e.clientY,
      title: inst.clientName ?? "Instalación",
      lines: [
        { text: `Equipo: ${inst.teamName}` },
        { text: formatDateRangeForTooltip(inst.plannedWorkStart, inst.plannedWorkEnd) },
      ],
    });
  }

  return (
    <div className="relative" style={{ height: rowHeight }}>
      {/* Barra plan */}
      {plannedStart && plannedEnd && (
        <div
          className="absolute"
          style={{
            left: `${pctFor(plannedStart, range)}%`,
            width: `${widthPctBetween(plannedStart, plannedEnd, range)}%`,
            top: planTop,
            height: BAR_HEIGHT,
            background: PLAN_COLOR,
            opacity: showPending ? 0.5 : 1,
            borderRadius: 3,
            cursor: "default",
          }}
          onMouseEnter={planTooltip}
          onMouseMove={planTooltip}
          onMouseLeave={onClearTooltip}
        />
      )}

      {/* Texto "Sin iniciar" */}
      {showPending && plannedEnd && (
        <span
          className="absolute font-mono text-[var(--color-text-muted)]"
          style={{
            left: `calc(${pctFor(plannedEnd, range)}% + 4px)`,
            top: planTop - 1,
            fontSize: 9,
            whiteSpace: "nowrap",
          }}
        >
          Sin iniciar
        </span>
      )}

      {/* Barra real (solo si ya inició) */}
      {!showPending && actualStart && (
        <RealBars
          stage={stage}
          actualStart={actualStart}
          actualEnd={actualEnd}
          plannedEnd={plannedEnd}
          today={today}
          range={range}
          top={realTop}
          height={realBarHeight}
          onTooltip={planTooltip}
          onClearTooltip={onClearTooltip}
        />
      )}

      {/* Bloques de instalación (solo en Operaciones) */}
      {installations.map((inst) => {
        const start = parseUtcDate(inst.plannedWorkStart);
        const end = parseUtcDate(inst.plannedWorkEnd);
        if (!start || !end) return null;
        const barCenter = realTop + realBarHeight / 2;
        const installTop = barCenter - INSTALL_BAR_HEIGHT / 2;
        return (
          <div
            key={inst.id}
            className="absolute"
            style={{
              left: `${pctFor(start, range)}%`,
              width: `${widthPctBetween(start, end, range)}%`,
              top: installTop,
              height: INSTALL_BAR_HEIGHT,
              background: INSTALL_COLOR,
              borderRadius: 2,
              zIndex: 3,
              cursor: "default",
            }}
            onMouseEnter={(e) => installTooltip(e, inst)}
            onMouseMove={(e) => installTooltip(e, inst)}
            onMouseLeave={onClearTooltip}
          />
        );
      })}
    </div>
  );
}

function RealBars({
  stage,
  actualStart,
  actualEnd,
  plannedEnd,
  today,
  range,
  top,
  height,
  onTooltip,
  onClearTooltip,
}: {
  stage: ProjectGanttStage;
  actualStart: Date;
  actualEnd: Date | null;
  plannedEnd: Date | null;
  today: Date;
  range: TimeRange;
  top: number;
  height: number;
  onTooltip: (e: React.MouseEvent) => void;
  onClearTooltip: () => void;
}) {
  const baseStyle: CSSProperties = {
    position: "absolute",
    top,
    height,
    borderRadius: 3,
    cursor: "default",
  };

  const handlers = {
    onMouseEnter: onTooltip,
    onMouseMove: onTooltip,
    onMouseLeave: onClearTooltip,
  };

  if (stage.status === "COMPLETED") {
    const end = actualEnd ?? today;
    return (
      <div
        style={{
          ...baseStyle,
          left: `${pctFor(actualStart, range)}%`,
          width: `${widthPctBetween(actualStart, end, range)}%`,
          background: REAL_COLOR,
        }}
        {...handlers}
      />
    );
  }

  // IN_PROGRESS
  // Solid: actualStart → min(plannedEnd, today)
  // Striped: si today > plannedEnd → desde plannedEnd a today
  // Si no hay plannedEnd, todo el tramo actualStart → today va sólido
  const referenceEnd = plannedEnd ?? today;
  const solidEnd = referenceEnd.getTime() <= today.getTime() ? referenceEnd : today;
  const stripedNeeded = plannedEnd !== null && today.getTime() > plannedEnd.getTime();

  return (
    <>
      <div
        style={{
          ...baseStyle,
          left: `${pctFor(actualStart, range)}%`,
          width: `${widthPctBetween(actualStart, solidEnd, range)}%`,
          background: REAL_COLOR,
        }}
        {...handlers}
      />
      {stripedNeeded && plannedEnd && (
        <div
          style={{
            ...baseStyle,
            left: `${pctFor(plannedEnd, range)}%`,
            width: `${widthPctBetween(plannedEnd, today, range)}%`,
            background: STRIPED,
          }}
          {...handlers}
        />
      )}
    </>
  );
}

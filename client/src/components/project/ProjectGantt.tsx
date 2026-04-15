import { memo, useMemo, useState } from "react";
import type { ProjectGanttResponse, ProjectGanttStage } from "../../types/api.types";

const DAY = 24 * 60 * 60 * 1000;

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY);
}

function stageColor(stage: ProjectGanttStage) {
  if (stage.status === "COMPLETED") return "#79bcff";
  if (stage.status === "IN_PROGRESS") return "#ffd84d";
  return "rgba(79, 166, 255, 0.42)";
}

function buildAxisMarks(start: Date, end: Date) {
  const totalDays = Math.max(diffDays(start, end), 1);
  const marks: Array<{ label: string; offset: number }> = [];

  if (totalDays < 90) {
    const cursor = new Date(start);
    while (cursor <= end) {
      marks.push({
        label: `Sem ${Math.ceil(cursor.getDate() / 7)}`,
        offset: diffDays(start, cursor),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      marks.push({
        label: cursor.toLocaleDateString("es-UY", { month: "short", year: "2-digit" }),
        offset: diffDays(start, cursor),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return marks;
}

export const ProjectGantt = memo(function ProjectGantt({ data }: { data: ProjectGanttResponse }) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    stage: ProjectGanttStage;
  } | null>(null);

  const stagesWithPlan = data.stages.filter((stage) => stage.plannedStart && stage.plannedEnd);

  const timeline = useMemo(() => {
    if (stagesWithPlan.length === 0) return null;

    const candidates = stagesWithPlan.flatMap((stage) =>
      [stage.plannedStart, stage.plannedEnd, stage.actualStart, stage.actualEnd].filter(Boolean).map((value) => new Date(value!)),
    );
    const start = new Date(Math.min(...candidates.map((date) => startOfDay(date).getTime())));
    const end = new Date(Math.max(...candidates.map((date) => startOfDay(date).getTime())));
    const today = startOfDay(new Date());
    const totalDays = Math.max(diffDays(start, end), 1);

    return {
      start,
      end,
      totalDays,
      todayOffset: diffDays(start, today),
      axisMarks: buildAxisMarks(start, end),
    };
  }, [stagesWithPlan]);

  if (!timeline) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 text-sm text-[var(--color-text-secondary)]">
        Las fechas planificadas no están cargadas. Editá las etapas para agregar fechas.
      </div>
    );
  }

  const rowHeight = 52;
  const labelWidth = 150;
  const chartWidth = 720;
  const chartHeight = data.stages.length * rowHeight + 50;

  return (
    <div className="relative overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <svg width={labelWidth + chartWidth + 24} height={chartHeight}>
        <g transform={`translate(${labelWidth}, 12)`}>
          {timeline.axisMarks.map((mark) => {
            const x = (mark.offset / timeline.totalDays) * chartWidth;
            return (
              <g key={`${mark.label}-${mark.offset}`}>
                <line x1={x} x2={x} y1={0} y2={chartHeight - 36} stroke="var(--color-border)" strokeDasharray="3 3" />
                <text
                  x={x + 4}
                  y={12}
                  fill="var(--color-text-muted)"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                >
                  {mark.label}
                </text>
              </g>
            );
          })}

          {timeline.todayOffset >= 0 && timeline.todayOffset <= timeline.totalDays && (
            <g>
              <line
                x1={(timeline.todayOffset / timeline.totalDays) * chartWidth}
                x2={(timeline.todayOffset / timeline.totalDays) * chartWidth}
                y1={0}
                y2={chartHeight - 36}
                stroke="#ffd84d"
                strokeWidth="2"
              />
              <text
                x={(timeline.todayOffset / timeline.totalDays) * chartWidth + 6}
                y={24}
                fill="#ffd84d"
                fontSize="10"
                fontFamily="var(--font-mono)"
              >
                Hoy
              </text>
            </g>
          )}

          {data.stages.map((stage, index) => {
            const y = 34 + index * rowHeight;
            const plannedStart = toDate(stage.plannedStart);
            const plannedEnd = toDate(stage.plannedEnd);
            const actualStart = toDate(stage.actualStart);
            const actualEnd = toDate(stage.actualEnd);

            if (!plannedStart || !plannedEnd) {
              return null;
            }

            const plannedX = (diffDays(timeline.start, plannedStart) / timeline.totalDays) * chartWidth;
            const plannedWidth = (Math.max(diffDays(plannedStart, plannedEnd), 1) / timeline.totalDays) * chartWidth;
            const actualBaseStart = actualStart ?? plannedStart;
            const actualBaseEnd =
              stage.status === "COMPLETED"
                ? actualEnd ?? plannedEnd
                : stage.status === "IN_PROGRESS"
                  ? new Date()
                  : plannedEnd;
            const actualX = (diffDays(timeline.start, actualBaseStart) / timeline.totalDays) * chartWidth;
            const actualWidth = (Math.max(diffDays(actualBaseStart, actualBaseEnd), 1) / timeline.totalDays) * chartWidth;
            const overflowWidth =
              actualBaseEnd > plannedEnd
                ? (Math.max(diffDays(plannedEnd, actualBaseEnd), 1) / timeline.totalDays) * chartWidth
                : 0;

            return (
              <g key={stage.id}>
                <text
                  x={-12}
                  y={y + 14}
                  textAnchor="end"
                  fill="var(--color-text-primary)"
                  fontSize="12"
                >
                  {stage.label}
                </text>

                <rect
                  x={plannedX}
                  y={y}
                  width={plannedWidth}
                  height={12}
                  rx={6}
                  fill="rgba(148, 163, 184, 0.25)"
                />

                <rect
                  x={actualX}
                  y={y + 2}
                  width={actualWidth}
                  height={8}
                  rx={4}
                  fill={stageColor(stage)}
                  className={stage.status === "IN_PROGRESS" ? "animate-pulse" : undefined}
                  onMouseEnter={(event) =>
                    setTooltip({
                      x: event.clientX,
                      y: event.clientY,
                      stage,
                    })
                  }
                  onMouseMove={(event) =>
                    setTooltip({
                      x: event.clientX,
                      y: event.clientY,
                      stage,
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                />

                {overflowWidth > 0 && (
                  <rect
                    x={plannedX + plannedWidth}
                    y={y + 2}
                    width={overflowWidth}
                    height={8}
                    rx={4}
                    fill="rgba(248, 113, 113, 0.85)"
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-xs shadow-xl"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12, maxWidth: 240 }}
        >
          <p className="mb-1 font-semibold text-[var(--color-text-primary)]">{tooltip.stage.label}</p>
          <p className="text-[var(--color-text-secondary)]">
            Plan: {tooltip.stage.plannedStart ?? "—"} → {tooltip.stage.plannedEnd ?? "—"}
          </p>
          <p className="text-[var(--color-text-secondary)]">
            Real: {tooltip.stage.actualStart ?? "—"} → {tooltip.stage.actualEnd ?? (tooltip.stage.status === "IN_PROGRESS" ? "En curso" : "—")}
          </p>
          <p className="text-[var(--color-text-secondary)]">
            Desvío: {tooltip.stage.delayDays !== null ? `${tooltip.stage.delayDays > 0 ? "+" : ""}${tooltip.stage.delayDays} días` : "—"}
          </p>
        </div>
      ) : null}
    </div>
  );
});

import type { CSSProperties } from "react";

import type { Stage } from "../../types/api.types";
import {
  AREA_COLOR,
  AREA_LABEL,
  PARALLEL_SPAN,
  isParallelStage,
  stageArea,
  stageLabel,
} from "../../constants/stages";
import { CountdownBadge, StageDoneBadge } from "../ui/StageTimeBadge";

interface Props {
  stages: Stage[];
  onStageClick: (stage: Stage) => void;
}

function deriveDisplayStatus(stage: Stage): Stage["status"] {
  if (stage.status === "BLOCKED") return "BLOCKED";
  if (stage.progressPercent >= 100) return "COMPLETED";
  if (stage.progressPercent > 0) return "IN_PROGRESS";
  return "PENDING";
}

function subDotColor(status: Stage["substages"][number]["status"]): string {
  if (status === "COMPLETED") return "var(--color-pipe-done-dot)";
  if (status === "IN_PROGRESS") return "var(--color-pipe-active-dot)";
  if (status === "BLOCKED") return "var(--color-danger-text)";
  return "var(--color-text-muted)";
}

// Fondo/borde de la card según el estado. Completada = verde (claramente
// identificable), en curso = acento, bloqueada = rojo, pendiente = neutra.
const CARD_BG: Record<Stage["status"], string> = {
  COMPLETED: "var(--color-pipe-done-bg)",
  IN_PROGRESS: "var(--color-pipe-active-bg)",
  BLOCKED: "var(--color-danger-bg)",
  PENDING: "var(--color-bg-card)",
};
const CARD_BORDER: Record<Stage["status"], string> = {
  COMPLETED: "var(--color-pipe-done-border)",
  IN_PROGRESS: "var(--color-accent)",
  BLOCKED: "color-mix(in srgb, var(--color-danger-text) 40%, transparent)",
  PENDING: "var(--color-border)",
};

function StageCard({ stage, onClick, gridColumn }: { stage: Stage; onClick: () => void; gridColumn?: string }) {
  const display = deriveDisplayStatus(stage);
  const area = stageArea(stage.name);
  const isActive = display === "IN_PROGRESS";
  const isDone = display === "COMPLETED";

  return (
    <button
      onClick={onClick}
      style={{
        gridColumn,
        textAlign: "left",
        cursor: "pointer",
        background: CARD_BG[display],
        border: `1px solid ${CARD_BORDER[display]}`,
        boxShadow: isActive ? "0 0 0 1px var(--color-accent)" : "none",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: display === "PENDING" ? 0.82 : 1,
        padding: 0,
      }}
    >
      {/* strip por área */}
      <div style={{ height: 3, width: "100%", background: AREA_COLOR[area] }} />

      <div style={{ padding: "8px 9px 6px", flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            lineHeight: 1.2,
            marginBottom: 2,
          }}
        >
          <span style={{ color: "var(--color-accent)" }}>{stage.order}.</span> {stageLabel(stage.name)}
        </div>
        <div style={{ fontSize: 9, color: "var(--color-text-muted)", marginBottom: 5 }}>
          {AREA_LABEL[area]}
          {isActive && ` · ${stage.progressPercent}%`}
          {isDone && " · ✓"}
        </div>

        {/* Tiempo / plazo de la etapa: cuenta regresiva si está en curso,
            duración + cumplimiento si está completada. */}
        {isActive && stage.countdown && (
          <div style={{ marginBottom: 6 }}>
            <CountdownBadge countdown={stage.countdown} />
          </div>
        )}
        {isDone && (
          <div style={{ marginBottom: 6 }}>
            <StageDoneBadge actualDurationDays={stage.actualDurationDays} countdown={stage.countdown} />
          </div>
        )}

        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {stage.substages
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((sub) => (
              <li
                key={sub.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 5,
                  fontSize: 9.5,
                  color: "var(--color-text-secondary)",
                  lineHeight: 1.3,
                  padding: "1px 0",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: subDotColor(sub.status),
                    marginTop: 5,
                  }}
                />
                <span>{sub.name}</span>
              </li>
            ))}
        </ul>
      </div>
    </button>
  );
}

export function PipelineExpandido({ stages, onStageClick }: Props) {
  const linear = stages.filter((s) => !isParallelStage(s.name)).sort((a, b) => a.order - b.order);
  const parallels = stages.filter((s) => isParallelStage(s.name));
  const cols = linear.length;
  if (cols === 0) return null;

  const gridCols: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, minmax(150px, 1fr))`,
    gap: 6,
    alignItems: "stretch",
  };

  const colIndex = (name: string) => linear.findIndex((s) => s.name === name);
  // Posición (rango de columnas) de cada carril paralelo según PARALLEL_SPAN.
  const lanes = parallels
    .map((p) => {
      const span = PARALLEL_SPAN[p.name];
      if (!span) return null;
      const a = colIndex(span.from);
      const b = colIndex(span.to);
      if (a < 0 || b < 0) return null;
      return { p, start: Math.min(a, b), end: Math.max(a, b) };
    })
    .filter((x): x is { p: Stage; start: number; end: number } => x !== null);

  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--color-text-muted)",
          marginBottom: 12,
        }}
      >
        Pipeline de etapas — Experiencia Solar en paralelo
      </p>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: cols * 156 }}>
          {/* Etapas (pipeline lineal) */}
          <div style={gridCols}>
            {linear.map((s) => (
              <StageCard key={s.id} stage={s} onClick={() => onStageClick(s)} />
            ))}
          </div>

          {/* Etapas paralelas de Experiencia Solar: mismo diseño (StageCard),
              posicionadas como carriles que abarcan varias columnas. */}
          {lanes.length > 0 && (
            <div style={{ ...gridCols, marginTop: 6 }}>
              {lanes.map(({ p, start, end }) => (
                <StageCard
                  key={p.id}
                  stage={p}
                  onClick={() => onStageClick(p)}
                  gridColumn={`${start + 1} / ${end + 2}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

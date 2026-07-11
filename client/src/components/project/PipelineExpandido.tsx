import type { CSSProperties } from "react";

import type { Stage } from "../../types/api.types";
import {
  AREA_COLOR,
  AREA_LABEL,
  PARALLEL_SPAN,
  STAGE_TRASPASO,
  isParallelStage,
  stageArea,
  stageLabel,
} from "../../constants/stages";

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

const chipStyle: CSSProperties = {
  background: "var(--color-bg-card-hover)",
  border: "1px solid var(--color-border)",
  color: "var(--color-accent)",
  fontWeight: 700,
  borderRadius: 4,
  padding: "1px 6px",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
};

function StageCard({ stage, onClick }: { stage: Stage; onClick: () => void }) {
  const display = deriveDisplayStatus(stage);
  const area = stageArea(stage.name);
  const isActive = display === "IN_PROGRESS";
  const isDone = display === "COMPLETED";
  const traspaso = STAGE_TRASPASO[stage.name];

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        background: "var(--color-bg-card)",
        border: isActive
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-border)",
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

      {traspaso && (
        <div
          style={{
            borderTop: "1px solid var(--color-border)",
            padding: "5px 9px",
            fontSize: 9,
            color: "var(--color-text-muted)",
          }}
        >
          <span style={chipStyle}>{traspaso}</span>
        </div>
      )}
    </button>
  );
}

// Carril clickeable de una etapa paralela de Experiencia Solar. Abre el drawer
// (con sus sub-etapas) igual que las etapas del pipeline.
function CxLane({ stage, start, end, onClick }: { stage: Stage; start: number; end: number; onClick: () => void }) {
  const display = deriveDisplayStatus(stage);
  const done = stage.substages.filter((s) => s.status === "COMPLETED").length;
  const estado =
    display === "COMPLETED" ? " · ✓" : display === "IN_PROGRESS" ? ` · ${stage.progressPercent}%` : "";
  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: `${start + 1} / ${end + 2}`,
        background: AREA_COLOR.CX,
        opacity: display === "PENDING" ? 0.72 : 1,
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 8,
        padding: "8px 10px",
        color: "#fff",
        textAlign: "left",
        cursor: "pointer",
        minHeight: 44,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.25 }}>{stageLabel(stage.name)}</span>
      <span style={{ fontSize: 8.5, fontWeight: 500, opacity: 0.92, marginTop: 2 }}>
        {done}/{stage.substages.length} sub-tareas{estado} · clic para abrir
      </span>
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

          {/* Conectores de traspaso */}
          <div style={{ ...gridCols, margin: "4px 0" }}>
            {linear.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "center", minHeight: 16 }}>
                {STAGE_TRASPASO[s.name] && <span style={chipStyle}>{STAGE_TRASPASO[s.name]}</span>}
              </div>
            ))}
          </div>

          {/* Carriles paralelos de Experiencia Solar (clickeables, con sub-etapas) */}
          {lanes.length > 0 && (
            <div style={{ ...gridCols, gap: 6, marginTop: 2 }}>
              {lanes.map(({ p, start, end }) => (
                <CxLane key={p.id} stage={p} start={start} end={end} onClick={() => onStageClick(p)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

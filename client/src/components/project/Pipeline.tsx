import type { Stage } from "../../types/api.types";

interface PipelineProps {
  stages: Stage[];
  onStageClick: (stage: Stage) => void;
}

export function Pipeline({ stages, onStageClick }: PipelineProps) {
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "14px",
        marginBottom: 16,
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--color-text-muted)",
          marginBottom: 12,
        }}
      >
        Pipeline de etapas
      </p>
      <div style={{ display: "flex", gap: 6 }}>
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            onClick={() => onStageClick(stage)}
          />
        ))}
      </div>
    </div>
  );
}

type BlockStyle = {
  background: string;
  border: string;
};

const BLOCK: Record<string, BlockStyle> = {
  COMPLETED: { background: "#1a4d2e", border: "1px solid color-mix(in srgb, #4ade80 50%, transparent)" },
  IN_PROGRESS: { background: "#4a3f1a", border: "1px solid color-mix(in srgb, #fbbf24 50%, transparent)" },
  PENDING: { background: "var(--color-bg-card-hover)", border: "1px solid var(--color-border-hover)" },
  BLOCKED: { background: "var(--color-danger-bg)", border: "1px solid color-mix(in srgb, var(--color-danger-text) 36%, transparent)" },
};

const HEADER_COLOR: Record<string, string> = {
  COMPLETED: "#4ade80",
  IN_PROGRESS: "#fbbf24",
  PENDING: "var(--color-text-primary)",
  BLOCKED: "var(--color-danger-text)",
};

// Deriva el estado visual desde el progreso real, ignorando el estado stale de la DB
function deriveDisplayStatus(stage: Stage): Stage["status"] {
  if (stage.status === "BLOCKED") return "BLOCKED";
  if (stage.progressPercent >= 100) return "COMPLETED";
  if (stage.progressPercent > 0) return "IN_PROGRESS";
  return "PENDING";
}

function StatusLabel({ stage }: { stage: Stage }) {
  const display = deriveDisplayStatus(stage);
  if (display === "COMPLETED") {
    return (
      <span style={{ color: "#4ade80", fontWeight: 700, fontSize: 10 }}>
        ✓ Completo 100%
      </span>
    );
  }
  if (display === "IN_PROGRESS") {
    return (
      <span style={{ color: "#fbbf24", fontWeight: 700, fontSize: 10 }}>
        ▶ Activo {stage.progressPercent}%
      </span>
    );
  }
  if (display === "BLOCKED") {
    return (
      <span style={{ color: "var(--color-danger-text)", fontWeight: 700, fontSize: 10 }}>
        ✕ Bloqueado {stage.progressPercent}%
      </span>
    );
  }
  return (
    <span style={{ color: "var(--color-text-primary)", fontSize: 10, fontWeight: 500 }}>
      ◌ Sin inicio 0%
    </span>
  );
}

function SubstageDot({ status }: { status: Stage["substages"][number]["status"] }) {
  const color =
    status === "COMPLETED"
      ? "#4ade80"
      : status === "IN_PROGRESS"
      ? "var(--color-accent)"
      : status === "BLOCKED"
      ? "var(--color-danger-text)"
      : "var(--color-text-muted)";

  return (
    <span
      style={{
        display: "inline-block",
        width: 5,
        height: 5,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        marginTop: 1,
      }}
    />
  );
}

function StageColumn({ stage, onClick }: { stage: Stage; onClick: () => void }) {
  const displayStatus = deriveDisplayStatus(stage);
  const blockStyle = BLOCK[displayStatus] ?? BLOCK.PENDING;
  const headerColor = HEADER_COLOR[displayStatus] ?? "var(--color-text-secondary)";

  const visibleSubs = stage.substages.slice(0, 3);
  const extraCount = stage.substages.length - 3;

  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        textAlign: "left",
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        opacity: 1,
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      {/* Stage header */}
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: headerColor,
          marginBottom: 6,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {stage.order}. {stage.name}
      </p>

      {/* Stage block */}
      <div
        style={{
          ...blockStyle,
          borderRadius: 6,
          padding: "8px 10px",
          minHeight: 72,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <StatusLabel stage={stage} />
        </div>

        {/* Substages */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {visibleSubs.map((sub) => (
            <li
              key={sub.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 4,
                fontSize: 9,
                color: "var(--color-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 2,
              }}
            >
              <SubstageDot status={sub.status} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {sub.name}
              </span>
            </li>
          ))}
          {extraCount > 0 && (
            <li
              style={{
                fontSize: 9,
                color: "var(--color-text-primary)",
              }}
            >
              + {extraCount} más
            </li>
          )}
        </ul>
      </div>
    </button>
  );
}

import type { Stage } from "../../types/api.types";

interface PipelineProps {
  stages: Stage[];
  onStageClick: (stage: Stage) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string | null, toIso: string | null | Date): number | null {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso);
  const to = typeof toIso === "string" ? new Date(toIso) : toIso;
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS));
}

function stageTimeLabel(stage: Stage): string {
  if (stage.name === "POSTVENTA") return "Sin fechas asociadas";
  const display = deriveDisplayStatus(stage);
  if (display === "COMPLETED") {
    const days = daysBetween(stage.actualStartDate, stage.actualEndDate);
    if (days == null) return "Completada";
    return `Completada en ${days} ${days === 1 ? "día" : "días"}`;
  }
  if (display === "IN_PROGRESS") {
    const days = daysBetween(stage.actualStartDate, new Date());
    if (days == null) return "En curso";
    return `En curso · ${days} ${days === 1 ? "día" : "días"}`;
  }
  if (display === "BLOCKED") return "Bloqueada";
  return "Sin iniciar";
}

export function Pipeline({ stages, onStageClick }: PipelineProps) {
  return (
    <div
      style={{
        background: "var(--color-bg-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "18px",
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
          marginBottom: 14,
        }}
      >
        Pipeline de etapas
      </p>
      {/* En < md las etapas se apilan (full-width); en >= md quedan en columnas. */}
      <div className="flex flex-col gap-2 md:flex-row">
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
  borderLeft: string;
};

const BLOCK: Record<string, BlockStyle> = {
  COMPLETED: {
    background: "var(--color-pipe-done-bg)",
    border: "1px solid var(--color-pipe-done-border)",
    borderLeft: "var(--color-pipe-done-border-left-width) solid var(--color-pipe-done-border-left)",
  },
  IN_PROGRESS: {
    background: "var(--color-pipe-active-bg)",
    border: "1px solid var(--color-pipe-active-border)",
    borderLeft: "var(--color-pipe-active-border-left-width) solid var(--color-pipe-active-border-left)",
  },
  PENDING: {
    background: "var(--color-bg-card-hover)",
    border: "1px solid var(--color-border-hover)",
    borderLeft: "1px solid var(--color-border-hover)",
  },
  BLOCKED: {
    background: "var(--color-danger-bg)",
    border: "1px solid color-mix(in srgb, var(--color-danger-text) 36%, transparent)",
    borderLeft: "1px solid color-mix(in srgb, var(--color-danger-text) 36%, transparent)",
  },
};

const HEADER_COLOR: Record<string, string> = {
  COMPLETED: "var(--color-pipe-done-label)",
  IN_PROGRESS: "var(--color-pipe-active-label)",
  PENDING: "var(--color-text-primary)",
  BLOCKED: "var(--color-danger-text)",
};

const SUBITEM_COLOR: Record<string, string> = {
  COMPLETED: "var(--color-pipe-done-subitem)",
  IN_PROGRESS: "var(--color-pipe-active-subitem)",
  PENDING: "var(--color-text-primary)",
  BLOCKED: "var(--color-text-primary)",
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
      <span
        style={{
          color: "var(--color-pipe-done-title)",
          fontWeight: "var(--color-pipe-status-weight)",
          fontSize: 10,
        }}
      >
        ✓ Completo 100%
      </span>
    );
  }
  if (display === "IN_PROGRESS") {
    return (
      <span
        style={{
          color: "var(--color-pipe-active-title)",
          fontWeight: "var(--color-pipe-status-weight)",
          fontSize: 10,
        }}
      >
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
      ? "var(--color-pipe-done-dot)"
      : status === "IN_PROGRESS"
      ? "var(--color-pipe-active-dot)"
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
  const subItemColor = SUBITEM_COLOR[displayStatus] ?? "var(--color-text-primary)";

  const visibleSubs = stage.substages.slice(0, 3);
  const extraCount = stage.substages.length - 3;

  return (
    <button
      onClick={onClick}
      className="w-full min-w-0 md:flex-1"
      style={{
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
          fontSize: 11,
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
          padding: "10px 12px",
          minHeight: 96,
        }}
      >
        <div style={{ marginBottom: 10 }}>
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
                gap: 5,
                fontSize: 11,
                color: subItemColor,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 3,
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
                fontSize: 10,
                color: subItemColor,
              }}
            >
              + {extraCount} más
            </li>
          )}
        </ul>
      </div>

      {/* Tiempo por etapa */}
      <p
        style={{
          marginTop: 6,
          fontSize: 11,
          color: "var(--color-text-muted)",
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {stageTimeLabel(stage)}
      </p>
    </button>
  );
}

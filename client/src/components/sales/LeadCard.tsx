import { useState } from "react";
import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { Plus } from "lucide-react";
import type { LeadListItem, SalesStage } from "../../types/leads.types";
import { KANBAN_COLUMNS, STAGE_COLORS, STAGE_LABELS } from "../../types/leads.types";
import { Sheet } from "../ui/Sheet";

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getAssigneeInitial(name?: string) {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// Tarjeta de lead compartida por el Kanban y la vista priorizada. En el Kanban
// se pasa como draggable (props de dnd-kit vía dragRef/dragStyle/dragProps); en
// la vista priorizada se usa estática (sin esas props). El markup es idéntico.
export function LeadCard({
  lead,
  onOpen,
  onMove,
  onReclamo,
  onCloseRequest,
  dragRef,
  dragStyle,
  dragProps,
  isDragging = false,
}: {
  lead: LeadListItem;
  onOpen: (leadId: string) => void;
  onMove: (leadId: string, stage: SalesStage) => void;
  onReclamo: (leadId: string) => void;
  onCloseRequest: (leadId: string) => void;
  dragRef?: Ref<HTMLDivElement>;
  dragStyle?: CSSProperties;
  dragProps?: HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const draggable = dragProps != null;

  const daysColor =
    lead.daysInStage > 14
      ? "#f87171"
      : lead.daysInStage > 7
        ? "var(--color-accent)"
        : "var(--color-text-muted)";

  return (
    <>
      <div
        ref={dragRef}
        style={{ ...dragStyle, cursor: draggable ? (isDragging ? "grabbing" : "grab") : "pointer" }}
        role={draggable ? undefined : "button"}
        tabIndex={draggable ? undefined : 0}
        aria-label={`Abrir lead ${lead.clientName}`}
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-left focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
        {...dragProps}
        onClick={() => onOpen(lead.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(lead.id);
          }
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{lead.clientName}</p>
            <p className="font-mono text-[10px] text-[var(--color-text-muted)]">{lead.estimatedKwp ?? "—"} kWp</p>
          </div>
          <button
            type="button"
            aria-label="Mover a etapa…"
            title="Mover a etapa…"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setMoveOpen(true);
            }}
            className="tap-target shrink-0 rounded text-[var(--color-text-muted)] select-none hover:bg-[var(--color-bg-app)] hover:text-[var(--color-text-primary)]"
          >
            ⋮⋮
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--color-text-secondary)]">{formatMoney(lead.estimatedBudgetUsd)}</div>
          {lead.assignedTo ? (
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-black">
                {getAssigneeInitial(lead.assignedTo.name)}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{lead.assignedTo.name}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px]" style={{ color: daysColor }}>
            {lead.daysInStage} día{lead.daysInStage === 1 ? "" : "s"} en etapa
          </span>
          <div className="flex items-center gap-1">
            {lead.reclamosCount > 0 ? (
              <span
                title={`${lead.reclamosCount} reclamo${lead.reclamosCount === 1 ? "" : "s"} realizado${lead.reclamosCount === 1 ? "" : "s"}`}
                className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none"
                style={{ background: "rgba(251,146,60,0.16)", color: "#fb923c" }}
              >
                {lead.reclamosCount}R
              </span>
            ) : null}
            <button
              type="button"
              aria-label="Registrar reclamo"
              title="Registrar un reclamo"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onReclamo(lead.id);
              }}
              className="tap-target flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-muted)] select-none hover:bg-[var(--color-bg-app)] hover:text-[#fb923c]"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Sheet open={moveOpen} onClose={() => setMoveOpen(false)} title="Mover a etapa…">
        <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
          {lead.clientName} · actualmente en {STAGE_LABELS[lead.stage]}
        </p>
        <ul className="space-y-1">
          {KANBAN_COLUMNS.filter((stage) => stage !== lead.stage).map((stage) => (
            <li key={stage}>
              <button
                type="button"
                onClick={() => {
                  onMove(lead.id, stage);
                  setMoveOpen(false);
                }}
                className="tap-target flex w-full items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STAGE_COLORS[stage].dot }} />
                {STAGE_LABELS[stage]}
              </button>
            </li>
          ))}
          <li className="border-t border-[var(--color-border)] pt-1">
            <button
              type="button"
              onClick={() => {
                onCloseRequest(lead.id);
                setMoveOpen(false);
              }}
              className="tap-target flex w-full items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-text-muted)]" />
              Cerrar lead…
            </button>
          </li>
        </ul>
      </Sheet>
    </>
  );
}

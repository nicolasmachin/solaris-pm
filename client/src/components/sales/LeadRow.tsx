import { Plus } from "lucide-react";
import type { LeadListItem } from "../../types/leads.types";
import { STAGE_COLORS, STAGE_LABELS } from "../../types/leads.types";

function formatMoney(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// Fila simple de lead, compartida por la pestaña "Cerrados" del pipeline y la
// vista priorizada. Es <div role="button"> (no <button>) para poder anidar el
// botón "+" de reclamo sin generar HTML inválido.
export function LeadRow({
  lead,
  onOpen,
  onReclamo,
  showStageBadge = false,
}: {
  lead: LeadListItem;
  onOpen: (leadId: string) => void;
  onReclamo?: (leadId: string) => void;
  showStageBadge?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(lead.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(lead.id);
        }
      }}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-left hover:bg-[var(--color-bg-card-hover)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{lead.clientName}</p>
          {showStageBadge ? (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
              style={{ background: `${STAGE_COLORS[lead.stage].dot}22`, color: STAGE_COLORS[lead.stage].dot }}
            >
              {STAGE_LABELS[lead.stage]}
            </span>
          ) : null}
        </div>
        <p className="font-mono text-[10px] text-[var(--color-text-muted)]">{lead.estimatedKwp ?? "—"} kWp</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {lead.reclamosCount > 0 ? (
          <span
            title={`${lead.reclamosCount} reclamo${lead.reclamosCount === 1 ? "" : "s"} realizado${lead.reclamosCount === 1 ? "" : "s"}`}
            className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none"
            style={{ background: "rgba(251,146,60,0.16)", color: "#fb923c" }}
          >
            {lead.reclamosCount}R
          </span>
        ) : null}
        {onReclamo ? (
          <button
            type="button"
            aria-label="Registrar reclamo"
            title="Registrar un reclamo"
            onClick={(event) => {
              event.stopPropagation();
              onReclamo(lead.id);
            }}
            className="tap-target flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-app)] hover:text-[#fb923c]"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : null}
        <div className="text-right">
          <p className="text-sm text-[var(--color-text-secondary)]">{formatMoney(lead.estimatedBudgetUsd)}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">{lead.daysInStage} días</p>
        </div>
      </div>
    </div>
  );
}

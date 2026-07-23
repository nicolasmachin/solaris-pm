import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LeadListItem, LeadStageGroup, SalesStage } from "../../types/leads.types";
import { STAGE_COLORS } from "../../types/leads.types";
import { LeadCard } from "./LeadCard";

// Vista de trabajo priorizada: agrupa los leads activos de más avanzado a
// menos, para atacarlos por prioridad. Los cerrados (ganado/perdido) no
// aparecen. Dentro de cada grupo, los que esperan hace más tiempo van arriba.
// Usa la MISMA tarjeta que el Kanban (LeadCard), acomodada en un grid.
const SECTIONS: Array<{ stage: SalesStage; title: string; hint: string }> = [
  { stage: "VISITADO", title: "Visitados", hint: "Listos para cerrar" },
  { stage: "AGENDAR_VISITA", title: "Agendar visita", hint: "Pendientes de coordinar la visita" },
  { stage: "COTIZADO", title: "Cotizados", hint: "Seguimiento de la cotización" },
  { stage: "RECLAMADO", title: "Reclamados", hint: "Seguimiento tras insistir" },
  { stage: "NUEVO_LEAD", title: "Nuevos leads", hint: "Pendientes de cotizar" },
];

export function PriorityView({
  groups,
  onOpenLead,
  onMove,
  onReclamo,
  onCloseRequest,
}: {
  groups: LeadStageGroup[];
  onOpenLead: (leadId: string) => void;
  onMove: (leadId: string, stage: SalesStage) => void;
  onReclamo: (leadId: string) => void;
  onCloseRequest: (leadId: string) => void;
}) {
  const byStage = useMemo(() => {
    const map = new Map<SalesStage, LeadListItem[]>();
    for (const group of groups) {
      // Copia ordenada por días en etapa desc (mayor espera arriba).
      map.set(group.stage, [...group.leads].sort((a, b) => b.daysInStage - a.daysInStage));
    }
    return map;
  }, [groups]);

  // Secciones colapsadas (no se persiste: cada refresh arranca todo expandido).
  const [collapsed, setCollapsed] = useState<Set<SalesStage>>(new Set());
  const toggle = (stage: SalesStage) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });

  const totalActivos = SECTIONS.reduce((sum, s) => sum + (byStage.get(s.stage)?.length ?? 0), 0);

  if (totalActivos === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-sm text-[var(--color-text-muted)]">
        No hay leads activos para priorizar.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pb-4">
      {SECTIONS.map((section) => {
        const leads = byStage.get(section.stage) ?? [];
        const isCollapsed = collapsed.has(section.stage);
        return (
          <section key={section.stage}>
            <button
              type="button"
              onClick={() => toggle(section.stage)}
              aria-expanded={!isCollapsed}
              className="mb-2 flex w-full items-center gap-2 rounded text-left hover:opacity-80"
            >
              {isCollapsed ? (
                <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
              ) : (
                <ChevronDown size={14} className="text-[var(--color-text-muted)]" />
              )}
              <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLORS[section.stage].dot }} />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{section.title}</h3>
              <span className="rounded-full bg-[var(--color-bg-app)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {leads.length}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">· {section.hint}</span>
            </button>
            {isCollapsed ? null : leads.length > 0 ? (
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onOpen={onOpenLead}
                    onMove={onMove}
                    onReclamo={onReclamo}
                    onCloseRequest={onCloseRequest}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-3 text-center text-xs text-[var(--color-text-muted)]">
                Sin leads en esta prioridad
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

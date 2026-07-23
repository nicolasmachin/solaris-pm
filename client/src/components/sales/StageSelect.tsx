import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { STAGE_COLORS, STAGE_LABELS, type SalesStage } from "../../types/leads.types";

// Badge clickeable que abre un dropdown con todas las etapas del lead.
// No abre los modales de confirmación: el componente solo emite el evento
// onChange y delega la decisión al caller (lista, panel, etc.).
//
// Estilo del badge: mismo look-and-feel que se usaba inline en
// LeadsListView (round-full, border + dot del color del stage). Cuando
// está activo (dropdown abierto) muestra una leve sombra.

interface Props {
  currentStage: SalesStage;
  onChange: (newStage: SalesStage) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

// Lista completa de stages en el orden visualmente coherente (mismo del
// enum). El consumidor del componente puede ignorar las que no aplican
// vía la lógica de su onChange.
const ALL_STAGES: SalesStage[] = [
  "NUEVO_LEAD",
  "COTIZADO",
  "RECLAMADO",
  "AGENDAR_VISITA",
  "VISITADO",
  "CERRADO_GANADO",
  "CERRADO_PERDIDO",
];

export function StageSelect({
  currentStage,
  onChange,
  disabled,
  className,
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageColor = STAGE_COLORS[currentStage];

  // Cerrar al click fuera.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-block ${className ?? ""}`}>
      <button
        type="button"
        onClick={(e) => {
          // stopPropagation: la tabla de LeadsListView tiene onClick en el <tr>
          // que abre el detalle del lead. No queremos disparar eso al clickear
          // el badge.
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        disabled={disabled}
        aria-label={ariaLabel ?? `Cambiar etapa (actual: ${STAGE_LABELS[currentStage]})`}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-all ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:brightness-110"
        }`}
        style={{ borderColor: stageColor.border, color: stageColor.dot }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageColor.dot }} />
        {STAGE_LABELS[currentStage]}
        <ChevronDown size={10} className="opacity-60" />
      </button>

      {open && !disabled && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-72 min-w-[180px] overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] py-1 shadow-xl"
        >
          {ALL_STAGES.map((stage) => {
            const color = STAGE_COLORS[stage];
            const isCurrent = stage === currentStage;
            return (
              <li key={stage}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isCurrent}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    if (stage !== currentStage) onChange(stage);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                    isCurrent
                      ? "bg-[var(--color-bg-card-hover)]/60 font-semibold text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]/40"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: color.dot }} />
                  {STAGE_LABELS[stage]}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

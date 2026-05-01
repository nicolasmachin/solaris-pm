import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(" "); }

export type DropdownOption = string | { value: string; label: string };

interface Props {
  label: string;
  options: DropdownOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Texto del CTA "todos" — default: "todos" / "todas" según contexto. */
  allLabel?: string;
}

/**
 * Multi-select compacto con popover. Mantiene `selected` como array de
 * strings; click en cada opción toggle. Botón "Todos / Ninguno" arriba.
 */
export function DropdownFilter({ label, options, selected, onChange, allLabel = "Todos" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const allSelected = selected.length === normalized.length && normalized.length > 0;
  const someSelected = selected.length > 0 && !allSelected;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] hover:border-[var(--color-border-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      >
        <span className="font-mono uppercase tracking-widest text-[var(--color-text-muted)]">{label}</span>
        {someSelected && (
          <span className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] text-black font-semibold text-[10px] px-1.5 min-w-[18px] h-[18px]">
            {selected.length}
          </span>
        )}
        {allSelected && <span className="text-[10px] text-[var(--color-text-muted)]">{allLabel}</span>}
        <ChevronDown size={12} className="text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 min-w-[220px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl py-1">
          <button
            type="button"
            onClick={() => onChange(allSelected ? [] : normalized.map((o) => o.value))}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-secondary)] font-mono uppercase tracking-wider"
          >
            <span className={klass(
              "w-3.5 h-3.5 rounded border flex items-center justify-center",
              allSelected
                ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                : someSelected
                  ? "bg-[var(--color-accent)]/40 border-[var(--color-accent)]"
                  : "border-[var(--color-border)]",
            )}>
              {allSelected && <Check size={10} className="text-black" />}
              {someSelected && <span className="w-1.5 h-1.5 bg-black rounded-sm" />}
            </span>
            {allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
          </button>
          <div className="border-t border-[var(--color-border)] my-1" />
          <div className="max-h-[280px] overflow-y-auto">
            {normalized.map((opt) => {
              const isSel = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] text-left"
                >
                  <span className={klass(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                    isSel ? "bg-[var(--color-accent)] border-[var(--color-accent)]" : "border-[var(--color-border)]",
                  )}>
                    {isSel && <Check size={10} className="text-black" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

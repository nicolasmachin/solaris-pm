import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
}

export function MultiSelectFilter<T extends string>({
  options,
  selected,
  onChange,
  buttonLabel,
  allLabel,
  noneLabel = "Ninguno seleccionado",
  className = "",
}: {
  options: MultiSelectOption<T>[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  /** Si pasás esto y no están "todos" seleccionados, se muestra "X de Y" + buttonLabel. */
  buttonLabel?: string;
  /** Texto a mostrar si están todos los valores seleccionados. */
  allLabel?: string;
  /** Texto si no hay ninguno. */
  noneLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al clickear afuera.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function toggle(value: T) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(options.map((o) => o.value)));
  }
  function clearAll() {
    onChange(new Set());
  }

  const allSelected = selected.size === options.length && options.length > 0;
  const noneSelected = selected.size === 0;
  // Texto del botón.
  const label = noneSelected
    ? noneLabel
    : allSelected
      ? allLabel ?? `Todos (${options.length})`
      : selected.size === 1
        ? options.find((o) => selected.has(o.value))?.label ?? buttonLabel ?? "Seleccionados"
        : `${selected.size} de ${options.length}${buttonLabel ? ` · ${buttonLabel}` : ""}`;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] focus:outline-none focus:border-[var(--color-accent)]"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)]" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 min-w-[200px] rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">
            <button
              type="button"
              onClick={selectAll}
              className="hover:text-[var(--color-text-secondary)]"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="hover:text-[var(--color-text-secondary)]"
            >
              Limpiar
            </button>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {options.map((option) => {
              const isOn = selected.has(option.value);
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => toggle(option.value)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        isOn
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-gray-900"
                          : "border-[var(--color-border)]"
                      }`}
                    >
                      {isOn && <Check className="w-3 h-3" />}
                    </span>
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Combo input + dropdown para calibres eléctricos (térmica AC, diferencial
// AC, protección DC). Value es string libre — acepta tanto valores
// predefinidos ("40A 300mA") como cualquier string técnico custom ("37A").
//
// Si `emptyOptionLabel` está set, la primera opción del dropdown limpia el
// valor (onChange(null)). Sirve para los calibres AC: null = "automático,
// usar regla del server según potencia y tipo de red".

export interface CalibreInputProps {
  value: string | null;
  onChange: (v: string | null) => void;
  predefined: string[];
  emptyOptionLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_CLASS =
  "w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] " +
  "px-2 py-1.5 pr-7 text-xs text-[var(--color-text-primary)] " +
  "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] " +
  "disabled:opacity-50";

export function CalibreInput({
  value,
  onChange,
  predefined,
  emptyOptionLabel,
  placeholder,
  disabled,
  className,
  ariaLabel,
}: CalibreInputProps) {
  const [draft, setDraft] = useState<string>(value ?? "");
  const [open, setOpen] = useState(false);
  const focusedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value ?? "");
    }
  }, [value]);

  // Cerrar dropdown si se hace click fuera.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        commitDraft();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
    // commitDraft cierra sobre draft/value vía closure; no es estable pero
    // funciona porque al disparar leemos los últimos valores via state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function commitDraft() {
    const s = draft.trim();
    const next: string | null = s === "" ? null : s;
    if (next !== value) onChange(next);
    setDraft(next ?? "");
  }

  const filtered = (() => {
    if (!draft.trim()) return predefined;
    const q = draft.toLowerCase();
    return predefined.filter((p) => p.toLowerCase().includes(q));
  })();

  function selectOption(opt: string | null) {
    if (opt !== value) onChange(opt);
    setDraft(opt ?? "");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        aria-label={ariaLabel}
        className={className ?? DEFAULT_CLASS}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          focusedRef.current = true;
          setOpen(true);
        }}
        onBlur={() => {
          focusedRef.current = false;
          // No cerramos acá: el listener documental lo maneja. Si el blur
          // viene por click en una opción del dropdown, queremos que ese
          // click se procese ANTES de cerrar. El document handler ya se
          // encarga de cerrar al click externo.
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Si hay una sola opción filtrada exacta, usarla; sino commit raw.
            const exact = filtered.find((p) => p.toLowerCase() === draft.trim().toLowerCase());
            if (exact) selectOption(exact);
            else {
              commitDraft();
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value ?? "");
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        disabled={disabled}
        aria-label="Mostrar sugerencias"
      >
        <ChevronDown size={14} />
      </button>

      {open && !disabled && (
        <ul className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl text-xs">
          {emptyOptionLabel && (
            <li
              role="option"
              aria-selected={value === null}
              onMouseDown={(e) => {
                // mousedown para que dispare ANTES del blur del input.
                e.preventDefault();
                selectOption(null);
              }}
              className={`px-2 py-1.5 cursor-pointer italic text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] border-b border-[var(--color-border)] ${
                value === null ? "bg-[var(--color-bg-card-hover)]/60" : ""
              }`}
            >
              {emptyOptionLabel}
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-[var(--color-text-muted)] italic">
              Sin coincidencias en la lista. Podés tipear un valor custom.
            </li>
          ) : (
            filtered.map((opt) => (
              <li
                key={opt}
                role="option"
                aria-selected={opt === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt);
                }}
                className={`px-2 py-1.5 cursor-pointer text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] ${
                  opt === value ? "bg-[var(--color-bg-card-hover)]/60 font-medium" : ""
                }`}
              >
                {opt}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

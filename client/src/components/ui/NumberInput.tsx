import { useEffect, useRef, useState } from "react";

// Input numérico con patrón "draft string interno + commit al blur". Soluciona
// el bug típico de inputs controlados donde, al borrar el contenido, el
// onChange recibe "" → Number("") = 0 → el value vuelve a 0/min y no podés
// terminar de escribir el número que querías (ej. tipear "580" desde un valor
// previo de 7).
//
// Reglas:
// - Mantiene el contenido del input como string mientras el usuario tipea.
// - Solo dispara onChange al perder el foco (o presionar Enter), nunca a mitad
//   de tipeo.
// - Si al blur el contenido es vacío o inválido, revierte al último value
//   válido. Nunca propaga NaN ni vacíos al caller.
// - Si min/max están definidos, el valor commiteado se clampa al rango.
// - Flechitas (↑/↓) incrementan/decrementan por `step` (default 1).
// - Escape cancela cualquier edición en curso.

export interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  allowDecimals?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

const REGEX_INT = /^-?\d*$/;
const REGEX_DECIMAL = /^-?\d*[.,]?\d*$/;

function clamp(n: number, min?: number, max?: number): number {
  let r = n;
  if (min !== undefined && r < min) r = min;
  if (max !== undefined && r > max) r = max;
  return r;
}

const DEFAULT_CLASS =
  "w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] " +
  "px-2 py-1.5 text-xs text-[var(--color-text-primary)] " +
  "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] " +
  "disabled:opacity-50";

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  allowDecimals = false,
  placeholder,
  disabled,
  className,
  id,
  ariaLabel,
}: NumberInputProps) {
  const [draft, setDraft] = useState<string>(String(value));
  const focusedRef = useRef(false);

  // Si el value cambia desde afuera (ej. reset del form, prefetch, etc.) y el
  // input no tiene foco, sincronizamos el draft. Si tiene foco, NO tocamos
  // — el usuario está escribiendo activamente.
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(String(value));
    }
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const s = e.target.value;
    const re = allowDecimals ? REGEX_DECIMAL : REGEX_INT;
    if (s === "" || re.test(s)) {
      setDraft(s);
    }
    // Si no matchea, se ignora el cambio (cursor se queda donde estaba).
  }

  function commit() {
    const s = draft.replace(",", ".").trim();
    if (s === "" || s === "-") {
      // Vacío o solo signo: revertir al último valor válido.
      setDraft(String(value));
      return;
    }
    const n = allowDecimals ? parseFloat(s) : parseInt(s, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = clamp(n, min, max);
    if (clamped !== value) {
      onChange(clamped);
    }
    // Asegura que el draft refleje el valor commiteado (puede haberse clampeado).
    setDraft(String(clamped));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(String(value));
      e.currentTarget.blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = clamp(value + step, min, max);
      if (next !== value) onChange(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = clamp(value - step, min, max);
      if (next !== value) onChange(next);
    }
  }

  return (
    <input
      type="text"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      id={id}
      aria-label={ariaLabel}
      className={className ?? DEFAULT_CLASS}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={handleChange}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={handleKeyDown}
    />
  );
}

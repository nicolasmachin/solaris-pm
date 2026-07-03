import type { FlaggedValue } from "../../../types/proposals-v2";

// Una variable de defaults: input del valor + switch "Asesor puede modificar".
export function VariableInput({
  label,
  entry,
  onChange,
  disabled,
  suffix,
  min,
  max,
}: {
  label: string;
  entry: FlaggedValue;
  onChange: (next: FlaggedValue) => void;
  disabled: boolean;
  suffix?: string;
  min?: number;
  max?: number;
}) {
  const isNumber = typeof entry.value === "number";

  return (
    <div className="flex flex-wrap items-center gap-3 py-1.5">
      <label className="min-w-[220px] flex-1 text-sm text-[var(--color-text-secondary)]">{label}</label>
      <div className="flex w-40 items-center gap-1.5">
        <input
          type={isNumber ? "number" : "text"}
          step="any"
          min={isNumber ? min : undefined}
          max={isNumber ? max : undefined}
          value={entry.value}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...entry,
              value: isNumber ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value,
            })
          }
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm tabular-nums text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
        />
        {suffix ? <span className="text-xs text-[var(--color-text-muted)]">{suffix}</span> : null}
      </div>
      <label className="flex w-44 cursor-pointer items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <input
          type="checkbox"
          checked={entry.asesorCanOverride}
          disabled={disabled}
          onChange={(e) => onChange({ ...entry, asesorCanOverride: e.target.checked })}
          className="cursor-pointer disabled:opacity-60"
        />
        Asesor puede modificar
      </label>
    </div>
  );
}

import type { FlaggedValue } from "../../../types/proposals-v2";

// Una variable de defaults: input del valor + switch "Asesor puede modificar".
export function VariableInput({
  label,
  entry,
  onChange,
  disabled,
}: {
  label: string;
  entry: FlaggedValue;
  onChange: (next: FlaggedValue) => void;
  disabled: boolean;
}) {
  const isNumber = typeof entry.value === "number";

  return (
    <div className="flex flex-wrap items-center gap-3 py-1.5">
      <label className="min-w-[220px] flex-1 text-sm text-[var(--color-text-secondary)]">{label}</label>
      <input
        type={isNumber ? "number" : "text"}
        step="any"
        value={entry.value}
        disabled={disabled}
        onChange={(e) =>
          onChange({
            ...entry,
            value: isNumber ? (e.target.value === "" ? 0 : Number(e.target.value)) : e.target.value,
          })
        }
        className="w-40 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm tabular-nums text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
      />
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

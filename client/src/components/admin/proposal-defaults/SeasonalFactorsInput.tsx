import type { FlaggedValue } from "../../../types/proposals-v2";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

// Editor de los 12 factores estacionales de generación (deben sumar 1.0).
export function SeasonalFactorsInput({
  entry,
  onChange,
  disabled,
}: {
  entry: FlaggedValue;
  onChange: (next: FlaggedValue) => void;
  disabled: boolean;
}) {
  const values = Array.isArray(entry.value) ? entry.value : [];
  const sum = values.reduce((a, b) => a + (Number(b) || 0), 0);
  const sumOk = Math.abs(sum - 1) < 0.001;

  function setAt(i: number, v: number) {
    const next = values.slice();
    next[i] = v;
    onChange({ ...entry, value: next });
  }

  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Factores estacionales de generación (Ene→Dic)
        </label>
        <span className={`text-xs tabular-nums ${sumOk ? "text-[var(--color-text-muted)]" : "text-amber-400"}`}>
          Suma: {sum.toFixed(3)} {sumOk ? "✓" : "(debería ser 1.0)"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {MESES.map((mes, i) => (
          <label key={mes} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">{mes}</span>
            <input
              type="number"
              step="any"
              min={0}
              disabled={disabled}
              value={values[i] ?? 0}
              onChange={(e) => setAt(i, e.target.value === "" ? 0 : Number(e.target.value))}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm tabular-nums text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

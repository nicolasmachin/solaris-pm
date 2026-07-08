import type { FlaggedValue } from "../../../types/proposals-v2";

// Labels de los 7 tramos de cantidad de paneles (cota superior inclusiva; el
// redondo cierra el tramo). Deben espejar TRAMOS_ELECTRICA_MAX_PANELES del server.
const TRAMOS = ["1–10", "11–20", "21–30", "31–40", "41–50", "51–100", "101+"];

// Editor de los 7 multiplicadores del costo de instalación eléctrica por tamaño
// del sistema. Los tramos son fijos; solo se editan los multiplicadores.
export function ElectricaMultiplierInput({
  entry,
  onChange,
  disabled,
}: {
  entry: FlaggedValue;
  onChange: (next: FlaggedValue) => void;
  disabled: boolean;
}) {
  const values = Array.isArray(entry.value) ? entry.value : [];

  function setAt(i: number, v: number) {
    const next = values.slice();
    next[i] = v;
    onChange({ ...entry, value: next });
  }

  return (
    <div className="py-2">
      <label className="mb-1.5 block text-sm text-[var(--color-text-secondary)]">
        Multiplicador del costo eléctrico por cantidad de paneles
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TRAMOS.map((tramo, i) => (
          <label key={tramo} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">{tramo} paneles</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--color-text-muted)]">×</span>
              <input
                type="number"
                step="any"
                min={0}
                disabled={disabled}
                value={values[i] ?? 1}
                onChange={(e) => setAt(i, e.target.value === "" ? 0 : Number(e.target.value))}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm tabular-nums text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-60"
              />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

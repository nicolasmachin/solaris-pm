export interface PeriodValue {
  year: number;
  quarter?: number; // 1–4, undefined = año completo
}

interface PeriodSelectorProps {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}

function toKey(v: PeriodValue): string {
  return v.quarter != null ? `${v.year}-Q${v.quarter}` : `${v.year}`;
}

function fromKey(key: string): PeriodValue {
  const m = key.match(/^(\d{4})-Q(\d)$/);
  if (m) return { year: Number(m[1]), quarter: Number(m[2]) };
  return { year: Number(key) };
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const thisYear = new Date().getFullYear();
  const startYear = 2024;
  const years = Array.from({ length: thisYear - startYear + 1 }, (_, i) => thisYear - i);

  return (
    <select
      value={toKey(value)}
      onChange={(e) => onChange(fromKey(e.target.value))}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none cursor-pointer"
    >
      {years.map((y) => (
        <optgroup key={y} label={String(y)}>
          <option value={`${y}-Q1`}>Q1 {y} (Ene–Mar)</option>
          <option value={`${y}-Q2`}>Q2 {y} (Abr–Jun)</option>
          <option value={`${y}-Q3`}>Q3 {y} (Jul–Sep)</option>
          <option value={`${y}-Q4`}>Q4 {y} (Oct–Dic)</option>
          <option value={`${y}`}>Año completo {y}</option>
        </optgroup>
      ))}
    </select>
  );
}

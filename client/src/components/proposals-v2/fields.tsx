// Campos tipados del constructor. Estilo consistente con el resto del repo
// (var(--color-*)). `error` pinta el borde rojo y muestra un mensaje inline.

const base =
  "w-full rounded-md border bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";
const borderOk = "border-[var(--color-border)]";
const borderErr = "border-red-400/70";

function Wrap({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-red-400">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input
        className={`${base} ${error ? borderErr : borderOk} ${disabled ? "opacity-60" : ""}`}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  disabled,
  step,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
  step?: number;
  min?: number;
}) {
  return (
    <Wrap label={label} hint={hint} error={error}>
      <input
        type="number"
        className={`${base} ${error ? borderErr : borderOk} ${disabled ? "opacity-60" : ""}`}
        value={Number.isFinite(value) ? value : ""}
        step={step}
        min={min}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </Wrap>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  error?: string;
}) {
  return (
    <Wrap label={label} error={error}>
      <select
        className={`${base} ${error ? borderErr : borderOk}`}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Wrap label={label}>
      <textarea
        className={`${base} ${borderOk} min-h-[90px] resize-y`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Wrap>
  );
}

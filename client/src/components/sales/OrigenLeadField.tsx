import { ORIGEN_LEAD_OPTIONS, type OrigenLead } from "../../types/leads.types";

const LABEL_CLASS = "mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]";
const INPUT_CLASS =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none";

/** "Otro" sin aclaración no se puede guardar: no dice nada al medir. */
export function origenIncompleto(origen: OrigenLead | "", detalle: string): boolean {
  return origen === "OTRO" && !detalle.trim();
}

/**
 * "¿Cómo nos conoció?": el canal por el que llegó el lead, más una aclaración
 * libre (quién lo recomendó, qué marca). En el alta es obligatorio; en la
 * ficha de un lead viejo puede quedar vacío, porque ese dato no se inventa.
 */
export function OrigenLeadField({
  origen,
  detalle,
  onChange,
  required = false,
  className = "",
}: {
  origen: OrigenLead | "";
  detalle: string;
  onChange: (next: { origen: OrigenLead | ""; detalle: string }) => void;
  required?: boolean;
  className?: string;
}) {
  const opcion = ORIGEN_LEAD_OPTIONS.find((o) => o.value === origen);
  const faltaDetalle = origenIncompleto(origen, detalle);

  return (
    <div className={`grid gap-3 ${className}`}>
      <label>
        <span className={LABEL_CLASS}>¿Cómo nos conoció?{required ? " *" : ""}</span>
        <select
          className={INPUT_CLASS}
          value={origen}
          required={required}
          onChange={(event) => onChange({ origen: event.target.value as OrigenLead | "", detalle })}
        >
          <option value="" disabled={required}>
            {required ? "Elegí una opción" : "Sin dato (preguntárselo)"}
          </option>
          {ORIGEN_LEAD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {origen ? (
        <label>
          <span className={LABEL_CLASS}>Detalle</span>
          <input
            className={`${INPUT_CLASS} ${faltaDetalle ? "border-red-500" : ""}`}
            value={detalle}
            maxLength={500}
            placeholder={opcion?.detalle}
            onChange={(event) => onChange({ origen, detalle: event.target.value })}
          />
        </label>
      ) : null}
    </div>
  );
}

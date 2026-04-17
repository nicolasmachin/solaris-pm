import type { ChangeEvent, ReactNode } from "react";
import type { PhaseType, SolarSystem } from "../../types/api.types";
import type { SolarSystemPayload } from "../../api/projects.api";

export interface SolarSystemFormValues {
  description: string;
  inverterBrand: string;
  inverterPowerKw: string;
  inverterQuantity: string;
  inverterPhaseType: "" | PhaseType;
  inverterModel: string;
  panelQuantity: string;
  panelPowerW: string;
  panelBrand: string;
  panelModel: string;
}

export const EMPTY_SOLAR_SYSTEM_FORM: SolarSystemFormValues = {
  description: "",
  inverterBrand: "",
  inverterPowerKw: "",
  inverterQuantity: "1",
  inverterPhaseType: "",
  inverterModel: "",
  panelQuantity: "",
  panelPowerW: "",
  panelBrand: "",
  panelModel: "",
};

export const PHASE_OPTIONS: Array<{ value: PhaseType; label: string; shortLabel: string }> = [
  { value: "MONOFASICO", label: "Monofásico", shortLabel: "MONO" },
  { value: "TRIFASICO_230", label: "Trifásico 230V", shortLabel: "TRI-230" },
  { value: "TRIFASICO_400", label: "Trifásico 400V", shortLabel: "TRI-400" },
];

export function getPhaseTypeLabel(phaseType: PhaseType | null | undefined) {
  return PHASE_OPTIONS.find((option) => option.value === phaseType)?.label ?? "Sin fase";
}

export function getPhaseTypeShortLabel(phaseType: PhaseType | null | undefined) {
  return PHASE_OPTIONS.find((option) => option.value === phaseType)?.shortLabel ?? "S/F";
}

export function solarSystemToForm(system?: SolarSystem | null): SolarSystemFormValues {
  if (!system) return { ...EMPTY_SOLAR_SYSTEM_FORM };

  return {
    description: system.description ?? "",
    inverterBrand: system.inverterBrand ?? "",
    inverterPowerKw: system.inverterPowerKw != null ? String(system.inverterPowerKw) : "",
    inverterQuantity: system.inverterQuantity != null ? String(system.inverterQuantity) : "1",
    inverterPhaseType: system.inverterPhaseType ?? "",
    inverterModel: system.inverterModel ?? "",
    panelQuantity: system.panelQuantity != null ? String(system.panelQuantity) : "",
    panelPowerW: system.panelPowerW != null ? String(system.panelPowerW) : "",
    panelBrand: system.panelBrand ?? "",
    panelModel: system.panelModel ?? "",
  };
}

export function hasSolarSystemValues(form: SolarSystemFormValues) {
  return Object.entries(form).some(([key, value]) => {
    if (key === "inverterQuantity") return value !== "" && value !== "1";
    return value.trim() !== "";
  });
}

export function buildSolarSystemPayload(form: SolarSystemFormValues): SolarSystemPayload {
  return {
    description: cleanText(form.description),
    inverterBrand: cleanText(form.inverterBrand),
    inverterPowerKw: cleanNumber(form.inverterPowerKw),
    inverterQuantity: cleanInteger(form.inverterQuantity),
    inverterPhaseType: form.inverterPhaseType || null,
    inverterModel: cleanText(form.inverterModel),
    panelQuantity: cleanInteger(form.panelQuantity),
    panelPowerW: cleanInteger(form.panelPowerW),
    panelBrand: cleanText(form.panelBrand),
    panelModel: cleanText(form.panelModel),
  };
}

export function formatSolarSystemPrimary(system: SolarSystem) {
  const inverterBits = [
    system.inverterBrand,
    system.inverterPowerKw != null ? `${system.inverterPowerKw} kW` : null,
    system.inverterQuantity != null ? `${system.inverterQuantity} inv.` : null,
  ].filter(Boolean);

  return inverterBits.join(" · ") || "Sin inversor";
}

export function formatSolarSystemPanels(system: SolarSystem) {
  if (system.panelQuantity != null && system.panelPowerW != null) {
    return `${system.panelQuantity} × ${system.panelPowerW}W`;
  }
  if (system.panelQuantity != null) return `${system.panelQuantity} paneles`;
  if (system.panelPowerW != null) return `${system.panelPowerW}W c/u`;
  return "Sin paneles";
}

function cleanText(value: string) {
  const next = value.trim();
  return next ? next : null;
}

function cleanNumber(value: string) {
  const next = value.trim();
  return next ? Number(next) : null;
}

function cleanInteger(value: string) {
  const next = value.trim();
  return next ? Number.parseInt(next, 10) : null;
}

function input(hasError = false) {
  return `w-full rounded-md border ${hasError ? "border-red-500" : "border-[var(--color-border)]"} bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none`;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
      {error ? <p className="mt-1 text-[11px] text-red-400">{error}</p> : null}
    </label>
  );
}

export function validateSolarSystem(form: SolarSystemFormValues) {
  const errors: Partial<Record<keyof SolarSystemFormValues, string>> = {};
  if (!form.panelQuantity || Number(form.panelQuantity) <= 0) errors.panelQuantity = "Requerido";
  if (!form.panelPowerW || Number(form.panelPowerW) <= 0) errors.panelPowerW = "Requerido";
  if (!form.inverterBrand?.trim()) errors.inverterBrand = "Requerido";
  if (!form.inverterPowerKw || Number(form.inverterPowerKw) <= 0) errors.inverterPowerKw = "Requerido";
  return errors;
}

export function SolarSystemFields({
  form,
  onChange,
  errors = {},
}: {
  form: SolarSystemFormValues;
  onChange: (key: keyof SolarSystemFormValues, value: string) => void;
  errors?: Partial<Record<keyof SolarSystemFormValues, string>>;
}) {
  function bind(key: keyof SolarSystemFormValues) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange(key, event.target.value);
  }

  return (
    <div className="space-y-4">
      <Field label="Descripción">
        <input
          className={input()}
          value={form.description}
          onChange={bind("description")}
          placeholder="Ej: Sistema principal"
        />
      </Field>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-4">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Inversor
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Marca *" error={errors.inverterBrand}>
            <input className={input(!!errors.inverterBrand)} value={form.inverterBrand} onChange={bind("inverterBrand")} placeholder="Growatt" />
          </Field>
          <Field label="Modelo">
            <input className={input()} value={form.inverterModel} onChange={bind("inverterModel")} placeholder="MID 25KTL3-X" />
          </Field>
          <Field label="Potencia (kW) *" error={errors.inverterPowerKw}>
            <input type="number" min="0" step="0.01" className={input(!!errors.inverterPowerKw)} value={form.inverterPowerKw} onChange={bind("inverterPowerKw")} placeholder="25" />
          </Field>
          <Field label="Cantidad" error={errors.inverterQuantity}>
            <input type="number" min="1" step="1" className={input(!!errors.inverterQuantity)} value={form.inverterQuantity} onChange={bind("inverterQuantity")} placeholder="1" />
          </Field>
          <Field label="Tipo de fase" error={errors.inverterPhaseType}>
            <select className={input(!!errors.inverterPhaseType)} value={form.inverterPhaseType} onChange={bind("inverterPhaseType")}>
              <option value="">Seleccionar</option>
              {PHASE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-4">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Paneles
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Cantidad *" error={errors.panelQuantity}>
            <input type="number" min="0" step="1" className={input(!!errors.panelQuantity)} value={form.panelQuantity} onChange={bind("panelQuantity")} placeholder="40" />
          </Field>
          <Field label="Potencia por panel (W) *" error={errors.panelPowerW}>
            <input type="number" min="0" step="1" className={input(!!errors.panelPowerW)} value={form.panelPowerW} onChange={bind("panelPowerW")} placeholder="550" />
          </Field>
          <Field label="Marca">
            <input className={input()} value={form.panelBrand} onChange={bind("panelBrand")} placeholder="Longi" />
          </Field>
          <Field label="Modelo">
            <input className={input()} value={form.panelModel} onChange={bind("panelModel")} placeholder="LR5-72HPH-550M" />
          </Field>
        </div>
      </div>
    </div>
  );
}

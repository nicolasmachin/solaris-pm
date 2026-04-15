import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { createProject } from "../../api/projects.api";
import { Button } from "../ui/Button";
import {
  buildSolarSystemPayload,
  EMPTY_SOLAR_SYSTEM_FORM,
  hasSolarSystemValues,
  type SolarSystemFormValues,
  SolarSystemFields,
} from "./SolarSystemFields";

interface NewProjectForm {
  clientName: string;
  capacityKwp: string;
  locationCity: string;
  locationProvince: string;
  plannedEndDate: string;
  budgetUsd: string;
  startDate: string;
  estimatedMwhYear: string;
  notificationEmail: string;
  notificationPhone: string;
}

const EMPTY_FORM: NewProjectForm = {
  clientName: "",
  capacityKwp: "",
  locationCity: "",
  locationProvince: "",
  plannedEndDate: "",
  budgetUsd: "",
  startDate: new Date().toISOString().split("T")[0] ?? "",
  estimatedMwhYear: "",
  notificationEmail: "",
  notificationPhone: "",
};

function validate(form: NewProjectForm) {
  const errors: Partial<Record<keyof NewProjectForm, string>> = {};
  if (!form.clientName.trim()) errors.clientName = "Requerido";
  if (!form.capacityKwp || Number(form.capacityKwp) <= 0) errors.capacityKwp = "Debe ser mayor a 0";
  if (!form.locationCity.trim()) errors.locationCity = "Requerido";
  if (!form.locationProvince.trim()) errors.locationProvince = "Requerido";
  if (!form.plannedEndDate) errors.plannedEndDate = "Requerido";
  if (!form.budgetUsd || Number(form.budgetUsd) <= 0) errors.budgetUsd = "Debe ser mayor a 0";
  return errors;
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

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewProjectForm>(EMPTY_FORM);
  const [solarForm, setSolarForm] = useState<SolarSystemFormValues>(EMPTY_SOLAR_SYSTEM_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NewProjectForm, string>>>({});
  const [showSolarSection, setShowSolarSection] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        clientName: form.clientName.trim(),
        capacityKwp: Number(form.capacityKwp),
        locationCity: form.locationCity.trim(),
        locationProvince: form.locationProvince.trim(),
        plannedEndDate: form.plannedEndDate,
        budgetUsd: Number(form.budgetUsd),
        startDate: form.startDate || undefined,
        estimatedMwhYear: form.estimatedMwhYear ? Number(form.estimatedMwhYear) : undefined,
        notificationEmail: form.notificationEmail.trim() || undefined,
        notificationPhone: form.notificationPhone.trim() || undefined,
        solarSystem: hasSolarSystemValues(solarForm) ? buildSolarSystemPayload(solarForm) : undefined,
      }),
    onSuccess: (project) => {
      toast.success("Proyecto creado correctamente");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", project.id] });
      onClose();
      navigate(`/projects/${project.id}`);
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? "No se pudo crear el proyecto");
    },
  });

  function updateField(key: keyof NewProjectForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  function updateSolarField(key: keyof SolarSystemFormValues, value: string) {
    setSolarForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = validate(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">Nuevo proyecto</h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Podés dejar el sistema fotovoltaico para después si todavía no está definido.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Datos del proyecto</p>

            <Field label="Nombre del cliente" error={errors.clientName}>
              <input className={input(!!errors.clientName)} value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} placeholder="Ej: Agroindustrial Sur S.A." />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Capacidad (kWp)" error={errors.capacityKwp}>
                <input type="number" min="0" step="0.01" className={input(!!errors.capacityKwp)} value={form.capacityKwp} onChange={(event) => updateField("capacityKwp", event.target.value)} placeholder="25" />
              </Field>
              <Field label="Presupuesto (USD)" error={errors.budgetUsd}>
                <input type="number" min="0" step="0.01" className={input(!!errors.budgetUsd)} value={form.budgetUsd} onChange={(event) => updateField("budgetUsd", event.target.value)} placeholder="120000" />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Ciudad" error={errors.locationCity}>
                <input className={input(!!errors.locationCity)} value={form.locationCity} onChange={(event) => updateField("locationCity", event.target.value)} placeholder="Montevideo" />
              </Field>
              <Field label="Provincia / Depto." error={errors.locationProvince}>
                <input className={input(!!errors.locationProvince)} value={form.locationProvince} onChange={(event) => updateField("locationProvince", event.target.value)} placeholder="Montevideo" />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Fecha de inicio">
                <input type="date" className={input()} value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
              </Field>
              <Field label="Fecha estimada de fin" error={errors.plannedEndDate}>
                <input type="date" className={input(!!errors.plannedEndDate)} value={form.plannedEndDate} onChange={(event) => updateField("plannedEndDate", event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Generación anual (MWh)">
                <input type="number" min="0" step="0.01" className={input()} value={form.estimatedMwhYear} onChange={(event) => updateField("estimatedMwhYear", event.target.value)} placeholder="40" />
              </Field>
              <Field label="Email de notificación">
                <input type="email" className={input()} value={form.notificationEmail} onChange={(event) => updateField("notificationEmail", event.target.value)} placeholder="cliente@empresa.com" />
              </Field>
            </div>

            <Field label="Teléfono WhatsApp">
              <input type="tel" className={input()} value={form.notificationPhone} onChange={(event) => updateField("notificationPhone", event.target.value)} placeholder="+59899123456" />
            </Field>
          </div>

          <div className="rounded-xl border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setShowSolarSection((current) => !current)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Sistema fotovoltaico</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Sección opcional para cargar el primer sistema desde la creación.</p>
              </div>
              <span className="text-sm text-[var(--color-text-muted)]">{showSolarSection ? "Ocultar" : "Completar"}</span>
            </button>

            {showSolarSection ? (
              <div className="border-t border-[var(--color-border)] px-4 py-4">
                <SolarSystemFields form={solarForm} onChange={updateSolarField} />
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-[var(--color-border)] pt-3">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Crear proyecto
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { createProject } from "../../api/projects.api";
import { getUsers } from "../../api/users.api";
import { todayLocalISO } from "../../utils/date";
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
  budgetUsd: string;
  salespersonId: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  saleDate: string;
  llevaFactura: boolean;
  facturaNota: string;
}

function buildEmptyForm(): NewProjectForm {
  return {
    clientName: "",
    capacityKwp: "",
    locationCity: "",
    locationProvince: "",
    budgetUsd: "",
    salespersonId: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    saleDate: todayLocalISO(),
    llevaFactura: false,
    facturaNota: "",
  };
}

function calculateCapacity(solarForm: SolarSystemFormValues): number {
  const panelQuantity = Number(solarForm.panelQuantity) || 0;
  const panelPowerW = Number(solarForm.panelPowerW) || 0;
  const inverterPowerKw = Number(solarForm.inverterPowerKw) || 0;
  const inverterQuantity = Number(solarForm.inverterQuantity) || 1;

  const panelCapacityKw = (panelQuantity * panelPowerW) / 1000;
  const inverterCapacityKw = inverterPowerKw * inverterQuantity;

  return Math.min(panelCapacityKw, inverterCapacityKw);
}

function validate(form: NewProjectForm) {
  const errors: Partial<Record<keyof NewProjectForm, string>> = {};
  // Sólo estos 4 son obligatorios
  if (!form.clientName.trim()) errors.clientName = "Requerido";
  if (!form.locationCity.trim()) errors.locationCity = "Requerido";
  if (!form.locationProvince.trim()) errors.locationProvince = "Requerido";
  // capacityKwp se valida por solarForm (o es 0 y el usuario tiene que cargar después)
  if (form.budgetUsd && Number(form.budgetUsd) <= 0) errors.budgetUsd = "Debe ser mayor a 0";
  return errors;
}

function input(hasError = false) {
  return `w-full rounded-md border ${hasError ? "border-red-500" : "border-[var(--color-border)]"} bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none`;
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-1 text-[10px] italic text-[var(--color-text-muted)]">{hint}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-red-400">{error}</p> : null}
    </label>
  );
}

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewProjectForm>(buildEmptyForm);
  const [solarForm, setSolarForm] = useState<SolarSystemFormValues>(EMPTY_SOLAR_SYSTEM_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof NewProjectForm, string>>>({});

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const capacityKwp = calculateCapacity(solarForm);
      const hasCapacity = capacityKwp > 0;
      const estimatedMwhYear = hasCapacity ? capacityKwp * 1.478 : undefined;
      const solarPayload = hasSolarSystemValues(solarForm) ? buildSolarSystemPayload(solarForm) : undefined;
      return createProject({
        clientName: form.clientName.trim(),
        capacityKwp: hasCapacity ? capacityKwp : 0.01, // placeholder mínimo, el admin lo edita después
        locationCity: form.locationCity.trim(),
        locationProvince: form.locationProvince.trim(),
        budgetUsd: form.budgetUsd ? Number(form.budgetUsd) : undefined,
        estimatedMwhYear,
        salespersonId: form.salespersonId || undefined,
        clientEmail: form.clientEmail.trim() || undefined,
        clientPhone: form.clientPhone.trim() || undefined,
        clientAddress: form.clientAddress.trim() || undefined,
        saleDate: form.saleDate || undefined,
        llevaFactura: form.llevaFactura,
        facturaNota: form.facturaNota.trim() || undefined,
        solarSystem: solarPayload,
      });
    },
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
    // El sistema técnico es 100% opcional — se envía lo que haya cargado el usuario.
    setErrors({});
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
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

            <Field label="Nombre del cliente *" error={errors.clientName}>
              <input className={input(!!errors.clientName)} value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Ciudad *" error={errors.locationCity}>
                <input className={input(!!errors.locationCity)} value={form.locationCity} onChange={(event) => updateField("locationCity", event.target.value)} />
              </Field>
              <Field label="Departamento *" error={errors.locationProvince}>
                <input className={input(!!errors.locationProvince)} value={form.locationProvince} onChange={(event) => updateField("locationProvince", event.target.value)} />
              </Field>
            </div>

            <Field label="Dirección">
              <input type="text" className={input()} value={form.clientAddress} onChange={(event) => updateField("clientAddress", event.target.value)} />
            </Field>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Presupuesto (USD)" error={errors.budgetUsd}>
                <input type="number" min="0" step="0.01" className={input(!!errors.budgetUsd)} value={form.budgetUsd} onChange={(event) => updateField("budgetUsd", event.target.value)} />
              </Field>
              <Field label="Fecha de venta">
                <input type="date" className={input()} value={form.saleDate} onChange={(event) => updateField("saleDate", event.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Email del cliente" hint="Solo para contacto manual. No se usa para enviar notificaciones automáticas.">
                <input type="text" className={input()} value={form.clientEmail} onChange={(event) => updateField("clientEmail", event.target.value)} />
              </Field>
              <Field label="Teléfono del cliente" hint="Solo para contacto manual. No se usa para enviar WhatsApps automáticos.">
                <input type="tel" className={input()} value={form.clientPhone} onChange={(event) => updateField("clientPhone", event.target.value)} />
              </Field>
            </div>

            <Field label="Vendedor" error={errors.salespersonId}>
              <select className={input(!!errors.salespersonId)} value={form.salespersonId} onChange={(event) => updateField("salespersonId", event.target.value)}>
                <option value="">Seleccionar vendedor...</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </Field>

            <div className="rounded-xl border border-[var(--color-border)] px-4 py-3 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.llevaFactura}
                  onChange={(event) => setForm((current) => ({ ...current, llevaFactura: event.target.checked }))}
                  className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text-primary)]">Lleva factura</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">— el cliente exige factura fiscal</span>
              </label>
              {form.llevaFactura ? (
                <Field label="Nota de facturación">
                  <textarea
                    className={input()}
                    rows={2}
                    placeholder="RUT, razón social, a nombre de quién facturar, etc."
                    value={form.facturaNota}
                    onChange={(event) => updateField("facturaNota", event.target.value)}
                  />
                </Field>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Sistema fotovoltaico (opcional)</p>
            <div className="rounded-xl border border-[var(--color-border)] px-4 py-4">
              <SolarSystemFields form={solarForm} onChange={updateSolarField} optional />
            </div>
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

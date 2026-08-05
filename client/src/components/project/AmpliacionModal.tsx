import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { createAmpliacion } from "../../api/projects.api";
import type { Project } from "../../types/api.types";
import { todayLocalISO } from "../../utils/date";
import { Button } from "../ui/Button";
import {
  buildSolarSystemPayload,
  EMPTY_SOLAR_SYSTEM_FORM,
  hasSolarSystemValues,
  type SolarSystemFormValues,
  SolarSystemFields,
} from "./SolarSystemFields";

/**
 * Alta de una ampliación sobre una instalación existente.
 *
 * El form pide SOLO lo propio de la obra nueva. Todo lo del cliente —nombre,
 * ubicación, contacto, cédula, códigos UTE— se hereda del proyecto original y se
 * muestra arriba de solo lectura: que no haya que retipearlo es justamente el
 * motivo de la feature. Si algo de eso cambió, se edita después en la ficha.
 */
export function AmpliacionModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [solarForm, setSolarForm] = useState<SolarSystemFormValues>(EMPTY_SOLAR_SYSTEM_FORM);
  const [budgetUsd, setBudgetUsd] = useState("");
  const [startDate, setStartDate] = useState(todayLocalISO());
  const [saleDate, setSaleDate] = useState(todayLocalISO());
  const [error, setError] = useState<string | null>(null);

  // La obra de la que cuelga: si estamos parados sobre una ampliación, el padre
  // es la raíz. El backend resuelve lo mismo; acá es solo para el texto.
  const raiz = project.parentProject ?? { code: project.code, clientName: project.clientName };

  const capacityKwp = calculateCapacity(solarForm);

  const mutation = useMutation({
    mutationFn: () =>
      createAmpliacion(project.id, {
        capacityKwp,
        startDate,
        saleDate,
        budgetUsd: budgetUsd ? Number(budgetUsd) : null,
        estimatedMwhYear: capacityKwp > 0 ? capacityKwp * 1.478 : null,
        solarSystem: hasSolarSystemValues(solarForm)
          ? buildSolarSystemPayload(solarForm)
          : undefined,
      }),
    onSuccess: (nuevo) => {
      toast.success(`Ampliación ${nuevo.code} creada`);
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      onClose();
      navigate(`/projects/${nuevo.id}`);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      toast.error(message ?? "No se pudo crear la ampliación");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // La potencia sale del sistema fotovoltaico: sin paneles ni inversor cargados
    // no hay ampliación que medir, y crearla en 0 kWp ensucia las métricas.
    if (capacityKwp <= 0) {
      setError("Cargá los paneles y el inversor de la ampliación para calcular la potencia.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">
              Nueva ampliación
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Sobre {raiz.clientName} · {raiz.code}. Arranca como una obra nueva, con su pipeline
              completo y su propio trámite UTE.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] px-4 py-3">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Se hereda de la obra original
            </p>
            <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
              <Heredado label="Cliente" valor={project.clientName} />
              <Heredado
                label="Ubicación"
                valor={`${project.locationCity}, ${project.locationProvince}`}
              />
              <Heredado label="Dirección" valor={project.clientAddress} />
              <Heredado label="Vendedor" valor={project.salesperson?.name ?? null} />
              <Heredado label="Titular (cédula)" valor={project.nombreCliente || null} />
              <Heredado label="Códigos UTE" valor={codigosUte(project)} />
            </div>
            <p className="mt-3 text-[10px] italic text-[var(--color-text-muted)]">
              La cédula y la factura de UTE se copian a la ampliación. Si algo cambió, se edita
              después desde la ficha del proyecto nuevo.
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Datos de la ampliación
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Fecha de inicio">
                <input
                  type="date"
                  className={inputClass()}
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </Field>
              <Field label="Fecha de venta">
                <input
                  type="date"
                  className={inputClass()}
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                />
              </Field>
              <Field label="Presupuesto (USD)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass()}
                  value={budgetUsd}
                  onChange={(event) => setBudgetUsd(event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Lo que se agrega
              </p>
              {capacityKwp > 0 ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Potencia de la ampliación:{" "}
                  <span className="font-semibold text-[var(--color-accent)]">
                    {capacityKwp.toFixed(2)} kWp
                  </span>
                </p>
              ) : null}
            </div>
            <SolarSystemFields
              form={solarForm}
              optional
              onChange={(key, value) => setSolarForm((current) => ({ ...current, [key]: value }))}
            />
          </div>

          {error ? <p className="text-[11px] text-red-400">{error}</p> : null}

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]/30"
            >
              Cancelar
            </button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creando…" : "Crear ampliación"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Misma fórmula que el alta de proyecto: el mínimo entre paneles e inversor. */
function calculateCapacity(solarForm: SolarSystemFormValues): number {
  const panelQuantity = Number(solarForm.panelQuantity) || 0;
  const panelPowerW = Number(solarForm.panelPowerW) || 0;
  const inverterPowerKw = Number(solarForm.inverterPowerKw) || 0;
  const inverterQuantity = Number(solarForm.inverterQuantity) || 1;

  const panelCapacityKw = (panelQuantity * panelPowerW) / 1000;
  const inverterCapacityKw = inverterPowerKw * inverterQuantity;

  return Math.min(panelCapacityKw, inverterCapacityKw);
}

function codigosUte(project: Project): string | null {
  const partes = [project.uteCodigoPS, project.uteCodigoAS].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}

function Heredado({ label, valor }: { label: string; valor: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-[var(--color-text-muted)]">{label}:</span>
      <span className="truncate text-[var(--color-text-secondary)]">{valor || "—"}</span>
    </div>
  );
}

function inputClass() {
  return "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

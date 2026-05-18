import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { createSolarSystem, patchSolarSystem } from "../../api/projects.api";
import type { SolarSystem } from "../../types/api.types";
import { Button } from "../ui/Button";
import {
  buildSolarSystemPayload,
  solarSystemToForm,
  type SolarSystemFormValues,
  SolarSystemFields,
} from "./SolarSystemFields";

export function SolarSystemModal({
  projectId,
  system,
  nextOrder,
  onClose,
}: {
  projectId: string;
  system?: SolarSystem | null;
  nextOrder?: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SolarSystemFormValues>(solarSystemToForm(system));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildSolarSystemPayload(form);
      if (system) {
        return patchSolarSystem(projectId, system.id, payload);
      }
      return createSolarSystem(projectId, {
        ...payload,
        order: nextOrder,
      });
    },
    onSuccess: () => {
      toast.success(system ? "Sistema actualizado" : "Sistema creado");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message ?? "No se pudo guardar el sistema");
    },
  });

  function updateField(key: keyof SolarSystemFormValues, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">
              {system ? "Editar sistema fotovoltaico" : "Agregar sistema fotovoltaico"}
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Cargá inversor, paneles y una descripción opcional para identificar este sistema.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            ✕
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          <SolarSystemFields form={form} onChange={updateField} />

          <div className="mt-5 flex justify-end gap-3 border-t border-[var(--color-border)] pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { patchProject } from "../../api/projects.api";
import { useAuthStore } from "../../store/auth.store";

// Peso de la obra: cuántas "obras" vale el proyecto para la métrica ponderada.
// Editable solo por ADMIN; el resto lo ve en solo lectura.
export function PesoObraCard({ projectId, pesoObra }: { projectId: string; pesoObra: number }) {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === "ADMIN");
  const [value, setValue] = useState(String(pesoObra));

  // Si el valor cambia desde el server (refetch), reflejarlo en el input.
  useEffect(() => {
    setValue(String(pesoObra));
  }, [pesoObra]);

  const mut = useMutation({
    mutationFn: (n: number) => patchProject(projectId, { pesoObra: n }),
    onSuccess: () => {
      toast.success("Peso de obra actualizado");
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["metrics"] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo actualizar el peso");
      setValue(String(pesoObra));
    },
  });

  function save() {
    const n = parseInt(value, 10);
    if (!Number.isInteger(n) || n < 1) {
      toast.error("El peso debe ser un entero mayor o igual a 1");
      setValue(String(pesoObra));
      return;
    }
    if (n === pesoObra) return;
    mut.mutate(n);
  }

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Peso de obra
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            Cuántas obras vale este proyecto (por defecto 1)
          </p>
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={value}
              disabled={mut.isPending}
              onChange={(e) => setValue(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm tabular-nums text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none disabled:opacity-50"
              aria-label="Peso de obra"
            />
          </div>
        ) : (
          <span className="text-lg font-bold tabular-nums text-[var(--color-text-primary)]">
            {pesoObra}
          </span>
        )}
      </div>
    </div>
  );
}

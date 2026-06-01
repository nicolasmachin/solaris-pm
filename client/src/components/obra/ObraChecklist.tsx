import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Plus } from "lucide-react";

import {
  createChecklistItem,
  deleteChecklistItem,
  getChecklist,
  updateChecklistItem,
} from "../../api/obra.api";
import { ObraChecklistItem } from "./ObraChecklistItem";

interface Props {
  projectId: string;
}

export function ObraChecklist({ projectId }: Props) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  // Item con mutación en curso, para deshabilitarlo puntualmente.
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const queryKey = ["obra-checklist", projectId];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => getChecklist(projectId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const updateMut = useMutation({
    mutationFn: (vars: { itemId: string; body: { status?: "OK" | "PENDING"; observation?: string | null } }) =>
      updateChecklistItem(projectId, vars.itemId, vars.body),
    onMutate: (vars) => setBusyItemId(vars.itemId),
    onSuccess: () => invalidate(),
    onError: () => toast.error("No se pudo actualizar el ítem"),
    onSettled: () => setBusyItemId(null),
  });

  const createMut = useMutation({
    mutationFn: (body: { name: string; description?: string }) => createChecklistItem(projectId, body),
    onSuccess: () => {
      toast.success("Ítem agregado");
      setNewName("");
      setNewDesc("");
      setAdding(false);
      invalidate();
    },
    onError: () => toast.error("No se pudo agregar el ítem"),
  });

  const deleteMut = useMutation({
    mutationFn: (itemId: string) => deleteChecklistItem(projectId, itemId),
    onMutate: (itemId) => setBusyItemId(itemId),
    onSuccess: () => {
      toast.success("Ítem eliminado");
      invalidate();
    },
    onError: () => toast.error("No se pudo eliminar el ítem"),
    onSettled: () => setBusyItemId(null),
  });

  const items = data?.items ?? [];
  const summary = data?.summary ?? { total: 0, completed: 0, pending: 0, percentComplete: 0 };

  function submitNew() {
    const name = newName.trim();
    if (!name) return;
    createMut.mutate({ name, description: newDesc.trim() || undefined });
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
          Checklist de referencia
        </h3>
        <span className="font-mono text-xs text-[var(--color-text-muted)]">
          {summary.completed}/{summary.total} · {summary.percentComplete}%
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]/50">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${summary.percentComplete}%` }}
        />
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-[var(--color-text-muted)]">Cargando…</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ObraChecklistItem
              key={item.id}
              item={item}
              busy={busyItemId === item.id}
              onToggle={(next) => updateMut.mutate({ itemId: item.id, body: { status: next } })}
              onSaveObservation={(observation) =>
                updateMut.mutate({ itemId: item.id, body: { observation: observation || null } })
              }
              onDelete={() => deleteMut.mutate(item.id)}
            />
          ))}

          {items.length === 0 && (
            <div className="py-4 text-center text-xs text-[var(--color-text-muted)]">
              No hay ítems de checklist.
            </div>
          )}
        </div>
      )}

      {/* Agregar ítem custom */}
      <div className="mt-3">
        {adding ? (
          <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del ítem"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Descripción (opcional)"
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={createMut.isPending}
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setNewDesc("");
                }}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={createMut.isPending || !newName.trim()}
                onClick={submitNew}
                className="rounded-lg bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {createMut.isPending ? "Agregando…" : "Agregar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
          >
            <Plus size={14} />
            Agregar ítem de referencia
          </button>
        )}
      </div>
    </div>
  );
}

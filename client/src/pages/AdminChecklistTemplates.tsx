import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";

import {
  type ChecklistTemplate,
  createChecklistTemplate,
  getChecklistTemplates,
  reorderChecklistTemplates,
  updateChecklistTemplate,
} from "../api/obra.api";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider";

const QK = ["checklist-templates-admin"];

export function TabChecklistTemplates() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: QK,
    queryFn: getChecklistTemplates,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: QK });

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim(), description: description.trim() || undefined };
      if (editing) {
        return updateChecklistTemplate(editing.id, {
          name: body.name,
          description: body.description ?? null,
        });
      }
      return createChecklistTemplate(body);
    },
    onSuccess: () => {
      toast.success(editing ? "Plantilla actualizada" : "Plantilla creada");
      closeForm();
      invalidate();
    },
    onError: () => toast.error("No se pudo guardar la plantilla"),
  });

  const toggleMut = useMutation({
    mutationFn: (t: ChecklistTemplate) => updateChecklistTemplate(t.id, { isActive: !t.isActive }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      invalidate();
    },
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  const reorderMut = useMutation({
    mutationFn: (items: { id: string; order: number }[]) => reorderChecklistTemplates(items),
    onSuccess: () => invalidate(),
    onError: () => toast.error("No se pudo reordenar"),
  });

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setShowForm(true);
  }

  function openEdit(t: ChecklistTemplate) {
    setEditing(t);
    setName(t.name);
    setDescription(t.description ?? "");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setName("");
    setDescription("");
  }

  // Intercambia el order con el vecino y manda ambos al endpoint de reorder.
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= templates.length) return;
    const a = templates[index];
    const b = templates[target];
    reorderMut.mutate([
      { id: a.id, order: b.order },
      { id: b.id, order: a.order },
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[var(--color-text-muted)]">
          Ítems de referencia que se copian automáticamente al checklist de Obra de cada proyecto
          la primera vez que se abre. Desactivar una plantilla la quita de proyectos nuevos (no
          afecta a los que ya la tienen copiada).
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          <Plus size={15} />
          Nueva plantilla
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">Cargando…</div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-8 text-center text-sm text-[var(--color-text-muted)]">
          No hay plantillas todavía.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)] text-left font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                <th className="px-3 py-2 w-20">Orden</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2 w-24">Estado</th>
                <th className="px-3 py-2 w-24 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t, idx) => (
                <tr
                  key={t.id}
                  className={`border-b border-[var(--color-border)] last:border-0 ${
                    t.isActive ? "" : "opacity-50"
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0 || reorderMut.isPending}
                        onClick={() => move(idx, -1)}
                        aria-label="Subir"
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)] disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === templates.length - 1 || reorderMut.isPending}
                        onClick={() => move(idx, 1)}
                        aria-label="Bajar"
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)] disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{t.name}</td>
                  <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                    {t.description ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => toggleMut.mutate(t)}
                      disabled={toggleMut.isPending}
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        t.isActive
                          ? "bg-green-500/15 text-green-500"
                          : "bg-[var(--color-border)]/50 text-[var(--color-text-muted)]"
                      }`}
                    >
                      {t.isActive ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        aria-label="Editar"
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)]"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !saveMut.isPending && closeForm()}
        >
          <div
            className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {editing ? "Editar plantilla" : "Nueva plantilla"}
              </h4>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Cerrar"
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={lbl}>Nombre</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Verificar puesta a tierra"
                  className={inp}
                />
              </div>
              <div>
                <label className={lbl}>Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={inp}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saveMut.isPending}
                onClick={closeForm}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saveMut.isPending || !name.trim()}
                onClick={() => saveMut.mutate()}
                className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {saveMut.isPending ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

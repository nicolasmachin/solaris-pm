import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Stage, Substage, SubstageStatus, FileAttachment, ChecklistItem } from "../../types/api.types";
import { patchSubstage, patchStage, createSubstage, deleteSubstage, completeSubstage, completeAllSubstages } from "../../api/stages.api";
import { apiClient } from "../../api/axios";
import { uploadFile, getDownloadUrl } from "../../api/files.api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { CommentThread } from "../comments/CommentThread";

interface StageDrawerProps {
  stage: Stage;
  projectId: string;
  files: FileAttachment[];
  onClose: () => void;
}

// ─── Checklist section ────────────────────────────────────────────────────────

function ChecklistSection({
  substage,
  projectId,
  stageId,
  onChanged,
}: {
  substage: Substage;
  projectId: string;
  stageId: string;
  onChanged: () => void;
}) {
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ChecklistItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const { mutate: toggleItem } = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: string; completed: boolean }) =>
      apiClient.patch(`/api/checklist/${itemId}`, { completed }).then(r => r.data),
    onSuccess: onChanged,
    onError: () => toast.error("Error al actualizar ítem"),
  });

  const { mutate: saveLabel, isPending: savingLabel } = useMutation({
    mutationFn: ({ itemId, label }: { itemId: string; label: string }) =>
      apiClient.patch(`/api/checklist/${itemId}`, { label }).then(r => r.data),
    onSuccess: () => { setEditingItem(null); onChanged(); },
    onError: () => toast.error("Error al editar ítem"),
  });

  const { mutate: removeItem, isPending: deletingItem } = useMutation({
    mutationFn: (itemId: string) => apiClient.delete(`/api/checklist/${itemId}`),
    onSuccess: () => { setConfirmDeleteItem(null); onChanged(); },
    onError: () => toast.error("Error al eliminar ítem"),
  });

  const { mutate: addItem, isPending: addingItemPending } = useMutation({
    mutationFn: (label: string) =>
      apiClient.post(`/api/projects/${projectId}/stages/${stageId}/substages/${substage.id}/checklist`, { label }).then(r => r.data),
    onSuccess: () => { setNewLabel(""); setAddingItem(false); onChanged(); },
    onError: () => toast.error("Error al agregar ítem"),
  });

  const items = substage.checklistItems ?? [];

  return (
    <>
      <div className="mt-2">
        <div className="flex items-center justify-between mb-1.5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Checklist ({items.filter(i => i.completed).length}/{items.length})
          </p>
          <button
            onClick={() => setAddingItem(v => !v)}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            + Agregar
          </button>
        </div>

        {/* Formulario agregar ítem */}
        {addingItem && (
          <div className="flex gap-1 mb-2">
            <input
              className="flex-1 px-1.5 py-1 text-[11px] bg-[var(--color-bg-app)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Descripción del ítem..."
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && newLabel.trim()) addItem(newLabel.trim());
                if (e.key === "Escape") { setAddingItem(false); setNewLabel(""); }
              }}
              autoFocus
            />
            <button
              onClick={() => newLabel.trim() && addItem(newLabel.trim())}
              disabled={addingItemPending || !newLabel.trim()}
              style={{ padding: "2px 8px", borderRadius: 3, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 10, cursor: "pointer" }}
            >✓</button>
            <button
              onClick={() => { setAddingItem(false); setNewLabel(""); }}
              style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-muted)", fontSize: 10, cursor: "pointer" }}
            >✕</button>
          </div>
        )}

        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.id} className="flex items-center gap-2 group">
              <button
                onClick={() => toggleItem({ itemId: item.id, completed: !item.completed })}
                style={{
                  width: 14, height: 14, borderRadius: 3,
                  border: `1.5px solid ${item.completed ? "var(--color-accent)" : "var(--color-border)"}`,
                  background: item.completed ? "var(--color-accent)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
                }}
              >
                {item.completed && (
                  <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {editingItem === item.id ? (
                <input
                  className="flex-1 px-1.5 py-0.5 text-[11px] bg-[var(--color-bg-app)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") saveLabel({ itemId: item.id, label: editLabel });
                    if (e.key === "Escape") setEditingItem(null);
                  }}
                  autoFocus
                />
              ) : (
                <span
                  className="flex-1 text-[11px] truncate"
                  style={{ color: item.completed ? "var(--color-text-muted)" : "var(--color-text-secondary)", textDecoration: item.completed ? "line-through" : "none" }}
                >
                  {item.label}
                  {item.isRequired && <span className="ml-1 text-[9px] text-red-400">*</span>}
                </span>
              )}

              {editingItem === item.id ? (
                <div className="flex gap-1">
                  <button onClick={() => saveLabel({ itemId: item.id, label: editLabel })} disabled={savingLabel} style={{ padding: "2px 6px", borderRadius: 3, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 10, cursor: "pointer" }}>✓</button>
                  <button onClick={() => setEditingItem(null)} style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-muted)", fontSize: 10, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditingItem(item.id); setEditLabel(item.label); }}
                    style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-muted)", fontSize: 10, cursor: "pointer" }}
                    title="Editar ítem"
                  >✎</button>
                  <button
                    onClick={() => setConfirmDeleteItem(item)}
                    style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid #7f1d1d", background: "none", color: "#f87171", fontSize: 10, cursor: "pointer" }}
                    title="Eliminar ítem"
                  >✕</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {confirmDeleteItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDeleteItem(null); }}>
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 20, width: 320 }}>
            <p style={{ fontSize: 13, color: "var(--color-text-primary)", marginBottom: 8 }}>¿Eliminar ítem del checklist?</p>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 16 }}>{confirmDeleteItem.label}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDeleteItem(null)} style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => removeItem(confirmDeleteItem.id)} disabled={deletingItem} style={{ padding: "6px 12px", borderRadius: 5, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 600, cursor: deletingItem ? "not-allowed" : "pointer" }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Substage Row ─────────────────────────────────────────────────────────────

function SubstageRow({
  substage,
  projectId,
  stageId,
  commentContext,
  statusOptions,
  statusLabels,
  statusError,
  onStatusChange,
  onQuickComplete,
  onChanged,
}: {
  substage: Substage;
  projectId: string;
  stageId: string;
  commentContext: {
    stageLabelsById: Record<string, string>;
    substageNamesById: Record<string, string>;
    checklistLabelsById: Record<string, string>;
  };
  statusOptions: SubstageStatus[];
  statusLabels: Record<SubstageStatus, string>;
  statusError: string | null;
  onStatusChange: (s: SubstageStatus) => void;
  onQuickComplete: () => void;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(substage.name);
  const [responsible, setResponsible] = useState(substage.responsible ?? "");
  const [dueDate, setDueDate] = useState(substage.dueDate?.slice(0, 10) ?? "");
  const [plannedStart, setPlannedStart] = useState(substage.plannedStartDate?.slice(0, 10) ?? "");
  const [plannedEnd, setPlannedEnd] = useState(substage.plannedEndDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(substage.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [checklistPendingItems, setChecklistPendingItems] = useState<{ id: string; label: string }[]>([]);

  const isCompleted = substage.status === "COMPLETED";

  const { mutate: saveEdit, isPending: saving } = useMutation({
    mutationFn: () =>
      patchSubstage(projectId, stageId, substage.id, {
        name, responsible: responsible || undefined,
        dueDate: dueDate || null,
        plannedStartDate: plannedStart || null,
        plannedEndDate: plannedEnd || null,
        notes: notes || null,
      }),
    onSuccess: () => {
      toast.success("Subetapa actualizada");
      setEditing(false);
      onChanged();
    },
    onError: () => toast.error("Error al actualizar subetapa"),
  });

  const { mutate: remove, isPending: deleting } = useMutation({
    mutationFn: () => deleteSubstage(projectId, stageId, substage.id),
    onSuccess: () => {
      toast.success("Subetapa eliminada");
      setConfirmDelete(false);
      onChanged();
    },
    onError: () => toast.error("Error al eliminar subetapa"),
  });

  const completeSubstageMutation = useMutation({
    mutationFn: () => completeSubstage(projectId, stageId, substage.id),
    onSuccess: () => {
      toast.success("Subetapa completada");
      onChanged();
    },
    onError: (err: unknown) => {
      const resp = (err as { response?: { data?: { code?: string; details?: { pendingItems?: { id: string; label: string }[] } } } })?.response?.data;
      if (resp?.code === "CHECKLIST_INCOMPLETE") {
        setChecklistPendingItems(resp.details?.pendingItems ?? []);
      } else {
        toast.error("Error al completar subetapa");
      }
    },
  });

  async function handleQuickComplete(e: React.MouseEvent) {
    e.stopPropagation();
    if (isCompleted) return;
    completeSubstageMutation.mutate();
  }

  const dotColor = {
    COMPLETED: "#4ade80",
    IN_PROGRESS: "#a3e635",
    BLOCKED: "#f87171",
    PENDING: "#3a4a65",
  }[substage.status];

  return (
    <>
      <li className="rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)]">
        {/* Row header */}
        <div className="flex items-start gap-2 px-3 py-2">
          {/* Quick complete circular button */}
          <button
            onClick={handleQuickComplete}
            disabled={isCompleted || completeSubstageMutation.isPending}
            title={isCompleted ? "Completado" : "Marcar como completado"}
            style={{
              width: 18, height: 18, borderRadius: "50%",
              border: `2px solid ${isCompleted ? "#4ade80" : dotColor}`,
              background: isCompleted ? "#4ade80" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isCompleted ? "default" : "pointer",
              flexShrink: 0, marginTop: 1, transition: "all 0.15s",
            }}
          >
            {completeSubstageMutation.isPending ? (
              <span style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid currentColor", borderTopColor: "transparent", animation: "spin 0.6s linear infinite", display: "block" }} />
            ) : isCompleted ? (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !editing && setExpanded(v => !v)}>
            <p className="text-xs text-[var(--color-text-primary)] truncate">{substage.name}</p>
            {substage.responsible && (
              <p className="text-[10px] text-[var(--color-text-muted)]">{substage.responsible}</p>
            )}
            {substage.dueDate && (
              <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
                Vence:{" "}
                {new Date(substage.dueDate).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            <select
              value={substage.status}
              onChange={e => onStatusChange(e.target.value as SubstageStatus)}
              onClick={e => e.stopPropagation()}
              className="text-[10px] bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded px-1 py-0.5 focus:outline-none"
            >
              {statusOptions.map(s => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
            {statusError && (
              <p className="max-w-[180px] text-right text-[10px] leading-tight text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-1.5 py-0.5">
                {statusError}
              </p>
            )}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && !editing && (
          <div className="border-t border-[var(--color-border)] px-3 py-2">
            {substage.notes && (
              <p className="text-[11px] text-[var(--color-text-secondary)] mb-2">{substage.notes}</p>
            )}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setEditing(true)}
                className="text-[10px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-[10px] px-2 py-1 rounded border border-red-900 text-red-400 hover:bg-red-900/20 transition-colors"
              >
                Eliminar
              </button>
            </div>

            {/* Checklist */}
            <ChecklistSection
              substage={substage}
              projectId={projectId}
              stageId={stageId}
              onChanged={onChanged}
            />

            <div className="mt-3">
              <CommentThread
                projectId={projectId}
                stageId={stageId}
                substageId={substage.id}
                level="substage"
                context={commentContext}
              />
            </div>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="border-t border-[var(--color-border)] px-3 py-2 space-y-2">
            <input
              className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Nombre"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              placeholder="Responsable"
              value={responsible}
              onChange={e => setResponsible(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Plan inicio</p>
                <input type="date" className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]" value={plannedStart} onChange={e => setPlannedStart(e.target.value)} />
              </div>
              <div>
                <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Plan fin</p>
                <input type="date" className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Fecha límite</p>
              <input type="date" className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <textarea
              className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
              placeholder="Notas"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" loading={saving} disabled={!name} onClick={() => saveEdit()}>
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </li>

      {/* Confirm delete substage */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 20, width: 320 }}>
            <p style={{ fontSize: 13, color: "var(--color-text-primary)", marginBottom: 8 }}>¿Eliminar subetapa?</p>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 16 }}>{substage.name}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: "6px 12px", borderRadius: 5, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
              <button onClick={() => remove()} disabled={deleting} style={{ padding: "6px 12px", borderRadius: 5, border: "none", background: "#dc2626", color: "#fff", fontSize: 12, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer" }}>
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist incomplete modal */}
      {checklistPendingItems.length > 0 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setChecklistPendingItems([]); }}>
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 20, width: 360 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>Checklist incompleto</p>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 12 }}>
              Hay ítems requeridos sin completar en <strong>{substage.name}</strong>:
            </p>
            <ul style={{ marginBottom: 16 }}>
              {checklistPendingItems.map(item => (
                <li key={item.id} style={{ fontSize: 12, color: "var(--color-text-secondary)", padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
                  {item.label}
                </li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setChecklistPendingItems([])} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Stage Drawer ─────────────────────────────────────────────────────────────

export function StageDrawer({ stage, projectId, files, onClose }: StageDrawerProps) {
  const qc = useQueryClient();
  const stageFiles = files.filter((f) => f.stageId === stage.id);
  const stageCommentContext = {
    stageLabelsById: { [stage.id]: stage.name },
    substageNamesById: Object.fromEntries(stage.substages.map((substage) => [substage.id, substage.name])),
    checklistLabelsById: Object.fromEntries(
      stage.substages.flatMap((substage) => substage.checklistItems.map((item) => [item.id, item.label])),
    ),
  };

  // Notes
  const [notes, setNotes] = useState(stage.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);

  // Stage dates editing
  const [editingDates, setEditingDates] = useState(false);
  const [plannedStart, setPlannedStart] = useState(stage.plannedStartDate?.slice(0, 10) ?? "");
  const [plannedEnd, setPlannedEnd] = useState(stage.plannedEndDate?.slice(0, 10) ?? "");
  const [responsibleName, setResponsibleName] = useState(
    (stage as Stage & { responsibleName?: string | null }).responsibleName ?? ""
  );

  // New substage form
  const [showSubForm, setShowSubForm] = useState(false);
  const [subName, setSubName] = useState("");
  const [subResponsible, setSubResponsible] = useState("");
  const [subDue, setSubDue] = useState("");

  // File upload
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error inline por substage (para OPERATIONS_NOT_ACTIVE, etc.)
  const [substageStatusError, setSubstageStatusError] = useState<
    { substageId: string; message: string } | null
  >(null);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  // Patch substage status
  const subStatusMutation = useMutation({
    mutationFn: ({
      substageId,
      status,
    }: {
      substageId: string;
      status: SubstageStatus;
    }) => patchSubstage(projectId, stage.id, substageId, { status }),
    onMutate: ({ substageId }) => {
      if (substageStatusError?.substageId === substageId) setSubstageStatusError(null);
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      setSubstageStatusError(null);
      invalidate();
    },
    onError: (err: unknown, vars) => {
      const resp = (err as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
      if (resp?.code === "OPERATIONS_NOT_ACTIVE" && resp.message) {
        setSubstageStatusError({ substageId: vars.substageId, message: resp.message });
      } else {
        toast.error(resp?.message ?? "Error al actualizar estado");
      }
    },
  });

  // Save notes
  const notesMutation = useMutation({
    mutationFn: () => patchStage(projectId, stage.id, { notes }),
    onSuccess: () => {
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      invalidate();
    },
    onError: () => toast.error("Error al guardar notas"),
  });

  // Save stage dates
  const datesMutation = useMutation({
    mutationFn: () =>
      patchStage(projectId, stage.id, {
        plannedStartDate: plannedStart || null,
        plannedEndDate: plannedEnd || null,
        responsibleName: responsibleName || null,
      }),
    onSuccess: () => {
      setEditingDates(false);
      toast.success("Fechas actualizadas");
      invalidate();
    },
    onError: () => toast.error("Error al guardar fechas"),
  });

  // Create substage
  const createSubMutation = useMutation({
    mutationFn: () =>
      createSubstage(projectId, stage.id, {
        name: subName,
        responsible: subResponsible,
        dueDate: subDue || null,
      }),
    onSuccess: () => {
      toast.success("Subetapa creada");
      setShowSubForm(false);
      setSubName("");
      setSubResponsible("");
      setSubDue("");
      invalidate();
    },
    onError: () => toast.error("Error al crear subetapa"),
  });

  // Complete all substages
  const completeAllMutation = useMutation({
    mutationFn: () => completeAllSubstages(projectId, stage.id),
    onSuccess: () => {
      toast.success("Todas las subetapas marcadas como completadas");
      invalidate();
    },
    onError: () => toast.error("Error al completar las subetapas"),
  });

  // Upload file
  async function handleFileUpload(file: File) {
    try {
      setUploadPct(0);
      await uploadFile(projectId, file, stage.id, setUploadPct);
      toast.success("Archivo subido correctamente");
      invalidate();
    } catch {
      toast.error("Error al subir archivo");
    } finally {
      setUploadPct(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function fileIcon(mime: string) {
    if (mime.includes("pdf")) return "📄";
    if (mime.includes("image")) return "🖼";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
    if (mime.includes("word") || mime.includes("document")) return "📝";
    return "📎";
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const STATUS_OPTIONS: SubstageStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"];
  const STATUS_LABELS: Record<SubstageStatus, string> = {
    PENDING: "Pendiente",
    IN_PROGRESS: "En progreso",
    COMPLETED: "Completado",
    BLOCKED: "Bloqueado",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside className="fixed top-0 right-0 h-full w-full max-w-[380px] z-50 flex flex-col bg-[var(--color-bg-sidebar)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-bg-sidebar)] z-10">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Etapa {stage.order}
            </p>
            <h2 className="font-display font-bold text-base text-[var(--color-text-primary)] mt-0.5">
              {stage.name}
            </h2>
            <div className="mt-1">
              <Badge variant={stage.status} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mt-0.5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-5">
          {/* Time metrics */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Fechas
              </p>
              <button
                onClick={() => setEditingDates(v => !v)}
                className="text-[10px] text-[var(--color-accent)] hover:underline"
              >
                {editingDates ? "Cancelar" : "Editar"}
              </button>
            </div>

            {editingDates ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Plan inicio</p>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                      value={plannedStart}
                      onChange={e => setPlannedStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Plan fin</p>
                    <input
                      type="date"
                      className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                      value={plannedEnd}
                      onChange={e => setPlannedEnd(e.target.value)}
                    />
                  </div>
                </div>
                <input
                  className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="Responsable de etapa"
                  value={responsibleName}
                  onChange={e => setResponsibleName(e.target.value)}
                />
                <Button size="sm" loading={datesMutation.isPending} onClick={() => datesMutation.mutate()}>
                  Guardar fechas
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-[var(--color-text-muted)]">Plan inicio</span>
                  <p className="text-[var(--color-text-secondary)]">{formatDate(stage.plannedStartDate)}</p>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Plan fin</span>
                  <p className="text-[var(--color-text-secondary)]">{formatDate(stage.plannedEndDate)}</p>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Inicio real</span>
                  <p className="text-[var(--color-text-secondary)]">{formatDate(stage.actualStartDate)}</p>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)]">Fin real</span>
                  <p className="text-[var(--color-text-secondary)]">{formatDate(stage.actualEndDate)}</p>
                </div>
                {stage.plannedDurationDays && (
                  <div>
                    <span className="text-[var(--color-text-muted)]">Duración plan</span>
                    <p className="text-[var(--color-text-secondary)]">{stage.plannedDurationDays} días</p>
                  </div>
                )}
                {stage.delayDays !== null && (
                  <div>
                    <span className="text-[var(--color-text-muted)]">Desvío</span>
                    <p className={stage.delayDays > 0 ? "text-red-400" : "text-[#4ade80]"}>
                      {stage.delayDays > 0 ? "+" : ""}{stage.delayDays} días
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Substages */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Subetapas ({stage.substages.filter(s => s.status === "COMPLETED").length}/{stage.substages.length})
              </p>
              <div className="flex gap-2">
                {stage.substages.length > 0 && stage.substages.some(s => s.status !== "COMPLETED") && (
                  <button
                    onClick={() => completeAllMutation.mutate()}
                    disabled={completeAllMutation.isPending}
                    className="text-[10px] text-[#4ade80] hover:underline disabled:opacity-50"
                  >
                    {completeAllMutation.isPending ? "Completando..." : "✓ Completar todas"}
                  </button>
                )}
                <button
                  onClick={() => setShowSubForm((v) => !v)}
                  className="text-[10px] text-[var(--color-accent)] hover:underline"
                >
                  + Agregar
                </button>
              </div>
            </div>

            {showSubForm && (
              <div className="mb-3 p-3 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] space-y-2">
                <input
                  className="w-full px-2.5 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="Nombre de la subetapa"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                />
                <input
                  className="w-full px-2.5 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="Responsable"
                  value={subResponsible}
                  onChange={(e) => setSubResponsible(e.target.value)}
                />
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                  value={subDue}
                  onChange={(e) => setSubDue(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={createSubMutation.isPending}
                    disabled={!subName || !subResponsible}
                    onClick={() => createSubMutation.mutate()}
                  >
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSubForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            <ul className="space-y-2">
              {stage.substages.map((sub) => (
                <SubstageRow
                  key={sub.id}
                  substage={sub}
                  projectId={projectId}
                  stageId={stage.id}
                  commentContext={stageCommentContext}
                  statusOptions={STATUS_OPTIONS}
                  statusLabels={STATUS_LABELS}
                  statusError={
                    substageStatusError?.substageId === sub.id ? substageStatusError.message : null
                  }
                  onStatusChange={(status) =>
                    subStatusMutation.mutate({ substageId: sub.id, status })
                  }
                  onQuickComplete={invalidate}
                  onChanged={invalidate}
                />
              ))}
              {stage.substages.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)]">Sin subetapas</p>
              )}
            </ul>
          </section>

          {/* Notes */}
          <section>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
              Notas
            </p>
            <textarea
              className="w-full px-3 py-2 rounded-md text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
              rows={4}
              placeholder="Notas de la etapa..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="flex items-center gap-3 mt-2">
              <Button
                size="sm"
                loading={notesMutation.isPending}
                onClick={() => notesMutation.mutate()}
              >
                Guardar notas
              </Button>
              {notesSaved && (
                <span className="text-xs text-[#4ade80]">✓ Guardado</span>
              )}
            </div>
          </section>

          <CommentThread
            projectId={projectId}
            stageId={stage.id}
            level="stage"
            context={stageCommentContext}
          />

          {/* Files */}
          <section>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
              Archivos ({stageFiles.length})
            </p>

            {/* File list */}
            {stageFiles.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {stageFiles.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)]"
                  >
                    <span className="text-base shrink-0">{fileIcon(f.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--color-text-primary)] truncate">{f.filename}</p>
                      <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
                        {formatSize(f.sizeBytes)} · {formatDate(f.createdAt)}
                      </p>
                    </div>
                    <a
                      href={getDownloadUrl(f.id)}
                      download={f.filename}
                      className="shrink-0 text-[10px] text-[var(--color-accent)] hover:underline"
                    >
                      ↓
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {/* Upload zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border border-dashed border-[var(--color-border)] rounded-lg px-4 py-5 text-center cursor-pointer hover:border-[var(--color-accent)] transition-colors"
            >
              {uploadPct !== null ? (
                <div className="flex flex-col items-center gap-2">
                  <Spinner size={18} />
                  <p className="text-xs text-[var(--color-text-muted)]">{uploadPct}%</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Arrastrá un archivo o hacé clic para subir
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    PDF, imágenes, hojas de cálculo
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

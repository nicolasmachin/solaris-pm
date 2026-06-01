import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Stage, Substage, SubstageStatus, FileAttachment, ChecklistItem } from "../../types/api.types";
import { patchSubstage, patchStage, createSubstage, deleteSubstage, completeSubstage, completeAllSubstages, getStageUnassignedSubstagesCount } from "../../api/stages.api";
import { setSubstageDeadlineManual, resetSubstageDeadlineOverride } from "../../api/deadline.api";
import { useAuthStore } from "../../store/auth.store";
import { apiClient } from "../../api/axios";
import { uploadFile, getDownloadUrl } from "../../api/files.api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { UserSelect } from "../ui/UserSelect";
import { AssigneeLabel } from "../ui/AssigneeLabel";
import { CommentThread } from "../comments/CommentThread";
import { EngineeringModuleSection } from "./EngineeringModuleSection";
import { VisitasToolPanel } from "../ingenieria/visitas/VisitasToolPanel";
import { VisitFloatingButton } from "../visitas/VisitFloatingButton";
import { CanAccess } from "../ui/CanAccess";
import { CargarFotosObraButton } from "../obra/CargarFotosObraButton";

interface StageDrawerProps {
  stage: Stage;
  projectId: string;
  files: FileAttachment[];
  onClose: () => void;
}

// ─── Deadline helpers (G.2) ──────────────────────────────────────────────────

const DEADLINE_MS_PER_DAY = 24 * 60 * 60 * 1000;

function getDeadlineColor(deadline: string | null, completedAt: string | null): string {
  if (!deadline) return "text-[var(--color-text-muted)]";
  if (completedAt) return "text-green-500";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(`${deadline}T00:00:00`);
  const diffDays = Math.round((d.getTime() - now.getTime()) / DEADLINE_MS_PER_DAY);
  if (diffDays < 0) return "text-red-500 font-semibold";
  if (diffDays <= 3) return "text-orange-500";
  if (diffDays <= 7) return "text-yellow-600";
  return "text-[var(--color-text-secondary)]";
}

function formatDeadlineShort(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
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
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDeleteItem(null); }}>
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
  const [userId, setUserId] = useState<string | null>(substage.userId ?? null);
  const [dueDate, setDueDate] = useState(substage.dueDate?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(substage.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [checklistPendingItems, setChecklistPendingItems] = useState<{ id: string; label: string }[]>([]);
  const [showDeadlineModal, setShowDeadlineModal] = useState(false);

  const currentUser = useAuthStore((s) => s.user);
  const canEditDeadline = currentUser?.role === "ADMIN" || currentUser?.role === "OPERACIONES";

  const setDeadlineMut = useMutation({
    mutationFn: (deadline: string | null) => setSubstageDeadlineManual(substage.id, deadline),
    onSuccess: () => {
      toast.success("Deadline actualizado");
      setShowDeadlineModal(false);
      onChanged();
    },
    onError: () => toast.error("Error al actualizar deadline"),
  });

  const resetDeadlineMut = useMutation({
    mutationFn: () => resetSubstageDeadlineOverride(substage.id),
    onSuccess: (data) => {
      toast.success(
        data.deadline
          ? `Deadline recalculado: ${formatDeadlineShort(data.deadline)}`
          : "Override eliminado, sin deadline (no hay regla configurada)",
      );
      onChanged();
    },
    onError: () => toast.error("Error al resetear deadline"),
  });

  const isCompleted = substage.status === "COMPLETED";
  const isUteManaged = !!(substage.isSystem && substage.uteAction);

  const { mutate: saveEdit, isPending: saving } = useMutation({
    mutationFn: () =>
      patchSubstage(projectId, stageId, substage.id, {
        ...(substage.isSystem && substage.uteAction ? {} : { name }),
        userId,
        dueDate: dueDate || null,
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
          {/* Quick complete circular button (no clickeable si es UTE-managed) */}
          <button
            onClick={isUteManaged ? undefined : handleQuickComplete}
            disabled={isUteManaged || isCompleted || completeSubstageMutation.isPending}
            title={
              isUteManaged
                ? "Se completa automáticamente al cargar la fecha en Trámites UTE"
                : isCompleted ? "Completado" : "Marcar como completado"
            }
            style={{
              width: 18, height: 18, borderRadius: "50%",
              border: `2px solid ${isCompleted ? "#4ade80" : dotColor}`,
              background: isCompleted ? "#4ade80" : "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isUteManaged ? "not-allowed" : isCompleted ? "default" : "pointer",
              flexShrink: 0, marginTop: 1, transition: "all 0.15s",
              opacity: isUteManaged && !isCompleted ? 0.6 : 1,
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
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-[var(--color-text-primary)] truncate">{substage.name}</p>
              {isUteManaged && (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 rounded border border-blue-500/40 bg-blue-500/10 px-1 py-px text-[8px] font-mono uppercase tracking-wider text-blue-400"
                  title="Se sincroniza automáticamente desde el módulo Trámites UTE"
                >
                  Auto
                </span>
              )}
            </div>
            <p className="truncate">
              <AssigneeLabel user={substage.user} legacyText={substage.responsible} size="xs" />
            </p>
            {substage.dueDate && (
              <p className="font-mono text-[10px] text-[var(--color-text-muted)]">
                Vence:{" "}
                {new Date(substage.dueDate).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </p>
            )}
            {substage.deadline && (
              <p className={`font-mono text-[10px] flex items-center gap-1 ${getDeadlineColor(substage.deadline, substage.actualEndDate)}`}>
                <span>📅 Deadline: {formatDeadlineShort(substage.deadline)}</span>
                {substage.deadlineManuallySet && (
                  <span
                    className="px-1 py-px text-[8px] rounded border border-[var(--color-border)] text-[var(--color-text-muted)] uppercase tracking-wider"
                    title="Editado manualmente. No se recalcula automáticamente."
                  >
                    manual
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            <select
              value={substage.status}
              onChange={e => onStatusChange(e.target.value as SubstageStatus)}
              onClick={e => e.stopPropagation()}
              disabled={isUteManaged}
              title={isUteManaged ? "El status se actualiza automáticamente desde Trámites UTE" : undefined}
              className="text-[10px] bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded px-1 py-0.5 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
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
            {/* G.3: fechas reales de la subetapa */}
            {(substage.actualStartDate || substage.actualEndDate) && (
              <p className="text-[10px] text-[var(--color-text-muted)] mb-2 font-mono">
                {substage.actualStartDate && <>Iniciada: {formatDeadlineShort(substage.actualStartDate)}</>}
                {substage.actualStartDate && substage.actualEndDate && <> · </>}
                {substage.actualEndDate && <>Completada: {formatDeadlineShort(substage.actualEndDate)}</>}
              </p>
            )}
            <div className="flex gap-2 mb-2 flex-wrap">
              {!isUteManaged && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-[10px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] transition-colors"
                >
                  Editar
                </button>
              )}
              {isUteManaged && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-[10px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] transition-colors"
                  title="Sólo podés editar responsable, dueDate y notas"
                >
                  Editar (responsable / fechas / notas)
                </button>
              )}
              {canEditDeadline && (
                <button
                  onClick={() => setShowDeadlineModal(true)}
                  className="text-[10px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] transition-colors"
                  title="Editar deadline manualmente"
                >
                  {substage.deadline ? "Editar deadline" : "+ Agregar deadline"}
                </button>
              )}
              {canEditDeadline && substage.deadlineManuallySet && (
                <button
                  onClick={() => resetDeadlineMut.mutate()}
                  disabled={resetDeadlineMut.isPending}
                  className="text-[10px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] transition-colors disabled:opacity-60"
                >
                  Volver a cálculo automático
                </button>
              )}
              {!isUteManaged && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-[10px] px-2 py-1 rounded border border-red-900 text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  Eliminar
                </button>
              )}
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
            {isUteManaged ? (
              <p className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-2 py-1.5">
                El nombre y status de esta subetapa los maneja el módulo Trámites UTE.
                Acá podés actualizar responsable, deadline y notas.
              </p>
            ) : (
              <input
                className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            )}
            <div>
              <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Responsable</p>
              <UserSelect
                value={userId}
                onChange={setUserId}
                ariaLabel="Responsable de la subetapa"
              />
              {!userId && substage.responsible && substage.responsible.trim() !== "" ? (
                <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                  Texto legacy: <span className="italic">{substage.responsible}</span>
                </p>
              ) : null}
            </div>
            <div>
              <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Fecha límite</p>
              <input type="date" className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <textarea
              className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" loading={saving} disabled={!isUteManaged && !name} onClick={() => saveEdit()}>
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </li>

      {/* Modal: edit deadline manualmente */}
      {showDeadlineModal && (
        <DeadlineEditModal
          substage={substage}
          isPending={setDeadlineMut.isPending}
          onSave={(d) => setDeadlineMut.mutate(d)}
          onClose={() => setShowDeadlineModal(false)}
        />
      )}

      {/* Confirm delete substage */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
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
          onMouseDown={e => { if (e.target === e.currentTarget) setChecklistPendingItems([]); }}>
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
  const navigate = useNavigate();
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

  // Stage dates editing (plannedEndDate editable por todos; fechas reales sólo admin)
  const [editingDates, setEditingDates] = useState(false);
  const [plannedEnd, setPlannedEnd] = useState(stage.plannedEndDate?.slice(0, 10) ?? "");
  const [actualStart, setActualStart] = useState(stage.actualStartDate?.slice(0, 10) ?? "");
  const [actualEnd, setActualEnd] = useState(stage.actualEndDate?.slice(0, 10) ?? "");
  const [dateEditError, setDateEditError] = useState<string | null>(null);
  const [responsibleUserId, setResponsibleUserId] = useState<string | null>(
    stage.responsibleUserId ?? null,
  );

  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "ADMIN";
  const isPostventa = stage.name === "POSTVENTA";

  // New substage form
  const [showSubForm, setShowSubForm] = useState(false);
  const [subName, setSubName] = useState("");
  const [subUserId, setSubUserId] = useState<string | null>(null);
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

  // Save stage dates (sólo fechas reales — admin — + responsable)
  const [confirmPropagate, setConfirmPropagate] = useState<{ count: number } | null>(null);
  const [checkingPropagation, setCheckingPropagation] = useState(false);
  const datesMutation = useMutation({
    mutationFn: ({ propagate }: { propagate: boolean }) => {
      const body: {
        plannedEndDate?: string | null;
        actualStartDate?: string | null;
        actualEndDate?: string | null;
        responsibleUserId?: string | null;
        propagateResponsible?: boolean;
      } = {};
      const currentPlannedEnd = stage.plannedEndDate?.slice(0, 10) ?? "";
      const currentActualStart = stage.actualStartDate?.slice(0, 10) ?? "";
      const currentActualEnd = stage.actualEndDate?.slice(0, 10) ?? "";
      const currentResponsibleUserId = stage.responsibleUserId ?? null;

      if ((plannedEnd || "") !== currentPlannedEnd) body.plannedEndDate = plannedEnd || null;
      if (isAdmin && (actualStart || "") !== currentActualStart) body.actualStartDate = actualStart || null;
      if (isAdmin && (actualEnd || "") !== currentActualEnd) body.actualEndDate = actualEnd || null;
      if (responsibleUserId !== currentResponsibleUserId) {
        body.responsibleUserId = responsibleUserId;
        if (propagate && responsibleUserId !== null) body.propagateResponsible = true;
      }

      return patchStage(projectId, stage.id, body);
    },
    onSuccess: (_data, variables) => {
      setEditingDates(false);
      setDateEditError(null);
      toast.success(
        variables.propagate
          ? "Responsable actualizado y propagado a las subetapas"
          : "Fechas actualizadas",
      );
      invalidate();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al guardar fechas");
    },
  });

  async function handleSaveDates() {
    if (actualStart && actualEnd && actualEnd < actualStart) {
      setDateEditError("Real fin no puede ser anterior al inicio");
      return;
    }
    setDateEditError(null);

    const currentResponsibleUserId = stage.responsibleUserId ?? null;
    const responsibleChanged = responsibleUserId !== currentResponsibleUserId;
    const responsibleIsAssigned = responsibleUserId !== null;

    if (responsibleChanged && responsibleIsAssigned) {
      setCheckingPropagation(true);
      try {
        const count = await getStageUnassignedSubstagesCount(projectId, stage.id);
        if (count > 0) {
          setConfirmPropagate({ count });
          return;
        }
      } catch {
        // Si el conteo falla, seguimos sin propagar: el PATCH no queda bloqueado.
      } finally {
        setCheckingPropagation(false);
      }
    }
    datesMutation.mutate({ propagate: false });
  }

  // Create substage
  const createSubMutation = useMutation({
    mutationFn: () =>
      createSubstage(projectId, stage.id, {
        name: subName,
        userId: subUserId,
        dueDate: subDue || null,
      }),
    onSuccess: () => {
      toast.success("Subetapa creada");
      setShowSubForm(false);
      setSubName("");
      setSubUserId(null);
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
    // Las fechas DATE-only (YYYY-MM-DD) deben formatearse en UTC
    // para no perder un día por la conversión a hora local (Argentina = UTC-3).
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(d);
    const parsed = new Date(isDateOnly ? `${d}T00:00:00Z` : d);
    return parsed.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(isDateOnly ? { timeZone: "UTC" } : {}),
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
      <aside className="fixed top-0 right-0 h-full w-full md:w-1/2 z-50 flex flex-col bg-[var(--color-bg-sidebar)] border-l border-[var(--color-border)] shadow-2xl overflow-y-auto">
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
          {isPostventa ? (
            <section>
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                Fechas
              </p>
              <p className="text-xs text-[var(--color-text-muted)] italic">
                La etapa Postventa no tiene fechas asociadas por ser indefinida.
              </p>
            </section>
          ) : (
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                  Fechas
                </p>
                <button
                  onClick={() => {
                    setEditingDates((v) => !v);
                    setDateEditError(null);
                  }}
                  className="text-[10px] text-[var(--color-accent)] hover:underline"
                >
                  {editingDates ? "Cancelar" : "Editar"}
                </button>
              </div>

              {editingDates ? (
                <div className="space-y-2">
                  <div>
                    <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Fecha límite</p>
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        className="flex-1 px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                        value={plannedEnd}
                        onChange={(e) => setPlannedEnd(e.target.value)}
                      />
                      {plannedEnd && (
                        <button
                          type="button"
                          onClick={() => setPlannedEnd("")}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-danger-text)] px-1 text-xs"
                          title="Limpiar fecha"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Es la fecha que aparece en Mis Tareas</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div title={isAdmin ? undefined : "Solo admin puede modificar fechas reales"}>
                      <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Real inicio</p>
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          disabled={!isAdmin}
                          className="flex-1 px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-60 disabled:cursor-not-allowed"
                          value={actualStart}
                          onChange={(e) => setActualStart(e.target.value)}
                        />
                        {isAdmin && actualStart && (
                          <button
                            type="button"
                            onClick={() => setActualStart("")}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-danger-text)] px-1 text-xs"
                            title="Limpiar fecha"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    <div title={isAdmin ? undefined : "Solo admin puede modificar fechas reales"}>
                      <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Real fin</p>
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          disabled={!isAdmin}
                          className="flex-1 px-2 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-60 disabled:cursor-not-allowed"
                          value={actualEnd}
                          onChange={(e) => setActualEnd(e.target.value)}
                        />
                        {isAdmin && actualEnd && (
                          <button
                            type="button"
                            onClick={() => setActualEnd("")}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-danger-text)] px-1 text-xs"
                            title="Limpiar fecha"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Responsable</p>
                    <UserSelect
                      value={responsibleUserId}
                      onChange={setResponsibleUserId}
                      ariaLabel="Responsable de la etapa"
                    />
                    {!responsibleUserId && stage.responsibleName && stage.responsibleName.trim() !== "" ? (
                      <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                        Texto legacy: <span className="italic">{stage.responsibleName}</span>
                      </p>
                    ) : null}
                  </div>
                  {dateEditError && (
                    <p className="text-[11px] text-[var(--color-danger-text)]">{dateEditError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={datesMutation.isPending || checkingPropagation}
                      onClick={handleSaveDates}
                    >
                      Guardar cambios
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingDates(false);
                        setDateEditError(null);
                        setPlannedEnd(stage.plannedEndDate?.slice(0, 10) ?? "");
                        setActualStart(stage.actualStartDate?.slice(0, 10) ?? "");
                        setActualEnd(stage.actualEndDate?.slice(0, 10) ?? "");
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div className="col-span-2">
                    <span className="text-[var(--color-text-muted)] text-[10px]">Fecha límite</span>
                    <p className="text-[var(--color-text-secondary)]">
                      {stage.plannedEndDate
                        ? new Date(stage.plannedEndDate).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" })
                        : <span className="text-[var(--color-text-muted)] italic">Sin definir</span>}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">Real inicio</span>
                    <p className="text-[var(--color-text-secondary)] flex items-center gap-1">
                      {stage.status === "PENDING" && !stage.actualStartDate
                        ? <span className="text-[var(--color-text-muted)] italic">Pendiente</span>
                        : formatDate(stage.actualStartDate)}
                      {stage.actualDatesManuallyEdited && (
                        <span
                          title="Fecha modificada manualmente por admin"
                          className="text-[var(--color-text-muted)] text-[11px]"
                        >
                          ✎
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--color-text-muted)] text-[10px]">Real fin</span>
                    <p className="text-[var(--color-text-secondary)] flex items-center gap-1">
                      {stage.status === "PENDING" && !stage.actualEndDate
                        ? <span className="text-[var(--color-text-muted)] italic">Pendiente</span>
                        : formatDate(stage.actualEndDate)}
                      {stage.actualDatesManuallyEdited && (
                        <span
                          title="Fecha modificada manualmente por admin"
                          className="text-[var(--color-text-muted)] text-[11px]"
                        >
                          ✎
                        </span>
                      )}
                    </p>
                  </div>
                  {stage.actualDurationDays != null && (
                    <div>
                      <span className="text-[var(--color-text-muted)] text-[10px]">Duración real</span>
                      <p className="text-[var(--color-text-secondary)]">{stage.actualDurationDays} días</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-[var(--color-text-muted)] text-[10px]">Responsable</span>
                    <p className="mt-0.5">
                      <AssigneeLabel
                        user={stage.responsibleUser}
                        legacyText={stage.responsibleName}
                      />
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Acceso directo a Obra (galería + checklist) — solo etapa Operaciones */}
          {stage.name === "OPERACIONES" && (
            <CanAccess module="OPERACIONES" action="VIEW">
              <CargarFotosObraButton projectId={projectId} variant="block" />
            </CanAccess>
          )}

          {/* Substages */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Subetapas ({stage.substages.filter(s => s.status === "COMPLETED").length}/{stage.substages.length})
              </p>
              <div className="flex gap-2">
                {stage.name === "HABILITACION_UTE" ? (
                  <a
                    href={`/tramites-ute?projectId=${projectId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/tramites-ute?projectId=${projectId}`);
                    }}
                    className="text-[10px] text-[var(--color-accent)] hover:underline"
                    title="Estas subetapas se gestionan desde el módulo Trámites UTE"
                  >
                    → Ir a Trámites UTE
                  </a>
                ) : (
                  <>
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
                      onClick={() => {
                        if (!showSubForm) setSubUserId(stage.responsibleUserId ?? null);
                        setShowSubForm((v) => !v);
                      }}
                      className="text-[10px] text-[var(--color-accent)] hover:underline"
                    >
                      + Agregar
                    </button>
                  </>
                )}
              </div>
            </div>

            {stage.name === "HABILITACION_UTE" && (
              <div className="mb-3 rounded-lg bg-blue-500/5 border border-blue-500/20 p-3">
                <p className="text-[11px] text-blue-300">
                  Las subetapas de Trámite UTE se generan y sincronizan automáticamente
                  desde el módulo <strong>Trámites UTE</strong>. Acá podés ver el estado y
                  asignar responsables, pero nombres, status y orden vienen del trámite.
                </p>
              </div>
            )}

            {showSubForm && stage.name !== "HABILITACION_UTE" && (
              <div className="mb-3 p-3 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] space-y-2">
                <div>
                  <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Nombre</p>
                  <input
                    className="w-full px-2.5 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                  />
                </div>
                <div>
                  <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Responsable</p>
                  <UserSelect
                    value={subUserId}
                    onChange={setSubUserId}
                    ariaLabel="Responsable de la nueva subetapa"
                  />
                </div>
                <div>
                  <p className="font-mono text-[9px] text-[var(--color-text-muted)] mb-0.5">Fecha límite</p>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1.5 rounded text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                    value={subDue}
                    onChange={(e) => setSubDue(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    loading={createSubMutation.isPending}
                    disabled={!subName}
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

          {/* Módulo Ingeniería: link al workspace + documentos generados (read-only).
              Las herramientas del módulo (unifilar, lista de materiales,
              calculadora de triángulos) viven ahora en /ingenieria/proyecto/:id. */}
          {stage.name === "INGENIERIA" && (
            <div className="mt-3 space-y-3">
              <EngineeringModuleSection projectId={projectId} />
              {/* Visita técnica con IA — accesible para OPERACIONES también
                  (operario carga audios/fotos/notas y la IA arma el informe). */}
              <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                  Visita técnica (IA)
                </p>
                <VisitasToolPanel projectId={projectId} />
              </section>
              <VisitFloatingButton projectId={projectId} />
            </div>
          )}

          {/* Notes */}
          <section>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
              Notas
            </p>
            <textarea
              className="w-full px-3 py-2 rounded-md text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] resize-none"
              rows={4}
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

      {/* Confirm propagate responsible to substages */}
      {confirmPropagate && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmPropagate(null); }}
        >
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 20, width: 380 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>
              Propagar responsable
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 16, lineHeight: 1.45 }}>
              Esta etapa tiene <strong>{confirmPropagate.count}</strong>{" "}
              {confirmPropagate.count === 1 ? "subetapa sin responsable" : "subetapas sin responsable"}.
              ¿Querés asignar el nuevo responsable también a{" "}
              {confirmPropagate.count === 1 ? "esa subetapa" : "esas subetapas"}?
              Las subetapas con otro responsable no se tocan.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setConfirmPropagate(null);
                  datesMutation.mutate({ propagate: false });
                }}
                disabled={datesMutation.isPending}
                style={{ padding: "7px 14px", borderRadius: 5, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 12, cursor: "pointer" }}
              >
                Solo cambiar la etapa
              </button>
              <button
                onClick={() => {
                  setConfirmPropagate(null);
                  datesMutation.mutate({ propagate: true });
                }}
                disabled={datesMutation.isPending}
                style={{ padding: "7px 14px", borderRadius: 5, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Sí, propagar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Modal: Editar deadline manualmente (G.2) ─────────────────────────────────

function DeadlineEditModal({
  substage,
  isPending,
  onSave,
  onClose,
}: {
  substage: Substage;
  isPending: boolean;
  onSave: (deadline: string | null) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(substage.deadline?.slice(0, 10) ?? "");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="border-b border-[var(--color-border)] px-5 py-3">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            Editar deadline de "{substage.name}"
          </p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
              Deadline manual
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </div>
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
            <strong className="text-amber-500">Atención:</strong> al editar manualmente, este deadline NO se recalculará automáticamente con cambios de fecha de instalación. Podés volver al cálculo automático con el botón "Volver a cálculo automático".
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            Cancelar
          </button>
          {substage.deadline && (
            <button
              type="button"
              onClick={() => onSave(null)}
              disabled={isPending}
              className="rounded-md border border-red-900 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-60"
            >
              Eliminar deadline
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(date || null)}
            disabled={isPending || !date}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-[var(--color-bg-app)] hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { createComment, deleteComment, getLeadComments, getProjectComments, patchComment } from "../../api/comments.api";
import type { Comment } from "../../types/api.types";
import { useAuthStore } from "../../store/auth.store";
import { Spinner } from "../ui/Spinner";

type CommentLevel = "project" | "stage" | "substage" | "checklist" | "task" | "lead";

interface CommentThreadProps {
  projectId?: string;
  leadId?: string;
  stageId?: string;
  substageId?: string;
  checklistItemId?: string;
  taskId?: string;
  level: CommentLevel;
  context?: {
    stageLabelsById?: Record<string, string>;
    substageNamesById?: Record<string, string>;
    checklistLabelsById?: Record<string, string>;
    taskTitlesById?: Record<string, string>;
  };
}

function formatRelativeDate(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? "" : "s"}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getQueryKey(props: CommentThreadProps) {
  return [
    "comments",
    props.level,
    props.projectId ?? null,
    props.leadId ?? null,
    props.stageId ?? null,
    props.substageId ?? null,
    props.checklistItemId ?? null,
    props.taskId ?? null,
  ];
}

function filterComments(comments: Comment[], props: CommentThreadProps) {
  if (props.level === "project") return comments;
  if (props.level === "stage") {
    return comments.filter(
      (comment) => comment.stageId === props.stageId || (props.stageId && comment.substageId && comment.stageId === props.stageId),
    );
  }
  if (props.level === "substage") {
    return comments.filter(
      (comment) =>
        comment.substageId === props.substageId || comment.checklistItemId !== null && comment.substageId === props.substageId,
    );
  }
  if (props.level === "checklist") return comments.filter((comment) => comment.checklistItemId === props.checklistItemId);
  if (props.level === "task") return comments.filter((comment) => comment.taskId === props.taskId);
  return comments;
}

function getCommentOrigin(comment: Comment, props: CommentThreadProps) {
  if (props.level === "lead") {
    return null;
  }

  const parts: string[] = [];
  const stageLabel = comment.stageId ? props.context?.stageLabelsById?.[comment.stageId] : null;
  const substageLabel = comment.substageId ? props.context?.substageNamesById?.[comment.substageId] : null;
  const checklistLabel = comment.checklistItemId ? props.context?.checklistLabelsById?.[comment.checklistItemId] : null;
  const taskLabel = comment.taskId ? props.context?.taskTitlesById?.[comment.taskId] : null;

  if (props.level === "project") {
    if (stageLabel) {
      parts.push(`Etapa: ${stageLabel}`);
    }
    if (substageLabel) {
      parts.push(`Subetapa: ${substageLabel}`);
    }
    if (checklistLabel) {
      parts.push(`Checklist: ${checklistLabel}`);
    }
    if (taskLabel) {
      parts.push(`Tarea: ${taskLabel}`);
    }
  } else if (props.level === "stage") {
    if (substageLabel) {
      parts.push(`Subetapa: ${substageLabel}`);
    }
    if (checklistLabel) {
      parts.push(`Checklist: ${checklistLabel}`);
    }
    if (taskLabel) {
      parts.push(`Tarea: ${taskLabel}`);
    }
  } else if (props.level === "substage") {
    if (checklistLabel) {
      parts.push(`Checklist: ${checklistLabel}`);
    }
    if (taskLabel) {
      parts.push(`Tarea: ${taskLabel}`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export const CommentThread = memo(function CommentThread(props: CommentThreadProps) {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user } = useAuthStore();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const queryKey = getQueryKey(props);

  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (props.leadId) {
        return getLeadComments(props.leadId);
      }
      if (!props.projectId) {
        return [];
      }
      return getProjectComments(props.projectId, {
        stageId: props.level === "stage" ? props.stageId : undefined,
        substageId: props.level === "substage" ? props.substageId : undefined,
        page: 1,
        limit: 100,
      });
    },
    enabled: Boolean(props.projectId || props.leadId),
  });

  const comments = useMemo(
    () =>
      [...filterComments(data, props)].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [data, props],
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [draft]);

  const createMutation = useMutation({
    mutationFn: () =>
      createComment({
        content: draft.trim(),
        projectId: props.projectId,
        leadId: props.leadId,
        stageId: props.stageId,
        substageId: props.substageId,
        checklistItemId: props.checklistItemId,
        taskId: props.taskId,
      }),
    onSuccess: (createdComment) => {
      setDraft("");
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) => [...current, createdComment]);
    },
    onError: () => toast.error("No se pudo crear el comentario"),
  });

  const patchMutation = useMutation({
    mutationFn: (commentId: string) => patchComment(commentId, { content: editingValue.trim() }),
    onSuccess: (updatedComment) => {
      setEditingId(null);
      setEditingValue("");
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) =>
        current.map((comment) => (comment.id === updatedComment.id ? updatedComment : comment)),
      );
    },
    onError: () => toast.error("No se pudo editar el comentario"),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_, commentId) => {
      setConfirmDeleteId(null);
      queryClient.setQueryData<Comment[]>(queryKey, (current = []) =>
        current.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                content: "Comentario eliminado",
              }
            : comment,
        ),
      );
    },
    onError: () => toast.error("No se pudo eliminar el comentario"),
  });

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
        Comentarios
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="animate-pulse rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
              <div className="mb-2 h-3 w-32 rounded bg-[var(--color-border)]" />
              <div className="h-3 w-full rounded bg-[var(--color-border)]" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay comentarios. Sé el primero.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const canManage = user?.role === "ADMIN" || user?.id === comment.author.id;
            const isEditing = editingId === comment.id;
            const isDeleted = comment.content === "Comentario eliminado";
            const origin = getCommentOrigin(comment, props);

            return (
              <article
                key={comment.id}
                className="group rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-black">
                    {getInitials(comment.author.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{comment.author.name}</span>
                      <span
                        className="font-mono text-[10px] text-[var(--color-text-muted)]"
                        title={new Date(comment.createdAt).toLocaleString("es-UY")}
                      >
                        {formatRelativeDate(comment.createdAt)}
                      </span>
                      {comment.isEdited && (
                        <span className="rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] text-[var(--color-text-muted)]">
                          editado
                        </span>
                      )}
                      {canManage && !isDeleted && !isEditing && (
                        <div className="ml-auto hidden items-center gap-1 group-hover:flex">
                          <button
                            className="rounded px-1.5 py-1 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditingValue(comment.content);
                            }}
                            type="button"
                          >
                            ✎
                          </button>
                          <button
                            className="rounded px-1.5 py-1 text-[10px] text-red-400 hover:bg-[var(--color-bg-card-hover)]"
                            onClick={() => setConfirmDeleteId(comment.id)}
                            type="button"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {origin ? (
                      <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-[var(--color-accent)]">
                        {origin}
                      </p>
                    ) : null}

                    {isEditing ? (
                      <div className="space-y-2">
                        <textarea
                          className="min-h-[84px] w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black"
                            disabled={!editingValue.trim() || patchMutation.isPending}
                            onClick={() => patchMutation.mutate(comment.id)}
                            type="button"
                          >
                            Guardar
                          </button>
                          <button
                            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                            onClick={() => {
                              setEditingId(null);
                              setEditingValue("");
                            }}
                            type="button"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm leading-relaxed ${isDeleted ? "text-[var(--color-text-muted)] italic" : "text-[var(--color-text-secondary)]"}`}>
                          {comment.content}
                        </p>

                        {confirmDeleteId === comment.id && (
                          <div className="mt-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2">
                            <p className="mb-2 text-xs text-[var(--color-text-secondary)]">¿Eliminar este comentario?</p>
                            <div className="flex gap-2">
                              <button
                                className="rounded-md bg-[#dc2626] px-3 py-1.5 text-xs font-semibold text-white"
                                onClick={() => deleteMutation.mutate(comment.id)}
                                type="button"
                              >
                                Sí
                              </button>
                              <button
                                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)]"
                                onClick={() => setConfirmDeleteId(null)}
                                type="button"
                              >
                                No
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex gap-3 border-t border-[var(--color-border)] pt-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-black">
          {getInitials(user?.name ?? "Usuario")}
        </div>
        <div className="flex-1">
          <textarea
            ref={textareaRef}
            className="min-h-[72px] w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            placeholder="Escribí un comentario..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.ctrlKey && draft.trim()) {
                event.preventDefault();
                createMutation.mutate();
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <button
              className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!draft.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              type="button"
            >
              {createMutation.isPending ? "Comentando..." : "Comentar"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
});

import { useState } from "react";
import { MessageSquare, Phone, Mail, MapPin, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import type { ClienteInteraction, InteractionChannel } from "../../../api/clientes.api";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { useAuthStore } from "../../../store/auth.store";
import { CHANNEL_LABELS } from "../constants";
import { useDeleteInteraction, useEditInteraction } from "../hooks/useClienteInteractions";

const CHANNEL_ICON: Record<InteractionChannel, typeof MessageSquare> = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  LLAMADA: Phone,
  VISITA: MapPin,
  OTRO: MessageSquare,
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function fueEditada(i: ClienteInteraction): boolean {
  return new Date(i.updatedAt).getTime() - new Date(i.createdAt).getTime() > 1000;
}

const MAX = 2000;

export function ClienteInteractionList({
  interacciones,
  projectId,
}: {
  interacciones: ClienteInteraction[];
  projectId: string;
}) {
  const isMobile = useIsMobile();
  const { user } = useAuthStore();
  const editMut = useEditInteraction(projectId);
  const delMut = useDeleteInteraction(projectId);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function canModify(i: ClienteInteraction): boolean {
    return !!user && (user.id === i.autor.id || user.role === "ADMIN");
  }

  function startEdit(i: ClienteInteraction) {
    setEditingId(i.id);
    setDraft(i.content);
  }

  function saveEdit(id: string) {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > MAX) {
      toast.error(`El texto debe tener entre 1 y ${MAX} caracteres`);
      return;
    }
    editMut.mutate(
      { id, content: trimmed },
      {
        onSuccess: () => setEditingId(null),
        onError: (err) => toast.error(getApiErr(err) ?? "No se pudo guardar"),
      },
    );
  }

  function doDelete(id: string) {
    delMut.mutate(id, {
      onSuccess: () => {
        setConfirmId(null);
        toast.success("Interacción borrada");
      },
      onError: (err) => toast.error(getApiErr(err) ?? "No se pudo borrar"),
    });
  }

  if (interacciones.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
        Sin interacciones registradas todavía.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {interacciones.map((i) => {
          const Icon = CHANNEL_ICON[i.channel] ?? MessageSquare;
          const editable = canModify(i);
          const isEditing = editingId === i.id;
          return (
            <li
              key={i.id}
              className="group/it relative rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"
            >
              <div className="mb-1 flex items-center justify-between gap-2 pr-12">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  <Icon className="h-3.5 w-3.5" />
                  {CHANNEL_LABELS[i.channel] ?? i.channel}
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {fmtDateTime(i.createdAt)}
                  {fueEditada(i) && (
                    <span className="ml-1 italic" title={`Editado el ${fmtDateTime(i.updatedAt)}`}>
                      (editado)
                    </span>
                  )}
                </span>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    rows={3}
                    maxLength={MAX}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)} disabled={editMut.isPending}>
                      Cancelar
                    </Button>
                    <Button size="sm" loading={editMut.isPending} onClick={() => saveEdit(i.id)} disabled={!draft.trim()}>
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{i.content}</p>
              )}

              <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">— {i.autor.nombre}</p>

              {editable && !isEditing && (
                <div
                  className={`absolute right-2 top-2 flex items-center gap-1 ${
                    isMobile ? "opacity-100" : "opacity-0 group-hover/it:opacity-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => startEdit(i)}
                    aria-label="Editar interacción"
                    className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40 hover:text-[var(--color-text-primary)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(i.id)}
                    aria-label="Borrar interacción"
                    className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!confirmId}
        title="¿Borrar esta interacción?"
        description="Esta acción no se puede deshacer desde la app."
        confirmLabel="Borrar"
        destructive
        loading={delMut.isPending}
        onConfirm={() => confirmId && doDelete(confirmId)}
        onClose={() => setConfirmId(null)}
      />
    </>
  );
}

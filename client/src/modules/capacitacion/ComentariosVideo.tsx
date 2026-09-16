import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  borrarComentario,
  crearComentario,
  editarComentario,
  listComentarios,
  type ComentarioItem,
} from "../../api/capacitacion.api";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { useAuthStore } from "../../store/auth.store";
import { usePermission } from "../../hooks/usePermission";

const textareaClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] resize-y";

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function fmtCuando(iso: string) {
  const d = new Date(iso);
  const minutos = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  if (minutos < 60 * 24) return `hace ${Math.floor(minutos / 60)} h`;
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

// Preguntas y aportes del equipo debajo del video. Escribe cualquiera que pueda
// ver el video; borra el autor, y también quien gestiona el módulo (moderación).
export function ComentariosVideo({ videoId }: { videoId: string }) {
  const qc = useQueryClient();
  const usuario = useAuthStore((s) => s.user);
  const moderador = usePermission("CAPACITACION", "EDIT");
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [textoEdicion, setTextoEdicion] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["capacitacion", "comentarios", videoId],
    queryFn: () => listComentarios(videoId),
    enabled: Boolean(videoId),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["capacitacion", "comentarios", videoId] });

  const crear = useMutation({
    mutationFn: () => crearComentario(videoId, texto),
    onSuccess: () => {
      setTexto("");
      invalidar();
    },
    onError: () => toast.error("No se pudo publicar el comentario"),
  });

  const editar = useMutation({
    mutationFn: ({ id, contenido }: { id: string; contenido: string }) => editarComentario(id, contenido),
    onSuccess: () => {
      setEditando(null);
      invalidar();
    },
    onError: () => toast.error("No se pudo editar el comentario"),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => borrarComentario(id),
    onSuccess: invalidar,
    onError: () => toast.error("No se pudo borrar el comentario"),
  });

  const comentarios = data ?? [];

  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
        <MessageSquare size={13} />
        {comentarios.length === 0
          ? "Preguntas y comentarios"
          : `${comentarios.length} ${comentarios.length === 1 ? "comentario" : "comentarios"}`}
      </h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim()) crear.mutate();
        }}
        className="space-y-2"
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder="¿Te quedó alguna duda con este video? Preguntá acá."
          className={textareaClass}
        />
        {texto.trim() && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" type="button" onClick={() => setTexto("")}>
              Cancelar
            </Button>
            <Button size="sm" type="submit" loading={crear.isPending}>
              Comentar
            </Button>
          </div>
        )}
      </form>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner size={20} />
        </div>
      ) : comentarios.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Todavía no hay comentarios. El primero puede ser el tuyo.
        </p>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c: ComentarioItem) => {
            const propio = c.autorId === usuario?.id;
            return (
              <li key={c.id} className="flex gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-gray-900">
                  {iniciales(c.autorNombre)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{c.autorNombre}</span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {fmtCuando(c.createdAt)}
                      {c.editado && " · editado"}
                    </span>
                  </p>

                  {editando === c.id ? (
                    <div className="mt-1 space-y-2">
                      <textarea
                        value={textoEdicion}
                        onChange={(e) => setTextoEdicion(e.target.value)}
                        rows={2}
                        className={textareaClass}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          loading={editar.isPending}
                          disabled={!textoEdicion.trim()}
                          onClick={() => editar.mutate({ id: c.id, contenido: textoEdicion })}
                        >
                          Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{c.contenido}</p>
                  )}
                </div>

                {(propio || moderador) && editando !== c.id && (
                  <div className="flex flex-shrink-0 items-start gap-0.5">
                    {propio && (
                      <button
                        title="Editar"
                        onClick={() => {
                          setEditando(c.id);
                          setTextoEdicion(c.contenido);
                        }}
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    <button
                      title={propio ? "Borrar" : "Borrar (moderación)"}
                      onClick={() => {
                        if (window.confirm("¿Borrar el comentario?")) borrar.mutate(c.id);
                      }}
                      className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

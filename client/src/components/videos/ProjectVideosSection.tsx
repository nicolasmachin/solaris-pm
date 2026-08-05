import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { deleteProjectVideo, getProjectVideos, type ProjectVideo } from "../../api/videos.api";
import { usePermission } from "../../hooks/usePermission";
import { ProjectVideoCard } from "./ProjectVideoCard";
import { ProjectVideoPlayer } from "./ProjectVideoPlayer";
import { ProjectVideoUpload } from "./ProjectVideoUpload";

interface Props {
  projectId: string;
}

export function ProjectVideosSection({ projectId }: Props) {
  const qc = useQueryClient();
  const canUpload = usePermission("OPERACIONES", "CREATE");
  const [playing, setPlaying] = useState<ProjectVideo | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectVideo | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["project-videos", projectId],
    queryFn: () => getProjectVideos(projectId),
    // Mientras haya videos comprimiéndose se refresca solo, para que el operario
    // vea aparecer la miniatura sin recargar. Cuando están todos listos, para.
    refetchInterval: (query) => {
      const rows = query.state.data ?? [];
      return rows.some((v) => v.processingStatus === "PENDING" || v.processingStatus === "PROCESSING")
        ? 4000
        : false;
    },
  });

  const canDelete = usePermission("OPERACIONES", "DELETE");

  const deleteMut = useMutation({
    mutationFn: (videoId: string) => deleteProjectVideo(videoId),
    onSuccess: () => {
      toast.success("Video eliminado");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["project-videos", projectId] });
    },
    onError: () => toast.error("No se pudo eliminar el video"),
  });

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
          Videos
          <span className="ml-2 font-mono text-xs font-normal text-[var(--color-text-muted)]">
            {videos.length}
          </span>
        </h3>
      </div>

      {canUpload && (
        <div className="mb-4 rounded-lg border border-dashed border-[var(--color-border)] p-3">
          <ProjectVideoUpload projectId={projectId} />
          <p className="mt-2 text-[10px] leading-snug text-[var(--color-text-muted)]">
            Los videos se comprimen al subirlos, así que ocupan poco y se pueden guardar siempre.
            Para que la subida sea más rápida, grabá en 1080p en vez de 4K.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">Cargando…</div>
      ) : videos.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          Todavía no se subió ningún video
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <ProjectVideoCard
              key={video.id}
              video={video}
              canDelete={canDelete}
              onPlay={() => setPlaying(video)}
              onDelete={() => setConfirmDelete(video)}
            />
          ))}
        </div>
      )}

      {playing && <ProjectVideoPlayer video={playing} onClose={() => setPlaying(null)} />}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleteMut.isPending && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
              Eliminar video
            </h4>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
              El video deja de verse en el proyecto, pero el archivo se conserva en el respaldo por
              tratarse de evidencia de obra.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(confirmDelete.id)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMut.isPending ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

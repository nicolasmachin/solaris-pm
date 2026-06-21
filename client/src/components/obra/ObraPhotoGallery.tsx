import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download } from "lucide-react";

import {
  deleteObraPhoto,
  getDownloadAllUrl,
  getObraPhotos,
  type ObraPhoto,
} from "../../api/obra.api";
import { ObraPhotoUpload } from "./ObraPhotoUpload";
import { ObraLightbox } from "./ObraLightbox";
import { ProtectedImage } from "./ProtectedImage";

interface Props {
  projectId: string;
}

export function ObraPhotoGallery({ projectId }: Props) {
  const qc = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ObraPhoto | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["obra-photos", projectId],
    queryFn: () => getObraPhotos(projectId),
  });

  const photos = data?.photos ?? [];
  const count = data?.count ?? 0;

  const deleteMut = useMutation({
    mutationFn: (photoId: string) => deleteObraPhoto(projectId, photoId),
    onSuccess: () => {
      toast.success("Foto eliminada");
      setConfirmDelete(null);
      // Cerrar el lightbox: la foto que se estaba viendo ya no existe.
      setLightboxIndex(null);
      qc.invalidateQueries({ queryKey: ["obra-photos", projectId] });
    },
    onError: () => toast.error("No se pudo eliminar la foto"),
  });

  // Descarga del ZIP por fetch autenticado (el endpoint exige Bearer, así que
  // no sirve un <a href>). Mantenemos "Preparando descarga…" hasta que el blob
  // esté listo y se dispare el guardado, para que el usuario no reclickee.
  async function handleDownloadAll() {
    if (count === 0 || downloading) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem("voltia-token");
      const res = await fetch(getDownloadAllUrl(projectId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "fotos_obra.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      console.error("Error descargando ZIP de fotos:", err);
      toast.error("No se pudo preparar la descarga");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
          Fotos de Obra
          <span className="ml-2 font-mono text-xs font-normal text-[var(--color-text-muted)]">
            {count}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={count === 0 || downloading}
            onClick={handleDownloadAll}
            className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]/30 disabled:opacity-40"
          >
            <Download size={14} />
            {downloading ? "Preparando descarga…" : "Descargar todas"}
          </button>
          <ObraPhotoUpload projectId={projectId} />
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">Cargando…</div>
      ) : photos.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No hay fotos cargadas todavía
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              className="group relative aspect-square overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)]"
            >
              <ProtectedImage
                src={photo.thumbnailUrl}
                alt={photo.filename}
                className="h-full w-full cursor-pointer object-cover"
                onClick={() => setLightboxIndex(idx)}
              />
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <ObraLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDelete={(photo) => setConfirmDelete(photo)}
        />
      )}

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
              Eliminar foto
            </h4>
            <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
              ¿Seguro que querés eliminar esta foto? No se puede deshacer.
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

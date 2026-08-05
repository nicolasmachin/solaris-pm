import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Camera, Trash2, Video } from "lucide-react";

import { deleteLeadFoto, getLeadFotos, uploadLeadFoto } from "../../api/leadFotos.api";
import {
  deleteProjectVideo,
  getLeadVideos,
  uploadLeadVideo,
  type ProjectVideo,
} from "../../api/videos.api";
import { usePermission } from "../../hooks/usePermission";
import { compressImage } from "../../utils/compressImage";
import { ACCEPT_FOTOS } from "../../utils/fileAccept";
import { ProtectedImage } from "../obra/ProtectedImage";
import { ProjectVideoCard } from "../videos/ProjectVideoCard";
import { ProjectVideoPlayer } from "../videos/ProjectVideoPlayer";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface Props {
  leadId: string;
  canEdit: boolean;
}

/** Coincide con MAX_VIDEO_SIZE_MB del backend. */
const MAX_VIDEO_MB = 500;

/**
 * Fotos y videos del relevamiento de la visita comercial, antes de que exista el
 * proyecto. Al ganarse el lead, todo esto pasa al proyecto: las fotos a la
 * galería de obra y los videos a la sección Videos.
 */
export function LeadVisitaMedia({ leadId, canEdit }: Props) {
  const qc = useQueryClient();
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [fotoProgreso, setFotoProgreso] = useState<{ hechas: number; total: number } | null>(null);
  const [videoPercent, setVideoPercent] = useState<number | null>(null);
  const [playing, setPlaying] = useState<ProjectVideo | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState<{ id: string; nombre: string } | null>(
    null,
  );
  const [confirmarVideo, setConfirmarVideo] = useState<ProjectVideo | null>(null);
  const canDeleteVideo = usePermission("VENTAS", "DELETE");

  const fotosQ = useQuery({
    queryKey: ["lead-fotos", leadId],
    queryFn: () => getLeadFotos(leadId),
  });

  const videosQ = useQuery({
    queryKey: ["lead-videos", leadId],
    queryFn: () => getLeadVideos(leadId),
    // Mientras alguno se está comprimiendo, refrescar para que aparezca la
    // miniatura sin recargar la página.
    refetchInterval: (query) =>
      (query.state.data ?? []).some(
        (v) => v.processingStatus === "PENDING" || v.processingStatus === "PROCESSING",
      )
        ? 4000
        : false,
  });

  const fotos = fotosQ.data?.fotos ?? [];
  const videos = videosQ.data ?? [];

  const borrarFotoMut = useMutation({
    mutationFn: (fotoId: string) => deleteLeadFoto(leadId, fotoId),
    onSuccess: () => {
      toast.success("Foto eliminada");
      setConfirmarBorrado(null);
      qc.invalidateQueries({ queryKey: ["lead-fotos", leadId] });
    },
    onError: () => toast.error("No se pudo eliminar la foto"),
  });

  const borrarVideoMut = useMutation({
    mutationFn: (videoId: string) => deleteProjectVideo(videoId),
    onSuccess: () => {
      toast.success("Video eliminado");
      setConfirmarVideo(null);
      qc.invalidateQueries({ queryKey: ["lead-videos", leadId] });
    },
    onError: () => toast.error("No se pudo eliminar el video"),
  });

  // Las fotos se comprimen en el celular antes de subir (de ~4 MB a ~300 KB):
  // en una visita se sacan muchas y de otro modo la subida por datos es lenta.
  async function subirFotos(files: FileList) {
    const lista = Array.from(files);
    if (lista.length === 0) return;

    setFotoProgreso({ hechas: 0, total: lista.length });
    let ok = 0;

    for (let i = 0; i < lista.length; i++) {
      try {
        const { blob, filename } = await compressImage(lista[i]);
        await uploadLeadFoto(leadId, blob, filename);
        ok++;
      } catch (err) {
        console.error("Error subiendo foto del lead:", lista[i].name, err);
      }
      setFotoProgreso({ hechas: i + 1, total: lista.length });
    }

    setFotoProgreso(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
    await qc.invalidateQueries({ queryKey: ["lead-fotos", leadId] });

    if (ok === lista.length) toast.success(ok === 1 ? "Foto subida" : `${ok} fotos subidas`);
    else if (ok > 0) toast.success(`${ok} de ${lista.length} subidas`);
    else toast.error("No se pudo subir ninguna foto");
  }

  async function subirVideo(file: File) {
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_VIDEO_MB) {
      toast.error(`El video pesa ${mb.toFixed(0)} MB y el máximo es ${MAX_VIDEO_MB} MB.`);
      return;
    }

    setVideoPercent(0);
    try {
      await uploadLeadVideo(leadId, { file, onProgress: setVideoPercent });
      toast.success("Video subido. Se está preparando para ver.");
      await qc.invalidateQueries({ queryKey: ["lead-videos", leadId] });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo subir el video";
      toast.error(message);
    } finally {
      setVideoPercent(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  const subiendoVideo = videoPercent !== null;
  const subiendoFotos = fotoProgreso !== null;

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fotoInputRef}
            type="file"
            accept={ACCEPT_FOTOS}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void subirFotos(e.target.files);
            }}
          />
          <button
            type="button"
            disabled={subiendoFotos}
            onClick={() => fotoInputRef.current?.click()}
            className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Camera size={14} />
            {subiendoFotos
              ? `Subiendo ${fotoProgreso.hechas} de ${fotoProgreso.total}…`
              : "Subir fotos"}
          </button>

          <input
            ref={videoInputRef}
            type="file"
            // Sin `capture`: en iOS ese atributo fuerza la cámara y saca la
            // opción de elegir un video ya grabado del carrete.
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subirVideo(f);
            }}
          />
          <button
            type="button"
            disabled={subiendoVideo}
            onClick={() => videoInputRef.current?.click()}
            className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]/30 disabled:opacity-50"
          >
            <Video size={14} />
            {subiendoVideo ? `Subiendo… ${videoPercent}%` : "Subir video"}
          </button>
        </div>
      )}

      {fotos.length === 0 && videos.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">
          Todavía no hay fotos ni videos de la visita
        </p>
      ) : null}

      {fotos.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Fotos · {fotos.length}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {fotos.map((foto) => (
              <div
                key={foto.id}
                className="group relative aspect-square overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)]"
              >
                <ProtectedImage
                  src={foto.thumbnailUrl}
                  alt={foto.filename}
                  className="h-full w-full cursor-pointer object-cover"
                  onClick={() => window.open(`${foto.fullUrl}`, "_blank")}
                />
                {canEdit && (
                  <button
                    type="button"
                    aria-label="Eliminar foto"
                    onClick={() => setConfirmarBorrado({ id: foto.id, nombre: foto.filename })}
                    className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Videos · {videos.length}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((video) => (
              <ProjectVideoCard
                key={video.id}
                video={video}
                canDelete={canDeleteVideo}
                onPlay={() => setPlaying(video)}
                onDelete={() => setConfirmarVideo(video)}
              />
            ))}
          </div>
        </div>
      )}

      {playing && <ProjectVideoPlayer video={playing} onClose={() => setPlaying(null)} />}

      <ConfirmDialog
        open={confirmarBorrado !== null}
        title="Eliminar foto"
        description={`¿Eliminar "${confirmarBorrado?.nombre ?? ""}"? No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        loading={borrarFotoMut.isPending}
        onClose={() => setConfirmarBorrado(null)}
        onConfirm={() => confirmarBorrado && borrarFotoMut.mutate(confirmarBorrado.id)}
      />

      <ConfirmDialog
        open={confirmarVideo !== null}
        title="Eliminar video"
        description={`¿Eliminar "${confirmarVideo?.originalFilename ?? ""}"? No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        loading={borrarVideoMut.isPending}
        onClose={() => setConfirmarVideo(null)}
        onConfirm={() => confirmarVideo && borrarVideoMut.mutate(confirmarVideo.id)}
      />
    </div>
  );
}

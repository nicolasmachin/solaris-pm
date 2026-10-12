import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, PlayCircle, Video } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import {
  getPortalEmbed,
  getPortalVideos,
  savePortalProgreso,
  type DocumentoItem,
  type ListaConVideos,
  type VideoItem,
} from "../api/capacitacion.api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { DocumentoFila } from "../modules/capacitacion/CapacitacionSeccion";
import { fmtDuracion, Miniatura } from "../modules/capacitacion/capacitacionUi";
import { useProgresoVideo } from "../modules/capacitacion/useProgresoVideo";
import { usePortalPreviewStore } from "../store/portalPreview.store";

// "Videos" del portal: los tutoriales que Voltia le va mandando al cliente
// durante el proceso, para que los vuelva a ver cuando quiera. El contenido es
// el de Capacitación (áreas habilitadas para clientes). El video abierto va en
// la URL (?v=), que es a donde lleva el "Enlace para el cliente".
export function PortalVideos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const videoIdUrl = searchParams.get("v");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["portal-videos"],
    queryFn: getPortalVideos,
  });

  const listas = useMemo(() => data?.secciones.flatMap((s) => s.listas) ?? [], [data]);
  const abierto = useMemo(() => {
    if (!videoIdUrl) return null;
    for (const lista of listas) {
      const video = lista.videos.find((v) => v.id === videoIdUrl);
      if (video) return { video, lista };
    }
    return null;
  }, [listas, videoIdUrl]);

  const abrir = useCallback(
    (id: string | null) => {
      setSearchParams(id ? { v: id } : {}, { replace: Boolean(videoIdUrl && id) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setSearchParams, videoIdUrl],
  );

  if (isLoading) return <Spinner />;

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
        No pudimos cargar los videos. Probá de nuevo en un rato.
      </div>
    );
  }

  if (abierto) {
    return (
      <Reproductor
        video={abierto.video}
        lista={abierto.lista}
        mediaToken={data.mediaToken}
        documentos={data.secciones.flatMap((s) => s.documentos).filter((d) => d.listaId === abierto.lista.id)}
        onAbrir={abrir}
      />
    );
  }

  const variasAreas = data.secciones.length > 1;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Videos</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Los videos que te vamos mandando sobre tu instalación, para que los vuelvas a ver cuando quieras.
        </p>
      </div>

      {/* Llegó con un enlace a un video que ya no está. */}
      {videoIdUrl && (
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-muted)]">
          Ese video ya no está disponible. Acá tenés todos los demás.
        </p>
      )}

      {data.secciones.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
          <Video size={28} className="mx-auto mb-2 text-[var(--color-text-muted)]" />
          <p className="text-sm text-[var(--color-text-muted)]">
            Todavía no hay videos. Cuando te mandemos el primero, va a aparecer acá.
          </p>
        </div>
      ) : (
        data.secciones.map((seccion) => (
          <section key={seccion.id} className="space-y-5">
            {variasAreas && (
              <div>
                <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                  {seccion.nombre}
                </h2>
                {seccion.descripcion && (
                  <p className="text-sm text-[var(--color-text-muted)]">{seccion.descripcion}</p>
                )}
              </div>
            )}

            {seccion.listas
              .filter((l) => l.videos.length > 0)
              .map((lista) => (
                <div key={lista.id} className="space-y-2">
                  <div>
                    <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                      {lista.titulo}
                    </h3>
                    {lista.descripcion && (
                      <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{lista.descripcion}</p>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {lista.videos.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => abrir(v.id)}
                        className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2.5 text-left transition-colors hover:border-[var(--color-accent)]"
                      >
                        <Miniatura
                          thumbnailUrl={v.thumbnailUrl}
                          mediaToken={data.mediaToken}
                          duracionSeg={v.duracionSeg}
                          visto={v.visto}
                        />
                        <p className="line-clamp-2 text-sm font-medium text-[var(--color-text-primary)]">
                          {v.titulo}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

            {seccion.documentos.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)]">
                  Documentos
                </h3>
                <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                  {seccion.documentos.map((doc) => (
                    <DocumentoFila key={doc.id} doc={doc} mediaToken={data.mediaToken} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function Reproductor({
  video,
  lista,
  mediaToken,
  documentos,
  onAbrir,
}: {
  video: VideoItem;
  lista: ListaConVideos;
  mediaToken: string;
  documentos: DocumentoItem[];
  onAbrir: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Quien mira el portal "como el cliente" no le deja progreso: el backend lo
  // rechazaría igual (es sólo lectura), así que ni se intenta.
  const enVistaPrevia = Boolean(usePortalPreviewStore((s) => s.preview));

  const { data: embed, isLoading: cargandoEmbed } = useQuery({
    queryKey: ["portal-videos", "embed", video.id],
    queryFn: () => getPortalEmbed(video.id),
    staleTime: 60 * 60 * 1000,
  });

  const progreso = useMutation({
    mutationFn: (body: { videoId: string; segundos: number; completado?: boolean }) =>
      savePortalProgreso(body.videoId, { segundos: body.segundos, completado: body.completado }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-videos"], exact: true }),
  });

  const { guardar } = useProgresoVideo(iframeRef, {
    videoId: video.id,
    enviar: (body) => {
      if (!enVistaPrevia) progreso.mutate(body);
    },
    onFin: (videoId) => {
      // Pasar solo al siguiente de la lista.
      const i = lista.videos.findIndex((v) => v.id === videoId);
      const siguiente = i >= 0 ? lista.videos[i + 1] : undefined;
      if (siguiente) onAbrir(siguiente.id);
    },
  });

  // El título de la pestaña ayuda a reencontrar el video en el historial.
  useEffect(() => {
    const previo = document.title;
    document.title = `${video.titulo} · Voltia`;
    return () => {
      document.title = previo;
    };
  }, [video.titulo]);

  const otros = lista.videos;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button
        onClick={() => onAbrir(null)}
        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      >
        <ArrowLeft size={14} /> Todos los videos
      </button>

      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
        {cargandoEmbed || !embed ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={28} />
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={video.id}
            src={embed.embedUrl}
            title={video.titulo}
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            {lista.titulo}
          </p>
          <h1 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">{video.titulo}</h1>
          {video.descripcion && (
            <p className="mt-1 whitespace-pre-line text-sm text-[var(--color-text-muted)]">{video.descripcion}</p>
          )}
        </div>
        {!enVistaPrevia && (
          <Button
            size="sm"
            variant={video.visto ? "secondary" : "primary"}
            loading={progreso.isPending}
            onClick={() => guardar(!video.visto)}
          >
            <span className="flex items-center gap-1.5">
              <Check size={14} /> {video.visto ? "Visto" : "Marcar como visto"}
            </span>
          </Button>
        )}
      </div>

      {documentos.length > 0 && (
        <div>
          <h2 className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Material de apoyo
          </h2>
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            {documentos.map((doc) => (
              <DocumentoFila key={doc.id} doc={doc} mediaToken={mediaToken} />
            ))}
          </ul>
        </div>
      )}

      {otros.length > 1 && (
        <div>
          <h2 className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            En esta lista · {otros.filter((v) => v.visto).length}/{otros.length} vistos
          </h2>
          <ul className="space-y-1">
            {otros.map((v, i) => {
              const activo = v.id === video.id;
              return (
                <li key={v.id}>
                  <button
                    onClick={() => !activo && onAbrir(v.id)}
                    className={`flex w-full items-start gap-2 rounded-lg border p-2 text-left transition-colors ${
                      activo
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-transparent hover:bg-[var(--color-bg-card-hover)]"
                    }`}
                  >
                    <span className="w-4 flex-shrink-0 pt-1 text-center text-[11px] text-[var(--color-text-muted)]">
                      {activo ? <PlayCircle size={12} className="mx-auto" /> : i + 1}
                    </span>
                    <div className="w-28 flex-shrink-0">
                      <Miniatura thumbnailUrl={v.thumbnailUrl} mediaToken={mediaToken} duracionSeg={v.duracionSeg} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`line-clamp-2 text-sm ${
                          activo ? "font-medium text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {v.titulo}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                        {v.visto ? (
                          <>
                            <Check size={10} className="text-emerald-500" /> Visto
                          </>
                        ) : (
                          fmtDuracion(v.duracionSeg) ?? ""
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

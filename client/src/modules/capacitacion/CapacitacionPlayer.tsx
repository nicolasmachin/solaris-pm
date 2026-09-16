import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Link2, Maximize2, Minimize2, PlayCircle } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";

import { getEmbed, getLista, saveProgreso, type VideoItem } from "../../api/capacitacion.api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { ComentariosVideo } from "./ComentariosVideo";
import { DocumentoFila } from "./CapacitacionSeccion";
import { fmtDuracion, Miniatura } from "./capacitacionUi";
import { useBunnyPlayer } from "./useBunnyPlayer";

// Cada cuánto se manda la posición del video mientras se mira. Suficiente para
// no perder el punto y sin llenar la red de pedidos.
const GUARDADO_CADA_MS = 15_000;

// Tamaño del reproductor. En "normal" la altura se ata a la del navegador, para
// que el título, los botones y los comentarios entren sin scrollear (en una
// pantalla grande, ocupar todo el ancho dejaba todo eso abajo del pliegue).
// "Amplio" es el modo teatro: usa todo el ancho disponible.
const PREF_AMPLIO = "capacitacion-player-amplio";

// Reproductor estilo lista de YouTube: el video grande y, al costado, los demás
// de la lista. El video activo va en la URL (?v=) para poder compartir el link.
export function CapacitacionPlayer() {
  const { listaId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [amplio, setAmplio] = useState(() => {
    try {
      return localStorage.getItem(PREF_AMPLIO) === "1";
    } catch {
      // Safari en privado tira al leer localStorage: se arranca en normal.
      return false;
    }
  });
  const qc = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["capacitacion", "lista", listaId],
    queryFn: () => getLista(listaId),
    enabled: Boolean(listaId),
  });

  const videos = useMemo(() => data?.videos ?? [], [data]);
  const videoIdUrl = searchParams.get("v");
  const actual: VideoItem | undefined =
    videos.find((v) => v.id === videoIdUrl) ?? videos.find((v) => !v.visto) ?? videos[0];

  const seleccionar = useCallback(
    (id: string) => setSearchParams({ v: id }, { replace: true }),
    [setSearchParams],
  );

  // URL firmada del embed: se pide por video y vence sola (la firma dura horas).
  const { data: embed, isLoading: cargandoEmbed } = useQuery({
    queryKey: ["capacitacion", "embed", actual?.id],
    queryFn: () => getEmbed(actual!.id),
    enabled: Boolean(actual?.id),
    staleTime: 60 * 60 * 1000,
  });

  const progreso = useMutation({
    mutationFn: (body: { videoId: string; segundos: number; completado?: boolean }) =>
      saveProgreso(body.videoId, { segundos: body.segundos, completado: body.completado }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capacitacion", "lista", listaId] });
      qc.invalidateQueries({ queryKey: ["capacitacion", "secciones"] });
      qc.invalidateQueries({ queryKey: ["capacitacion", "seccion", data?.seccion.id] });
    },
  });

  // Posición del video vivo fuera de React: el evento llega ~4 veces por
  // segundo y no tiene que repintar nada.
  const posicion = useRef(0);
  const ultimoGuardado = useRef(0);
  // Última posición efectivamente guardada: si el video está pausado no se
  // vuelve a mandar nada. Sin esto, abrir un video y no mirarlo dejaba a la
  // persona registrada con 0 segundos en el seguimiento.
  const posicionGuardada = useRef(-1);
  const videoIdRef = useRef<string | undefined>(actual?.id);
  videoIdRef.current = actual?.id;

  const guardar = useCallback(
    (completado?: boolean) => {
      const videoId = videoIdRef.current;
      if (!videoId) return;
      const segundos = Math.floor(posicion.current);
      // Sin avance real y sin marcar a mano, no hay nada que guardar.
      if (completado === undefined && segundos <= posicionGuardada.current) return;
      progreso.mutate({ videoId, segundos, completado });
      posicionGuardada.current = segundos;
      ultimoGuardado.current = Date.now();
    },
    [progreso],
  );

  useBunnyPlayer(iframeRef, {
    videoKey: actual?.id,
    onTiempo: (segundos) => {
      posicion.current = segundos;
      if (Date.now() - ultimoGuardado.current >= GUARDADO_CADA_MS) guardar();
    },
    onFin: () => {
      guardar(true);
      // Pasar solo al siguiente, como una lista de reproducción.
      const i = videos.findIndex((v) => v.id === videoIdRef.current);
      const siguiente = i >= 0 ? videos[i + 1] : undefined;
      if (siguiente) seleccionar(siguiente.id);
    },
  });

  // Al cambiar de video o salir de la pantalla, guardar lo último visto.
  useEffect(() => {
    posicion.current = 0;
    posicionGuardada.current = 0;
    ultimoGuardado.current = Date.now();
  }, [actual?.id]);

  useEffect(() => {
    function alSalir() {
      if (posicion.current > 0) guardar();
    }
    window.addEventListener("pagehide", alSalir);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      alSalir();
    };
    // `guardar` es estable salvo por la mutación; no hace falta re-registrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enlace directo a ESTE video, para pasarlo por chat. Lo abre cualquiera que
  // tenga habilitada el área; el resto ve "No encontramos esta capacitación".
  function alternarTamano() {
    setAmplio((v) => {
      const next = !v;
      try {
        localStorage.setItem(PREF_AMPLIO, next ? "1" : "0");
      } catch {
        // Sin localStorage el modo vale solo para esta visita.
      }
      return next;
    });
  }

  async function copiarEnlace() {
    if (!actual) return;
    // Enlace "de compartir": lo resuelve el backend con el título y la miniatura
    // del video, para que WhatsApp o Slack muestren la tarjeta. A la persona la
    // redirige al reproductor.
    const url = `${window.location.origin}/api/capacitacion/compartir/${actual.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      // Safari sin permiso de portapapeles: al menos dejarlo a la vista.
      window.prompt("Copiá el enlace:", url);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={28} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="No encontramos esta lista"
        description="Puede que se haya quitado, o que no esté habilitada para tu rol."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Link
          to={`/capacitacion/${data.seccion.id}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft size={14} /> {data.seccion.nombre}
        </Link>
        <h1 className="mt-1 font-display text-xl font-bold text-[var(--color-text-primary)]">{data.titulo}</h1>
      </div>

      {videos.length === 0 ? (
        <EmptyState title="Esta lista todavía no tiene videos" icon="🎬" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <div
              className={`relative mx-auto aspect-video overflow-hidden rounded-lg bg-black ${
                amplio ? "w-full" : "h-[min(58vh,calc((100vw-2rem)*9/16))] max-w-full"
              }`}
            >
              {cargandoEmbed || !embed ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size={28} />
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  key={actual?.id}
                  src={embed.embedUrl}
                  title={actual?.titulo ?? "Video"}
                  loading="lazy"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full border-0"
                />
              )}
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
                  {actual?.titulo}
                </h2>
                {actual?.descripcion && (
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{actual.descripcion}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={alternarTamano}
                  title={amplio ? "Achicar el reproductor" : "Agrandar el reproductor"}
                >
                  <span className="flex items-center gap-1.5">
                    {amplio ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    {amplio ? "Achicar" : "Agrandar"}
                  </span>
                </Button>
                <Button size="sm" variant="ghost" onClick={copiarEnlace} title="Copiar enlace a este video">
                  <span className="flex items-center gap-1.5">
                    <Link2 size={14} /> Copiar enlace
                  </span>
                </Button>
                <Button
                  size="sm"
                  variant={actual?.visto ? "secondary" : "primary"}
                  loading={progreso.isPending}
                  onClick={() => guardar(!actual?.visto)}
                >
                  <span className="flex items-center gap-1.5">
                    <Check size={14} /> {actual?.visto ? "Visto" : "Marcar como visto"}
                  </span>
                </Button>
              </div>
            </div>

            {actual && <ComentariosVideo videoId={actual.id} />}

            {data.documentos.length > 0 && (
              <div>
                <h3 className="mb-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Material de la lista
                </h3>
                <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                  {data.documentos.map((doc) => (
                    <DocumentoFila key={doc.id} doc={doc} mediaToken={data.mediaToken} />
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                En esta lista
              </h3>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {videos.filter((v) => v.visto).length}/{videos.length}
              </span>
            </div>
            <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
              {videos.map((v, i) => {
                const activo = v.id === actual?.id;
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => seleccionar(v.id)}
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
                        <Miniatura
                          thumbnailUrl={v.thumbnailUrl}
                          mediaToken={data.mediaToken}
                          duracionSeg={v.duracionSeg}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`line-clamp-2 text-xs ${
                            activo
                              ? "font-medium text-[var(--color-text-primary)]"
                              : "text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {v.titulo}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
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
          </aside>
        </div>
      )}
    </div>
  );
}

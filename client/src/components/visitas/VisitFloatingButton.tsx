import { useEffect, useRef, useState } from "react";
import { useMatch } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Mic, X } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { usePermission } from "../../hooks/usePermission";
import { uploadProjectVisitAudio } from "../../api/visitas.api";

/**
 * Botón flotante de audio (estilo WhatsApp) para grabar una entrada de visita
 * técnica desde cualquier pantalla de proyecto. Tap arranca la grabación,
 * tap detiene. Después abre un dialog con preview + descripción + guardar.
 *
 * Visible sólo si:
 *  - El user tiene OPERACIONES.EDIT (operario o admin)
 *  - La URL actual contiene un projectId reconocible
 *
 * Posición: bottom-6 right-24 (al lado del FAB violeta de IA, que va en
 * bottom-6 right-6).
 */

function pickSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore
    }
  }
  return "";
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function VisitFloatingButton() {
  const { user } = useAuthStore();
  const canCreateVisitas = usePermission("OPERACIONES", "EDIT");

  // Detectar projectId de la URL actual.
  const projectMatch = useMatch("/projects/:projectId");
  const visitMatch = useMatch("/projects/:projectId/visita/:visitId");
  const projectId = visitMatch?.params.projectId ?? projectMatch?.params.projectId ?? null;

  const qc = useQueryClient();

  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMime, setAudioMime] = useState("");
  const [description, setDescription] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (intervalRef.current) clearInterval(intervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const audioMut = useMutation({
    mutationFn: () =>
      uploadProjectVisitAudio(projectId!, audioBlob!, audioMime, description.trim() || null),
    onSuccess: () => {
      toast.success("Audio guardado · transcribiendo…");
      cleanup();
      setShowDialog(false);
      qc.invalidateQueries({ queryKey: ["technical-visits", projectId] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo subir el audio");
    },
  });

  function cleanup() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setAudioMime("");
    setDescription("");
    setDuration(0);
    chunksRef.current = [];
  }

  async function startRecording() {
    if (!projectId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const preferredMime = pickSupportedMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const realMime = recorder.mimeType || preferredMime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: realMime });
        setAudioBlob(blob);
        setAudioMime(realMime);
        setAudioUrl(URL.createObjectURL(blob));
        setShowDialog(true);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setDuration(0);
      const start = Date.now();
      intervalRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - start) / 1000));
      }, 500);
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRecording(false);
  }

  function handleToggle() {
    if (recording) stopRecording();
    else startRecording();
  }

  // No mostrar el botón si no hay context o no hay permiso.
  if (!user || !canCreateVisitas || !projectId) return null;

  // Posición: si el user es ADMIN, hay otro FAB en bottom-6 right-6 (IA).
  // Me corro a la izquierda. Si no, ocupo right-6.
  const positionClass = user.role === "ADMIN" ? "right-24" : "right-6";

  return (
    <>
      <div className={`fixed bottom-6 ${positionClass} z-40`}>
        {recording && (
          <div className="absolute -top-9 right-0 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold animate-pulse whitespace-nowrap">
            ● {formatDuration(duration)}
          </div>
        )}
        <button
          onClick={handleToggle}
          aria-label={recording ? "Detener grabación" : "Grabar audio"}
          title={recording ? "Detener grabación" : "Grabar audio para visita técnica"}
          className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all ${
            recording
              ? "bg-red-500 hover:bg-red-600 scale-110"
              : "bg-[var(--color-accent)] hover:opacity-90 active:scale-95"
          } text-black`}
        >
          {recording ? (
            <div className="w-4 h-4 bg-white rounded-sm" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>

      {showDialog && audioBlob && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => !audioMut.isPending && setShowDialog(false)}
        >
          <div
            className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 max-w-md w-full space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Audio grabado · {formatDuration(duration)}
              </h3>
              <button
                onClick={() => !audioMut.isPending && setShowDialog(false)}
                className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {audioUrl && (
              <audio src={audioUrl} controls preload="metadata" playsInline className="w-full" />
            )}
            <input
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs"
              placeholder="Descripción opcional (ej: 'recorrida del techo')"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  cleanup();
                  setShowDialog(false);
                }}
                disabled={audioMut.isPending}
                className="flex-1 rounded border border-[var(--color-border)] px-3 py-2 text-xs hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
              >
                Descartar
              </button>
              <button
                onClick={() => audioMut.mutate()}
                disabled={audioMut.isPending}
                className="flex-1 rounded bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
              >
                {audioMut.isPending ? "Subiendo…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

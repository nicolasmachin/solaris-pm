import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { Mic, Square, X } from "lucide-react";

interface AudioRecorderProps {
  onSave: (blob: Blob, description: string) => Promise<void> | void;
  onCancel: () => void;
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function AudioRecorder({ onSave, onCancel }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(0);
  const [saving, setSaving] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
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
    mediaRecorderRef.current?.stop();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRecording(false);
  }

  function discard() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setDescription("");
  }

  async function handleSave() {
    if (!audioBlob) return;
    setSaving(true);
    try {
      await onSave(audioBlob, description.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
          Grabar audio
        </p>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {!recording && !audioBlob && (
        <button
          onClick={startRecording}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
        >
          <Mic className="w-4 h-4" /> Empezar a grabar
        </button>
      )}

      {recording && (
        <div className="text-center space-y-2">
          <div className="text-2xl font-mono">{formatDuration(duration)}</div>
          <div className="animate-pulse text-red-500 text-xs">● Grabando…</div>
          <button
            onClick={stopRecording}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-card-hover)]"
          >
            <Square className="w-3 h-3" /> Detener
          </button>
        </div>
      )}

      {audioBlob && !recording && (
        <>
          {audioUrl && <audio src={audioUrl} controls className="w-full" />}
          <input
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs"
            placeholder="Descripción opcional (ej: 'recorrida del techo')"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={discard}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              Descartar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Subiendo…" : "Guardar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

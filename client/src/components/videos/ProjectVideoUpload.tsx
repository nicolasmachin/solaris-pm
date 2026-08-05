import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Video } from "lucide-react";

import {
  TIPOS_VIDEO_SELECCIONABLES,
  TIPO_VIDEO_LABEL,
  uploadProjectVideo,
  type TipoVideo,
} from "../../api/videos.api";

interface Props {
  projectId: string;
}

/** Coincide con MAX_VIDEO_SIZE_MB del backend. */
const MAX_MB = 500;

export function ProjectVideoUpload({ projectId }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipoVideo, setTipoVideo] = useState<TipoVideo>("ENSAYO_ANTI_ISLA");
  const [descripcion, setDescripcion] = useState("");
  const [percent, setPercent] = useState<number | null>(null);

  const busy = percent !== null;

  async function handleFile(file: File) {
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_MB) {
      toast.error(
        `El video pesa ${sizeMb.toFixed(0)} MB y el máximo es ${MAX_MB} MB. Probá grabar en 1080p en vez de 4K, o subir un clip más corto.`,
      );
      return;
    }

    setPercent(0);
    try {
      await uploadProjectVideo(projectId, {
        file,
        tipoVideo,
        descripcion: descripcion.trim() || undefined,
        onProgress: setPercent,
      });
      toast.success("Video subido. Se está preparando para ver.");
      setDescripcion("");
      await qc.invalidateQueries({ queryKey: ["project-videos", projectId] });
      // El checklist se marca solo cuando el video queda listo.
      await qc.invalidateQueries({ queryKey: ["project", projectId] });
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo subir el video";
      toast.error(message);
    } finally {
      setPercent(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          Tipo
        </span>
        <select
          value={tipoVideo}
          disabled={busy}
          onChange={(e) => setTipoVideo(e.target.value as TipoVideo)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] disabled:opacity-50"
        >
          {TIPOS_VIDEO_SELECCIONABLES.map((tipo) => (
            <option key={tipo} value={tipo}>
              {TIPO_VIDEO_LABEL[tipo]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          Nota (opcional)
        </span>
        <input
          type="text"
          value={descripcion}
          disabled={busy}
          maxLength={200}
          placeholder="Ej: se abre el interruptor general"
          onChange={(e) => setDescripcion(e.target.value)}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] disabled:opacity-50"
        />
      </label>

      <input
        ref={inputRef}
        type="file"
        // Sin `capture`: ese atributo fuerza la cámara en iOS y hace desaparecer
        // la opción de elegir un video ya grabado del carrete. Sin él, el iPhone
        // ofrece las dos cosas (Fototeca / grabar en el momento), que es lo que
        // hace falta — el operario graba con la cámara nativa y sube después.
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Video size={14} />
        {busy ? `Subiendo… ${percent}%` : "Subir video"}
      </button>
    </div>
  );
}

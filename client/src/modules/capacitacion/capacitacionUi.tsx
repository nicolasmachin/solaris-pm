import { Check, FileText, PlayCircle } from "lucide-react";

import { thumbSrc } from "../../api/capacitacion.api";

/** "49:58" o "1:12:30". Null cuando Bunny todavía no reportó la duración. */
export function fmtDuracion(segundos: number | null | undefined) {
  if (!segundos || segundos <= 0) return null;
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

/** "45 min" / "2 h 10 min" para el total de una lista. */
export function fmtDuracionLarga(segundos: number) {
  if (segundos <= 0) return null;
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${Math.max(1, m)} min`;
}

export function fmtPeso(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Miniatura del video con su duración. Si no hay miniatura (o todavía no llegó
 * el token) cae a un ícono de play sobre el fondo de la card.
 */
export function Miniatura({
  thumbnailUrl,
  mediaToken,
  duracionSeg,
  visto,
  className = "",
}: {
  thumbnailUrl: string | null;
  mediaToken?: string;
  duracionSeg?: number | null;
  visto?: boolean;
  className?: string;
}) {
  const src = thumbSrc(thumbnailUrl, mediaToken);
  const duracion = fmtDuracion(duracionSeg);
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-md bg-[var(--color-border)] ${className}`}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
          <PlayCircle size={28} />
        </div>
      )}
      {duracion && (
        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-mono text-white">
          {duracion}
        </span>
      )}
      {visto && (
        <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
          <Check size={10} /> Visto
        </span>
      )}
    </div>
  );
}

/** Barra de avance "3 / 8 videos". */
export function AvanceBarra({ vistos, total }: { vistos: number; total: number }) {
  const pct = total > 0 ? Math.round((vistos / total) * 100) : 0;
  const completo = total > 0 && vistos === total;
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className={`h-full rounded-full transition-all ${completo ? "bg-emerald-500" : "bg-[var(--color-accent)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        {total === 0 ? "Sin videos todavía" : `${vistos} de ${total} ${total === 1 ? "video visto" : "videos vistos"}`}
      </p>
    </div>
  );
}

export function IconoDocumento({ mimeType }: { mimeType: string }) {
  const color = mimeType.includes("pdf")
    ? "text-red-400"
    : mimeType.includes("sheet") || mimeType.includes("excel")
      ? "text-emerald-400"
      : mimeType.startsWith("image/")
        ? "text-sky-400"
        : "text-[var(--color-text-muted)]";
  return <FileText size={18} className={color} />;
}

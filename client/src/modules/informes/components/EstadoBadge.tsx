import type { InformeEstado, InformeRespuesta } from "../../../api/informes.api";

const ESTADO_STYLE: Record<InformeEstado, { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-[var(--color-border)]/50 text-[var(--color-text-muted)]" },
  PENDIENTE: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-500" },
  APROBADO: { label: "Aprobado", cls: "bg-emerald-500/15 text-emerald-500" },
  DEVUELTO: { label: "Devuelto", cls: "bg-rose-500/15 text-rose-500" },
};

const RESPUESTA_STYLE: Record<InformeRespuesta, { label: string; cls: string }> = {
  PENDIENTE: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-500" },
  APROBADO: { label: "Aprobó", cls: "bg-emerald-500/15 text-emerald-500" },
  DEVUELTO: { label: "Devolvió", cls: "bg-rose-500/15 text-rose-500" },
};

export function EstadoBadge({ estado, compact }: { estado: InformeEstado; compact?: boolean }) {
  const s = ESTADO_STYLE[estado];
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full font-semibold ${s.cls} ${
        compact ? "px-1.5 py-0.5 text-[9px]" : "px-2.5 py-0.5 text-[11px]"
      }`}
    >
      {s.label}
    </span>
  );
}

export function RespuestaBadge({ respuesta }: { respuesta: InformeRespuesta }) {
  const s = RESPUESTA_STYLE[respuesta];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

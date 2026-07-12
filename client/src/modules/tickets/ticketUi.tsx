import {
  ESTADO_LABEL,
  PRIORIDAD_LABEL,
  type TicketEstado,
  type TicketPrioridad,
} from "../../api/tickets.api";

const ESTADO_CLASS: Record<TicketEstado, string> = {
  ABIERTO: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  DERIVADO: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  EN_PROGRESO: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  RESUELTO: "bg-green-500/15 text-green-300 border-green-500/30",
  CERRADO: "bg-[var(--color-bg-app)] text-[var(--color-text-muted)] border-[var(--color-border)]",
};

const PRIORIDAD_CLASS: Record<TicketPrioridad, string> = {
  BAJA: "text-[var(--color-text-muted)]",
  MEDIA: "text-amber-300",
  ALTA: "text-red-400",
};

export function EstadoBadge({ estado }: { estado: TicketEstado }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTADO_CLASS[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

export function PrioridadBadge({ prioridad }: { prioridad: TicketPrioridad }) {
  return (
    <span className={`text-[11px] font-medium ${PRIORIDAD_CLASS[prioridad]}`}>
      ● {PRIORIDAD_LABEL[prioridad]}
    </span>
  );
}

export function fmtFecha(dateStr: string): string {
  return new Date(dateStr).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

import { MessageSquare, Phone, Mail, MapPin, MessageCircle } from "lucide-react";

import type { ClienteInteraction, InteractionChannel } from "../../../api/clientes.api";
import { CHANNEL_LABELS } from "../constants";

const CHANNEL_ICON: Record<InteractionChannel, typeof MessageSquare> = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  LLAMADA: Phone,
  VISITA: MapPin,
  OTRO: MessageSquare,
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClienteInteractionList({ interacciones }: { interacciones: ClienteInteraction[] }) {
  if (interacciones.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
        Sin interacciones registradas todavía.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {interacciones.map((i) => {
        const Icon = CHANNEL_ICON[i.channel] ?? MessageSquare;
        return (
          <li
            key={i.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                <Icon className="h-3.5 w-3.5" />
                {CHANNEL_LABELS[i.channel] ?? i.channel}
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{fmtDateTime(i.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{i.content}</p>
            <p className="mt-1.5 text-[11px] text-[var(--color-text-muted)]">— {i.autor.nombre}</p>
          </li>
        );
      })}
    </ul>
  );
}

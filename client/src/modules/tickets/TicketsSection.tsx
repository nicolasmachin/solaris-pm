import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { listTickets, type TicketEstado } from "../../api/tickets.api";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { CrearTicketModal } from "./CrearTicketModal";
import { TicketDetail } from "./TicketDetail";
import { EstadoBadge, PrioridadBadge, fmtFecha } from "./ticketUi";

const ESTADOS: Array<{ value: TicketEstado | "TODOS"; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "ABIERTO", label: "Abiertos" },
  { value: "DERIVADO", label: "Derivados" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "RESUELTO", label: "Resueltos" },
  { value: "CERRADO", label: "Cerrados" },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]"
          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      {children}
    </button>
  );
}

// Contenido de la tab "Tickets" de Mis tareas: lista con filtros + alta + detalle.
export function TicketsSection() {
  const [estado, setEstado] = useState<TicketEstado | "TODOS">("TODOS");
  const [mias, setMias] = useState(false);
  const [creando, setCreando] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["tickets", estado, mias],
    queryFn: () => listTickets({ estado: estado === "TODOS" ? undefined : estado, mias: mias || undefined }),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {ESTADOS.map((e) => (
            <Pill key={e.value} active={estado === e.value} onClick={() => setEstado(e.value)}>{e.label}</Pill>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
          <Pill active={mias} onClick={() => setMias((v) => !v)}>Míos</Pill>
        </div>
        <Button size="sm" onClick={() => setCreando(true)}>
          <Plus size={14} className="mr-1" /> Nuevo ticket
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No hay tickets con estos filtros.</p>
      ) : (
        <div className="space-y-2">
          {data.map((t) => (
            <button
              key={t.id}
              onClick={() => setDetalleId(t.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-left hover:bg-[var(--color-bg-card-hover)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-[var(--color-text-primary)]">{t.titulo}</span>
                  {t.origenCliente && <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">· cliente</span>}
                </div>
                <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                  {t.projectName} · {t.projectCode} · {t.creadoPorNombre ?? "—"} · {fmtFecha(t.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <PrioridadBadge prioridad={t.prioridad} />
                <EstadoBadge estado={t.estado} />
              </div>
            </button>
          ))}
        </div>
      )}

      <CrearTicketModal open={creando} onClose={() => setCreando(false)} onCreated={(id) => setDetalleId(id)} />
      {detalleId && <TicketDetail ticketId={detalleId} onClose={() => setDetalleId(null)} />}
    </div>
  );
}

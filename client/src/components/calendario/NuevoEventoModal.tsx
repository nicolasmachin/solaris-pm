import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Plus, X } from "lucide-react";

import {
  crearAgendaEvento,
  TIPO_CALENDARIO_META,
  type TipoEventoAgenda,
} from "../../api/agenda.api";
import { getProjects } from "../../api/projects.api";
import { listTickets } from "../../api/tickets.api";
import { todayLocalISO } from "../../utils/date";
import { Button } from "../ui/Button";

interface EquipoOpcion {
  id: string;
  name: string;
  color: string;
}

interface Props {
  equipos: EquipoOpcion[];
  /** Día sobre el que se hizo clic, si vino de la grilla. */
  fechaInicial?: string;
  onClose: () => void;
}

const TIPOS: TipoEventoAgenda[] = ["MANTENIMIENTO", "SOPORTE", "VISITA_TECNICA"];

/**
 * Alta de un evento de agenda.
 *
 * Arranca con un solo día —que es el caso normal— y permite sumar días sueltos,
 * no necesariamente consecutivos: un mantenimiento puede ser el lunes y el
 * jueves sin tocar el miércoles.
 */
export function NuevoEventoModal({ equipos, fechaInicial, onClose }: Props) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<TipoEventoAgenda>("MANTENIMIENTO");
  const [dias, setDias] = useState<string[]>([fechaInicial ?? todayLocalISO()]);
  const [titulo, setTitulo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [notas, setNotas] = useState("");

  const proyectosQ = useQuery({
    queryKey: ["projects", "para-agenda"],
    // Incluye los generadores livianos: un mantenimiento suele ser sobre una
    // instalación vieja, que es justamente lo que se cargó por planilla.
    queryFn: () => getProjects({ includeLivianos: true }),
  });

  // Los tickets solo se piden cuando hacen falta.
  const ticketsQ = useQuery({
    queryKey: ["tickets", "abiertos", projectId],
    queryFn: () => listTickets(projectId ? { projectId } : undefined),
    enabled: tipo === "SOPORTE",
  });

  const proyectos = useMemo(
    () =>
      [...(proyectosQ.data ?? [])].sort((a, b) =>
        a.clientName.localeCompare(b.clientName, "es", { sensitivity: "base" }),
      ),
    [proyectosQ.data],
  );

  const crear = useMutation({
    mutationFn: () =>
      crearAgendaEvento({
        tipo,
        titulo: titulo.trim() || undefined,
        fechas: dias,
        projectId: projectId || null,
        // El backend rechaza un ticket fuera de SOPORTE; acá ni se manda.
        ticketId: tipo === "SOPORTE" && ticketId ? ticketId : null,
        teamId: teamId || null,
        notas: notas.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Agendado");
      qc.invalidateQueries({ queryKey: ["agenda-eventos"] });
      qc.invalidateQueries({ queryKey: ["calendar"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo agendar");
    },
  });

  function cambiarDia(i: number, valor: string) {
    setDias((d) => d.map((x, idx) => (idx === i ? valor : x)));
  }
  function sumarDia() {
    // El día nuevo arranca una semana después del último, que es el caso más
    // común en un mantenimiento repartido; igual se puede cambiar.
    const ultimo = dias[dias.length - 1];
    const d = new Date(`${ultimo}T12:00:00`);
    d.setDate(d.getDate() + 7);
    setDias((prev) => [...prev, d.toISOString().slice(0, 10)]);
  }
  function quitarDia(i: number) {
    setDias((d) => (d.length <= 1 ? d : d.filter((_, idx) => idx !== i)));
  }

  const meta = TIPO_CALENDARIO_META[tipo];
  const inputCls =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm";
  const sinDiasValidos = dias.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: meta.color }}
            aria-hidden
          />
          <h2 className="font-display text-base font-bold text-[var(--color-text-primary)]">
            Agendar {meta.corto.toLowerCase()}
          </h2>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Tipo</label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS.map((t) => {
                const m = TIPO_CALENDARIO_META[t];
                const sel = t === tipo;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
                    style={{
                      background: sel ? `${m.color}26` : "var(--color-bg-app)",
                      borderColor: sel ? m.color : "var(--color-border)",
                      color: sel ? "var(--color-text-primary)" : "var(--color-text-muted)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: m.color }} />
                    {m.corto}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Día{dias.length > 1 ? "s" : ""}
            </label>
            <div className="space-y-1.5">
              {dias.map((d, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={d}
                    onChange={(e) => cambiarDia(i, e.target.value)}
                    className={inputCls}
                  />
                  {dias.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitarDia(i)}
                      aria-label="Quitar día"
                      className="rounded border border-[var(--color-border)] p-1.5 text-[var(--color-text-muted)] hover:text-red-400"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={sumarDia}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            >
              <Plus size={12} /> Agregar otro día
            </button>
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              Los días no tienen que ser seguidos.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Equipo</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className={inputCls}>
              <option value="">— Sin equipo —</option>
              {equipos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Cliente / proyecto (opcional)
            </label>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setTicketId("");
              }}
              className={inputCls}
            >
              <option value="">— Sin proyecto —</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName} ({p.code})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              Si elegís uno, el evento queda en su ficha y en sus novedades.
            </p>
          </div>

          {tipo === "SOPORTE" && (
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
                Ticket (opcional)
              </label>
              <select
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Sin ticket —</option>
                {(ticketsQ.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.titulo}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Título (opcional)
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={projectId ? "Se usa el nombre del cliente" : "Ej: Relevamiento zona este"}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            Cancelar
          </button>
          <Button disabled={sinDiasValidos || crear.isPending} onClick={() => crear.mutate()}>
            {crear.isPending ? "Agendando…" : "Agendar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

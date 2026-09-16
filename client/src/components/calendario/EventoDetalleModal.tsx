import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Check, Plus, Trash2, X } from "lucide-react";

import {
  actualizarAgendaEvento,
  agregarDiaAgenda,
  eliminarAgendaEvento,
  moverDiaAgenda,
  quitarDiaAgenda,
  TIPO_CALENDARIO_META,
  type AgendaEvento,
  type TipoEventoAgenda,
} from "../../api/agenda.api";
import { getProjects } from "../../api/projects.api";
import { listTickets } from "../../api/tickets.api";
import { usePermission } from "../../hooks/usePermission";
import { Button } from "../ui/Button";

interface EquipoOpcion {
  id: string;
  name: string;
  color: string;
}

interface Props {
  evento: AgendaEvento;
  equipos: EquipoOpcion[];
  onClose: () => void;
}

const TIPOS: TipoEventoAgenda[] = ["MANTENIMIENTO", "SOPORTE", "VISITA_TECNICA", "OTRO"];

/** Día ya guardado (trae `id`) o recién agregado en pantalla (todavía sin `id`). */
interface DiaEditable {
  id: string | null;
  fecha: string;
}

/**
 * Ver, editar y eliminar un evento ya agendado.
 *
 * Los días se editan en local y se sincronizan recién al guardar: el backend
 * expone un endpoint por día (agregar / mover / quitar), pero disparar uno por
 * cada tecla del input de fecha llenaría la auditoría de reprogramaciones
 * fantasma. Acá se calcula la diferencia contra lo guardado y se mandan solo los
 * cambios reales.
 */
export function EventoDetalleModal({ evento, equipos, onClose }: Props) {
  const qc = useQueryClient();
  const puedeEditar = usePermission("OPERACIONES", "EDIT");
  const puedeEliminar = usePermission("OPERACIONES", "DELETE");

  const [tipo, setTipo] = useState<TipoEventoAgenda>(evento.tipo);
  const [titulo, setTitulo] = useState(evento.titulo);
  const [teamId, setTeamId] = useState(evento.teamId ?? "");
  const [projectId, setProjectId] = useState(evento.projectId ?? "");
  const [ticketId, setTicketId] = useState(evento.ticketId ?? "");
  const [notas, setNotas] = useState(evento.notas ?? "");
  const [dias, setDias] = useState<DiaEditable[]>(
    evento.dias.map((d) => ({ id: d.id, fecha: d.fecha })),
  );
  const [confirmandoBaja, setConfirmandoBaja] = useState(false);

  const completado = evento.completadoEn !== null;

  const proyectosQ = useQuery({
    queryKey: ["projects", "para-agenda"],
    queryFn: () => getProjects({ includeLivianos: true }),
  });

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

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["agenda-eventos"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
  }

  function mensajeError(err: unknown, fallback: string): string {
    return (
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
    );
  }

  /** Sincroniza los días: primero las bajas, después los movimientos, al final las altas. */
  async function sincronizarDias() {
    const originales = new Map(evento.dias.map((d) => [d.id, d.fecha]));
    const vivos = new Set(dias.filter((d) => d.id).map((d) => d.id as string));

    for (const [id] of originales) {
      if (!vivos.has(id)) await quitarDiaAgenda(evento.id, id);
    }
    for (const d of dias) {
      if (d.id && originales.get(d.id) !== d.fecha) {
        await moverDiaAgenda(evento.id, d.id, d.fecha);
      }
    }
    for (const d of dias) {
      if (!d.id) await agregarDiaAgenda(evento.id, d.fecha);
    }
  }

  const guardar = useMutation({
    mutationFn: async () => {
      await actualizarAgendaEvento(evento.id, {
        tipo,
        titulo: titulo.trim(),
        teamId: teamId || null,
        projectId: projectId || null,
        ticketId: tipo === "SOPORTE" && ticketId ? ticketId : null,
        notas,
      });
      await sincronizarDias();
    },
    onSuccess: () => {
      toast.success("Cambios guardados");
      invalidar();
      onClose();
    },
    onError: (err) => toast.error(mensajeError(err, "No se pudieron guardar los cambios")),
  });

  const alternarCompletado = useMutation({
    mutationFn: () => actualizarAgendaEvento(evento.id, { completado: !completado }),
    onSuccess: () => {
      toast.success(completado ? "Marcado como pendiente" : "Marcado como hecho");
      invalidar();
      onClose();
    },
    onError: (err) => toast.error(mensajeError(err, "No se pudo cambiar el estado")),
  });

  const eliminar = useMutation({
    mutationFn: () => eliminarAgendaEvento(evento.id),
    onSuccess: () => {
      toast.success("Eliminado del calendario");
      invalidar();
      onClose();
    },
    onError: (err) => toast.error(mensajeError(err, "No se pudo eliminar")),
  });

  function cambiarDia(i: number, valor: string) {
    setDias((d) => d.map((x, idx) => (idx === i ? { ...x, fecha: valor } : x)));
  }
  function sumarDia() {
    const ultimo = dias[dias.length - 1]?.fecha ?? new Date().toISOString().slice(0, 10);
    const d = new Date(`${ultimo}T12:00:00`);
    d.setDate(d.getDate() + 7);
    setDias((prev) => [...prev, { id: null, fecha: d.toISOString().slice(0, 10) }]);
  }
  function quitarDia(i: number) {
    setDias((d) => (d.length <= 1 ? d : d.filter((_, idx) => idx !== i)));
  }

  const meta = TIPO_CALENDARIO_META[tipo];
  const inputCls =
    "w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm disabled:opacity-60";
  const esOtro = tipo === "OTRO";
  const sinDiasValidos = dias.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d.fecha));
  const faltaDescripcion = esOtro && titulo.trim().length === 0;
  const ocupado = guardar.isPending || eliminar.isPending || alternarCompletado.isPending;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
        <div className="mb-1 flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: meta.color }}
            aria-hidden
          />
          <h2 className="font-display text-base font-bold text-[var(--color-text-primary)]">
            {meta.corto}
          </h2>
          {completado && (
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
              Hecho
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="ml-auto rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mb-4 text-[10px] text-[var(--color-text-muted)]">
          {/* `createdAt` es un timestamp real, no una fecha a medianoche UTC:
              acá sí corresponde pasarlo por Date para verlo en hora local. */}
          Agendado por {evento.createdByName ?? "alguien"} el{" "}
          {new Date(evento.createdAt).toLocaleDateString("es-UY")}
        </p>

        {!puedeEditar && (
          <p className="mb-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-2 text-[11px] text-[var(--color-text-muted)]">
            No tenés permiso para modificar la agenda. Podés ver el detalle.
          </p>
        )}

        <fieldset disabled={!puedeEditar || ocupado} className="space-y-3">
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
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed"
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
                <div key={d.id ?? `nuevo-${i}`} className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={d.fecha}
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
              {/* El equipo del evento puede estar dado de baja y no venir en la
                  lista: se agrega para no perderlo al guardar otra cosa. */}
              {evento.teamId && !equipos.some((eq) => eq.id === evento.teamId) && (
                <option value={evento.teamId}>{evento.teamName} (ex equipo)</option>
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Cliente / proyecto
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
              {esOtro ? "¿De qué se trata?" : "Título"}
              {esOtro && <span className="ml-1 text-[var(--color-danger,#E0564A)]">*</span>}
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={inputCls}
              placeholder={esOtro ? "Ej: Entrega de materiales en obra" : undefined}
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
        </fieldset>

        {puedeEditar && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => alternarCompletado.mutate()}
            className="mt-4 inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            <Check size={13} />
            {completado ? "Volver a marcar pendiente" : "Marcar como hecho"}
          </button>
        )}

        <div className="mt-5 flex items-center gap-2">
          {puedeEliminar &&
            (confirmandoBaja ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => eliminar.mutate()}
                  className="rounded bg-red-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {eliminar.isPending ? "Eliminando…" : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoBaja(false)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setConfirmandoBaja(true)}
                className="inline-flex items-center gap-1.5 rounded border border-[var(--color-border)] px-2.5 py-2 text-xs text-[var(--color-text-muted)] hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 size={13} /> Eliminar
              </button>
            ))}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
            >
              {puedeEditar ? "Cancelar" : "Cerrar"}
            </button>
            {puedeEditar && (
              <Button
                disabled={sinDiasValidos || faltaDescripcion || ocupado}
                onClick={() => guardar.mutate()}
              >
                {guardar.isPending ? "Guardando…" : "Guardar"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

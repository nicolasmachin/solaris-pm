import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";

import {
  addComentario,
  cerrarTicket,
  derivarTicket,
  enProgresoTicket,
  getTicket,
  resolverTicket,
  type AreaDerivable,
} from "../../api/tickets.api";
import { Button } from "../../components/ui/Button";
import { LargeModal } from "../../components/ui/LargeModal";
import { Spinner } from "../../components/ui/Spinner";
import { EstadoBadge, PrioridadBadge, fmtFecha } from "./ticketUi";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function TicketDetail({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: t, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: () => getTicket(ticketId),
  });

  const [comentario, setComentario] = useState("");
  const [esInterno, setEsInterno] = useState(false);
  const [area, setArea] = useState<AreaDerivable>("INGENIERIA");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  const onErr = (err: unknown) => toast.error(getApiErr(err) ?? "No se pudo completar la acción");

  const comentar = useMutation({
    mutationFn: () => addComentario(ticketId, comentario.trim(), esInterno),
    onSuccess: () => { setComentario(""); setEsInterno(false); invalidate(); },
    onError: onErr,
  });
  const derivar = useMutation({ mutationFn: () => derivarTicket(ticketId, area), onSuccess: () => { toast.success("Derivado"); invalidate(); }, onError: onErr });
  const enProgreso = useMutation({ mutationFn: () => enProgresoTicket(ticketId), onSuccess: () => invalidate(), onError: onErr });
  const resolver = useMutation({ mutationFn: () => resolverTicket(ticketId), onSuccess: () => { toast.success("Resuelto"); invalidate(); }, onError: onErr });
  const cerrar = useMutation({ mutationFn: () => cerrarTicket(ticketId), onSuccess: () => { toast.success("Cerrado"); invalidate(); }, onError: onErr });

  const acting = derivar.isPending || enProgreso.isPending || resolver.isPending || cerrar.isPending;
  const cerrado = t?.estado === "CERRADO";
  const resuelto = t?.estado === "RESUELTO";

  return (
    <LargeModal open onClose={onClose} size="wide" ariaLabel="Detalle del ticket">
      {isLoading || !t ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-5 p-5">
          {/* Header */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <EstadoBadge estado={t.estado} />
              <PrioridadBadge prioridad={t.prioridad} />
              {t.origenCliente && (
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">Abierto por el cliente</span>
              )}
              {t.areaDerivada && (
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[11px] text-[var(--color-text-muted)]">Área: {t.areaDerivada}</span>
              )}
            </div>
            <h1 className="font-display text-xl font-bold text-[var(--color-text-primary)]">{t.titulo}</h1>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              Abierto por {t.creadoPorNombre ?? "—"} · {fmtFecha(t.createdAt)} ·{" "}
              <Link to={`/projects/${t.projectId}`} className="text-[var(--color-accent)] hover:underline" onClick={onClose}>
                Ver proyecto →
              </Link>
            </p>
          </div>

          <p className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-sm text-[var(--color-text-primary)]">
            {t.descripcion}
          </p>

          {/* Acciones */}
          {!cerrado && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <select value={area} onChange={(e) => setArea(e.target.value as AreaDerivable)} className={`${inputClass} w-auto`}>
                <option value="INGENIERIA">Ingeniería</option>
                <option value="OPERACIONES">Operaciones</option>
              </select>
              <Button variant="ghost" size="sm" loading={derivar.isPending} disabled={acting} onClick={() => derivar.mutate()}>Derivar</Button>
              {t.estado !== "EN_PROGRESO" && (
                <Button variant="ghost" size="sm" loading={enProgreso.isPending} disabled={acting} onClick={() => enProgreso.mutate()}>En progreso</Button>
              )}
              {!resuelto && (
                <Button size="sm" loading={resolver.isPending} disabled={acting} onClick={() => resolver.mutate()}>Resolver</Button>
              )}
              {resuelto && (
                <Button size="sm" loading={cerrar.isPending} disabled={acting} onClick={() => cerrar.mutate()}>Cerrar</Button>
              )}
            </div>
          )}

          {/* Comentarios */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Conversación ({t.comentarios.length})</h3>
            {t.comentarios.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Sin comentarios todavía.</p>
            ) : (
              <div className="space-y-2">
                {t.comentarios.map((c) => (
                  <div key={c.id} className={`rounded-lg border p-3 ${c.esInterno ? "border-amber-500/30 bg-amber-500/5" : "border-[var(--color-border)] bg-[var(--color-bg-card)]"}`}>
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                      <span className="font-medium text-[var(--color-text-secondary)]">{c.autorNombre ?? "—"}</span>
                      <span>{fmtFecha(c.createdAt)}</span>
                      {c.esInterno && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-300">interno</span>}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{c.contenido}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Nuevo comentario */}
            {!cerrado && (
              <div className="space-y-2">
                <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={4000} placeholder="Escribí un comentario…" className={`${inputClass} resize-none`} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                    <input type="checkbox" checked={esInterno} onChange={(e) => setEsInterno(e.target.checked)} />
                    Nota interna (el cliente no la ve)
                  </label>
                  <Button size="sm" loading={comentar.isPending} disabled={comentar.isPending || comentario.trim().length === 0} onClick={() => comentar.mutate()}>
                    Comentar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </LargeModal>
  );
}

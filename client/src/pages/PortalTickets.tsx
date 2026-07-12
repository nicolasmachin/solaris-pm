import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import { createPortalTicket, getPortalProjects, getPortalTickets } from "../api/portal.api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { EstadoBadge, fmtFecha } from "../modules/tickets/ticketUi";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function PortalTickets() {
  const qc = useQueryClient();
  const { data: tickets, isLoading } = useQuery({ queryKey: ["portal-tickets"], queryFn: getPortalTickets });
  const { data: projects = [] } = useQuery({ queryKey: ["portal-projects"], queryFn: getPortalProjects });

  const [showForm, setShowForm] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const effectiveProjectId = projectId || (projects.length === 1 ? projects[0].id : "");

  const crear = useMutation({
    mutationFn: () => createPortalTicket({ projectId: effectiveProjectId, titulo: titulo.trim(), descripcion: descripcion.trim() }),
    onSuccess: () => {
      toast.success("Ticket enviado");
      qc.invalidateQueries({ queryKey: ["portal-tickets"] });
      setTitulo("");
      setDescripcion("");
      setProjectId("");
      setShowForm(false);
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo enviar el ticket"),
  });

  const canSubmit = effectiveProjectId && titulo.trim() && descripcion.trim() && !crear.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Mis tickets</h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">Consultas y reclamos sobre tu instalación.</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus size={14} className="mr-1" /> Nuevo ticket
          </Button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          {projects.length > 1 && (
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Proyecto</label>
              <select value={effectiveProjectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
                <option value="">Elegí un proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.clientName} · {p.code}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Asunto</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="¿Sobre qué es tu consulta?" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Detalle</label>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} maxLength={4000} placeholder="Contanos qué pasa…" className={`${inputClass} resize-none`} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" loading={crear.isPending} disabled={!canSubmit} onClick={() => crear.mutate()}>Enviar</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : !tickets || tickets.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No tenés tickets todavía.</p>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <Link
              key={t.id}
              to={`/portal/tickets/${t.id}`}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 hover:bg-[var(--color-bg-card-hover)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--color-text-primary)]">{t.titulo}</p>
                <p className="truncate text-[12px] text-[var(--color-text-muted)]">{t.projectName} · {fmtFecha(t.createdAt)}</p>
              </div>
              <EstadoBadge estado={t.estado} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

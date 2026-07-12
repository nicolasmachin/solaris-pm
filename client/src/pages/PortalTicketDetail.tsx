import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import { comentarPortalTicket, getPortalTicket } from "../api/portal.api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { EstadoBadge, fmtFecha } from "../modules/tickets/ticketUi";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function PortalTicketDetail() {
  const { id = "" } = useParams();
  const qc = useQueryClient();
  const { data: t, isLoading } = useQuery({ queryKey: ["portal-ticket", id], queryFn: () => getPortalTicket(id) });
  const [comentario, setComentario] = useState("");

  const comentar = useMutation({
    mutationFn: () => comentarPortalTicket(id, comentario.trim()),
    onSuccess: () => {
      setComentario("");
      qc.invalidateQueries({ queryKey: ["portal-ticket", id] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo enviar el comentario"),
  });

  const cerrado = t?.estado === "CERRADO";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/portal/tickets" className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline">
        <ChevronLeft size={16} /> Mis tickets
      </Link>

      {isLoading || !t ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : (
        <>
          <div>
            <div className="mb-2"><EstadoBadge estado={t.estado} /></div>
            <h1 className="font-display text-xl font-bold text-[var(--color-text-primary)]">{t.titulo}</h1>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">Abierto el {fmtFecha(t.createdAt)}</p>
          </div>

          <p className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-sm text-[var(--color-text-primary)]">
            {t.descripcion}
          </p>

          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Conversación</h3>
            {t.comentarios.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">Todavía no hay respuestas.</p>
            ) : (
              t.comentarios.map((c) => (
                <div key={c.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
                  <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                    <span className="font-medium text-[var(--color-text-secondary)]">{c.autorNombre ?? "Voltia"}</span>
                    <span>{fmtFecha(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{c.contenido}</p>
                </div>
              ))
            )}

            {!cerrado && (
              <div className="space-y-2">
                <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} maxLength={4000} placeholder="Escribí un mensaje…" className={`${inputClass} resize-none`} />
                <div className="flex justify-end">
                  <Button size="sm" loading={comentar.isPending} disabled={comentar.isPending || comentario.trim().length === 0} onClick={() => comentar.mutate()}>
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { getPortalSurveys, responderPortalSurvey, type PortalSurveyRow } from "../api/portal.api";
import { tipoLabelConEdicion } from "../api/encuestas.api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { EstadoBadge, NotaStars, StarRatingInput, TipoBadge } from "../modules/encuestas/encuestaUi";
import { fmtFecha } from "../modules/tickets/ticketUi";

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const labelClass = "mb-1.5 block text-[12px] font-medium text-[var(--color-text-primary)]";

function ResponderForm({ survey }: { survey: PortalSurveyRow }) {
  const qc = useQueryClient();
  const [nota, setNota] = useState(0);
  const [nota2, setNota2] = useState(0);
  const [nota3, setNota3] = useState(0);
  const [comentario, setComentario] = useState("");
  const p = survey.preguntas;

  const responder = useMutation({
    mutationFn: () =>
      responderPortalSurvey(survey.id, {
        nota,
        // Solo la primera es obligatoria; las otras van si el cliente las contestó.
        nota2: nota2 > 0 ? nota2 : null,
        nota3: nota3 > 0 ? nota3 : null,
        comentario: comentario.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("¡Gracias por tu opinión!");
      qc.invalidateQueries({ queryKey: ["portal-surveys"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo enviar la encuesta"),
  });

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
      <div>
        <label className={labelClass}>{p.pregunta1}</label>
        <StarRatingInput value={nota} onChange={setNota} />
      </div>
      <div>
        <label className={labelClass}>
          {p.pregunta2} <span className="text-[var(--color-text-muted)]">(opcional)</span>
        </label>
        <StarRatingInput value={nota2} onChange={setNota2} />
      </div>
      <div>
        <label className={labelClass}>
          {p.pregunta3} <span className="text-[var(--color-text-muted)]">(opcional)</span>
        </label>
        <StarRatingInput value={nota3} onChange={setNota3} />
      </div>
      <div>
        <label className="mb-1 block text-[12px] font-medium text-[var(--color-text-primary)]">
          {p.comentario} <span className="text-[var(--color-text-muted)]">(opcional)</span>
        </label>
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Contanos qué te pareció…"
          className={`${inputClass} resize-none`}
        />
      </div>
      <div className="flex justify-end">
        <Button size="sm" loading={responder.isPending} disabled={nota < 1 || responder.isPending} onClick={() => responder.mutate()}>
          Enviar
        </Button>
      </div>
    </div>
  );
}

export function PortalSurveys() {
  const { data: surveys, isLoading } = useQuery({ queryKey: ["portal-surveys"], queryFn: getPortalSurveys });

  const pendientes = (surveys ?? []).filter((s) => s.estado === "PENDIENTE");
  const respondidas = (surveys ?? []).filter((s) => s.estado === "RESPONDIDA");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Encuestas</h1>
        <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">Tu opinión nos ayuda a mejorar tu experiencia solar.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : !surveys || surveys.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No tenés encuestas por ahora.</p>
      ) : (
        <>
          {pendientes.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Para responder</h2>
              {pendientes.map((s) => (
                <div key={s.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
                  <div className="flex items-center gap-2">
                    <TipoBadge tipo={s.tipo} edicion={s.edicion} />
                    <span className="truncate text-[12px] text-[var(--color-text-muted)]">{s.projectName}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-[var(--color-text-primary)]">{s.preguntas.intro}</p>
                  <ResponderForm survey={s} />
                </div>
              ))}
            </section>
          )}

          {respondidas.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Respondidas</h2>
              {respondidas.map((s) => (
                <div key={s.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TipoBadge tipo={s.tipo} edicion={s.edicion} />
                      <span className="truncate text-[12px] text-[var(--color-text-muted)]">
                        {s.projectName} · {s.respondidaEn ? fmtFecha(s.respondidaEn) : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <NotaStars nota={s.nota} />
                      <EstadoBadge estado={s.estado} />
                    </div>
                  </div>
                  {s.comentario && (
                    <p className="mt-2 text-[13px] italic text-[var(--color-text-muted)]">“{s.comentario}”</p>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

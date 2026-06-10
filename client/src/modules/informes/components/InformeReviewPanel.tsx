import { useState } from "react";
import { Check, RotateCcw, Users } from "lucide-react";

import type { InformeDetail } from "../../../api/informes.api";
import { useInformeMutations } from "../../../hooks/useInformes";
import { RespuestaBadge } from "./EstadoBadge";

interface Props {
  informe: InformeDetail;
  currentUserId: string;
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function InformeReviewPanel({ informe, currentUserId }: Props) {
  const { responder } = useInformeMutations(informe.id);
  const [comentario, setComentario] = useState("");
  const [modo, setModo] = useState<"APROBADO" | "DEVUELTO" | null>(null);

  const miEntrada = informe.destinatarios.find((d) => d.usuario.id === currentUserId);

  function enviarRespuesta(respuesta: "APROBADO" | "DEVUELTO") {
    if (respuesta === "DEVUELTO" && !comentario.trim()) {
      setModo("DEVUELTO");
      return;
    }
    responder.mutate(
      { id: informe.id, respuesta, comentario: comentario.trim() || undefined },
      { onSuccess: () => { setComentario(""); setModo(null); } },
    );
  }

  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-4 py-3">
        <Users className="h-4 w-4 text-[var(--color-text-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Revisión ({informe.destinatarios.length})
        </h3>
      </div>

      {informe.puedeResponder && (
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">Tu respuesta a este informe:</p>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            placeholder={
              modo === "DEVUELTO" ? "Comentario obligatorio para devolver…" : "Comentario (opcional al aprobar)…"
            }
            className={`mb-2 w-full resize-y rounded-lg border bg-[var(--color-bg-app)] px-2.5 py-2 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] ${
              modo === "DEVUELTO" && !comentario.trim() ? "border-rose-500/60" : "border-[var(--color-border)]"
            }`}
          />
          <div className="flex gap-2">
            <button
              onClick={() => enviarRespuesta("DEVUELTO")}
              disabled={responder.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 px-2 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Devolver
            </button>
            <button
              onClick={() => enviarRespuesta("APROBADO")}
              disabled={responder.isPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-2 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Aprobar
            </button>
          </div>
          {modo === "DEVUELTO" && !comentario.trim() && (
            <p className="mt-1 text-[10px] text-rose-500">Escribí un comentario para poder devolver.</p>
          )}
        </div>
      )}

      {miEntrada && !informe.puedeResponder && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/40 px-4 py-2.5">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Ya respondiste este informe. Tu respuesta es definitiva.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <ul className="space-y-3">
          {informe.destinatarios.map((d) => (
            <li key={d.usuario.id} className="border-b border-[var(--color-border)]/60 pb-3 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-[var(--color-text-primary)]">
                  {d.usuario.nombre}
                  {d.usuario.id === currentUserId && (
                    <span className="ml-1 text-[10px] text-[var(--color-text-muted)]">(vos)</span>
                  )}
                </span>
                <RespuestaBadge respuesta={d.respuesta} />
              </div>
              {d.respondidoAt && (
                <span className="text-[10px] text-[var(--color-text-muted)]">{fechaHora(d.respondidoAt)}</span>
              )}
              {d.comentario && (
                <p className="mt-1 rounded-md bg-[var(--color-bg-app)]/60 px-2 py-1.5 text-[11px] italic text-[var(--color-text-secondary)]">
                  “{d.comentario}”
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

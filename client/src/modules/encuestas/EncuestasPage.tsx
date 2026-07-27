import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ExternalLink, User, X } from "lucide-react";

import { type EncuestaRow, listEncuestas, type SurveyEstado, type SurveyTipo } from "../../api/encuestas.api";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import { fmtFecha } from "../tickets/ticketUi";
import { EstadoBadge, NotaStars, TipoBadge } from "./encuestaUi";

type EstadoFiltro = SurveyEstado | "TODOS";
type TipoFiltro = SurveyTipo | "TODOS";

const ESTADOS: Array<{ value: EstadoFiltro; label: string }> = [
  { value: "TODOS", label: "Todas" },
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "RESPONDIDA", label: "Respondidas" },
];

const TIPOS: Array<{ value: TipoFiltro; label: string }> = [
  { value: "TODOS", label: "Todos los tipos" },
  { value: "OBRA", label: "Instalación" },
  { value: "HABILITACION", label: "Habilitación" },
  { value: "ANIVERSARIO", label: "Aniversario" },
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

export function EncuestasPage() {
  const [estado, setEstado] = useState<EstadoFiltro>("TODOS");
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [notaBaja, setNotaBaja] = useState(false);
  const [detalle, setDetalle] = useState<EncuestaRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["encuestas", estado, tipo, notaBaja],
    queryFn: () =>
      listEncuestas({
        estado: estado === "TODOS" ? undefined : estado,
        tipo: tipo === "TODOS" ? undefined : tipo,
        notaBaja: notaBaja || undefined,
      }),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        Respuestas de los Generadores. Las notas bajas (≤3) generan un aviso a Experiencia Solar.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {ESTADOS.map((e) => (
          <Pill key={e.value} active={estado === e.value} onClick={() => setEstado(e.value)}>{e.label}</Pill>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        {TIPOS.map((t) => (
          <Pill key={t.value} active={tipo === t.value} onClick={() => setTipo(t.value)}>{t.label}</Pill>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--color-border)]" />
        <Pill active={notaBaja} onClick={() => setNotaBaja((v) => !v)}>Solo nota baja</Pill>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size={24} /></div>
      ) : !data || data.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No hay encuestas con estos filtros.</p>
      ) : (
        <div className="space-y-2">
          {data.map((s) => (
            <button
              key={s.id}
              onClick={() => setDetalle(s)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-[var(--color-bg-card-hover)] ${
                s.notaBaja
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <TipoBadge tipo={s.tipo} edicion={s.edicion} />
                  <span className="truncate font-medium text-[var(--color-text-primary)]">{s.projectName}</span>
                  <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">{s.projectCode}</span>
                </div>
                {s.comentario && (
                  <p className="mt-1.5 line-clamp-2 text-[13px] italic text-[var(--color-text-muted)]">“{s.comentario}”</p>
                )}
                <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                  {s.estado === "RESPONDIDA"
                    ? `Respondida ${s.respondidaEn ? fmtFecha(s.respondidaEn) : ""}${s.respondidaPorNombre ? ` · ${s.respondidaPorNombre}` : ""}`
                    : `Generada ${fmtFecha(s.createdAt)}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <EstadoBadge estado={s.estado} />
                {s.estado === "RESPONDIDA" && <NotaStars nota={s.nota} />}
              </div>
            </button>
          ))}
        </div>
      )}

      {detalle && <EncuestaDetalleModal encuesta={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

// ─── Modal de detalle: respuesta completa de la encuesta ─────────────────────
// Compacto y centrado (la respuesta es nota + comentario). El botón "Ver ficha
// del cliente" queda como salida opcional a /clientes/:projectId.
function EncuestaDetalleModal({ encuesta: s, onClose }: { encuesta: EncuestaRow; onClose: () => void }) {
  const navigate = useNavigate();
  useLockBodyScroll(true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Respuesta de la encuesta"
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <TipoBadge tipo={s.tipo} edicion={s.edicion} />
              <EstadoBadge estado={s.estado} />
            </div>
            <p className="truncate font-medium text-[var(--color-text-primary)]">{s.projectName}</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{s.projectCode}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {s.estado === "RESPONDIDA" ? (
            <>
              <div className="flex items-center gap-3">
                <NotaStars nota={s.nota} />
                {s.nota != null && (
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{s.nota}/5</span>
                )}
              </div>

              {s.notaBaja && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 text-[12px] text-red-300">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>Nota baja: generó un aviso a Experiencia Solar para seguimiento.</span>
                </div>
              )}

              <div>
                <p className="mb-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Comentario
                </p>
                {s.comentario ? (
                  <p className="whitespace-pre-wrap text-[13px] italic text-[var(--color-text-secondary)]">
                    “{s.comentario}”
                  </p>
                ) : (
                  <p className="text-[13px] text-[var(--color-text-muted)]">Sin comentario.</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-text-muted)]">
                <span>Respondida {s.respondidaEn ? fmtFecha(s.respondidaEn) : "—"}</span>
                {s.respondidaPorNombre && (
                  <span className="inline-flex items-center gap-1">
                    <User size={12} /> {s.respondidaPorNombre}
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="py-2 text-[13px] text-[var(--color-text-muted)]">
              Esta encuesta todavía no fue respondida por el Generador. Se generó {fmtFecha(s.createdAt)}.
            </p>
          )}

          <div className="flex justify-end border-t border-[var(--color-border)] pt-3">
            <Button size="sm" variant="secondary" onClick={() => navigate(`/clientes/${s.projectId}`)}>
              <ExternalLink size={14} className="mr-1.5" />
              Ver ficha del cliente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

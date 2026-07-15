import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { listEncuestas, type SurveyEstado, type SurveyTipo } from "../../api/encuestas.api";
import { Spinner } from "../../components/ui/Spinner";
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
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoFiltro>("TODOS");
  const [tipo, setTipo] = useState<TipoFiltro>("TODOS");
  const [notaBaja, setNotaBaja] = useState(false);

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
              onClick={() => navigate(`/clientes/${s.projectId}`)}
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
    </div>
  );
}

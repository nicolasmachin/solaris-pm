import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getAgendaEventos, TIPO_CALENDARIO_META } from "../../api/agenda.api";

interface Props {
  projectId: string;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

/** "22 set" desde la string, sin pasar por Date (evita el corrimiento de zona). */
function fmtDia(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)} ${MESES[Number(m) - 1] ?? m}`;
}

/**
 * Mantenimientos, soportes y visitas técnicas agendados para este proyecto.
 *
 * Las obras no van acá: tienen su propia fila de instalación en la ficha.
 */
export function AgendaDelProyecto({ projectId }: Props) {
  const navigate = useNavigate();
  const { data: eventos = [], isLoading } = useQuery({
    queryKey: ["agenda-eventos", "proyecto", projectId],
    queryFn: () => getAgendaEventos({ projectId }),
  });

  if (isLoading || eventos.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Agendado para esta obra
        </p>
        <button
          type="button"
          onClick={() => navigate("/calendario")}
          className="text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Ver en el calendario →
        </button>
      </div>

      <div className="space-y-1.5">
        {eventos.map((e) => {
          const meta = TIPO_CALENDARIO_META[e.tipo];
          const hecho = e.completadoEn !== null;
          return (
            <div
              key={e.id}
              className="flex items-center gap-2 rounded border border-[var(--color-border)] px-2.5 py-1.5"
              style={{ borderLeft: `3px solid ${meta.color}` }}
            >
              <span aria-hidden>{meta.icono}</span>
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-xs ${
                    hecho
                      ? "text-[var(--color-text-muted)] line-through"
                      : "text-[var(--color-text-primary)]"
                  }`}
                >
                  {meta.corto}
                  {e.titulo && e.titulo !== e.clientName ? ` · ${e.titulo}` : ""}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {e.dias.map((d) => fmtDia(d.fecha)).join(" · ")}
                  {e.teamName ? ` — ${e.teamName}` : ""}
                </p>
              </div>
              {hecho && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                  Hecho
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

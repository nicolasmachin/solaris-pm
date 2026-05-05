import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar, FileText, User } from "lucide-react";
import { getVisitas, type VisitListItem, type VisitType } from "../../../api/visitas.api";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  INICIAL: "Inicial",
  REVISION: "Revisión",
  COMPLEMENTARIA: "Complementaria",
};

/**
 * Panel read-only de visitas técnicas en el workspace de Ingeniería.
 *
 * Muestra las visitas que el operario cargó desde el StageDrawer del proyecto.
 * El proyectista puede entrar a una visita para revisar los inputs y los
 * informes generados, y desde ahí integrar las versiones (botón en la página
 * de la visita, gateado por INGENIERIA.EDIT).
 *
 * No permite crear ni borrar — esas acciones viven en el StageDrawer del
 * proyecto y requieren OPERACIONES.EDIT/DELETE.
 */
export function VisitasReadOnlyPanel({ projectId }: { projectId: string }) {
  const navigate = useNavigate();

  const visitsQ = useQuery({
    queryKey: ["technical-visits", projectId],
    queryFn: () => getVisitas(projectId),
  });

  const visits = visitsQ.data ?? [];

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        Listado de visitas técnicas que el operario cargó desde el módulo Proyectos. Como
        proyectista podés revisar los inputs e informes, y consolidar las versiones en un
        super-informe.
      </p>

      {visitsQ.isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : visits.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
          Sin visitas registradas todavía. El operario carga visitas desde la etapa Ingeniería del
          módulo Proyectos.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visits.map((v) => (
            <VisitRow
              key={v.id}
              visit={v}
              onOpen={() => navigate(`/projects/${projectId}/visita/${v.id}`)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function VisitRow({ visit, onOpen }: { visit: VisitListItem; onOpen: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
      <Calendar className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-primary)]">
          <span className="font-mono">{VISIT_TYPE_LABEL[visit.visitType]}</span>
          <span className="text-[var(--color-text-muted)]"> · {fmtDate(visit.visitDate)}</span>
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5 flex items-center gap-2">
          <User className="w-3 h-3" /> {visit.createdBy.name}
          <span>·</span>
          <span>
            {visit.inputsCount} input{visit.inputsCount === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <FileText className="w-3 h-3" />
          <span>
            {visit.reportsCount} informe{visit.reportsCount === 1 ? "" : "s"}
          </span>
        </p>
      </div>
      <button
        onClick={onOpen}
        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:bg-[var(--color-bg-card-hover)]"
      >
        Abrir <ArrowRight className="w-3 h-3" />
      </button>
    </li>
  );
}

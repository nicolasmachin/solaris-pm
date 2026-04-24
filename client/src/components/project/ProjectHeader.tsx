import { useNavigate } from "react-router-dom";
import { FileCheck, Mail, MapPin, Phone } from "lucide-react";
import type { Project } from "../../types/api.types";
import { UTE_STAGE_LABEL, UTE_STATUS_LABEL } from "../../api/uteProcess.api";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE:      { bg: "var(--color-state-active-bg)", text: "var(--color-state-active-text)", label: "EN EJECUCIÓN" },
  IN_PROGRESS: { bg: "var(--color-state-active-bg)", text: "var(--color-state-active-text)", label: "EN EJECUCIÓN" },
  PROSPECT:    { bg: "var(--color-warning-bg)", text: "var(--color-warning-text)", label: "EN COTIZACIÓN" },
  PLANNING:    { bg: "var(--color-info-bg)", text: "var(--color-info-text)", label: "EN PLANIFICACIÓN" },
  COMPLETED:   { bg: "var(--color-state-done-bg)", text: "var(--color-state-done-text)", label: "COMPLETADO" },
  ON_HOLD:     { bg: "var(--color-warning-bg)", text: "var(--color-warning-text)", label: "PAUSADO" },
  CANCELLED:   { bg: "var(--color-danger-bg)", text: "var(--color-danger-text)", label: "CANCELADO" },
  ARCHIVED:    { bg: "var(--color-border)", text: "var(--color-text-muted)", label: "ARCHIVADO" },
};

interface ProjectHeaderProps {
  project: Project;
  onEdit?: () => void;
}

export function ProjectHeader({ project, onEdit }: ProjectHeaderProps) {
  const navigate = useNavigate();
  const style = STATUS_STYLES[project.status] ?? STATUS_STYLES.ACTIVE;
  const hasInstallation = !!project.installationSchedule;

  function goToCalendar() {
    if (hasInstallation) {
      navigate(`/calendario?projectId=${project.id}`);
    } else {
      navigate(`/calendario?newForProject=${project.id}`);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors mb-2 flex items-center gap-1"
        >
          ← Proyectos
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display text-xl font-bold text-[var(--color-text-primary)] leading-tight">
            {project.clientName}
          </h1>
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 rounded hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              title="Editar proyecto"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button
            onClick={goToCalendar}
            className="ml-1 inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
            title={hasInstallation ? "Ver en el calendario" : "Agendar instalación en el calendario"}
          >
            <span>📅</span>
            <span>{hasInstallation ? "Ver en calendario" : "Agendar instalación"}</span>
          </button>
        </div>
        <p className="font-mono text-[10px] text-[var(--color-text-muted)] mt-1">
          {project.code} · {project.capacityKwp} kWp · {project.locationCity},{" "}
          {project.locationProvince}
        </p>
        {(project.notificationEmail || project.notificationPhone || project.clientAddress) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[12px] text-[var(--color-text-secondary)]">
            {project.notificationEmail ? (
              <a
                href={`mailto:${project.notificationEmail}`}
                className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Mail size={14} className="shrink-0" />
                <span>{project.notificationEmail}</span>
              </a>
            ) : null}
            {project.notificationPhone ? (
              <a
                href={`tel:${project.notificationPhone}`}
                className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Phone size={14} className="shrink-0" />
                <span>{project.notificationPhone}</span>
              </a>
            ) : null}
            {project.clientAddress ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} className="shrink-0" />
                <span>{project.clientAddress}</span>
              </span>
            ) : null}
          </div>
        )}
        {project.firstDateScheduledAt && (
          <p className="font-mono text-[10px] text-[var(--color-text-muted)] mt-0.5">
            Fecha tentativa de obra:{" "}
            {new Date(project.firstDateScheduledAt).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </p>
        )}
        {project.uteProcess ? (
          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
            <FileCheck size={12} className="shrink-0" />
            <span>
              <span className="text-[var(--color-text-muted)]">UTE:</span>{" "}
              {UTE_STAGE_LABEL[project.uteProcess.currentStage]} ·{" "}
              {UTE_STATUS_LABEL[project.uteProcess.currentStatus]}
            </span>
            <button
              type="button"
              onClick={() => navigate(`/tramites-ute?highlight=${project.uteProcess!.id}`)}
              className="text-[var(--color-accent)] hover:underline"
            >
              Ver →
            </button>
          </div>
        ) : null}
      </div>

      <span
        className="shrink-0 mt-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
        style={{ background: style.bg, color: style.text }}
      >
        {style.label}
      </span>
    </div>
  );
}

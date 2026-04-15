import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { getProject, patchProject } from "../api/projects.api";
import type { Project, Stage } from "../types/api.types";

import { ProjectHeader } from "../components/project/ProjectHeader";
import { KpiCards } from "../components/project/KpiCards";
import { Pipeline } from "../components/project/Pipeline";
import { StageDrawer } from "../components/project/StageDrawer";
import { TasksPanel } from "../components/project/TasksPanel";
import { ProgressPanel } from "../components/project/ProgressPanel";
import { TaskModal } from "../components/project/TaskModal";
import { SolarSystemModal } from "../components/project/SolarSystemModal";
import { AuditHistory } from "../components/project/AuditHistory";
import { ProjectTimelineIndicators } from "../components/project/ProjectTimelineIndicators";
import { ProjectGantt } from "../components/project/ProjectGantt";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { CommentThread } from "../components/comments/CommentThread";
import { getProjectGantt } from "../api/metrics.api";
import { usePermission } from "../hooks/usePermission";
import {
  formatSolarSystemPanels,
  formatSolarSystemPrimary,
  getPhaseTypeLabel,
  getPhaseTypeShortLabel,
} from "../components/project/SolarSystemFields";

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonBar({ w = "w-full", h = "h-3" }: { w?: string; h?: string }) {
  return <div className={`skeleton rounded ${w} ${h}`} />;
}

function HeaderSkeleton() {
  return (
    <div className="mb-5 space-y-2">
      <SkeletonBar w="w-48" h="h-3" />
      <SkeletonBar w="w-72" h="h-5" />
      <SkeletonBar w="w-56" h="h-3" />
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-3 space-y-2"
        >
          <SkeletonBar w="w-24" h="h-2" />
          <SkeletonBar w="w-16" h="h-6" />
          <SkeletonBar w="w-32" h="h-2" />
        </div>
      ))}
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-3.5 mb-4">
      <SkeletonBar w="w-32" h="h-2" />
      <div className="flex gap-1.5 mt-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex-1 space-y-1.5">
            <SkeletonBar h="h-2" />
            <div className="skeleton rounded-md h-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Edit Project Modal ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--color-bg-app)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  padding: "7px 10px",
  color: "var(--color-text-primary)",
  fontSize: 13,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  color: "var(--color-text-muted)",
  marginBottom: 4,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

function EditProjectModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientName, setClientName] = useState(project.clientName);
  const [capacityKwp, setCapacityKwp] = useState(String(project.capacityKwp));
  const [locationCity, setLocationCity] = useState(project.locationCity);
  const [locationProvince, setLocationProvince] = useState(project.locationProvince);
  const [plannedEndDate, setPlannedEndDate] = useState(project.plannedEndDate?.slice(0, 10) ?? "");
  const [budgetUsd, setBudgetUsd] = useState(String(project.budgetUsd));
  const [notificationEmail, setNotificationEmail] = useState(project.notificationEmail ?? "");
  const [notificationPhone, setNotificationPhone] = useState(project.notificationPhone ?? "");
  const [firstDateScheduledAt, setFirstDateScheduledAt] = useState(
    project.firstDateScheduledAt ? project.firstDateScheduledAt.slice(0, 10) : ""
  );

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      patchProject(project.id, {
        clientName,
        capacityKwp: parseFloat(capacityKwp),
        locationCity,
        locationProvince,
        plannedEndDate: plannedEndDate || null,
        budgetUsd: parseFloat(budgetUsd),
        notificationEmail: notificationEmail || undefined,
        notificationPhone: notificationPhone || undefined,
        firstDateScheduledAt: firstDateScheduledAt
          ? new Date(firstDateScheduledAt).toISOString()
          : null,
      }),
    onSuccess: () => {
      toast.success("Proyecto actualizado");
      onSaved();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Error al guardar");
    },
  });

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 10, padding: 24, width: 480, maxHeight: "90vh", overflowY: "auto" }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--color-text-muted)", marginBottom: 20 }}>
          Editar proyecto
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Cliente *</label>
            <input style={inputStyle} value={clientName} onChange={e => setClientName(e.target.value)} required />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Ciudad</label>
              <input style={inputStyle} value={locationCity} onChange={e => setLocationCity(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Provincia</label>
              <input style={inputStyle} value={locationProvince} onChange={e => setLocationProvince(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Capacidad (kWp)</label>
              <input style={inputStyle} type="number" step="0.01" value={capacityKwp} onChange={e => setCapacityKwp(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Presupuesto (USD)</label>
              <input style={inputStyle} type="number" step="0.01" value={budgetUsd} onChange={e => setBudgetUsd(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Fecha fin planificada</label>
              <input style={inputStyle} type="date" value={plannedEndDate} onChange={e => setPlannedEndDate(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Fecha tentativa de obra</label>
              <input style={inputStyle} type="date" value={firstDateScheduledAt} onChange={e => setFirstDateScheduledAt(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Email de notificación</label>
              <input style={inputStyle} type="email" value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Teléfono de notificación</label>
              <input style={inputStyle} value={notificationPhone} onChange={e => setNotificationPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid var(--color-border)", background: "none", color: "var(--color-text-secondary)", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending}
            style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "var(--color-accent)", color: "#000", fontSize: 13, fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1 }}
          >
            {isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SolarSystemsSection({
  project,
  onEdit,
  onCreate,
}: {
  project: Project;
  onEdit: (systemId: string) => void;
  onCreate: () => void;
}) {
  const systems = project.solarSystems ?? [];

  return (
    <section className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            Sistema fotovoltaico
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">Datos técnicos</h2>
        </div>
        <Button size="sm" variant="secondary" onClick={onCreate}>
          {systems.length === 0 ? "Agregar sistema" : "Agregar sistema"}
        </Button>
      </div>

      {systems.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-secondary)]">
          Todavía no hay sistemas cargados para este proyecto.
        </div>
      ) : systems.length === 1 ? (
        <div className="mt-4 flex flex-col gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{formatSolarSystemPrimary(systems[0])}</span>
            <Badge label={getPhaseTypeShortLabel(systems[0].inverterPhaseType)} className="bg-[var(--color-border)] text-[var(--color-text-primary)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">{formatSolarSystemPanels(systems[0])}</span>
            {systems[0].description ? (
              <span className="text-xs text-[var(--color-text-muted)]">{systems[0].description}</span>
            ) : null}
          </div>
          <Button size="sm" variant="ghost" onClick={() => onEdit(systems[0].id)}>
            ✎ Editar sistema
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {systems.map((system) => (
            <div key={system.id} className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {system.description || `Sistema ${system.order}`}
                  </span>
                  <Badge label={getPhaseTypeShortLabel(system.inverterPhaseType)} className="bg-[var(--color-border)] text-[var(--color-text-primary)]" />
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">{formatSolarSystemPrimary(system)}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {getPhaseTypeLabel(system.inverterPhaseType)} · {formatSolarSystemPanels(system)}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onEdit(system.id)}>
                ✎ Editar sistema
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [editingSolarSystemId, setEditingSolarSystemId] = useState<string | null>(null);
  const [showCreateSolarSystem, setShowCreateSolarSystem] = useState(false);
  const [bottomTab, setBottomTab] = useState<"activity" | "comments" | "timeline">("activity");
  const canViewMetrics = usePermission("METRICAS", "VIEW");

  const {
    data: project,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id!),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const ganttQuery = useQuery({
    queryKey: ["project", id, "gantt"],
    queryFn: () => getProjectGantt(id!),
    enabled: !!id && canViewMetrics && bottomTab === "timeline",
  });

  // ── Error / loading states ────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          No se pudo cargar el proyecto.
        </p>
        <Button variant="secondary" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div>
        <HeaderSkeleton />
        <KpiSkeleton />
        <PipelineSkeleton />
        <div className="grid gap-4" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg h-48 skeleton" />
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg h-48 skeleton" />
        </div>
      </div>
    );
  }

  // ── When a stage in the drawer was deleted/changed, keep it synced ────────
  const drawerStage = selectedStage
    ? (project.stages.find((s) => s.id === selectedStage.id) ?? null)
    : null;

  const commentContext = {
    stageLabelsById: Object.fromEntries(project.stages.map((stage) => [stage.id, stage.name])),
    substageNamesById: Object.fromEntries(
      project.stages.flatMap((stage) => stage.substages.map((substage) => [substage.id, substage.name])),
    ),
    checklistLabelsById: Object.fromEntries(
      project.stages.flatMap((stage) =>
        stage.substages.flatMap((substage) =>
          substage.checklistItems.map((item) => [item.id, item.label]),
        ),
      ),
    ),
    taskTitlesById: Object.fromEntries(project.tasks.map((task) => [task.id, task.title])),
  };

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["project", id] });
  }

  const editingSolarSystem =
    editingSolarSystemId != null
      ? project.solarSystems.find((system) => system.id === editingSolarSystemId) ?? null
      : null;

  return (
    <div className="relative">
      {/* Header */}
      <ProjectHeader
        project={project}
        onEdit={() => setShowEditProject(true)}
      />

      <SolarSystemsSection
        project={project}
        onEdit={(systemId) => setEditingSolarSystemId(systemId)}
        onCreate={() => setShowCreateSolarSystem(true)}
      />

      {/* KPI cards */}
      <KpiCards project={project} />
      <ProjectTimelineIndicators project={project} />

      {/* Pipeline */}
      <Pipeline
        stages={project.stages}
        onStageClick={(stage) => setSelectedStage(stage)}
      />

      {/* Bottom row */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "1.5fr 1fr" }}
      >
        <TasksPanel
          projectId={project.id}
          tasks={project.tasks}
          onNewTask={() => setShowTaskModal(true)}
          onTasksChanged={invalidate}
        />
        <ProgressPanel stages={project.stages} />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <div className="mb-4 flex gap-2 border-b border-[var(--color-border)] pb-3">
          <button
            className={`rounded-full px-3 py-1 text-xs ${bottomTab === "activity" ? "bg-[var(--color-accent)] text-black" : "text-[var(--color-text-secondary)]"}`}
            onClick={() => setBottomTab("activity")}
            type="button"
          >
            Historial de actividad
          </button>
          <button
            className={`rounded-full px-3 py-1 text-xs ${bottomTab === "comments" ? "bg-[var(--color-accent)] text-black" : "text-[var(--color-text-secondary)]"}`}
            onClick={() => setBottomTab("comments")}
            type="button"
          >
            Comentarios
          </button>
          {canViewMetrics ? (
            <button
              className={`rounded-full px-3 py-1 text-xs ${bottomTab === "timeline" ? "bg-[var(--color-accent)] text-black" : "text-[var(--color-text-secondary)]"}`}
              onClick={() => setBottomTab("timeline")}
              type="button"
            >
              Cronograma
            </button>
          ) : null}
        </div>

        {bottomTab === "activity" ? (
          <AuditHistory projectId={project.id} />
        ) : bottomTab === "timeline" ? (
          ganttQuery.isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Spinner />
            </div>
          ) : ganttQuery.isError || !ganttQuery.data ? (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 text-sm text-[var(--color-text-secondary)]">
              No se pudo cargar el cronograma. Verificá que el backend esté reiniciado y que tu usuario tenga permiso de métricas.
            </div>
          ) : (
            <ProjectGantt data={ganttQuery.data} />
          )
        ) : (
          <CommentThread projectId={project.id} level="project" context={commentContext} />
        )}
      </div>

      {/* Stage drawer */}
      {drawerStage && (
        <StageDrawer
          stage={drawerStage}
          projectId={project.id}
          files={project.files}
          onClose={() => setSelectedStage(null)}
        />
      )}

      {/* Task modal */}
      {showTaskModal && (
        <TaskModal
          projectId={project.id}
          stages={project.stages}
          onClose={() => setShowTaskModal(false)}
        />
      )}

      {/* Edit project modal */}
      {showEditProject && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditProject(false)}
          onSaved={invalidate}
        />
      )}

      {showCreateSolarSystem ? (
        <SolarSystemModal
          projectId={project.id}
          nextOrder={(project.solarSystems.length > 0 ? project.solarSystems[project.solarSystems.length - 1].order : 0) + 1}
          onClose={() => setShowCreateSolarSystem(false)}
        />
      ) : null}

      {editingSolarSystem ? (
        <SolarSystemModal
          projectId={project.id}
          system={editingSolarSystem}
          onClose={() => setEditingSolarSystemId(null)}
        />
      ) : null}
    </div>
  );
}

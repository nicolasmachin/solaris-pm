import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ArrowRight, Mic } from "lucide-react";
import { useAuthStore } from "../store/auth.store";
import { usePermission } from "../hooks/usePermission";
import { getProjects } from "../api/projects.api";
import { getMyTasks } from "../api/myTasks.api";
import { getUteProcesses, UTE_STAGE_LABEL, UTE_STATUS_LABEL, UTE_ACTIONS_ORDERED } from "../api/uteProcess.api";
import { STAGE_AREA } from "../constants/stages";
import { getCalendarMonth } from "../api/calendar.api";
import { completeSubstage } from "../api/stages.api";
import { LATEST_RELEASE, OLDER_RELEASES } from "../data/latestRelease";
import { VersionHistoryModal } from "../components/layout/VersionFooter";
import { OperationsPanel } from "../components/dashboard/OperationsPanel";
import { SalesPanel } from "../components/dashboard/SalesPanel";
import { getMyUpcomingDeadlines, type UpcomingDeadline } from "../api/deadline.api";
import type { ProjectListItem } from "../types/api.types";
import type { UteProcess, UteActionKey } from "../api/uteProcess.api";
import type { MyTaskBlock, MyTaskSubstage } from "../api/myTasks.api";
import type { InstallationSchedule } from "../api/calendar.api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(" "); }

// "Mis proyectos por etapa" agrupa por ÁREA (5 tiles), no por etapa puntual, para
// que los proyectos del pipeline nuevo (8 etapas) caigan en el área correcta en
// vez de perderse. El mapeo etapa→área es el central (constants/stages).
const AREA_ORDER = ["VENTAS", "INGENIERIA", "OPERACIONES", "UTE", "CX"] as const;
type AreaName = (typeof AREA_ORDER)[number];
const AREA_TILE_LABEL: Record<AreaName, string> = {
  VENTAS: "Ventas",
  INGENIERIA: "Ingeniería",
  OPERACIONES: "Operaciones",
  UTE: "Trámite UTE",
  CX: "Experiencia Solar",
};

const ACTION_SIDE: Record<UteActionKey, "ours" | "ute"> = Object.fromEntries(
  UTE_ACTIONS_ORDERED.map(a => [a.key, a.side]),
) as Record<UteActionKey, "ours" | "ute">;
const UTE_DATE_KEYS: UteActionKey[] = UTE_ACTIONS_ORDERED.map(a => a.key);

function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffDays(fromIso: string): number {
  const from = new Date(fromIso);
  const today = todayLocal();
  return Math.floor((today.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function fmtSpanishDate(d: Date): string {
  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}, ${d.getFullYear()}`;
}

function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function Dashboard() {
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === "ADMIN";
  const canViewUte = usePermission("TRAMITES_UTE", "VIEW");
  const canViewOps = usePermission("OPERACIONES", "VIEW");
  const canViewVentas = usePermission("VENTAS", "VIEW");

  // Shortcut grande para el rol OPERACIONES (operario): cargar una entrada
  // de visita técnica rápida sin tener que entrar al proyecto manualmente.
  // Reduce la fricción del flujo "tomo el celu, abro la app, grabo".
  const isOperario = user?.role === "OPERACIONES";

  return (
    <div>
      {isOperario && (
        <Link
          to="/visita-rapida"
          className="mb-4 flex items-center gap-3 bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 rounded-xl px-5 py-4 hover:bg-[var(--color-accent)]/25 transition-colors"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/30">
            <Mic className="w-5 h-5 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Cargar entrada de visita técnica
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Audio, foto o nota — elegís el proyecto y la app arma tu visita automáticamente.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-[var(--color-accent)] shrink-0" />
        </Link>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
          Buenas, {user ? firstName(user.name) : ""}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1 capitalize">
          {fmtSpanishDate(todayLocal())}
        </p>
      </div>

      {/* Panel de operaciones · Tiempos & SLA (gateado por OPERACIONES:VIEW) */}
      {canViewOps && <OperationsPanel />}

      {/* Panel de ventas · Embudo & SLA (gateado por VENTAS:VIEW) */}
      {canViewVentas && <SalesPanel />}

      {/* Grid 2 columnas en desktop */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 flex flex-col gap-4">
          <ProjectsByStageCard userId={user?.id ?? null} isAdmin={isAdmin} />
          {canViewUte && <UteSinAvanceCard userId={user?.id ?? null} isAdmin={isAdmin} />}
          <InstalacionesSemanaCard userId={user?.id ?? null} isAdmin={isAdmin} />
          <UpcomingDeadlinesCard />
          <MisTareasCard />
          <MisMetricasCard userId={user?.id ?? null} isAdmin={isAdmin} />
        </div>
        <div className="md:col-span-1">
          <ChangelogSidebar />
        </div>
      </div>
    </div>
  );
}

// ─── Card 1: Mis proyectos por etapa ──────────────────────────────────────────

function ProjectsByStageCard({ userId, isAdmin }: { userId: string | null; isAdmin: boolean }) {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: () => getProjects({ status: "ACTIVE" }),
    staleTime: 60_000,
  });

  const counts = useMemo(() => {
    const result: Record<AreaName, number> = {
      VENTAS: 0, INGENIERIA: 0, OPERACIONES: 0, UTE: 0, CX: 0,
    };
    for (const p of projects) {
      const cs = p.currentStage;
      if (!cs) continue;
      // Etapa (nueva o vieja) → área. Si no está mapeada, se saltea.
      const area = STAGE_AREA[cs.name] as AreaName | undefined;
      if (!area || !(area in result)) continue;
      // Filtro de "mis proyectos": admin ve todo; otros sólo si son responsables
      // de la etapa actual.
      if (!isAdmin && cs.responsibleUserId !== userId) continue;
      result[area] += 1;
    }
    return result;
  }, [projects, userId, isAdmin]);

  const max = Math.max(...Object.values(counts));

  return (
    <CardFrame
      icon="📊"
      iconBg="bg-blue-500/10 text-blue-500"
      title="Mis proyectos por etapa"
      link={{ to: "/projects", label: "Ver todos →" }}
    >
      {isLoading ? (
        <div className="h-20 rounded-lg bg-[var(--color-border)]/30 animate-pulse" />
      ) : (
        <div className="flex gap-1.5 items-stretch">
          {AREA_ORDER.map((area, i) => {
            const count = counts[area];
            const isHighlight = max > 0 && count === max;
            return (
              <Link
                key={area}
                to="/projects"
                className={klass(
                  "flex-1 rounded-lg border p-2.5 text-center transition-all relative cursor-pointer",
                  isHighlight
                    ? "border-amber-300 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30"
                    : "border-[var(--color-border)] bg-[var(--color-bg-app)] hover:bg-[var(--color-warning-bg)]/40 hover:border-amber-200",
                )}
              >
                <div className={klass(
                  "text-[9px] font-bold uppercase tracking-widest mb-1",
                  isHighlight ? "text-amber-900 dark:text-amber-300" : "text-[var(--color-text-muted)]",
                )}>
                  {AREA_TILE_LABEL[area]}
                </div>
                <div className={klass(
                  "text-2xl font-extrabold tabular-nums leading-none",
                  isHighlight ? "text-amber-900 dark:text-amber-100" : "text-[var(--color-text-primary)]",
                )}>
                  {count}
                </div>
                {i < AREA_ORDER.length - 1 && (
                  <span className="absolute -right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm z-10 pointer-events-none">
                    ›
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </CardFrame>
  );
}

// ─── Card 2: Trámites UTE sin avance ─────────────────────────────────────────

interface UteRow {
  id: string;
  client: string;
  stage: string;
  status: string;
  daysIdle: number;
  side: "ours" | "ute";
}

function UteSinAvanceCard({ userId, isAdmin }: { userId: string | null; isAdmin: boolean }) {
  const { data: utes = [], isLoading } = useQuery({
    queryKey: ["dashboard-utes"],
    queryFn: () => getUteProcesses({}),
    staleTime: 60_000,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: () => getProjects({ status: "ACTIVE" }),
    staleTime: 60_000,
  });

  const myProjectIds = useMemo(() => {
    if (isAdmin) return null; // null = ver todo
    const set = new Set<string>();
    for (const p of projects) {
      if (p.currentStage?.responsibleUserId === userId) set.add(p.id);
    }
    return set;
  }, [projects, userId, isAdmin]);

  const rows = useMemo<UteRow[]>(() => {
    const today = todayLocal();
    return utes
      .filter(u => u.currentStage !== "FINALIZADO")
      .filter(u => myProjectIds === null || myProjectIds.has(u.projectId))
      .map((u: UteProcess): UteRow | null => {
        // Encontrar la última fecha y qué key fue
        let lastKey: UteActionKey | null = null;
        let lastDate: string | null = null;
        for (const key of UTE_DATE_KEYS) {
          const v = u[key];
          if (v && (!lastDate || v > lastDate)) {
            lastDate = v;
            lastKey = key;
          }
        }
        // Si no hay fecha, usamos createdAt como referencia
        const refDate = lastDate ?? u.createdAt.slice(0, 10);
        const days = Math.floor((today.getTime() - new Date(refDate).getTime()) / (24 * 60 * 60 * 1000));
        if (days < 10) return null;
        // Si no hay key (ningún sentAt/approvedAt cargado), bloquea Nosotros (hay que arrancar).
        const side: "ours" | "ute" = lastKey ? (ACTION_SIDE[lastKey] === "ours" ? "ute" : "ours") : "ours";
        // Lógica del side: si la última acción fue NUESTRA (envío) → estamos esperando
        // a UTE → bloquea UTE. Si fue de UTE (caso abierto, aprobación) → bloquea Nosotros.
        return {
          id: u.id,
          client: u.project.clientName,
          stage: UTE_STAGE_LABEL[u.currentStage],
          status: UTE_STATUS_LABEL[u.currentStatus].toLowerCase(),
          daysIdle: days,
          side,
        };
      })
      .filter((r): r is UteRow => r !== null)
      .sort((a, b) => b.daysIdle - a.daysIdle)
      .slice(0, 5);
  }, [utes, myProjectIds]);

  return (
    <CardFrame
      icon="⚠"
      iconBg="bg-red-500/10 text-red-500"
      title="Trámites UTE sin avance"
      link={{ to: "/tramites-ute", label: "Ver todos →" }}
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-[var(--color-border)]/30 animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
          No hay trámites detenidos. Todo al día. ✓
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const isCritical = r.daysIdle > 30;
            return (
              <Link
                key={r.id}
                to={`/tramites-ute?openId=${r.id}`}
                className={klass(
                  "grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                  isCritical
                    ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 hover:bg-red-100/60 dark:hover:bg-red-950/50"
                    : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100/60 dark:hover:bg-amber-950/50",
                )}
              >
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{r.client}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{r.stage} · {r.status}</div>
                </div>
                <div className={klass(
                  "text-sm font-bold tabular-nums",
                  isCritical ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300",
                )}>
                  {r.daysIdle}d
                </div>
                <span className={klass(
                  "text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-[var(--color-bg-card)] border whitespace-nowrap",
                  isCritical
                    ? "border-red-300 text-red-700 dark:text-red-400 dark:border-red-700"
                    : "border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-700",
                )}>
                  {r.side === "ute" ? "UTE" : "Nosotros"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </CardFrame>
  );
}

// ─── Card 3: Instalaciones esta semana ───────────────────────────────────────

const DAY_LABELS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function InstalacionesSemanaCard({ userId, isAdmin }: { userId: string | null; isAdmin: boolean }) {
  const today = todayLocal();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["dashboard-calendar", year, month],
    queryFn: () => getCalendarMonth(year, month),
    staleTime: 60_000,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: () => getProjects({ status: "ACTIVE" }),
    staleTime: 60_000,
  });

  const myProjectIds = useMemo(() => {
    if (isAdmin) return null;
    const set = new Set<string>();
    for (const p of projects) if (p.currentStage?.responsibleUserId === userId) set.add(p.id);
    return set;
  }, [projects, userId, isAdmin]);

  // Generar 7 días: lunes a domingo de la semana actual
  const weekDays = useMemo(() => {
    const dow = today.getDay() === 0 ? 6 : today.getDay() - 1; // 0 = lunes
    const start = new Date(today);
    start.setDate(start.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [today]);

  // Filtrar schedules a los que cubren días de esta semana y proyecto del usuario
  const eventsByDay = useMemo(() => {
    const map = new Map<string, InstallationSchedule[]>();
    if (!schedules?.schedules) return map;
    for (const sch of schedules.schedules) {
      if (myProjectIds !== null && (!sch.projectId || !myProjectIds.has(sch.projectId))) continue;
      for (const seg of sch.segments) {
        const segStart = new Date(seg.startDate);
        const segEnd = new Date(seg.endDate);
        for (const day of weekDays) {
          if (day >= segStart && day <= segEnd) {
            const key = day.toISOString().slice(0, 10);
            if (!map.has(key)) map.set(key, []);
            const list = map.get(key)!;
            if (!list.some(s => s.id === sch.id)) list.push(sch);
          }
        }
      }
    }
    return map;
  }, [schedules, weekDays, myProjectIds]);

  const todayKey = today.toISOString().slice(0, 10);

  return (
    <CardFrame
      icon="📅"
      iconBg="bg-purple-500/10 text-purple-500"
      title="Instalaciones esta semana"
      link={{ to: "/calendario", label: "Ver calendario →" }}
    >
      {isLoading ? (
        <div className="h-24 rounded-lg bg-[var(--color-border)]/30 animate-pulse" />
      ) : (
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, i) => {
            const key = day.toISOString().slice(0, 10);
            const events = eventsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={klass(
                  "rounded-md border p-1.5 min-h-[88px]",
                  isToday
                    ? "border-amber-300 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30"
                    : "border-[var(--color-border)] bg-[var(--color-bg-app)]",
                )}
              >
                <div className={klass(
                  "text-[9px] font-bold uppercase tracking-widest",
                  isToday ? "text-amber-900 dark:text-amber-300" : "text-[var(--color-text-muted)]",
                )}>
                  {isToday ? `${DAY_LABELS_SHORT[i]} · HOY` : DAY_LABELS_SHORT[i]}
                </div>
                <div className={klass(
                  "text-base font-bold mb-1.5",
                  isToday ? "text-amber-900 dark:text-amber-100" : "text-[var(--color-text-primary)]",
                )}>
                  {day.getDate()}
                </div>
                <div className="space-y-1">
                  {events.slice(0, 2).map(ev => (
                    <Link
                      key={ev.id}
                      to={`/calendario?start=${ev.plannedWorkStart}`}
                      className="block text-[9.5px] text-white px-1.5 py-0.5 rounded truncate hover:opacity-90"
                      style={{ backgroundColor: ev.teamColor || "#5b8def" }}
                      title={ev.project?.clientName ?? "Instalación"}
                    >
                      {ev.project?.clientName ?? "—"}
                    </Link>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[9px] text-[var(--color-text-muted)] text-center">+{events.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardFrame>
  );
}

// ─── Card 4: Mis tareas pendientes ───────────────────────────────────────────

function MisTareasCard() {
  const qc = useQueryClient();
  const { data: myTasksResp, isLoading } = useQuery({
    queryKey: ["dashboard-my-tasks"],
    queryFn: () => getMyTasks(),
    staleTime: 60_000,
  });
  const blocks = myTasksResp?.blocks ?? [];

  // Aplanar y ordenar por urgencia: las propias del usuario, ordenadas por urgencyRank.
  const tasks = useMemo(() => {
    type Flat = { block: MyTaskBlock; sub: MyTaskSubstage };
    const flat: Flat[] = [];
    for (const b of blocks) {
      for (const s of b.substages) {
        if (s.assignedUser?.isCurrentUser) flat.push({ block: b, sub: s });
      }
    }
    flat.sort((a, b) => a.sub.urgencyRank - b.sub.urgencyRank);
    return flat.slice(0, 5);
  }, [blocks]);

  const totalCount = useMemo(() => {
    let c = 0;
    for (const b of blocks) for (const s of b.substages) if (s.assignedUser?.isCurrentUser) c++;
    return c;
  }, [blocks]);

  const completeMut = useMutation({
    mutationFn: ({ projectId, stageId, substageId }: { projectId: string; stageId: string; substageId: string }) =>
      completeSubstage(projectId, stageId, substageId),
    onSuccess: () => {
      toast.success("Tarea completada");
      qc.invalidateQueries({ queryKey: ["dashboard-my-tasks"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: () => toast.error("No se pudo completar"),
  });

  return (
    <CardFrame
      icon="✓"
      iconBg="bg-amber-500/10 text-amber-600"
      title="Mis tareas pendientes"
      link={{ to: "/mis-tareas", label: "Ver todas →" }}
    >
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-[var(--color-border)]/30 animate-pulse" />)}</div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Sin tareas pendientes 🎉</p>
      ) : (
        <>
          <div className="space-y-1.5">
            {tasks.map(({ block, sub }) => {
              const due = formatDueLabel(sub.dueDate);
              return (
                <div
                  key={sub.id}
                  className="grid grid-cols-[auto_1fr_auto] gap-3 items-center px-3 py-2 rounded-lg bg-[var(--color-bg-app)] border border-[var(--color-border)] hover:bg-[var(--color-warning-bg)]/30 hover:border-amber-200 cursor-pointer transition-colors"
                  onClick={() => {
                    window.location.href = `/projects/${block.projectId}?stage=${block.stageId}`;
                  }}
                >
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`¿Marcar como completada: "${sub.name}"?`)) {
                        completeMut.mutate({ projectId: block.projectId, stageId: block.stageId, substageId: sub.id });
                      }
                    }}
                    className="w-4 h-4 rounded border-[1.5px] border-[var(--color-border)] hover:border-amber-400 transition-colors shrink-0"
                    aria-label="Completar"
                  />
                  <div className="min-w-0">
                    <div className="text-[12.5px] text-[var(--color-text-primary)] truncate">{sub.name}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{block.projectName} · {block.stageLabel}</div>
                  </div>
                  <span className={klass(
                    "text-[10.5px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap",
                    due.tone === "overdue" ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400" :
                    due.tone === "today" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400" :
                    due.tone === "upcoming" ? "bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)]" :
                    "bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)]",
                  )}>
                    {due.label}
                  </span>
                </div>
              );
            })}
          </div>
          {totalCount > tasks.length && (
            <p className="text-[11px] text-[var(--color-text-muted)] text-center mt-3">
              + {totalCount - tasks.length} tarea{totalCount - tasks.length === 1 ? "" : "s"} más
            </p>
          )}
        </>
      )}
    </CardFrame>
  );
}

function formatDueLabel(dueDate: string | null): { label: string; tone: "overdue" | "today" | "upcoming" | "none" } {
  if (!dueDate) return { label: "—", tone: "none" };
  const days = diffDays(dueDate);
  if (days > 0) return { label: `${days}d atraso`, tone: "overdue" };
  if (days === 0) return { label: "Hoy", tone: "today" };
  // futuro
  const d = new Date(dueDate);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return { label: `${d.getDate()}-${meses[d.getMonth()]}`, tone: "upcoming" };
}

// ─── Card 5: Mis métricas ────────────────────────────────────────────────────

function MisMetricasCard({ userId, isAdmin }: { userId: string | null; isAdmin: boolean }) {
  const { data: projects = [] } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: () => getProjects({ status: "ACTIVE" }),
    staleTime: 60_000,
  });
  const { data: completedProjects = [] } = useQuery({
    queryKey: ["dashboard-projects-completed"],
    queryFn: () => getProjects({ status: "COMPLETED" }),
    staleTime: 60_000,
  });
  const { data: myTasksResp2 } = useQuery({
    queryKey: ["dashboard-my-tasks"],
    queryFn: () => getMyTasks(),
    staleTime: 60_000,
  });
  const myTasks = myTasksResp2?.blocks ?? [];

  const metrics = useMemo(() => {
    const isMine = (p: ProjectListItem) => isAdmin || p.currentStage?.responsibleUserId === userId;
    const activos = projects.filter(p => isMine(p) && p.status === "ACTIVE").length;

    // Para "Cerrados" y "kW instalados" usamos los proyectos COMPLETED.
    // Filtro de "mío" para completados es laxo: como el currentStage suele
    // quedar en POSTVENTA y muchas veces sin responsable, usamos también
    // el caso en que cualquiera de mis stages activas pertenezca al proyecto.
    // Para simplificar este MVP, contamos los completados con currentStage
    // del usuario (puede ser null en muchos), o todos para admin.
    const last30 = todayLocal();
    last30.setDate(last30.getDate() - 30);
    const last60 = todayLocal();
    last60.setDate(last60.getDate() - 60);

    const myCompleted = completedProjects.filter(p => isAdmin || p.currentStage?.responsibleUserId === userId);
    const closedThisPeriod = myCompleted.filter(p => p.actualEndDate && new Date(p.actualEndDate) >= last30);
    const closedPrevPeriod = myCompleted.filter(
      p => p.actualEndDate && new Date(p.actualEndDate) >= last60 && new Date(p.actualEndDate) < last30,
    );

    const kwThisPeriod = closedThisPeriod.reduce((s, p) => s + p.capacityKwp, 0);
    const kwPrevPeriod = closedPrevPeriod.reduce((s, p) => s + p.capacityKwp, 0);

    const tareasPendientes = myTasks.reduce(
      (acc, b) => acc + b.substages.filter(s => s.assignedUser?.isCurrentUser).length,
      0,
    );

    return {
      activos,
      cerradosMes: closedThisPeriod.length,
      cerradosTrend: closedThisPeriod.length - closedPrevPeriod.length,
      kw: Math.round(kwThisPeriod),
      kwTrend: Math.round(kwThisPeriod - kwPrevPeriod),
      tareas: tareasPendientes,
    };
  }, [projects, completedProjects, myTasks, userId, isAdmin]);

  const showTrend = (n: number) => {
    if (n === 0) return null;
    const sign = n > 0 ? "+" : "";
    return { text: `${sign}${n} vs mes pasado`, isUp: n > 0 };
  };

  const cerradosTrend = showTrend(metrics.cerradosTrend);
  const kwTrend = showTrend(metrics.kwTrend);

  return (
    <CardFrame
      icon="📈"
      iconBg="bg-green-500/10 text-green-600"
      title="Mis métricas"
      link={{ to: "/metrics", label: "Ver detalle →" }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <MetricBox label="Activos" value={metrics.activos} />
        <MetricBox label="Cerrados (30d)" value={metrics.cerradosMes} trend={cerradosTrend} />
        <MetricBox label="kW instalados" value={metrics.kw} trend={kwTrend} />
        <MetricBox label="Tareas pendientes" value={metrics.tareas} />
      </div>
    </CardFrame>
  );
}

function MetricBox({ label, value, trend }: { label: string; value: number; trend?: { text: string; isUp: boolean } | null }) {
  return (
    <div
      className="rounded-lg border border-amber-100 dark:border-amber-900/30 p-3"
      style={{
        background: "linear-gradient(180deg, var(--color-bg-card) 0%, rgba(254, 243, 199, 0.5) 100%)",
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
      <div className="text-2xl font-extrabold tabular-nums mt-1 text-[var(--color-text-primary)]">{value}</div>
      {trend && (
        <div className={klass("text-[10px] font-semibold mt-0.5", trend.isUp ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
          {trend.text}
        </div>
      )}
    </div>
  );
}

// ─── Card frame ──────────────────────────────────────────────────────────────

function CardFrame({ icon, iconBg, title, link, children }: {
  icon: string;
  iconBg: string;
  title: string;
  link?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className={klass("w-6 h-6 rounded-md flex items-center justify-center text-xs", iconBg)}>{icon}</div>
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h2>
        </div>
        {link && (
          <Link to={link.to} className="text-[11px] font-semibold text-amber-500 hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Sidebar Changelog ───────────────────────────────────────────────────────

function ChangelogSidebar() {
  const release = LATEST_RELEASE;
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden md:sticky md:top-6 md:self-start">
        <div className="bg-slate-800 text-slate-200 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold">Última versión</span>
          <span className="text-sm font-bold font-mono text-amber-400">v{release.version}</span>
        </div>
        <div className="px-4 py-3 max-h-[70vh] overflow-y-auto">
          {release.sections.map((section, i) => (
            <div key={i} className="mb-3.5 last:mb-0">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">
                {section.title}
              </div>
              {section.items.map((item, j) => (
                <ChangelogItem key={j} text={item} />
              ))}
            </div>
          ))}
          {OLDER_RELEASES.length > 0 && (
            <div className="mt-4 pt-3 border-t border-dashed border-[var(--color-border)] space-y-3">
              {OLDER_RELEASES.map((old, i) => (
                <Fragment key={i}>
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mb-1">
                      v{old.version} · {old.shortDate}
                    </div>
                    {old.highlights.map((h, j) => (
                      <ChangelogItem key={j} text={h} small />
                    ))}
                  </div>
                  {i < OLDER_RELEASES.length - 1 && <div className="border-t border-dashed border-[var(--color-border)]" />}
                </Fragment>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-[var(--color-border)] px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="text-[11px] font-semibold text-[var(--color-accent)] hover:underline"
          >
            Ver historial completo de versiones →
          </button>
        </div>
      </div>
      {historyOpen ? <VersionHistoryModal onClose={() => setHistoryOpen(false)} /> : null}
    </>
  );
}

function ChangelogItem({ text, small = false }: { text: string; small?: boolean }) {
  // Render simple de bullets con **bold**.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className={klass(
      "flex gap-1.5 leading-snug py-0.5",
      small ? "text-[10.5px]" : "text-[11.5px]",
      "text-[var(--color-text-secondary)]",
    )}>
      <span className="text-[var(--color-text-muted)] shrink-0">•</span>
      <span>
        {parts.map((p, i) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={i} className="text-[var(--color-text-primary)] font-semibold">
              {p.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </span>
    </div>
  );
}

// ─── Card: Deadlines próximos (G.3) ───────────────────────────────────────────

function getUpcomingDeadlineColor(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return "text-red-500 font-semibold";
  if (days <= 3) return "text-orange-400";
  if (days <= 7) return "text-yellow-500";
  return "text-[var(--color-text-secondary)]";
}

function formatUpcomingDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-UY", { day: "2-digit", month: "short" });
}

function UpcomingDeadlinesCard() {
  const { data = [], isLoading } = useQuery<UpcomingDeadline[]>({
    queryKey: ["my-upcoming-deadlines", 7],
    queryFn: () => getMyUpcomingDeadlines(7),
    staleTime: 60_000,
  });

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          Deadlines próximos
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Próximos 7 días
        </p>
      </div>
      {isLoading ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : data.length === 0 ? (
        <p className="py-4 text-center text-xs text-[var(--color-text-muted)] italic">
          Sin deadlines en los próximos 7 días.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0 flex-1">
                <Link
                  to={`/proyectos/${d.project.id}`}
                  className="text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] truncate block"
                >
                  {d.project.clientName}
                </Link>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                  {d.stage.label} · {d.name}
                </p>
              </div>
              <span className={`text-xs font-mono shrink-0 ${getUpcomingDeadlineColor(d.deadline)}`}>
                {formatUpcomingDate(d.deadline)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

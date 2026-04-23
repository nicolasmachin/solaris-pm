import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Eye } from "lucide-react";
import {
  getMyTasks,
  type MyTaskBlock,
  type MyTaskSubstage,
  type StageType,
} from "../api/myTasks.api";
import { Spinner } from "../components/ui/Spinner";
import { UserSelect } from "../components/ui/UserSelect";
import { apiClient } from "../api/axios";
import { useAuthStore } from "../store/auth.store";

type SortOption = "urgency" | "project" | "date";
type ScopeOption = "all" | "mine";

const SORT_LABELS: Record<SortOption, string> = {
  urgency: "Urgencia",
  project: "Proyecto",
  date: "Fecha de vencimiento",
};

const SUBTITLE_BY_SORT: Record<SortOption, string> = {
  urgency: "Proyectos y etapas en las que estás involucrado · Ordenados por urgencia",
  project: "Proyectos y etapas en las que estás involucrado · Ordenados por proyecto",
  date: "Proyectos y etapas en las que estás involucrado · Ordenados por fecha de vencimiento",
};

// Posición de cada etapa dentro del flujo, para el ordenamiento "Proyecto".
// Lo que no matche va al final.
const STAGE_POSITION: Record<StageType, number> = {
  ONBOARDING: 1,
  INGENIERIA: 2,
  OPERACIONES: 3,
  HABILITACION_UTE: 4,
  POSTVENTA: 5,
};

function sortBlocks(blocks: MyTaskBlock[], sort: SortOption): MyTaskBlock[] {
  if (sort === "urgency") return blocks; // ya viene ordenado así del backend
  const copy = [...blocks];
  if (sort === "project") {
    copy.sort((a, b) => {
      const byProject = a.projectName.localeCompare(b.projectName, "es", { sensitivity: "base" });
      if (byProject !== 0) return byProject;
      const ap = STAGE_POSITION[a.stageName] ?? Number.MAX_SAFE_INTEGER;
      const bp = STAGE_POSITION[b.stageName] ?? Number.MAX_SAFE_INTEGER;
      return ap - bp;
    });
    return copy;
  }
  // sort === "date": ascendente por stageDueDate, null al final, desempate por proyecto.
  copy.sort((a, b) => {
    if (a.stageDueDate && b.stageDueDate) {
      if (a.stageDueDate !== b.stageDueDate) return a.stageDueDate < b.stageDueDate ? -1 : 1;
      return a.projectName.localeCompare(b.projectName, "es", { sensitivity: "base" });
    }
    if (a.stageDueDate) return -1;
    if (b.stageDueDate) return 1;
    return a.projectName.localeCompare(b.projectName, "es", { sensitivity: "base" });
  });
  return copy;
}

// Parseo de los params de URL con fallback a defaults seguros.
function readSortParam(sp: URLSearchParams): SortOption {
  const v = sp.get("sort");
  return v === "project" || v === "date" ? v : "urgency";
}

function readScopeParam(sp: URLSearchParams): ScopeOption {
  const v = sp.get("scope");
  return v === "mine" ? "mine" : "all";
}

// ─── Constantes de urgencia y colores ───────────────────────────────────────

// rank: 0 atrasada/hoy, 1 ≤7d, 2 >7d, 3 sin fecha
const URGENCY = [
  { label: "Atrasada o vence hoy", dotClass: "bg-red-500", barVar: "var(--color-danger-text)" },
  { label: "Vence en menos de 7 días", dotClass: "bg-amber-400", barVar: "var(--color-warning-text)" },
  { label: "Vence en más de 7 días", dotClass: "bg-emerald-400", barVar: "var(--color-state-done-text)" },
  { label: "Sin fecha", dotClass: "bg-[var(--color-text-muted)]", barVar: "var(--color-text-muted)" },
] as const;

const STAGE_COLORS: Record<StageType, { bg: string; text: string }> = {
  ONBOARDING: { bg: "rgba(139,92,246,0.15)", text: "#a78bfa" },      // violeta
  INGENIERIA: { bg: "rgba(16,185,129,0.15)", text: "#34d399" },      // verde
  OPERACIONES: { bg: "rgba(249,115,22,0.18)", text: "#fb923c" },     // naranja
  HABILITACION_UTE: { bg: "rgba(239,68,68,0.15)", text: "#f87171" }, // rojo claro
  POSTVENTA: { bg: "rgba(45,212,191,0.15)", text: "#5eead4" },       // turquesa
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDueShort(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]}`;
}

function dueLabel(iso: string | null, rank: number): string {
  if (rank === 3) return "Sin fecha";
  if (rank === 0) {
    // Atrasada o vence hoy
    const d = new Date(`${iso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d.getTime() < today.getTime()) return `Atrasada · ${formatDueShort(iso)}`;
    return `Vence hoy`;
  }
  return `Vence ${formatDueShort(iso)}`;
}

// ─── Página ──────────────────────────────────────────────────────────────────

export function MisTareas() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "ADMIN";

  // Estado inicial desde URL: /mis-tareas?userId=xxx&sort=project&scope=mine
  const [searchParams, setSearchParams] = useSearchParams();
  const initialUserIdParam = searchParams.get("userId");
  const [viewUserId, setViewUserId] = useState<string | null>(
    // Un no-admin NUNCA respeta el param userId (seguridad: el backend ya lo
    // ignora igual, pero acá evitamos UI inconsistente).
    isAdmin && initialUserIdParam && initialUserIdParam !== currentUser?.id
      ? initialUserIdParam
      : null,
  );
  const [scope, setScope] = useState<ScopeOption>(() => readScopeParam(searchParams));
  const [sort, setSort] = useState<SortOption>(() => readSortParam(searchParams));

  // Sincronizar URL cuando cambian los filtros. Se omiten los defaults para
  // mantener la URL limpia.
  useEffect(() => {
    const next = new URLSearchParams();
    if (viewUserId && viewUserId !== currentUser?.id) next.set("userId", viewUserId);
    if (sort !== "urgency") next.set("sort", sort);
    if (scope !== "all") next.set("scope", scope);
    const currentStr = searchParams.toString();
    const nextStr = next.toString();
    if (currentStr !== nextStr) {
      setSearchParams(next, { replace: true });
    }
    // No incluimos setSearchParams en deps (referencia estable) para evitar bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewUserId, sort, scope, currentUser?.id]);

  const effectiveUserId = isAdmin ? viewUserId : null;

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["my-tasks", effectiveUserId ?? "self"],
    queryFn: () => getMyTasks({ userId: effectiveUserId }),
    staleTime: 30_000,
  });

  // Para el banner informativo, reuso el mismo queryKey que UserSelect cachea
  // (["users", "active"]) y extraigo el nombre del user target.
  const { data: activeUsers } = useQuery({
    queryKey: ["users", "active"],
    queryFn: async () => {
      const res = await apiClient.get<Array<{ id: string; name: string }>>("/api/users/active");
      return res.data;
    },
    staleTime: 5 * 60_000,
    enabled: isAdmin && !!effectiveUserId,
  });
  const targetUserName = useMemo(() => {
    if (!effectiveUserId) return null;
    return activeUsers?.find((u) => u.id === effectiveUserId)?.name ?? null;
  }, [activeUsers, effectiveUserId]);

  const allBlocks = data ?? [];
  const filteredBlocks = useMemo(() => {
    // scope="mine" filtra por el USUARIO TARGET. El backend ya calcula
    // myPendingSubstagesCount respecto al target, así que funciona tal cual
    // cuando un admin mira a otro.
    const scoped = scope === "mine"
      ? allBlocks.filter((b) => b.myPendingSubstagesCount > 0)
      : allBlocks;
    return sortBlocks(scoped, sort);
  }, [allBlocks, scope, sort]);

  // Stats
  const totalPending = allBlocks.reduce((s, b) => s + b.pendingSubstagesCount, 0);
  const myPending = allBlocks.reduce((s, b) => s + b.myPendingSubstagesCount, 0);
  const overdue = allBlocks.filter((b) => b.blockRank === 0).length;

  // Inicializamos el primer bloque como expandido para que el usuario entienda el patrón
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const initializedRef = useMemoInit(filteredBlocks, (blocks) => {
    if (blocks.length > 0) setExpanded(new Set([blocks[0].stageId]));
  });
  void initializedRef;

  function toggle(stageId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  function goToStage(block: MyTaskBlock, substageId?: string) {
    const params = new URLSearchParams();
    params.set("stage", block.stageId);
    if (substageId) params.set("substage", substageId);
    navigate(`/projects/${block.projectId}?${params.toString()}`);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Mis tareas
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {SUBTITLE_BY_SORT[sort]}
        </p>
      </div>

      {/* Admin only: selector de usuario a consultar */}
      {isAdmin ? (
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 md:flex-row md:items-center">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Ver tareas de
          </span>
          <div className="flex-1 md:max-w-xs">
            <UserSelect
              value={viewUserId}
              onChange={setViewUserId}
              allowUnassigned
              unassignedLabel="Yo (mis tareas)"
              placeholder="Yo (mis tareas)"
              ariaLabel="Ver tareas de otro usuario"
            />
          </div>
        </div>
      ) : null}

      {/* Toolbar: stats + filtros */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <Stat label="Etapas activas" value={allBlocks.length} />
          <Stat label="Subetapas pendientes" value={totalPending} />
          <Stat label="Asignadas a mí" value={myPending} highlight />
          <Stat label="Atrasadas" value={overdue} danger={overdue > 0} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="font-mono uppercase tracking-widest">Ordenar</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((opt) => (
                <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>
              ))}
            </select>
          </label>
          <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5 text-xs">
            <FilterButton active={scope === "all"} onClick={() => setScope("all")}>
              Todas
            </FilterButton>
            <FilterButton active={scope === "mine"} onClick={() => setScope("mine")}>
              Solo mías
            </FilterButton>
          </div>
        </div>
      </div>

      {/* Banner: admin mirando tareas de otro usuario */}
      {isAdmin && effectiveUserId && effectiveUserId !== currentUser?.id ? (
        <div
          role="status"
          aria-live="polite"
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-info-border,var(--color-border))] bg-[var(--color-info-bg)] px-4 py-2 text-sm"
          style={{ color: "var(--color-info-text)" }}
        >
          <span className="inline-flex items-center gap-2">
            <Eye size={14} aria-hidden />
            Estás viendo las tareas de{" "}
            <strong className="font-semibold">{targetUserName ?? "otro usuario"}</strong>.
          </span>
          <button
            type="button"
            onClick={() => setViewUserId(null)}
            className="rounded px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--color-info-text)" }}
          >
            Volver a las mías
          </button>
        </div>
      ) : null}

      {/* Leyenda de urgencia */}
      <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-[var(--color-text-muted)]">
        {URGENCY.map((u, i) => (
          <span key={i} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${u.dotClass}`} />
            {u.label}
          </span>
        ))}
      </div>

      {/* Contenido */}
      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No se pudieron cargar tus tareas.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            Reintentar
          </button>
        </div>
      ) : filteredBlocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] p-10 text-center">
          <p className="font-display text-base font-semibold text-[var(--color-text-primary)]">
            {allBlocks.length === 0
              ? "No tenés etapas activas en este momento."
              : "No hay etapas con tareas asignadas a vos."}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {allBlocks.length === 0 ? "¡Bien hecho!" : 'Probá el filtro "Todas" para ver el resto.'}
          </p>
        </div>
      ) : (
        <div className={`space-y-2 ${isFetching ? "opacity-60 transition-opacity" : ""}`} aria-busy={isFetching}>
          {filteredBlocks.map((block) => (
            <BlockRow
              key={block.stageId}
              block={block}
              expanded={expanded.has(block.stageId)}
              onToggle={() => toggle(block.stageId)}
              onSubstageClick={(sid) => goToStage(block, sid)}
              onStageClick={() => goToStage(block)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={`font-display text-lg font-bold leading-none ${
          danger
            ? "text-red-400"
            : highlight
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </span>
      <span className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] font-mono">
        {label}
      </span>
    </span>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 transition-colors ${
        active
          ? "bg-[var(--color-accent)] text-black font-semibold"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

function BlockRow({
  block,
  expanded,
  onToggle,
  onSubstageClick,
  onStageClick,
}: {
  block: MyTaskBlock;
  expanded: boolean;
  onToggle: () => void;
  onSubstageClick: (substageId: string) => void;
  onStageClick: () => void;
}) {
  const urgency = URGENCY[block.blockRank] ?? URGENCY[3];
  const stageColor = STAGE_COLORS[block.stageName] ?? { bg: "rgba(156,163,175,0.15)", text: "#9ca3af" };

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]"
      style={{ borderLeft: `4px solid ${urgency.barVar}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-card-hover)]"
      >
        <span className="shrink-0 text-[var(--color-text-muted)]">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-semibold text-[var(--color-text-primary)]">
              {block.projectName}
            </span>
            <span
              className="rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
              style={{ background: stageColor.bg, color: stageColor.text }}
            >
              {block.stageLabel}
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
              {block.projectCode}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]">
            {block.pendingSubstagesCount}{" "}
            {block.pendingSubstagesCount === 1 ? "subetapa pendiente" : "subetapas pendientes"}
            {block.myPendingSubstagesCount > 0 ? (
              <>
                <span className="mx-1 text-[var(--color-text-muted)]">·</span>
                <span className="text-[var(--color-accent)]">
                  {block.myPendingSubstagesCount}{" "}
                  {block.myPendingSubstagesCount === 1 ? "tuya" : "tuyas"}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold"
          style={{
            color: urgency.barVar,
            background: `color-mix(in srgb, ${urgency.barVar} 15%, transparent)`,
          }}
        >
          {dueLabel(block.stageDueDate, block.blockRank)}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-app)]/40">
          <ul className="divide-y divide-[var(--color-border)]">
            {block.substages.map((sub) => (
              <SubstageRow
                key={sub.id}
                sub={sub}
                onClick={() => onSubstageClick(sub.id)}
              />
            ))}
          </ul>
          <div className="border-t border-[var(--color-border)] px-4 py-2 text-right">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStageClick();
              }}
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              Abrir etapa completa →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubstageRow({ sub, onClick }: { sub: MyTaskSubstage; onClick: () => void }) {
  const statusDot =
    sub.status === "IN_PROGRESS"
      ? "bg-gradient-to-r from-[var(--color-accent)] to-transparent"
      : sub.status === "BLOCKED"
        ? "bg-red-500"
        : "bg-transparent border border-[var(--color-text-muted)]";

  const urgency = URGENCY[sub.urgencyRank] ?? URGENCY[3];

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-card-hover)]"
      >
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${statusDot}`}
          style={{ borderColor: "var(--color-text-muted)" }}
          aria-label={sub.status}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-[var(--color-text-primary)]">{sub.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
            <span style={{ color: sub.dueDate ? urgency.barVar : undefined }}>
              {dueLabel(sub.dueDate, sub.urgencyRank)}
            </span>
            {sub.checklistTotalCount > 0 ? (
              <span>
                {sub.checklistDoneCount} / {sub.checklistTotalCount} ítems
              </span>
            ) : null}
          </div>
        </div>
        {sub.assignedUser ? (
          <span
            title={sub.assignedUser.name}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              sub.assignedUser.isCurrentUser
                ? "bg-[var(--color-accent)] text-black shadow-[0_0_0_2px_rgba(251,191,36,0.35)]"
                : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
            }`}
          >
            {sub.assignedUser.initials}
          </span>
        ) : null}
        <ChevronRight size={14} className="shrink-0 text-[var(--color-text-muted)]" />
      </button>
    </li>
  );
}

// ─── Helpers React ───────────────────────────────────────────────────────────

// Inicializa algo UNA SOLA VEZ cuando la lista pasa de vacía a no vacía. Sirve
// para expandir la primera fila al cargar los datos.
function useMemoInit<T>(deps: T[], init: (deps: T[]) => void): boolean {
  const [done, setDone] = useState(false);
  if (!done && deps.length > 0) {
    init(deps);
    setDone(true);
  }
  return done;
}

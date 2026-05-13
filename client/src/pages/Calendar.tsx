import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  addSegment,
  confirmSchedule,
  createSchedule,
  deleteSchedule,
  deleteSegment,
  getCalendarMonth,
  getCalendarYear,
  getCalendarTeams,
  patchSchedule,
  patchSegment,
  rescheduleSchedule,
  type CalendarResponse,
  type CalendarTeam,
  type InstallationSchedule,
  type InstallationSegment,
} from "../api/calendar.api";
import { getProjects } from "../api/projects.api";
import { createTeam } from "../api/teams.api";
import { Button } from "../components/ui/Button";

type CalendarView = "month" | "year";

const TEAM_COLORS: string[] = [
  "#378ADD",
  "#1D9E75",
  "#D85A30",
  "#7F77DD",
  "#BA7517",
  "#888780",
];

const COMPLETED_COLOR = "#9AA0A6";

function effectiveColor(schedule: InstallationSchedule): string {
  if (schedule.operationsCompleted) return COMPLETED_COLOR;
  return schedule.team?.color ?? schedule.teamColor;
}

function displayTeamName(schedule: InstallationSchedule): string {
  if (schedule.team) return schedule.team.name;
  // Equipo soft-deleted: mostrar el snapshot
  return `${schedule.teamName} (eliminado)`;
}

const MONTHS_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MONTHS_ES_CAP = MONTHS_ES.map((m) => m.charAt(0).toUpperCase() + m.slice(1));

const DAY_HEADERS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const DAY_NAMES_LONG = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

// ─── Helpers de fechas (UTC) ──────────────────────────────────────────────────

function parseIso(str: string): Date {
  return new Date(`${str}T00:00:00Z`);
}

function formatIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function getMonday(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function getWeeksForMonth(year: number, month: number): Date[] {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDay = new Date(Date.UTC(year, month, 0));
  const firstMonday = getMonday(firstDay);
  const lastMonday = getMonday(lastDay);
  const weeks: Date[] = [];
  const cursor = new Date(firstMonday);
  while (cursor.getTime() <= lastMonday.getTime()) {
    weeks.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
}

function businessDaysInclusive(start: Date, end: Date): number {
  let count = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function formatMonthTitle(year: number, month: number): string {
  return `${MONTHS_ES_CAP[month - 1]} ${year}`;
}

function formatShortMonthName(month: number): string {
  return MONTHS_ES[month - 1];
}

function formatLongDate(date: Date): string {
  const dayName = DAY_NAMES_LONG[date.getUTCDay()];
  const day = date.getUTCDate();
  const month = MONTHS_ES[date.getUTCMonth()];
  return `${dayName} ${day} de ${month}`;
}

function formatRangeShort(startIso: string, endIso: string): string {
  const start = parseIso(startIso);
  const end = parseIso(endIso);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTHS_ES[start.getUTCMonth()];
  const endMonth = MONTHS_ES[end.getUTCMonth()];
  if (startIso === endIso) {
    return `${startDay} de ${endMonth}`;
  }
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${startDay}–${endDay} de ${endMonth}`;
  }
  return `${startDay} de ${startMonth}–${endDay} de ${endMonth}`;
}

function isColorDark(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6;
}

function formatConfirmedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

function workTypeLabel(wt: "PROPIA" | "TERCERIZADA" | null): string {
  if (wt === "PROPIA") return "Obra propia";
  if (wt === "TERCERIZADA") return "Obra tercerizada";
  return "Tipo de obra sin definir";
}

function scheduleCoversDay(schedule: InstallationSchedule, dayIso: string): boolean {
  return schedule.segments.some((seg) => dayIso >= seg.startDate && dayIso <= seg.endDate);
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function addDayIso(iso: string): string {
  const d = parseIso(iso);
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return formatIso(next);
}

function todayIsoLocal(): string {
  const now = new Date();
  return formatIso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

function computeInitials(name: string, max = 3): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .slice(0, max)
    .join("");
}

// Ancho del gap entre celdas del mini-mes (tailwind gap-[2px])
const MINI_CELL_GAP = 2;

function findScheduleForDay(
  schedules: InstallationSchedule[],
  dayIso: string,
): InstallationSchedule | null {
  for (const s of schedules) {
    if (scheduleCoversDay(s, dayIso)) return s;
  }
  return null;
}

function getInstallationsForDay(
  dayIso: string,
  installations: InstallationSchedule[],
): InstallationSchedule[] {
  return installations
    .filter((s) => scheduleCoversDay(s, dayIso))
    .sort((a, b) => a.teamName.localeCompare(b.teamName, "es"));
}

// Plan de tracks para una fila (semana). Ahora trabaja sobre SEGMENTS (no schedules):
// un mismo schedule puede tener múltiples tramos visibles, cada uno en su propio
// slot o compartiendo slot con otro schedule si el algoritmo lo permite.
//
// Empaquetado inteligente (first-fit): ordenamos todos los segments que tocan la
// semana por fecha de inicio y, para cada uno, buscamos el primer slot cuya
// "próxima fecha libre" sea ≤ segment.startDate. Esto hace que cuando un
// instalador termina una obra un día y empieza otra al día siguiente, ambas
// caen en el mismo slot visual sin dejar filas vacías arriba.
type WeekSegment = {
  scheduleId: string;
  segmentId: string;
  startDayIndex: number; // 0..6
  span: number; // días visibles en la semana
  isFirstOfSegment: boolean; // el tramo empieza en esta semana (no cruza desde antes)
  isLastOfSegment: boolean;  // el tramo termina en esta semana (no continúa)
  // Fechas reales del segment completo (útiles para drag/resize).
  segmentStart: string;
  segmentEnd: string;
};

type WeekPlan = {
  visibleTracks: Array<{ schedule: InstallationSchedule; segment: WeekSegment; slotIndex: number }>;
  overflowByDay: Map<number, number>; // dayIndex → count escondidos
  totalLanes: number;
};

type RawSegmentEntry = {
  schedule: InstallationSchedule;
  segmentId: string;
  segmentStart: string;
  segmentEnd: string;
  // Recorte a la semana para el render
  clippedStart: string;
  clippedEnd: string;
};

function computeWeekPlan(
  schedules: InstallationSchedule[],
  weekStartIso: string,
  weekEndIso: string,
  showAllUpTo: number, // hasta X slots mostramos todo (mensual=4, anual=4)
  maxVisibleWhenTruncated: number, // cuando hay más → mostramos N slots + "+X" (mensual=3, anual=3)
): WeekPlan {
  // 1. Flatten: todos los segments que tocan la semana.
  const raw: RawSegmentEntry[] = [];
  for (const schedule of schedules) {
    for (const seg of schedule.segments) {
      if (rangesOverlap(seg.startDate, seg.endDate, weekStartIso, weekEndIso)) {
        const clippedStart = seg.startDate < weekStartIso ? weekStartIso : seg.startDate;
        const clippedEnd = seg.endDate > weekEndIso ? weekEndIso : seg.endDate;
        raw.push({
          schedule,
          segmentId: seg.id,
          segmentStart: seg.startDate,
          segmentEnd: seg.endDate,
          clippedStart,
          clippedEnd,
        });
      }
    }
  }

  // 2. Ordenar por segment.startDate asc, luego teamName, luego scheduleId.
  raw.sort((a, b) => {
    if (a.segmentStart !== b.segmentStart) return a.segmentStart < b.segmentStart ? -1 : 1;
    const teamCmp = a.schedule.teamName.localeCompare(b.schedule.teamName, "es");
    if (teamCmp !== 0) return teamCmp;
    return a.schedule.id.localeCompare(b.schedule.id);
  });

  // 3. First-fit: cada slot guarda su "próxima fecha libre".
  const slotNextFree: string[] = []; // index → ISO "libre desde"
  const slotByEntryIdx: number[] = [];
  for (const entry of raw) {
    let assigned = -1;
    for (let slotIdx = 0; slotIdx < slotNextFree.length; slotIdx++) {
      const nextFree = slotNextFree[slotIdx];
      if (nextFree <= entry.segmentStart) {
        assigned = slotIdx;
        break;
      }
    }
    if (assigned === -1) {
      assigned = slotNextFree.length;
      slotNextFree.push("0000-00-00");
    }
    slotNextFree[assigned] = addDayIso(entry.segmentEnd);
    slotByEntryIdx.push(assigned);
  }

  const totalSlotsUsed = slotNextFree.length;
  const maxVisibleSlots = totalSlotsUsed <= showAllUpTo ? totalSlotsUsed : maxVisibleWhenTruncated;

  const weekStart = parseIso(weekStartIso);
  function indexFor(iso: string): number {
    return Math.floor((parseIso(iso).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  const visibleTracks: WeekPlan["visibleTracks"] = [];
  const overflowByDay = new Map<number, number>();

  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    const slot = slotByEntryIdx[i];
    const startIdx = indexFor(entry.clippedStart);
    const endIdx = indexFor(entry.clippedEnd);
    if (slot < maxVisibleSlots) {
      visibleTracks.push({
        schedule: entry.schedule,
        slotIndex: slot,
        segment: {
          scheduleId: entry.schedule.id,
          segmentId: entry.segmentId,
          startDayIndex: startIdx,
          span: endIdx - startIdx + 1,
          isFirstOfSegment: entry.segmentStart >= weekStartIso,
          isLastOfSegment: entry.segmentEnd <= weekEndIso,
          segmentStart: entry.segmentStart,
          segmentEnd: entry.segmentEnd,
        },
      });
    } else {
      for (let d = startIdx; d <= endIdx; d++) {
        overflowByDay.set(d, (overflowByDay.get(d) ?? 0) + 1);
      }
    }
  }

  // Orden estable para rendering: por slotIndex asc.
  visibleTracks.sort((a, b) => a.slotIndex - b.slotIndex);

  const totalLanes = maxVisibleSlots + (overflowByDay.size > 0 ? 1 : 0);
  return { visibleTracks, overflowByDay, totalLanes };
}

// ─── Filtro de equipos (persistente en localStorage) ──────────────────────────
// v2: almacena IDs de equipo en vez de nombres (después del refactor a entidad Team).

const TEAM_FILTER_KEY = "calendar-team-filter-v2";

function loadTeamFilter(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TEAM_FILTER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed.length > 0 ? (parsed as string[]) : null;
    }
  } catch {
    // fall through
  }
  return null;
}

function saveTeamFilter(list: string[] | null) {
  if (typeof window === "undefined") return;
  try {
    if (list === null || list.length === 0) {
      window.localStorage.removeItem(TEAM_FILTER_KEY);
    } else {
      window.localStorage.setItem(TEAM_FILTER_KEY, JSON.stringify(list));
    }
  } catch {
    // noop
  }
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function Calendar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth() + 1);
  const [view, setView] = useState<CalendarView>("month");
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[] | null>(() => loadTeamFilter());
  useEffect(() => saveTeamFilter(selectedTeams), [selectedTeams]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newModalPrefill, setNewModalPrefill] = useState<{ start: string; end: string; projectId?: string } | null>(null);
  const [showReprogram, setShowReprogram] = useState(false);
  const [moveRequest, setMoveRequest] = useState<
    | { schedule: InstallationSchedule; segmentId: string; targetStart: string; targetEnd: string }
    | null
  >(null);
  const [draggingSchedule, setDraggingSchedule] = useState<InstallationSchedule | null>(null);

  // ─── Estado específico de la vista anual (drag & resize) ──────────────────────
  const [yearDragPreview, setYearDragPreview] = useState<
    | { scheduleId: string; segmentId: string; start: string; end: string; invalid: boolean; reason: string | null }
    | null
  >(null);
  const [yearResize, setYearResize] = useState<
    | {
        scheduleId: string;
        segmentId: string;
        edge: "start" | "end";
        originalStart: string;
        originalEnd: string;
        currentStart: string;
        currentEnd: string;
      }
    | null
  >(null);
  const yearResizeRef = useRef(yearResize);
  yearResizeRef.current = yearResize;

  const todayIso = todayIsoLocal();

  // Query params:
  //   ?start=YYYY-MM-DD      → posicionar en el mes y seleccionar schedule que cubre ese día
  //   ?projectId=<id>        → buscar schedule del proyecto y seleccionarlo
  //   ?newForProject=<id>    → abrir modal de nuevo agendamiento preseleccionando el proyecto
  const lastProcessedQueryRef = useRef<string | null>(null);
  const pendingSelectStartRef = useRef<string | null>(null);
  const pendingSelectProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (location.search === lastProcessedQueryRef.current) return;
    lastProcessedQueryRef.current = location.search;

    const start = params.get("start") ?? params.get("week"); // retrocompat con ?week=
    const projectIdParam = params.get("projectId");
    const newForProject = params.get("newForProject");

    if (start) {
      const d = parseIso(start);
      setYear(d.getUTCFullYear());
      setMonth(d.getUTCMonth() + 1);
      setView("month");
      pendingSelectStartRef.current = start;
    }
    if (projectIdParam) {
      pendingSelectProjectIdRef.current = projectIdParam;
    }
    if (newForProject) {
      setNewModalPrefill({ start: "", end: "", projectId: newForProject });
      setShowNewModal(true);
    }
  }, [location.search]);

  const monthQuery = useQuery({
    queryKey: ["calendar", "month", year, month],
    queryFn: () => getCalendarMonth(year, month),
    enabled: view === "month",
  });

  const yearQuery = useQuery({
    queryKey: ["calendar", "year", year],
    queryFn: () => getCalendarYear(year),
    enabled: view === "year",
  });

  const teamsQuery = useQuery({
    queryKey: ["calendar-teams"],
    queryFn: getCalendarTeams,
  });

  const schedules = (view === "month" ? monthQuery.data?.schedules : yearQuery.data?.schedules) ?? [];

  const filteredSchedules = useMemo(() => {
    if (selectedTeams === null) return schedules;
    const set = new Set(selectedTeams);
    return schedules.filter((s) => s.teamId !== null && set.has(s.teamId));
  }, [schedules, selectedTeams]);

  const teamCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of schedules) {
      if (!s.teamId) continue;
      map.set(s.teamId, (map.get(s.teamId) ?? 0) + 1);
    }
    return map;
  }, [schedules]);

  const scheduleById = useMemo(() => {
    const map = new Map<string, InstallationSchedule>();
    for (const s of filteredSchedules) map.set(s.id, s);
    return map;
  }, [filteredSchedules]);

  const selectedSchedules = useMemo(
    () =>
      selectedScheduleIds
        .map((id) => scheduleById.get(id))
        .filter((s): s is InstallationSchedule => s != null),
    [selectedScheduleIds, scheduleById],
  );
  const primarySelected = selectedSchedules[0] ?? null;

  // Al cargar datos, si hay un pending ?start=, buscar el schedule que cubre ese día
  useEffect(() => {
    const pending = pendingSelectStartRef.current;
    if (!pending) return;
    if (schedules.length === 0) return;
    const match = schedules.find((s) => scheduleCoversDay(s, pending));
    if (match) {
      setSelectedScheduleIds([match.id]);
    }
    pendingSelectStartRef.current = null;
  }, [schedules]);

  // Al cargar datos, si hay un pending ?projectId=, buscar el schedule del proyecto
  useEffect(() => {
    const pending = pendingSelectProjectIdRef.current;
    if (!pending) return;
    if (schedules.length === 0) return;
    const match = schedules.find((s) => s.projectId === pending);
    if (match) {
      setSelectedScheduleIds([match.id]);
      const d = parseIso(match.plannedWorkStart);
      setYear(d.getUTCFullYear());
      setMonth(d.getUTCMonth() + 1);
      setView("month");
    }
    pendingSelectProjectIdRef.current = null;
  }, [schedules]);

  const moveMutation = useMutation({
    mutationFn: (args: {
      id: string;
      segmentId: string;
      plannedWorkStart: string;
      plannedWorkEnd: string;
    }) =>
      rescheduleSchedule(args.id, {
        plannedWorkStart: args.plannedWorkStart,
        plannedWorkEnd: args.plannedWorkEnd,
        segmentId: args.segmentId,
      }),
    onSuccess: (res) => {
      toast.success("Instalación reprogramada");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setSelectedScheduleIds([res.data.id]);
      setMoveRequest(null);
      setShowReprogram(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo reprogramar la instalación");
    },
  });

  // Reschedule con update optimista + rollback (para drag/resize de la vista anual).
  // Ahora reprograma un TRAMO (segment) puntual; si no viene segmentId, el backend
  // asume el único tramo que exista (compat).
  const rescheduleMutation = useMutation({
    mutationFn: (args: {
      id: string;
      segmentId?: string;
      plannedWorkStart: string;
      plannedWorkEnd: string;
    }) =>
      rescheduleSchedule(args.id, {
        plannedWorkStart: args.plannedWorkStart,
        plannedWorkEnd: args.plannedWorkEnd,
        segmentId: args.segmentId,
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["calendar"] });
      const snapshots = queryClient.getQueriesData<CalendarResponse>({ queryKey: ["calendar"] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData<CalendarResponse>(key, {
          ...data,
          schedules: data.schedules.map((s) => {
            if (s.id !== vars.id) return s;
            // Resolver qué segment mover: el indicado o (si hay 1 solo) el primero.
            const targetId = vars.segmentId ?? (s.segments.length === 1 ? s.segments[0].id : null);
            if (!targetId) return s;
            const nextSegments = s.segments.map((seg) =>
              seg.id === targetId
                ? { ...seg, startDate: vars.plannedWorkStart, endDate: vars.plannedWorkEnd }
                : seg,
            );
            const envStart = nextSegments.reduce(
              (min, seg) => (seg.startDate < min ? seg.startDate : min),
              nextSegments[0].startDate,
            );
            const envEnd = nextSegments.reduce(
              (max, seg) => (seg.endDate > max ? seg.endDate : max),
              nextSegments[0].endDate,
            );
            return {
              ...s,
              segments: nextSegments,
              plannedWorkStart: envStart,
              plannedWorkEnd: envEnd,
            };
          }),
        });
      }
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.snapshots) {
        for (const [key, data] of ctx.snapshots) {
          queryClient.setQueryData(key, data);
        }
      }
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo reprogramar la instalación");
    },
    onSuccess: (res) => {
      const env = res.data.plannedWorkStart ? parseIso(res.data.plannedWorkStart) : null;
      toast.success(env ? `Instalación movida al ${formatLongDate(env)}` : "Instalación movida");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      toast.success("Asignación eliminada");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setSelectedScheduleIds([]);
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  function dragSourceOf(e: { active: { data: { current?: Record<string, unknown> | undefined } } }): string | undefined {
    const data = e.active.data.current as { source?: string } | undefined;
    return data?.source;
  }

  function computeYearDragPreview(
    schedule: InstallationSchedule,
    segmentStart: string,
    segmentEnd: string,
    targetDay: string,
    segmentId: string,
  ): { start: string; end: string; invalid: boolean; reason: string | null } {
    const oldStart = parseIso(segmentStart);
    const oldEnd = parseIso(segmentEnd);
    const duration = daysBetweenInclusive(oldStart, oldEnd) - 1;
    const newStart = parseIso(targetDay);
    const newEnd = addDays(newStart, duration);
    const startIso = formatIso(newStart);
    const endIso = formatIso(newEnd);

    if (startIso < todayIso) {
      return { start: startIso, end: endIso, invalid: true, reason: "Fecha pasada" };
    }
    // Sólo chequeamos solape contra otros tramos del MISMO schedule.
    const overlap = schedule.segments.find(
      (seg) => seg.id !== segmentId && rangesOverlap(startIso, endIso, seg.startDate, seg.endDate),
    );
    if (overlap) {
      return {
        start: startIso,
        end: endIso,
        invalid: true,
        reason: `Se superpone con otro tramo`,
      };
    }
    return { start: startIso, end: endIso, invalid: false, reason: null };
  }

  function dragMetaOf(
    active: { data: { current?: Record<string, unknown> | undefined } },
  ): { scheduleId: string; segmentId: string; segmentStart: string; segmentEnd: string } | null {
    const data = active.data.current as
      | { scheduleId?: string; segmentId?: string; segmentStart?: string; segmentEnd?: string }
      | undefined;
    if (!data?.scheduleId || !data.segmentId || !data.segmentStart || !data.segmentEnd) return null;
    return {
      scheduleId: data.scheduleId,
      segmentId: data.segmentId,
      segmentStart: data.segmentStart,
      segmentEnd: data.segmentEnd,
    };
  }

  function handleDragStart(e: DragStartEvent) {
    const meta = dragMetaOf(e.active);
    if (!meta) return;
    const schedule = schedules.find((s) => s.id === meta.scheduleId) ?? null;
    setDraggingSchedule(schedule);
    if (schedule && dragSourceOf(e) === "year") {
      setYearDragPreview({
        scheduleId: schedule.id,
        segmentId: meta.segmentId,
        start: meta.segmentStart,
        end: meta.segmentEnd,
        invalid: false,
        reason: null,
      });
    }
  }

  function handleDragOver(e: DragOverEvent) {
    if (dragSourceOf(e) !== "year") return;
    const meta = dragMetaOf(e.active);
    if (!meta) return;
    const schedule = schedules.find((s) => s.id === meta.scheduleId);
    if (!schedule) return;
    const targetDay = e.over?.id != null ? String(e.over.id) : null;
    if (!targetDay) {
      setYearDragPreview({
        scheduleId: schedule.id,
        segmentId: meta.segmentId,
        start: meta.segmentStart,
        end: meta.segmentEnd,
        invalid: false,
        reason: null,
      });
      return;
    }
    const preview = computeYearDragPreview(schedule, meta.segmentStart, meta.segmentEnd, targetDay, meta.segmentId);
    setYearDragPreview({ scheduleId: schedule.id, segmentId: meta.segmentId, ...preview });
  }

  function handleDragEnd(e: DragEndEvent) {
    const meta = dragMetaOf(e.active);
    const targetDay = e.over?.id != null ? String(e.over.id) : null;
    const source = dragSourceOf(e);
    setDraggingSchedule(null);
    setYearDragPreview(null);
    if (!meta || !targetDay) return;
    const schedule = schedules.find((s) => s.id === meta.scheduleId);
    if (!schedule) return;
    if (meta.segmentStart === targetDay) return;

    const oldStart = parseIso(meta.segmentStart);
    const oldEnd = parseIso(meta.segmentEnd);
    const duration = daysBetweenInclusive(oldStart, oldEnd) - 1;
    const newStart = parseIso(targetDay);
    const newEnd = addDays(newStart, duration);
    const startIso = formatIso(newStart);
    const endIso = formatIso(newEnd);

    if (source === "year") {
      // Las fechas pasadas se permiten: se usan para ajustar el calendario a
      // las fechas reales en que se ejecutó la obra.
      // Sólo chequeamos solape contra otros tramos del mismo schedule.
      const overlap = schedule.segments.find(
        (seg) => seg.id !== meta.segmentId && rangesOverlap(startIso, endIso, seg.startDate, seg.endDate),
      );
      if (overlap) {
        toast.error("El tramo se superpone con otro del mismo proyecto");
        return;
      }
      rescheduleMutation.mutate({
        id: schedule.id,
        segmentId: meta.segmentId,
        plannedWorkStart: startIso,
        plannedWorkEnd: endIso,
      });
      return;
    }

    // Month view: flujo existente con diálogo de confirmación (ahora pasa segmentId).
    setMoveRequest({ schedule, segmentId: meta.segmentId, targetStart: startIso, targetEnd: endIso });
  }

  // Mouseup global: confirma el resize al soltar
  useEffect(() => {
    function onMouseUp() {
      const rs = yearResizeRef.current;
      if (!rs) return;
      setYearResize(null);

      if (rs.currentStart === rs.originalStart && rs.currentEnd === rs.originalEnd) return;
      if (rs.currentEnd < rs.currentStart) return; // rango inválido
      // Las fechas pasadas se permiten: sirven para ajustar el calendario a
      // las fechas reales en las que se ejecutó la obra.
      // Chequeo de solape: sólo contra otros TRAMOS del MISMO schedule (los tramos
      // del mismo schedule no se pueden superponer entre sí). Los tramos de
      // schedules distintos pueden coexistir en el mismo día — eso es lo que
      // permite el empaquetado inteligente.
      const schedule = schedules.find((s) => s.id === rs.scheduleId);
      if (schedule) {
        const overlap = schedule.segments.find(
          (seg) =>
            seg.id !== rs.segmentId &&
            rangesOverlap(rs.currentStart, rs.currentEnd, seg.startDate, seg.endDate),
        );
        if (overlap) {
          toast.error(`El tramo se superpone con otro del ${overlap.startDate} al ${overlap.endDate}`);
          return;
        }
      }
      rescheduleMutation.mutate({
        id: rs.scheduleId,
        segmentId: rs.segmentId,
        plannedWorkStart: rs.currentStart,
        plannedWorkEnd: rs.currentEnd,
      });
    }
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [schedules, rescheduleMutation, todayIso]);

  function startYearResize(segmentId: string, edge: "start" | "end") {
    let foundSchedule: InstallationSchedule | null = null;
    let foundSegment: InstallationSchedule["segments"][number] | null = null;
    for (const s of schedules) {
      const seg = s.segments.find((x) => x.id === segmentId);
      if (seg) {
        foundSchedule = s;
        foundSegment = seg;
        break;
      }
    }
    if (!foundSchedule || !foundSegment) return;
    setYearResize({
      scheduleId: foundSchedule.id,
      segmentId,
      edge,
      originalStart: foundSegment.startDate,
      originalEnd: foundSegment.endDate,
      currentStart: foundSegment.startDate,
      currentEnd: foundSegment.endDate,
    });
  }

  function updateYearResizeCursor(dayIso: string) {
    setYearResize((rs) => {
      if (!rs) return rs;
      if (rs.edge === "start") {
        // No cruzar el fin; mantener al menos 1 día
        const maxStart = rs.currentEnd;
        const nextStart = dayIso > maxStart ? maxStart : dayIso;
        return { ...rs, currentStart: nextStart };
      } else {
        const minEnd = rs.currentStart;
        const nextEnd = dayIso < minEnd ? minEnd : dayIso;
        return { ...rs, currentEnd: nextEnd };
      }
    });
  }

  function goPrev() {
    if (view === "year") {
      setYear(year - 1);
    } else if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedScheduleIds([]);
  }

  function goNext() {
    if (view === "year") {
      setYear(year + 1);
    } else if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedScheduleIds([]);
  }

  function handleDayClick(dayIso: string) {
    const covering = getInstallationsForDay(dayIso, filteredSchedules);
    if (covering.length > 0) {
      setSelectedScheduleIds(covering.map((s) => s.id));
    } else {
      // Prefill: inicio = ese día, fin = viernes de esa semana
      const start = parseIso(dayIso);
      const monday = getMonday(start);
      const friday = addDays(monday, 4);
      const endCandidate = friday.getTime() >= start.getTime() ? friday : start;
      setNewModalPrefill({ start: dayIso, end: formatIso(endCandidate) });
      setShowNewModal(true);
    }
  }

  function handleScheduleClick(scheduleId: string) {
    setSelectedScheduleIds([scheduleId]);
  }

  function handleYearDayClick(dayIso: string) {
    const covering = getInstallationsForDay(dayIso, filteredSchedules);
    const d = parseIso(dayIso);
    if (covering.length > 0) {
      const target = covering[0]!;
      const sd = parseIso(target.plannedWorkStart);
      setYear(sd.getUTCFullYear());
      setMonth(sd.getUTCMonth() + 1);
      setView("month");
      setSelectedScheduleIds(covering.map((s) => s.id));
    } else {
      setYear(d.getUTCFullYear());
      setMonth(d.getUTCMonth() + 1);
      setView("month");
      const monday = getMonday(d);
      const friday = addDays(monday, 4);
      const endCandidate = friday.getTime() >= d.getTime() ? friday : d;
      setNewModalPrefill({ start: dayIso, end: formatIso(endCandidate) });
      setShowNewModal(true);
    }
  }

  function handleCreated(created: InstallationSchedule) {
    const d = parseIso(created.plannedWorkStart);
    setYear(d.getUTCFullYear());
    setMonth(d.getUTCMonth() + 1);
    setView("month");
    setSelectedScheduleIds([created.id]);
    setShowNewModal(false);
    setNewModalPrefill(null);
  }

  const isLoading = view === "month" ? monthQuery.isLoading : yearQuery.isLoading;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setDraggingSchedule(null);
        setYearDragPreview(null);
      }}
    >
      {/* En desktop el contenedor toma todo el alto disponible del viewport
          (menos topbar + paddings del AppLayout ≈ 140px) y se comporta como
          flex-col para repartir ese alto entre header, filtros y calendario.
          En mobile (<md) se mantiene el flow vertical anterior. */}
      <div className="md:flex md:flex-col md:h-[calc(100dvh-140px)]">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap md:shrink-0">
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--color-text-primary)] leading-tight">
              Calendario de instalaciones
            </h1>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={goPrev}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label={view === "year" ? "Año anterior" : "Mes anterior"}
              >
                ‹
              </button>
              <span className="font-medium text-[var(--color-text-primary)]">
                {view === "month" ? formatMonthTitle(year, month) : year}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                aria-label={view === "year" ? "Año siguiente" : "Mes siguiente"}
              >
                ›
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <Button
              size="sm"
              onClick={() => {
                setNewModalPrefill(null);
                setShowNewModal(true);
              }}
            >
              + Nueva instalación
            </Button>
          </div>
        </div>

        {/* Filtros por equipo */}
        {teamsQuery.data && teamsQuery.data.length > 0 && (
          <div className="md:shrink-0">
            <TeamFilterBar
              teams={teamsQuery.data}
              selected={selectedTeams}
              onChange={setSelectedTeams}
              counts={teamCounts}
            />
          </div>
        )}

        <div className="flex gap-5 flex-col lg:flex-row md:flex-1 md:min-h-0">
          {/* Columna izquierda: calendario */}
          <div className="flex-1 min-w-0 md:min-h-0">
            {view === "month" ? (
              <MonthGrid
                year={year}
                month={month}
                schedules={filteredSchedules}
                selectedScheduleIds={selectedScheduleIds}
                onDayClick={handleDayClick}
                onScheduleClick={handleScheduleClick}
              />
            ) : (
              <YearGrid
                year={year}
                schedules={filteredSchedules}
                todayIso={todayIso}
                isYearDragActive={yearDragPreview !== null}
                draggingScheduleId={yearDragPreview?.scheduleId ?? null}
                yearResize={yearResize}
                selectedScheduleIds={selectedScheduleIds}
                onDayClick={handleYearDayClick}
                onScheduleClick={handleScheduleClick}
                onResizeStart={startYearResize}
                onResizeHover={updateYearResizeCursor}
              />
            )}
            {isLoading && (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">Cargando…</p>
            )}
          </div>

          {/* Columna derecha: panel lateral (solo en vista mensual) */}
          {view === "month" && (
            <div className="w-full lg:w-[240px] lg:shrink-0">
              <SidePanel
                selectedSchedules={selectedSchedules}
                teams={teamsQuery.data ?? []}
                onConfirm={async (id) => {
                  try {
                    await confirmSchedule(id);
                    toast.success("Fecha confirmada correctamente");
                    queryClient.invalidateQueries({ queryKey: ["calendar"] });
                  } catch {
                    toast.error("No se pudo confirmar la fecha");
                  }
                }}
                onReprogramClick={(id) => {
                  setSelectedScheduleIds([id]);
                  setShowReprogram(true);
                }}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPatch={async (id, body) => {
                  try {
                    await patchSchedule(id, body);
                    toast.success("Cambios guardados");
                    queryClient.invalidateQueries({ queryKey: ["calendar"] });
                    queryClient.invalidateQueries({ queryKey: ["calendar-teams"] });
                  } catch {
                    toast.error("No se pudieron guardar los cambios");
                  }
                }}
                onProjectClick={(projectId) => navigate(`/projects/${projectId}`)}
              />
            </div>
          )}
        </div>
      </div>

      <DragOverlay>
        {draggingSchedule ? (
          <ScheduleOverlay schedule={draggingSchedule} yearPreview={yearDragPreview} />
        ) : null}
      </DragOverlay>

      {showNewModal && (
        <NewScheduleModal
          prefill={newModalPrefill}
          teams={teamsQuery.data ?? []}
          onClose={() => {
            setShowNewModal(false);
            setNewModalPrefill(null);
          }}
          onCreated={handleCreated}
          onCreateTeamRequested={() => setShowCreateTeamModal(true)}
        />
      )}

      {showCreateTeamModal && (
        <QuickCreateTeamModal
          onClose={() => setShowCreateTeamModal(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["calendar-teams"] });
            setShowCreateTeamModal(false);
          }}
        />
      )}

      {showReprogram && primarySelected && (
        <ReprogramModal
          schedule={primarySelected}
          onCancel={() => setShowReprogram(false)}
          onConfirm={(segmentId, start, end) =>
            moveMutation.mutate({
              id: primarySelected.id,
              segmentId,
              plannedWorkStart: start,
              plannedWorkEnd: end,
            })
          }
          loading={moveMutation.isPending}
        />
      )}

      {moveRequest && (
        <MoveConfirmDialog
          clientName={moveRequest.schedule.project?.clientName ?? "el proyecto"}
          targetStart={moveRequest.targetStart}
          targetEnd={moveRequest.targetEnd}
          onCancel={() => setMoveRequest(null)}
          onConfirm={() =>
            moveMutation.mutate({
              id: moveRequest.schedule.id,
              segmentId: moveRequest.segmentId,
              plannedWorkStart: moveRequest.targetStart,
              plannedWorkEnd: moveRequest.targetEnd,
            })
          }
          loading={moveMutation.isPending}
        />
      )}
    </DndContext>
  );
}

// ─── Toggle de vista ──────────────────────────────────────────────────────────

function ViewToggle({ view, onChange }: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  return (
    <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] p-0.5 text-xs">
      {(["month", "year"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded px-2.5 py-1 font-medium transition-colors ${
            view === v
              ? "bg-[var(--color-accent)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          {v === "month" ? "Mes" : "Año"}
        </button>
      ))}
    </div>
  );
}

// ─── Leyenda de equipos ───────────────────────────────────────────────────────

function TeamFilterBar({
  teams,
  selected,
  onChange,
  counts,
}: {
  teams: CalendarTeam[];
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
  counts: Map<string, number>;
}) {
  const allActive = selected === null;
  const isSelected = (id: string) => allActive || (selected !== null && selected.includes(id));

  function toggleTeam(id: string) {
    if (allActive) {
      onChange([id]);
      return;
    }
    const current = selected ?? [];
    const next = current.includes(id)
      ? current.filter((n) => n !== id)
      : [...current, id];
    if (next.length === 0) onChange(null);
    else onChange(next);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-colors ${
          allActive
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]"
            : "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }`}
      >
        Todos
      </button>
      {teams.map((t) => {
        const sel = isSelected(t.id);
        const count = counts.get(t.id) ?? 0;
        const bg = sel && !allActive ? `${t.teamColor}26` : "var(--color-bg-card)";
        const border = sel && !allActive ? t.teamColor : "var(--color-border)";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggleTeam(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-colors ${
              sel && !allActive
                ? "text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
            style={{ background: bg, borderColor: border }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.teamColor }} />
            <span>{t.teamName}</span>
            <span className="opacity-60">({count})</span>
          </button>
        );
      })}
      {!allActive && selected !== null && (
        <span className="ml-2 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-amber-300">
          <span>Filtrando: {selected.length} {selected.length === 1 ? "equipo" : "equipos"}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-amber-200 hover:text-amber-100 underline"
          >
            Limpiar filtro
          </button>
        </span>
      )}
    </div>
  );
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

function MonthGrid({
  year,
  month,
  schedules,
  selectedScheduleIds,
  onDayClick,
  onScheduleClick,
}: {
  year: number;
  month: number;
  schedules: InstallationSchedule[];
  selectedScheduleIds: string[];
  onDayClick: (dayIso: string) => void;
  onScheduleClick: (scheduleId: string) => void;
}) {
  const weeks = useMemo(() => getWeeksForMonth(year, month), [year, month]);
  const today = new Date();
  const todayIso = formatIso(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
  );

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 md:flex md:h-full md:flex-col md:min-h-0">
      <div className="grid grid-cols-7 gap-1 mb-2 md:shrink-0">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] text-center"
          >
            {h}
          </div>
        ))}
      </div>
      {/* En desktop: grid con una fila por semana, cada semana toma 1fr del
          alto (mínimo 80px). Si el viewport no alcanza → scroll interno.
          En mobile se renderiza como stack vertical con space-y-1. */}
      <div
        className="space-y-1 md:space-y-0 md:flex-1 md:min-h-0 md:grid md:gap-1 md:overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(80px, 1fr))` }}
      >
        {weeks.map((weekStart) => (
          <WeekRow
            key={formatIso(weekStart)}
            weekStart={weekStart}
            monthNumber={month}
            todayIso={todayIso}
            schedules={schedules}
            selectedScheduleIds={selectedScheduleIds}
            onDayClick={onDayClick}
            onScheduleClick={onScheduleClick}
          />
        ))}
      </div>
    </div>
  );
}

// Altura mínima por lane en la grilla mensual. El row de la semana
// escala para que los lanes nunca sean más finos que esto.
const DAY_LANE_MIN_HEIGHT = 22;
// Altura mínima total del track area por semana (para que semanas con
// pocas barras no colapsen).
const WEEK_TRACK_AREA_MIN = 80;

function WeekRow({
  weekStart,
  monthNumber,
  todayIso,
  schedules,
  selectedScheduleIds,
  onDayClick,
  onScheduleClick,
}: {
  weekStart: Date;
  monthNumber: number;
  todayIso: string;
  schedules: InstallationSchedule[];
  selectedScheduleIds: string[];
  onDayClick: (dayIso: string) => void;
  onScheduleClick: (scheduleId: string) => void;
}) {
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) out.push(addDays(weekStart, i));
    return out;
  }, [weekStart]);
  const weekStartIso = formatIso(weekStart);
  const weekEndIso = formatIso(addDays(weekStart, 6));

  const plan = useMemo(
    () => computeWeekPlan(schedules, weekStartIso, weekEndIso, 4, 3),
    [schedules, weekStartIso, weekEndIso],
  );

  // Altura mínima de la semana: respeta el alto mínimo que necesita con sus
  // lanes para no colapsar cuando el contenedor padre también es ajustado.
  // En desktop el padre (MonthGrid) aplica minmax(80px, 1fr) y la semana
  // termina tomando 1fr del alto disponible; en mobile usa esta minHeight.
  const maxLanes = Math.max(1, plan.totalLanes);
  const minRowHeight = Math.max(WEEK_TRACK_AREA_MIN, maxLanes * DAY_LANE_MIN_HEIGHT);

  // Pills "+N más" que deben ir en el último lane del día que tiene overflow.
  const overflowEntries = Array.from(plan.overflowByDay.entries()).filter(
    ([, count]) => count > 0,
  );

  return (
    <div className="relative md:h-full md:min-h-0" style={{ minHeight: minRowHeight }}>
      {/* Capa de fondo: 7 celdas. Cada celda es droppable y tiene su badge
          con el número del día arriba a la derecha. */}
      <div className="absolute inset-0 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayIso = formatIso(day);
          const isOtherMonth = day.getUTCMonth() + 1 !== monthNumber;
          const isToday = dayIso === todayIso;
          return (
            <DayCell
              key={dayIso}
              day={day}
              dayIso={dayIso}
              isOtherMonth={isOtherMonth}
              isToday={isToday}
              onClick={() => onDayClick(dayIso)}
            />
          );
        })}
      </div>

      {/* Overlay de barras: grilla 7 cols × maxLanes rows. Cada barra es UN
          elemento posicionado con gridColumn (start + span) y gridRow
          (slotIndex + 1). Las multi-días se ven continuas porque CSS Grid
          hace que un elemento spanning cruce los gaps entre columnas.
          Arranca a 26px del top para dejar espacio al número del día. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 grid grid-cols-7 gap-1"
        style={{
          top: 26,
          gridTemplateRows: `repeat(${maxLanes}, 1fr)`,
        }}
      >
        {plan.visibleTracks.map((track) => (
          <MonthTrackBlock
            key={track.segment.segmentId}
            schedule={track.schedule}
            segment={track.segment}
            slotIndex={track.slotIndex}
            isSelected={selectedScheduleIds.includes(track.schedule.id)}
            onClick={() => onScheduleClick(track.schedule.id)}
          />
        ))}
        {overflowEntries.map(([dayIdx, count]) => {
          const dayIso = formatIso(days[dayIdx]);
          return (
            <button
              key={`overflow-${dayIso}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDayClick(dayIso);
              }}
              title={`+${count} más`}
              className="flex items-center justify-center rounded text-[9px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-app)] hover:bg-[var(--color-bg-card-hover)]"
              style={{
                gridColumn: `${dayIdx + 1} / span 1`,
                gridRow: `${maxLanes} / span 1`,
                pointerEvents: "auto",
              }}
            >
              +{count} más
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayCell({
  day,
  dayIso,
  isOtherMonth,
  isToday,
  onClick,
}: {
  day: Date;
  dayIso: string;
  isOtherMonth: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayIso });
  return (
    <div
      ref={setNodeRef}
      className={`relative h-full w-full rounded border border-[var(--color-border)] transition-colors ${
        isOtherMonth ? "bg-[var(--color-bg-app)]" : ""
      } ${isOver ? "outline outline-2 outline-[var(--color-accent-hover)]" : ""}`}
    >
      {/* Área clickeable de fondo (crea scheduling nuevo si no hay barras). */}
      <button
        type="button"
        onClick={onClick}
        aria-label={`Día ${day.getUTCDate()}`}
        className="absolute inset-0 h-full w-full rounded hover:bg-[var(--color-bg-card-hover)]"
      />

      {/* Número del día en la franja superior reservada (26px). Las barras
          arrancan debajo, así que no hace falta badge oscuro de fondo. */}
      <span
        className="pointer-events-none absolute right-2 top-1.5 z-20 font-semibold tabular-nums"
        style={{
          fontSize: 11,
          color: "var(--color-text-primary)",
        }}
      >
        {day.getUTCDate()}
        {isToday ? (
          <span
            className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
            style={{ background: "var(--color-accent)" }}
          />
        ) : null}
      </span>
    </div>
  );
}

function MonthTrackBlock({
  schedule,
  segment,
  slotIndex,
  isSelected,
  onClick,
}: {
  schedule: InstallationSchedule;
  segment: WeekSegment;
  slotIndex: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isDraggable = segment.isFirstOfSegment;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: segment.segmentId,
    disabled: !isDraggable,
    data: {
      source: "month",
      scheduleId: schedule.id,
      segmentId: segment.segmentId,
      segmentStart: segment.segmentStart,
      segmentEnd: segment.segmentEnd,
    },
  });
  const color = effectiveColor(schedule);
  const textDark = !isColorDark(color);
  const clientName = schedule.project?.clientName ?? "Sin proyecto";

  const style: CSSProperties = {
    gridColumn: `${segment.startDayIndex + 1} / span ${segment.span}`,
    gridRow: `${slotIndex + 1} / span 1`,
    background: color,
    borderTopLeftRadius: segment.isFirstOfSegment ? 6 : 2,
    borderBottomLeftRadius: segment.isFirstOfSegment ? 6 : 2,
    borderTopRightRadius: segment.isLastOfSegment ? 6 : 2,
    borderBottomRightRadius: segment.isLastOfSegment ? 6 : 2,
    outline: isSelected ? "2px solid var(--color-accent)" : undefined,
    outlineOffset: isSelected ? "-2px" : undefined,
    pointerEvents: "auto",
    opacity: isDragging ? 0.4 : 1,
    minHeight: 0,
  };

  return (
    <div
      ref={setNodeRef}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={`${clientName} · ${displayTeamName(schedule)}`}
      className={`flex items-center overflow-hidden ${
        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
      style={style}
    >
      {segment.isFirstOfSegment ? (
        <span
          className={`truncate font-medium ${textDark ? "text-[#0c3b6e]" : "text-white"}`}
          style={{ fontSize: 9, padding: "1px 4px" }}
        >
          {clientName}
        </span>
      ) : null}
    </div>
  );
}

// Agrupa tracks por slotIndex preservando el orden (slot 0 arriba). Se usa
// todavía en la vista anual (MiniMonth / YearTrackBlock). La vista mensual
// ya no la necesita: cada día distribuye sus propias barras.
function groupTracksBySlot<T extends { slotIndex: number }>(tracks: T[]): T[][] {
  if (tracks.length === 0) return [];
  const maxSlot = Math.max(...tracks.map((t) => t.slotIndex));
  const rows: T[][] = [];
  for (let i = 0; i <= maxSlot; i++) rows.push([]);
  for (const t of tracks) rows[t.slotIndex].push(t);
  return rows.filter((r) => r.length > 0);
}

function ScheduleOverlay({
  schedule,
  yearPreview,
}: {
  schedule: InstallationSchedule;
  yearPreview?: { start: string; end: string; invalid: boolean; reason: string | null } | null;
}) {
  const color = effectiveColor(schedule);
  const textDark = !isColorDark(color);
  return (
    <div
      className={`rounded-md px-3 py-2 text-xs font-medium shadow-lg ${
        textDark ? "text-[#0c3b6e]" : "text-white"
      }`}
      style={{ background: color, minWidth: 180, opacity: 0.9 }}
    >
      {schedule.project?.clientName ?? "Instalación"}
      <p className="text-[10px] opacity-80 mt-0.5">{displayTeamName(schedule)}</p>
      {yearPreview ? (
        <p
          className={`text-[10px] mt-1 ${
            yearPreview.invalid ? (textDark ? "text-red-700" : "text-red-200") : "opacity-90"
          }`}
        >
          {yearPreview.invalid
            ? yearPreview.reason
            : `Inicio: ${formatRangeShort(yearPreview.start, yearPreview.start)} · Fin: ${formatRangeShort(yearPreview.end, yearPreview.end)}`}
        </p>
      ) : null}
    </div>
  );
}

// ─── YearGrid (vista anual) ───────────────────────────────────────────────────

type YearResizeState = {
  scheduleId: string;
  segmentId: string;
  edge: "start" | "end";
  originalStart: string;
  originalEnd: string;
  currentStart: string;
  currentEnd: string;
};

function YearGrid({
  year,
  schedules,
  todayIso,
  isYearDragActive,
  draggingScheduleId,
  yearResize,
  selectedScheduleIds,
  onDayClick,
  onScheduleClick,
  onResizeStart,
  onResizeHover,
}: {
  year: number;
  schedules: InstallationSchedule[];
  todayIso: string;
  isYearDragActive: boolean;
  draggingScheduleId: string | null;
  yearResize: YearResizeState | null;
  selectedScheduleIds: string[];
  onDayClick: (dayIso: string) => void;
  onScheduleClick: (scheduleId: string) => void;
  onResizeStart: (scheduleId: string, edge: "start" | "end") => void;
  onResizeHover: (dayIso: string) => void;
}) {
  // Aplicar preview del resize a los horarios para el render en tiempo real:
  // actualizamos el segment que se está redimensionando y recalculamos el envelope.
  const effective = useMemo(() => {
    if (!yearResize) return schedules;
    return schedules.map((s) => {
      if (s.id !== yearResize.scheduleId) return s;
      const nextSegments = s.segments.map((seg) =>
        seg.id === yearResize.segmentId
          ? { ...seg, startDate: yearResize.currentStart, endDate: yearResize.currentEnd }
          : seg,
      );
      if (nextSegments.length === 0) return s;
      const envStart = nextSegments.reduce(
        (min, seg) => (seg.startDate < min ? seg.startDate : min),
        nextSegments[0].startDate,
      );
      const envEnd = nextSegments.reduce(
        (max, seg) => (seg.endDate > max ? seg.endDate : max),
        nextSegments[0].endDate,
      );
      return { ...s, segments: nextSegments, plannedWorkStart: envStart, plannedWorkEnd: envEnd };
    });
  }, [schedules, yearResize]);

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      style={yearResize ? { cursor: "ew-resize", userSelect: "none" } : undefined}
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <MiniMonth
          key={m}
          year={year}
          month={m}
          schedules={effective}
          todayIso={todayIso}
          isYearDragActive={isYearDragActive}
          draggingScheduleId={draggingScheduleId}
          yearResize={yearResize}
          selectedScheduleIds={selectedScheduleIds}
          onDayClick={onDayClick}
          onScheduleClick={onScheduleClick}
          onResizeStart={onResizeStart}
          onResizeHover={onResizeHover}
        />
      ))}
    </div>
  );
}

const MINI_TRACK_GAP = 1;
function miniSlotHeight(totalLanes: number): number {
  if (totalLanes <= 1) return 18;
  if (totalLanes === 2) return 11;
  if (totalLanes === 3) return 8;
  return 6; // 4 slots en la vista anual
}

function MiniMonth({
  year,
  month,
  schedules,
  todayIso,
  isYearDragActive,
  draggingScheduleId,
  yearResize,
  selectedScheduleIds,
  onDayClick,
  onScheduleClick,
  onResizeStart,
  onResizeHover,
}: {
  year: number;
  month: number;
  schedules: InstallationSchedule[];
  todayIso: string;
  isYearDragActive: boolean;
  draggingScheduleId: string | null;
  yearResize: YearResizeState | null;
  selectedScheduleIds: string[];
  onDayClick: (dayIso: string) => void;
  onScheduleClick: (scheduleId: string) => void;
  onResizeStart: (scheduleId: string, edge: "start" | "end") => void;
  onResizeHover: (dayIso: string) => void;
}) {
  const weeks = useMemo(() => getWeeksForMonth(year, month), [year, month]);

  // Medir ancho de celda (todas las celdas comparten ancho por ser grid-cols-7)
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [cellWidth, setCellWidth] = useState(0);
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      const total = el.clientWidth;
      const next = (total - MINI_CELL_GAP * 6) / 7;
      setCellWidth(next);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2">
      <p className="font-display text-[11px] font-semibold text-[var(--color-text-primary)] mb-1.5 text-center">
        {MONTHS_ES_CAP[month - 1]}
      </p>
      <div ref={gridRef} className="grid grid-cols-7 gap-[2px] mb-1">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="font-mono text-[8px] uppercase text-[var(--color-text-muted)] text-center"
          >
            {h.charAt(0)}
          </div>
        ))}
      </div>
      <div className="space-y-[2px]">
        {weeks.map((weekStart) => (
          <MiniWeekRow
            key={formatIso(weekStart)}
            weekStart={weekStart}
            month={month}
            todayIso={todayIso}
            schedules={schedules}
            cellWidth={cellWidth}
            isYearDragActive={isYearDragActive}
            draggingScheduleId={draggingScheduleId}
            yearResize={yearResize}
            selectedScheduleIds={selectedScheduleIds}
            onDayClick={onDayClick}
            onScheduleClick={onScheduleClick}
            onResizeStart={onResizeStart}
            onResizeHover={onResizeHover}
          />
        ))}
      </div>
    </div>
  );
}

function MiniWeekRow({
  weekStart,
  month,
  todayIso,
  schedules,
  cellWidth,
  isYearDragActive,
  draggingScheduleId,
  yearResize,
  selectedScheduleIds,
  onDayClick,
  onScheduleClick,
  onResizeStart,
  onResizeHover,
}: {
  weekStart: Date;
  month: number;
  todayIso: string;
  schedules: InstallationSchedule[];
  cellWidth: number;
  isYearDragActive: boolean;
  draggingScheduleId: string | null;
  yearResize: YearResizeState | null;
  selectedScheduleIds: string[];
  onDayClick: (dayIso: string) => void;
  onScheduleClick: (scheduleId: string) => void;
  onResizeStart: (scheduleId: string, edge: "start" | "end") => void;
  onResizeHover: (dayIso: string) => void;
}) {
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 7; i++) out.push(addDays(weekStart, i));
    return out;
  }, [weekStart]);
  const weekStartIso = formatIso(weekStart);
  const weekEndIso = formatIso(addDays(weekStart, 6));

  const plan = useMemo(
    () => computeWeekPlan(schedules, weekStartIso, weekEndIso, 4, 3),
    [schedules, weekStartIso, weekEndIso],
  );

  const slotH = miniSlotHeight(plan.totalLanes);
  const tracksHeight = plan.totalLanes * slotH + Math.max(0, plan.totalLanes - 1) * MINI_TRACK_GAP;
  const rowHeight = Math.max(20, tracksHeight);

  return (
    <div className="relative" style={{ height: rowHeight }}>
      {/* Fondo: 7 celdas como drop targets + click para crear/seleccionar */}
      <div className="absolute inset-0 grid grid-cols-7 gap-[2px]">
        {days.map((day) => {
          const dayIso = formatIso(day);
          const isOtherMonth = day.getUTCMonth() + 1 !== month;
          const isToday = dayIso === todayIso;
          const isPast = dayIso < todayIso;
          const dayCovered = scheduleCoversAnyOther(schedules, dayIso, draggingScheduleId);
          const invalid = isYearDragActive && (isPast || dayCovered);
          return (
            <MiniDayBackground
              key={dayIso}
              day={day}
              dayIso={dayIso}
              isOtherMonth={isOtherMonth}
              isToday={isToday}
              isYearDragActive={isYearDragActive}
              invalidDropTarget={invalid}
              yearResizeActive={yearResize !== null}
              onClick={() => onDayClick(dayIso)}
              onMouseEnter={() => yearResize && onResizeHover(dayIso)}
            />
          );
        })}
      </div>

      {/* Tracks apilados encima */}
      <div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          top: 0,
          height: rowHeight,
          pointerEvents: "none",
        }}
      >
        {groupTracksBySlot(plan.visibleTracks).map((tracksInSlot, rowIdx) => (
          <div
            key={`mini-slot-${rowIdx}`}
            className="grid grid-cols-7 gap-[2px]"
            style={{
              height: slotH,
              marginBottom: rowIdx < plan.totalLanes - 1 ? MINI_TRACK_GAP : 0,
            }}
          >
            {tracksInSlot.map((track) => (
              <YearTrackBlock
                key={track.segment.segmentId}
                schedule={track.schedule}
                segment={track.segment}
                slotHeight={slotH}
                cellWidth={cellWidth}
                isSelected={selectedScheduleIds.includes(track.schedule.id)}
                resizingSomething={yearResize !== null}
                onClick={() => onScheduleClick(track.schedule.id)}
                onResizeStart={onResizeStart}
              />
            ))}
          </div>
        ))}
        {plan.overflowByDay.size > 0 && (
          <div className="grid grid-cols-7 gap-[2px]" style={{ height: slotH }}>
            {days.map((day, idx) => {
              const count = plan.overflowByDay.get(idx) ?? 0;
              if (count === 0) return <div key={formatIso(day)} />;
              const dayIso = formatIso(day);
              return (
                <button
                  key={dayIso}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDayClick(dayIso);
                  }}
                  title={`+${count} más`}
                  className="rounded-[2px] text-[7px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-app)] hover:bg-[var(--color-bg-card-hover)]"
                  style={{ pointerEvents: "auto" }}
                >
                  +{count}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function scheduleCoversAnyOther(
  schedules: InstallationSchedule[],
  dayIso: string,
  excludeId: string | null,
): boolean {
  for (const s of schedules) {
    if (excludeId && s.id === excludeId) continue;
    if (scheduleCoversDay(s, dayIso)) return true;
  }
  return false;
}

function MiniDayBackground({
  day,
  dayIso,
  isOtherMonth,
  isToday,
  isYearDragActive,
  invalidDropTarget,
  yearResizeActive,
  onClick,
  onMouseEnter,
}: {
  day: Date;
  dayIso: string;
  isOtherMonth: boolean;
  isToday: boolean;
  isYearDragActive: boolean;
  invalidDropTarget: boolean;
  yearResizeActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayIso });
  const tooltip = `${day.getUTCDate()} de ${MONTHS_ES[day.getUTCMonth()]}`;
  const dragHint = isYearDragActive
    ? invalidDropTarget
      ? "outline outline-1 outline-red-400/60 bg-red-400/15"
      : isOver
        ? "outline outline-1 outline-green-400/70"
        : ""
    : "";
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      title={tooltip}
      aria-label={tooltip}
      className={`relative h-full w-full rounded-[2px] transition-colors ${
        isOtherMonth
          ? "bg-transparent hover:bg-[var(--color-bg-card-hover)]"
          : "bg-[var(--color-bg-app)] hover:bg-[var(--color-bg-card-hover)]"
      } ${dragHint} ${yearResizeActive ? "cursor-ew-resize" : ""}`}
    >
      {isToday ? (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
        </span>
      ) : null}
    </button>
  );
}

function YearTrackBlock({
  schedule,
  segment,
  slotHeight,
  cellWidth,
  isSelected,
  resizingSomething,
  onClick,
  onResizeStart,
}: {
  schedule: InstallationSchedule;
  segment: WeekSegment;
  slotHeight: number;
  cellWidth: number;
  isSelected: boolean;
  resizingSomething: boolean;
  onClick: () => void;
  onResizeStart: (scheduleId: string, edge: "start" | "end") => void;
}) {
  const isDraggable = segment.isFirstOfSegment;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: segment.segmentId,
    data: {
      source: "year",
      scheduleId: schedule.id,
      segmentId: segment.segmentId,
      segmentStart: segment.segmentStart,
      segmentEnd: segment.segmentEnd,
    },
    disabled: !isDraggable,
  });
  const color = effectiveColor(schedule);
  const clientName = schedule.project?.clientName ?? "Sin proyecto";

  // Texto: tier según ancho del segmento
  let text: string | null = null;
  if (segment.isFirstOfSegment && cellWidth > 0) {
    const segWidth = cellWidth * segment.span + MINI_CELL_GAP * (segment.span - 1);
    if (segWidth >= 60) text = clientName;
    else if (segWidth >= 30) text = computeInitials(clientName, 3);
  }

  const style: CSSProperties = {
    gridColumn: `${segment.startDayIndex + 1} / span ${segment.span}`,
    background: color,
    height: slotHeight,
    borderTopLeftRadius: segment.isFirstOfSegment ? 3 : 1,
    borderBottomLeftRadius: segment.isFirstOfSegment ? 3 : 1,
    borderTopRightRadius: segment.isLastOfSegment ? 3 : 1,
    borderBottomRightRadius: segment.isLastOfSegment ? 3 : 1,
    outline: isSelected ? "1.5px solid var(--color-accent)" : undefined,
    outlineOffset: isSelected ? "-1.5px" : undefined,
    pointerEvents: resizingSomething ? "none" : "auto",
    opacity: isDragging ? 0.4 : 1,
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      {...(isDraggable ? listeners : {})}
      {...(isDraggable ? attributes : {})}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title={`${clientName} · ${displayTeamName(schedule)} · ${formatRangeShort(segment.segmentStart, segment.segmentEnd)}`}
      className={`flex items-center overflow-hidden ${
        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
      style={style}
    >
      {text && slotHeight >= 11 ? (
        <span
          className="font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full"
          style={{
            fontSize: 9,
            fontWeight: 500,
            padding: "0 3px",
            filter: "brightness(0.4)",
            color,
          }}
        >
          {text}
        </span>
      ) : null}

      {segment.isFirstOfSegment ? (
        <span
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart(schedule.id, "start");
          }}
          className="absolute left-0 top-0 h-full w-[4px] cursor-ew-resize z-[3]"
          style={{ background: "rgba(0,0,0,0.25)" }}
          aria-label="Cambiar fecha de inicio"
        />
      ) : null}
      {segment.isLastOfSegment ? (
        <span
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onResizeStart(schedule.id, "end");
          }}
          className="absolute right-0 top-0 h-full w-[4px] cursor-ew-resize z-[3]"
          style={{ background: "rgba(0,0,0,0.25)" }}
          aria-label="Cambiar fecha de fin"
        />
      ) : null}
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function SidePanel({
  selectedSchedules,
  teams,
  onConfirm,
  onReprogramClick,
  onDelete,
  onPatch,
  onProjectClick,
}: {
  selectedSchedules: InstallationSchedule[];
  teams: CalendarTeam[];
  onConfirm: (id: string) => void;
  onReprogramClick: (id: string) => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, body: { teamId?: string; notes?: string | null }) => Promise<void>;
  onProjectClick: (projectId: string) => void;
}) {
  if (selectedSchedules.length === 0) {
    return (
      <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Seleccioná una instalación para ver el detalle.
        </p>
      </aside>
    );
  }

  if (selectedSchedules.length === 1) {
    return (
      <ScheduleDetail
        schedule={selectedSchedules[0]!}
        teams={teams}
        onConfirm={onConfirm}
        onReprogramClick={() => onReprogramClick(selectedSchedules[0]!.id)}
        onDelete={onDelete}
        onPatch={onPatch}
        onProjectClick={onProjectClick}
      />
    );
  }

  const minStart = selectedSchedules.reduce(
    (acc, s) => (s.plannedWorkStart < acc ? s.plannedWorkStart : acc),
    selectedSchedules[0]!.plannedWorkStart,
  );
  const maxEnd = selectedSchedules.reduce(
    (acc, s) => (s.plannedWorkEnd > acc ? s.plannedWorkEnd : acc),
    selectedSchedules[0]!.plannedWorkEnd,
  );

  return (
    <aside className="space-y-2">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2">
        <p className="text-[11px] font-medium text-[var(--color-text-primary)]">
          {formatRangeShort(minStart, maxEnd)} · {selectedSchedules.length} obras
        </p>
      </div>
      {selectedSchedules.map((s) => (
        <ScheduleDetail
          key={s.id}
          schedule={s}
          teams={teams}
          onConfirm={onConfirm}
          onReprogramClick={() => onReprogramClick(s.id)}
          onDelete={onDelete}
          onPatch={onPatch}
          onProjectClick={onProjectClick}
        />
      ))}
    </aside>
  );
}

function SegmentsSection({ schedule }: { schedule: InstallationSchedule }) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
  }

  function handleApiError(err: unknown, fallback: string) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
    toast.error(msg ?? fallback);
  }

  const addMutation = useMutation({
    mutationFn: (body: { startDate: string; endDate: string }) => addSegment(schedule.id, body),
    onSuccess: () => {
      toast.success("Tramo agregado");
      setAdding(false);
      invalidate();
    },
    onError: (err) => handleApiError(err, "No se pudo agregar el tramo"),
  });

  const editMutation = useMutation({
    mutationFn: (args: { id: string; startDate: string; endDate: string }) =>
      patchSegment(schedule.id, args.id, { startDate: args.startDate, endDate: args.endDate }),
    onSuccess: () => {
      toast.success("Tramo actualizado");
      setEditingId(null);
      invalidate();
    },
    onError: (err) => handleApiError(err, "No se pudo actualizar el tramo"),
  });

  const deleteMutation = useMutation({
    mutationFn: (segmentId: string) => deleteSegment(schedule.id, segmentId),
    onSuccess: () => {
      toast.success("Tramo eliminado");
      setConfirmDeleteId(null);
      invalidate();
    },
    onError: (err) => handleApiError(err, "No se pudo eliminar el tramo"),
  });

  function durationDays(seg: InstallationSegment): number {
    return daysBetweenInclusive(parseIso(seg.startDate), parseIso(seg.endDate));
  }

  const canDelete = schedule.segments.length > 1;

  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">
        Tramos de obra
      </p>
      <div className="space-y-1.5">
        {schedule.segments.map((seg) => (
          <div
            key={seg.id}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5"
          >
            {editingId === seg.id ? (
              <SegmentEditor
                initialStart={seg.startDate}
                initialEnd={seg.endDate}
                busy={editMutation.isPending}
                onCancel={() => setEditingId(null)}
                onSubmit={(startDate, endDate) =>
                  editMutation.mutate({ id: seg.id, startDate, endDate })
                }
              />
            ) : confirmDeleteId === seg.id ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--color-danger-text)]">¿Eliminar este tramo?</p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => deleteMutation.mutate(seg.id)}
                    loading={deleteMutation.isPending}
                  >
                    Sí
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                    No
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-primary)]">
                    {formatRangeShort(seg.startDate, seg.endDate)}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {" "}· {durationDays(seg)} {durationDays(seg) === 1 ? "día" : "días"}
                  </span>
                </div>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditingId(seg.id)}
                    title="Editar tramo"
                    className="rounded px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    disabled={!canDelete}
                    onClick={() => setConfirmDeleteId(seg.id)}
                    title={canDelete ? "Eliminar tramo" : "No se puede eliminar el último tramo"}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      canDelete
                        ? "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
                        : "text-[var(--color-text-muted)] opacity-40 cursor-not-allowed"
                    }`}
                  >
                    🗑
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding ? (
          <div className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5">
            <SegmentEditor
              initialStart=""
              initialEnd=""
              busy={addMutation.isPending}
              onCancel={() => setAdding(false)}
              onSubmit={(startDate, endDate) => addMutation.mutate({ startDate, endDate })}
            />
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => setAdding(true)}
          >
            + Agregar tramo
          </Button>
        )}
      </div>
    </div>
  );
}

function SegmentEditor({
  initialStart,
  initialEnd,
  busy,
  onCancel,
  onSubmit,
}: {
  initialStart: string;
  initialEnd: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (startDate: string, endDate: string) => void;
}) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const invalid = Boolean(start && end && end < start);
  const disabled = !start || !end || invalid || busy;

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="date"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] px-1.5 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          type="date"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] px-1.5 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      {invalid ? (
        <p className="text-[10px] text-[var(--color-danger-text)]">
          Fin no puede ser anterior al inicio
        </p>
      ) : null}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          disabled={disabled}
          loading={busy}
          onClick={() => onSubmit(start, end)}
          className="flex-1"
        >
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function ScheduleDetail({
  schedule,
  teams,
  onConfirm,
  onReprogramClick,
  onDelete,
  onPatch,
  onProjectClick,
}: {
  schedule: InstallationSchedule;
  teams: CalendarTeam[];
  onConfirm: (id: string) => void;
  onReprogramClick: () => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, body: { teamId?: string; notes?: string | null }) => Promise<void>;
  onProjectClick: (projectId: string) => void;
}) {
  const [teamId, setTeamId] = useState<string>(schedule.teamId ?? "");
  const [notes, setNotes] = useState(schedule.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTeamId(schedule.teamId ?? "");
    setNotes(schedule.notes ?? "");
    setConfirmDelete(false);
  }, [schedule.id, schedule.teamId, schedule.notes]);

  const dirty =
    teamId !== (schedule.teamId ?? "") ||
    (notes ?? "") !== (schedule.notes ?? "");

  const blockColor = effectiveColor(schedule);
  const textDark = !isColorDark(blockColor);
  const confirmed = Boolean(schedule.confirmedAt);

  const envelopeStart = schedule.plannedWorkStart;
  const envelopeEnd = schedule.plannedWorkEnd;
  const startDate = envelopeStart ? parseIso(envelopeStart) : null;
  const endDate = envelopeEnd ? parseIso(envelopeEnd) : null;
  const businessDays =
    startDate && endDate ? businessDaysInclusive(startDate, endDate) : 0;

  async function handleSave() {
    setSaving(true);
    try {
      const body: { teamId?: string; notes?: string | null } = {
        notes: notes.trim() ? notes.trim() : null,
      };
      if (teamId && teamId !== (schedule.teamId ?? "")) body.teamId = teamId;
      await onPatch(schedule.id, body);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 space-y-3">
      <div>
        <div className="space-y-0.5 text-[11px] text-[var(--color-text-secondary)]">
          <p>
            <span className="text-[var(--color-text-muted)]">Inicio:</span>{" "}
            {startDate ? formatLongDate(startDate) : "—"}
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Fin:</span>{" "}
            {endDate ? formatLongDate(endDate) : "—"}
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Duración:</span>{" "}
            {businessDays} {businessDays === 1 ? "día hábil" : "días hábiles"}
            {schedule.segments.length > 1
              ? ` · ${schedule.segments.length} tramos`
              : ""}
          </p>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {confirmed ? (
            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-[var(--color-state-done-text)] bg-[var(--color-state-done-bg)]">
              Confirmada
            </span>
          ) : (
            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]">
              Sin confirmar
            </span>
          )}
          {schedule.operationsCompleted && (
            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-[var(--color-state-done-text)] bg-[var(--color-state-done-bg)]">
              Obra finalizada
            </span>
          )}
        </div>
      </div>

      {schedule.project && (
        <button
          type="button"
          onClick={() => schedule.project && onProjectClick(schedule.project.id)}
          className="block w-full rounded-md p-2.5 text-left transition-opacity hover:opacity-90"
          style={{ background: blockColor, color: textDark ? "#0c3b6e" : "#ffffff" }}
        >
          <p className="text-xs font-medium leading-tight">{schedule.project.clientName}</p>
          <p className="text-[10px] opacity-80 mt-0.5">{displayTeamName(schedule)}</p>
          <p className="text-[10px] opacity-80">
            {schedule.project.capacityKwp} kWp · {schedule.project.locationCity}
          </p>
          <p className="text-[10px] opacity-80">{workTypeLabel(schedule.project.workType)}</p>
        </button>
      )}

      <div>
        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">
          Equipo
        </p>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
        >
          {!schedule.team && schedule.teamId === null && (
            <option value="">{schedule.teamName} (eliminado)</option>
          )}
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.teamName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">
          Notas
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSave}
          disabled={!dirty || saving}
          loading={saving}
          className="mt-2 w-full"
        >
          Guardar
        </Button>
      </div>

      {!confirmed ? (
        <button
          type="button"
          onClick={() => onConfirm(schedule.id)}
          className="w-full rounded-md bg-[#1F7A3A] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Confirmar fecha
        </button>
      ) : (
        <p className="text-[10px] text-[var(--color-state-done-text)]">
          Confirmada{" "}
          {schedule.confirmedByUser ? `por ${schedule.confirmedByUser.name} ` : ""}
          el {formatConfirmedAt(schedule.confirmedAt)}
        </p>
      )}

      <SegmentsSection schedule={schedule} />

      <Button size="sm" variant="secondary" onClick={onReprogramClick} className="w-full">
        Reprogramar
      </Button>

      {confirmDelete ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] text-[var(--color-danger-text)]">
            ¿Eliminar la asignación?
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="danger"
              onClick={() => onDelete(schedule.id)}
              className="flex-1"
            >
              Sí, eliminar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="text-[11px] text-[var(--color-danger-text)] hover:opacity-80"
        >
          Eliminar asignación
        </button>
      )}
    </aside>
  );
}

// ─── Modales ──────────────────────────────────────────────────────────────────

function ModalShell({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-xl"
      >
        <h2 className="font-display text-base font-bold text-[var(--color-text-primary)] mb-4">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function DateRangeFields({
  start,
  end,
  onChangeStart,
  onChangeEnd,
}: {
  start: string;
  end: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
}) {
  const rangeInvalid = Boolean(start && end && end < start);
  const businessDays =
    start && end && !rangeInvalid
      ? businessDaysInclusive(parseIso(start), parseIso(end))
      : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Fecha inicio
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => onChangeStart(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Fecha fin
          </label>
          <input
            type="date"
            value={end}
            onChange={(e) => onChangeEnd(e.target.value)}
            min={start || undefined}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            required
          />
        </div>
      </div>
      {rangeInvalid ? (
        <p className="text-[10px] text-red-400">
          La fecha de fin debe ser posterior al inicio
        </p>
      ) : businessDays !== null ? (
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Duración: {businessDays} {businessDays === 1 ? "día hábil" : "días hábiles"}
        </p>
      ) : null}
    </div>
  );
}

function QuickCreateTeamModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TEAM_COLORS[0]!);
  const [type, setType] = useState<"PROPIO" | "TERCERIZADO">("PROPIO");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createTeam({ name: name.trim(), color, type }),
    onSuccess: () => {
      toast.success("Equipo creado");
      onCreated();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo crear el equipo");
    },
  });

  return (
    <ModalShell title="Nuevo equipo" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && !mutation.isPending) mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Color
          </label>
          <div className="flex gap-1.5">
            {TEAM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  color.toLowerCase() === c.toLowerCase()
                    ? "scale-110 ring-2 ring-[var(--color-accent)]"
                    : ""
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Tipo de equipo
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "PROPIO" | "TERCERIZADO")}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="PROPIO">Equipo propio</option>
            <option value="TERCERIZADO">Tercerizado</option>
          </select>
        </div>
        {error && <p className="text-xs text-[var(--color-danger-text)]">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" type="submit" disabled={!name.trim()} loading={mutation.isPending}>
            Crear equipo
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function NewScheduleModal({
  prefill,
  teams,
  onClose,
  onCreated,
  onCreateTeamRequested,
}: {
  prefill: { start: string; end: string; projectId?: string } | null;
  teams: CalendarTeam[];
  onClose: () => void;
  onCreated: (s: InstallationSchedule) => void;
  onCreateTeamRequested: () => void;
}) {
  const queryClient = useQueryClient();
  // Trae solo proyectos agendables: sin InstallationSchedule activo y en
  // estado no terminal. El filtro lo aplica el backend; el queryKey distinto
  // garantiza que no pisa el cache global de ["projects"].
  const projectsQuery = useQuery({
    queryKey: ["projects", { schedulable: true }],
    queryFn: () => getProjects({ schedulable: true }),
  });
  const prefillProjectId = prefill?.projectId ?? "";
  // Si el modal viene con un projectId prefill que el filtro descartó (caso
  // raro de race condition con el cache), lo dejamos disponible para que el
  // form muestre la selección. El resto ya viene filtrado del servidor.
  const availableProjects = (projectsQuery.data ?? [])
    .slice()
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));

  const [projectId, setProjectId] = useState(prefillProjectId);
  const [plannedWorkStart, setPlannedWorkStart] = useState(prefill?.start ?? "");
  const [plannedWorkEnd, setPlannedWorkEnd] = useState(prefill?.end ?? "");
  const [teamId, setTeamId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createSchedule({
        projectId,
        teamId,
        notes: notes.trim() ? notes.trim() : null,
        segments: [{ startDate: plannedWorkStart, endDate: plannedWorkEnd }],
      }),
    onSuccess: (res) => {
      toast.success("Instalación agendada correctamente");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-teams"] });
      // El proyecto agendado ya no es schedulable → refrescar la lista
      // (afecta tanto al cache global como al filtrado por schedulable=true).
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onCreated(res.data);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg ?? "No se pudo agendar la instalación");
    },
  });

  function handleStartChange(v: string) {
    setPlannedWorkStart(v);
    if (v && (!plannedWorkEnd || plannedWorkEnd < v)) {
      const start = parseIso(v);
      const monday = getMonday(start);
      const friday = addDays(monday, 4);
      const end = friday.getTime() >= start.getTime() ? friday : start;
      setPlannedWorkEnd(formatIso(end));
    }
  }

  const rangeInvalid = Boolean(
    plannedWorkStart && plannedWorkEnd && plannedWorkEnd < plannedWorkStart,
  );

  function canSubmit() {
    return (
      projectId &&
      plannedWorkStart &&
      plannedWorkEnd &&
      !rangeInvalid &&
      teamId &&
      !mutation.isPending
    );
  }

  return (
    <ModalShell title="Agendar instalación" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit()) mutation.mutate();
        }}
        className="space-y-3"
      >
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Proyecto
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            required
          >
            <option value="">Seleccionar proyecto…</option>
            {availableProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.clientName} ({p.capacityKwp} kWp)
              </option>
            ))}
          </select>
          {availableProjects.length === 0 && !projectsQuery.isLoading && (
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              No hay proyectos disponibles para agendar. Todos los proyectos activos ya tienen instalación agendada.
            </p>
          )}
        </div>

        <DateRangeFields
          start={plannedWorkStart}
          end={plannedWorkEnd}
          onChangeStart={handleStartChange}
          onChangeEnd={setPlannedWorkEnd}
        />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Equipo
            </label>
            <button
              type="button"
              onClick={onCreateTeamRequested}
              className="text-[10px] text-[var(--color-accent)] hover:underline"
            >
              + Nuevo equipo
            </button>
          </div>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            required
          >
            <option value="">Seleccionar equipo…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.teamName}
              </option>
            ))}
          </select>
          {teams.length === 0 && (
            <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              No hay equipos. Creá uno primero desde Administración.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Notas (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {submitError && (
          <p className="text-xs text-[var(--color-danger-text)]">{submitError}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="ghost" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" type="submit" disabled={!canSubmit()} loading={mutation.isPending}>
            Agendar
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function MoveConfirmDialog({
  clientName,
  targetStart,
  targetEnd,
  onCancel,
  onConfirm,
  loading,
}: {
  clientName: string;
  targetStart: string;
  targetEnd: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <ModalShell title="Mover instalación" onClose={onCancel}>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        ¿Mover {clientName} a {formatRangeShort(targetStart, targetEnd)}?
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={onConfirm} loading={loading}>
          Confirmar
        </Button>
      </div>
    </ModalShell>
  );
}

function ReprogramModal({
  schedule,
  onCancel,
  onConfirm,
  loading,
}: {
  schedule: InstallationSchedule;
  onCancel: () => void;
  onConfirm: (segmentId: string, start: string, end: string) => void;
  loading: boolean;
}) {
  const segments = schedule.segments;
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    segments[0]?.id ?? "",
  );
  const current = segments.find((s) => s.id === selectedSegmentId) ?? segments[0];
  const [start, setStart] = useState(current?.startDate ?? "");
  const [end, setEnd] = useState(current?.endDate ?? "");

  // Al cambiar de tramo, sincronizar las fechas del form.
  useEffect(() => {
    if (!current) return;
    setStart(current.startDate);
    setEnd(current.endDate);
  }, [selectedSegmentId, current]);

  function handleStartChange(v: string) {
    setStart(v);
    if (v && end && end < v && current) {
      const oldStart = parseIso(current.startDate);
      const oldEnd = parseIso(current.endDate);
      const duration = daysBetweenInclusive(oldStart, oldEnd) - 1;
      setEnd(formatIso(addDays(parseIso(v), duration)));
    }
  }

  const rangeInvalid = Boolean(start && end && end < start);
  const unchanged =
    !!current && start === current.startDate && end === current.endDate;

  return (
    <ModalShell title="Reprogramar tramo" onClose={onCancel}>
      {segments.length > 1 && (
        <div className="mb-3">
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Tramo a reprogramar
          </label>
          <select
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            value={selectedSegmentId}
            onChange={(e) => setSelectedSegmentId(e.target.value)}
          >
            {segments.map((s, idx) => (
              <option key={s.id} value={s.id}>
                Tramo {idx + 1}: {formatRangeShort(s.startDate, s.endDate)}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Seleccioná las nuevas fechas del tramo.
      </p>
      <DateRangeFields
        start={start}
        end={end}
        onChangeStart={handleStartChange}
        onChangeEnd={setEnd}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          loading={loading}
          disabled={rangeInvalid || !start || !end || unchanged || !current}
          onClick={() => current && onConfirm(current.id, start, end)}
        >
          Confirmar nuevas fechas
        </Button>
      </div>
    </ModalShell>
  );
}

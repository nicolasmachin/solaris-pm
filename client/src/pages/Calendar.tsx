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
  confirmSchedule,
  createSchedule,
  deleteSchedule,
  getCalendarMonth,
  getCalendarYear,
  getCalendarTeams,
  patchSchedule,
  rescheduleSchedule,
  type CalendarResponse,
  type CalendarTeam,
  type InstallationSchedule,
} from "../api/calendar.api";
import { getProjects } from "../api/projects.api";
import { createTeam } from "../api/teams.api";
import { Button } from "../components/ui/Button";
import { toastWarning } from "../utils/toast";

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
  return dayIso >= schedule.plannedWorkStart && dayIso <= schedule.plannedWorkEnd;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
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

// Plan de tracks para una fila (semana). Cada schedule que toca la fila se le
// asigna un slot vertical; si hay más schedules que el cap visible, los excedentes
// se condensan en un track final con marca "+X" por día cubierto.
type WeekSegment = {
  scheduleId: string;
  startDayIndex: number; // 0..6
  span: number; // días
  isFirstOfSchedule: boolean;
  isLastOfSchedule: boolean;
};

type WeekPlan = {
  visibleTracks: Array<{ schedule: InstallationSchedule; segment: WeekSegment }>;
  overflowByDay: Map<number, number>; // dayIndex → count escondidos
  hiddenSchedules: InstallationSchedule[];
  totalLanes: number;
};

function computeWeekPlan(
  schedules: InstallationSchedule[],
  weekStartIso: string,
  weekEndIso: string,
  showAllUpTo: number, // mensual=3, anual=2
  maxVisibleWhenTruncated = 2,
): WeekPlan {
  const inRow = schedules
    .filter((s) => rangesOverlap(s.plannedWorkStart, s.plannedWorkEnd, weekStartIso, weekEndIso))
    .sort((a, b) => {
      if (a.plannedWorkStart !== b.plannedWorkStart) {
        return a.plannedWorkStart < b.plannedWorkStart ? -1 : 1;
      }
      return a.teamName.localeCompare(b.teamName, "es");
    });

  const visible = inRow.length <= showAllUpTo ? inRow : inRow.slice(0, maxVisibleWhenTruncated);
  const hidden = inRow.length <= showAllUpTo ? [] : inRow.slice(maxVisibleWhenTruncated);

  const weekStart = parseIso(weekStartIso);

  function indexFor(iso: string): number {
    return Math.floor((parseIso(iso).getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  const visibleTracks = visible.map((s) => {
    const segStartIso = s.plannedWorkStart < weekStartIso ? weekStartIso : s.plannedWorkStart;
    const segEndIso = s.plannedWorkEnd > weekEndIso ? weekEndIso : s.plannedWorkEnd;
    const startDayIndex = indexFor(segStartIso);
    const endDayIndex = indexFor(segEndIso);
    return {
      schedule: s,
      segment: {
        scheduleId: s.id,
        startDayIndex,
        span: endDayIndex - startDayIndex + 1,
        isFirstOfSchedule: s.plannedWorkStart === segStartIso,
        isLastOfSchedule: s.plannedWorkEnd === segEndIso,
      },
    };
  });

  const overflowByDay = new Map<number, number>();
  for (const s of hidden) {
    const segStartIso = s.plannedWorkStart < weekStartIso ? weekStartIso : s.plannedWorkStart;
    const segEndIso = s.plannedWorkEnd > weekEndIso ? weekEndIso : s.plannedWorkEnd;
    const startIdx = indexFor(segStartIso);
    const endIdx = indexFor(segEndIso);
    for (let i = startIdx; i <= endIdx; i++) {
      overflowByDay.set(i, (overflowByDay.get(i) ?? 0) + 1);
    }
  }

  const totalLanes = visibleTracks.length + (overflowByDay.size > 0 ? 1 : 0);
  return { visibleTracks, overflowByDay, hiddenSchedules: hidden, totalLanes };
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
  const [newModalPrefill, setNewModalPrefill] = useState<{ start: string; end: string } | null>(null);
  const [showReprogram, setShowReprogram] = useState(false);
  const [moveRequest, setMoveRequest] = useState<
    | { schedule: InstallationSchedule; targetStart: string; targetEnd: string }
    | null
  >(null);
  const [draggingSchedule, setDraggingSchedule] = useState<InstallationSchedule | null>(null);

  // ─── Estado específico de la vista anual (drag & resize) ──────────────────────
  const [yearDragPreview, setYearDragPreview] = useState<
    | { scheduleId: string; start: string; end: string; invalid: boolean; reason: string | null }
    | null
  >(null);
  const [yearResize, setYearResize] = useState<
    | {
        scheduleId: string;
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

  // Query param ?start=YYYY-MM-DD para preseleccionar desde ProjectDetail
  const lastProcessedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const start = params.get("start") ?? params.get("week"); // retrocompat con ?week=
    if (start && start !== lastProcessedQueryRef.current) {
      const d = parseIso(start);
      setYear(d.getUTCFullYear());
      setMonth(d.getUTCMonth() + 1);
      setView("month");
      lastProcessedQueryRef.current = start;
      // Se seleccionará cuando lleguen los datos (ver efecto abajo)
      pendingSelectStartRef.current = start;
    }
  }, [location.search]);

  const pendingSelectStartRef = useRef<string | null>(null);

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

  const moveMutation = useMutation({
    mutationFn: (args: { id: string; plannedWorkStart: string; plannedWorkEnd: string }) =>
      patchSchedule(args.id, {
        plannedWorkStart: args.plannedWorkStart,
        plannedWorkEnd: args.plannedWorkEnd,
      }),
    onSuccess: (data) => {
      toast.success("Instalación reprogramada");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setSelectedScheduleIds([data.id]);
      setMoveRequest(null);
      setShowReprogram(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo reprogramar la instalación");
    },
  });

  // Reschedule con update optimista + rollback (para drag/resize de la vista anual)
  const rescheduleMutation = useMutation({
    mutationFn: (args: { id: string; plannedWorkStart: string; plannedWorkEnd: string }) =>
      rescheduleSchedule(args.id, {
        plannedWorkStart: args.plannedWorkStart,
        plannedWorkEnd: args.plannedWorkEnd,
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["calendar"] });
      const snapshots = queryClient.getQueriesData<CalendarResponse>({ queryKey: ["calendar"] });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        queryClient.setQueryData<CalendarResponse>(key, {
          ...data,
          schedules: data.schedules.map((s) =>
            s.id === vars.id
              ? { ...s, plannedWorkStart: vars.plannedWorkStart, plannedWorkEnd: vars.plannedWorkEnd }
              : s,
          ),
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
      const start = parseIso(res.data.plannedWorkStart);
      toast.success(`Instalación movida al ${formatLongDate(start)}`);
      if (res.warning) {
        toastWarning(res.warning.message);
      }
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
    targetDay: string,
  ): { start: string; end: string; invalid: boolean; reason: string | null } {
    const oldStart = parseIso(schedule.plannedWorkStart);
    const oldEnd = parseIso(schedule.plannedWorkEnd);
    const duration = daysBetweenInclusive(oldStart, oldEnd) - 1;
    const newStart = parseIso(targetDay);
    const newEnd = addDays(newStart, duration);
    const startIso = formatIso(newStart);
    const endIso = formatIso(newEnd);

    if (startIso < todayIso) {
      return { start: startIso, end: endIso, invalid: true, reason: "Fecha pasada" };
    }
    const conflict = schedules.find(
      (s) =>
        s.id !== schedule.id &&
        rangesOverlap(startIso, endIso, s.plannedWorkStart, s.plannedWorkEnd),
    );
    if (conflict) {
      return {
        start: startIso,
        end: endIso,
        invalid: true,
        reason: `Se solapa con ${conflict.project?.clientName ?? "otra instalación"}`,
      };
    }
    return { start: startIso, end: endIso, invalid: false, reason: null };
  }

  function handleDragStart(e: DragStartEvent) {
    const schedule = schedules.find((s) => s.id === String(e.active.id));
    setDraggingSchedule(schedule ?? null);
    if (schedule && dragSourceOf(e) === "year") {
      setYearDragPreview({
        scheduleId: schedule.id,
        start: schedule.plannedWorkStart,
        end: schedule.plannedWorkEnd,
        invalid: false,
        reason: null,
      });
    }
  }

  function handleDragOver(e: DragOverEvent) {
    if (dragSourceOf(e) !== "year") return;
    const scheduleId = String(e.active.id);
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    const targetDay = e.over?.id != null ? String(e.over.id) : null;
    if (!targetDay) {
      setYearDragPreview({
        scheduleId,
        start: schedule.plannedWorkStart,
        end: schedule.plannedWorkEnd,
        invalid: false,
        reason: null,
      });
      return;
    }
    const preview = computeYearDragPreview(schedule, targetDay);
    setYearDragPreview({ scheduleId, ...preview });
  }

  function handleDragEnd(e: DragEndEvent) {
    const scheduleId = String(e.active.id);
    const targetDay = e.over?.id != null ? String(e.over.id) : null;
    const source = dragSourceOf(e);
    setDraggingSchedule(null);
    setYearDragPreview(null);
    if (!targetDay) return;
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    if (schedule.plannedWorkStart === targetDay) return;

    const oldStart = parseIso(schedule.plannedWorkStart);
    const oldEnd = parseIso(schedule.plannedWorkEnd);
    const duration = daysBetweenInclusive(oldStart, oldEnd) - 1;
    const newStart = parseIso(targetDay);
    const newEnd = addDays(newStart, duration);
    const startIso = formatIso(newStart);
    const endIso = formatIso(newEnd);

    if (source === "year") {
      // Validación cliente (el server también la chequea)
      if (startIso < todayIso) {
        toast.error("No se puede mover a fechas pasadas");
        return;
      }
      const conflict = schedules.find(
        (s) =>
          s.id !== schedule.id &&
          rangesOverlap(startIso, endIso, s.plannedWorkStart, s.plannedWorkEnd),
      );
      if (conflict) {
        toast.error(
          `Se solapa con ${conflict.project?.clientName ?? "otra instalación"}`,
        );
        return;
      }
      rescheduleMutation.mutate({ id: schedule.id, plannedWorkStart: startIso, plannedWorkEnd: endIso });
      return;
    }

    // Month view: flujo existente con diálogo de confirmación
    setMoveRequest({ schedule, targetStart: startIso, targetEnd: endIso });
  }

  // Mouseup global: confirma el resize al soltar
  useEffect(() => {
    function onMouseUp() {
      const rs = yearResizeRef.current;
      if (!rs) return;
      setYearResize(null);

      if (rs.currentStart === rs.originalStart && rs.currentEnd === rs.originalEnd) return;
      if (rs.currentEnd < rs.currentStart) return; // rango inválido
      if (rs.edge === "start" && rs.currentStart < todayIso) {
        toast.error("No se puede mover a fechas pasadas");
        return;
      }
      const conflict = schedules.find(
        (s) =>
          s.id !== rs.scheduleId &&
          rangesOverlap(rs.currentStart, rs.currentEnd, s.plannedWorkStart, s.plannedWorkEnd),
      );
      if (conflict) {
        toast.error(`Se solapa con ${conflict.project?.clientName ?? "otra instalación"}`);
        return;
      }
      rescheduleMutation.mutate({
        id: rs.scheduleId,
        plannedWorkStart: rs.currentStart,
        plannedWorkEnd: rs.currentEnd,
      });
    }
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [schedules, rescheduleMutation, todayIso]);

  function startYearResize(scheduleId: string, edge: "start" | "end") {
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    setYearResize({
      scheduleId,
      edge,
      originalStart: schedule.plannedWorkStart,
      originalEnd: schedule.plannedWorkEnd,
      currentStart: schedule.plannedWorkStart,
      currentEnd: schedule.plannedWorkEnd,
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
      <div className="px-6 py-5">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
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
          <TeamFilterBar
            teams={teamsQuery.data}
            selected={selectedTeams}
            onChange={setSelectedTeams}
            counts={teamCounts}
          />
        )}

        <div className="flex gap-5 flex-col lg:flex-row">
          {/* Columna izquierda: calendario */}
          <div className="flex-1 min-w-0">
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
          onConfirm={(start, end) =>
            moveMutation.mutate({
              id: primarySelected.id,
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
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] text-center"
          >
            {h}
          </div>
        ))}
      </div>
      <div className="space-y-1">
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

const MONTH_DAY_HEADER_HEIGHT = 16;
const MONTH_TRACK_GAP = 1;
function monthSlotHeight(totalLanes: number): number {
  if (totalLanes <= 1) return 48;
  if (totalLanes === 2) return 28;
  return 22;
}

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
    () => computeWeekPlan(schedules, weekStartIso, weekEndIso, 3, 2),
    [schedules, weekStartIso, weekEndIso],
  );

  const slotH = monthSlotHeight(plan.totalLanes);
  const tracksHeight = plan.totalLanes * slotH + Math.max(0, plan.totalLanes - 1) * MONTH_TRACK_GAP;
  const rowHeight = MONTH_DAY_HEADER_HEIGHT + 4 + tracksHeight + 4; // header + paddings

  return (
    <div className="relative" style={{ minHeight: Math.max(64, rowHeight) }}>
      {/* Capa de fondo: 7 celdas clickeables (drop targets, día y today) */}
      <div className="absolute inset-0 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayIso = formatIso(day);
          const isOtherMonth = day.getUTCMonth() + 1 !== monthNumber;
          const isToday = dayIso === todayIso;
          return (
            <DayBackgroundCell
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

      {/* Tracks apilados arriba */}
      <div
        className="absolute"
        style={{
          left: 0,
          right: 0,
          top: MONTH_DAY_HEADER_HEIGHT + 4,
          height: tracksHeight,
          pointerEvents: "none",
        }}
      >
        {plan.visibleTracks.map((track, slotIndex) => (
          <div
            key={track.schedule.id}
            className="grid grid-cols-7 gap-1"
            style={{
              height: slotH,
              marginBottom: slotIndex < plan.totalLanes - 1 ? MONTH_TRACK_GAP : 0,
            }}
          >
            <MonthTrackBlock
              schedule={track.schedule}
              segment={track.segment}
              slotHeight={slotH}
              isSelected={selectedScheduleIds.includes(track.schedule.id)}
              onClick={() => onScheduleClick(track.schedule.id)}
            />
          </div>
        ))}
        {plan.overflowByDay.size > 0 && (
          <div
            className="grid grid-cols-7 gap-1"
            style={{ height: slotH }}
          >
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
                  className="rounded text-[9px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-app)] hover:bg-[var(--color-bg-card-hover)]"
                  style={{ pointerEvents: "auto" }}
                >
                  +{count} más
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DayBackgroundCell({
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
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={`relative h-full w-full rounded border border-[var(--color-border)] text-left px-1.5 py-1 transition-colors hover:bg-[var(--color-bg-card-hover)] ${
        isOtherMonth ? "bg-[var(--color-bg-app)]" : ""
      } ${isOver ? "outline outline-2 outline-[var(--color-accent-hover)]" : ""}`}
    >
      <span className="block text-[10px] text-[var(--color-text-muted)]">
        {day.getUTCDate()}
        {isToday ? (
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] align-middle" />
        ) : null}
      </span>
    </button>
  );
}

function MonthTrackBlock({
  schedule,
  segment,
  slotHeight,
  isSelected,
  onClick,
}: {
  schedule: InstallationSchedule;
  segment: WeekSegment;
  slotHeight: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isDraggable = segment.isFirstOfSchedule;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: schedule.id,
    disabled: !isDraggable,
  });
  const color = effectiveColor(schedule);
  const textDark = !isColorDark(color);
  const clientName = schedule.project?.clientName ?? "Sin proyecto";

  const style: CSSProperties = {
    gridColumn: `${segment.startDayIndex + 1} / span ${segment.span}`,
    background: color,
    height: slotHeight,
    borderTopLeftRadius: segment.isFirstOfSchedule ? 6 : 2,
    borderBottomLeftRadius: segment.isFirstOfSchedule ? 6 : 2,
    borderTopRightRadius: segment.isLastOfSchedule ? 6 : 2,
    borderBottomRightRadius: segment.isLastOfSchedule ? 6 : 2,
    outline: isSelected ? "2px solid var(--color-accent)" : undefined,
    outlineOffset: isSelected ? "-2px" : undefined,
    pointerEvents: "auto",
    opacity: isDragging ? 0.4 : 1,
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
      {segment.isFirstOfSchedule ? (
        <span
          className={`truncate font-medium ${textDark ? "text-[#0c3b6e]" : "text-white"}`}
          style={{ fontSize: 9, padding: "1px 3px" }}
        >
          {clientName}
        </span>
      ) : null}
    </div>
  );
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
  // Aplicar preview del resize a los horarios para el render en tiempo real
  const effective = useMemo(() => {
    if (!yearResize) return schedules;
    return schedules.map((s) =>
      s.id === yearResize.scheduleId
        ? { ...s, plannedWorkStart: yearResize.currentStart, plannedWorkEnd: yearResize.currentEnd }
        : s,
    );
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
  return 8;
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
    () => computeWeekPlan(schedules, weekStartIso, weekEndIso, 2, 2),
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
        {plan.visibleTracks.map((track, slotIndex) => (
          <div
            key={track.schedule.id}
            className="grid grid-cols-7 gap-[2px]"
            style={{
              height: slotH,
              marginBottom: slotIndex < plan.totalLanes - 1 ? MINI_TRACK_GAP : 0,
            }}
          >
            <YearTrackBlock
              schedule={track.schedule}
              segment={track.segment}
              slotHeight={slotH}
              cellWidth={cellWidth}
              isSelected={selectedScheduleIds.includes(track.schedule.id)}
              resizingSomething={yearResize !== null}
              onClick={() => onScheduleClick(track.schedule.id)}
              onResizeStart={onResizeStart}
            />
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
  const isDraggable = segment.isFirstOfSchedule;
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: schedule.id,
    data: { source: "year" },
    disabled: !isDraggable,
  });
  const color = effectiveColor(schedule);
  const clientName = schedule.project?.clientName ?? "Sin proyecto";

  // Texto: tier según ancho del segmento
  let text: string | null = null;
  if (segment.isFirstOfSchedule && cellWidth > 0) {
    const segWidth = cellWidth * segment.span + MINI_CELL_GAP * (segment.span - 1);
    if (segWidth >= 60) text = clientName;
    else if (segWidth >= 30) text = computeInitials(clientName, 3);
  }

  const style: CSSProperties = {
    gridColumn: `${segment.startDayIndex + 1} / span ${segment.span}`,
    background: color,
    height: slotHeight,
    borderTopLeftRadius: segment.isFirstOfSchedule ? 3 : 1,
    borderBottomLeftRadius: segment.isFirstOfSchedule ? 3 : 1,
    borderTopRightRadius: segment.isLastOfSchedule ? 3 : 1,
    borderBottomRightRadius: segment.isLastOfSchedule ? 3 : 1,
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
      title={`${clientName} · ${displayTeamName(schedule)} · ${formatRangeShort(schedule.plannedWorkStart, schedule.plannedWorkEnd)}`}
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

      {segment.isFirstOfSchedule ? (
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
      {segment.isLastOfSchedule ? (
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

  const startDate = parseIso(schedule.plannedWorkStart);
  const endDate = parseIso(schedule.plannedWorkEnd);
  const businessDays = businessDaysInclusive(startDate, endDate);

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
            {formatLongDate(startDate)}
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Fin:</span>{" "}
            {formatLongDate(endDate)}
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Duración:</span>{" "}
            {businessDays} {businessDays === 1 ? "día hábil" : "días hábiles"}
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
          placeholder="Agregar notas…"
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
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createTeam({ name: name.trim(), color }),
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
            placeholder="Ej. Equipo propio"
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
  prefill: { start: string; end: string } | null;
  teams: CalendarTeam[];
  onClose: () => void;
  onCreated: (s: InstallationSchedule) => void;
  onCreateTeamRequested: () => void;
}) {
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const calendarCache = queryClient.getQueriesData<{ schedules: InstallationSchedule[] }>({
    queryKey: ["calendar"],
  });
  const scheduledProjectIds = new Set<string>();
  for (const [, data] of calendarCache) {
    for (const s of data?.schedules ?? []) {
      scheduledProjectIds.add(s.projectId);
    }
  }
  const availableProjects = (projectsQuery.data ?? [])
    .filter((p) => !scheduledProjectIds.has(p.id))
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));

  const [projectId, setProjectId] = useState("");
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
        plannedWorkStart,
        plannedWorkEnd,
        notes: notes.trim() ? notes.trim() : null,
      }),
    onSuccess: (res) => {
      toast.success("Instalación agendada correctamente");
      if (res.warning) {
        toastWarning(res.warning.message);
      }
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-teams"] });
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
              No hay proyectos sin instalación agendada.
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
  onConfirm: (start: string, end: string) => void;
  loading: boolean;
}) {
  const [start, setStart] = useState(schedule.plannedWorkStart);
  const [end, setEnd] = useState(schedule.plannedWorkEnd);

  function handleStartChange(v: string) {
    setStart(v);
    if (v && end && end < v) {
      // Preservar duración anterior si la nueva fecha rompe el rango
      const oldStart = parseIso(schedule.plannedWorkStart);
      const oldEnd = parseIso(schedule.plannedWorkEnd);
      const duration = daysBetweenInclusive(oldStart, oldEnd) - 1;
      setEnd(formatIso(addDays(parseIso(v), duration)));
    }
  }

  const rangeInvalid = Boolean(start && end && end < start);
  const unchanged = start === schedule.plannedWorkStart && end === schedule.plannedWorkEnd;

  return (
    <ModalShell title="Reprogramar instalación" onClose={onCancel}>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Seleccioná las nuevas fechas de obra.
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
          disabled={rangeInvalid || !start || !end || unchanged}
          onClick={() => onConfirm(start, end)}
        >
          Confirmar nuevas fechas
        </Button>
      </div>
    </ModalShell>
  );
}

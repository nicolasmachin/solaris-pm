import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  type InstallationSchedule,
} from "../api/calendar.api";
import { getProjects } from "../api/projects.api";
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
  return schedule.operationsCompleted ? COMPLETED_COLOR : schedule.teamColor;
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

function findScheduleForDay(
  schedules: InstallationSchedule[],
  dayIso: string,
): InstallationSchedule | null {
  for (const s of schedules) {
    if (scheduleCoversDay(s, dayIso)) return s;
  }
  return null;
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
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newModalPrefill, setNewModalPrefill] = useState<{ start: string; end: string } | null>(null);
  const [showReprogram, setShowReprogram] = useState(false);
  const [moveRequest, setMoveRequest] = useState<
    | { schedule: InstallationSchedule; targetStart: string; targetEnd: string }
    | null
  >(null);
  const [draggingSchedule, setDraggingSchedule] = useState<InstallationSchedule | null>(null);

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

  const scheduleById = useMemo(() => {
    const map = new Map<string, InstallationSchedule>();
    for (const s of schedules) map.set(s.id, s);
    return map;
  }, [schedules]);

  const selectedSchedule = selectedScheduleId ? scheduleById.get(selectedScheduleId) ?? null : null;

  // Al cargar datos, si hay un pending ?start=, buscar el schedule que cubre ese día
  useEffect(() => {
    const pending = pendingSelectStartRef.current;
    if (!pending) return;
    if (schedules.length === 0) return;
    const match = schedules.find((s) => scheduleCoversDay(s, pending));
    if (match) {
      setSelectedScheduleId(match.id);
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
      setSelectedScheduleId(data.id);
      setMoveRequest(null);
      setShowReprogram(false);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo reprogramar la instalación");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSchedule(id),
    onSuccess: () => {
      toast.success("Asignación eliminada");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setSelectedScheduleId(null);
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  function handleDragStart(e: DragStartEvent) {
    const schedule = schedules.find((s) => s.id === String(e.active.id));
    setDraggingSchedule(schedule ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const scheduleId = String(e.active.id);
    const targetDay = e.over?.id != null ? String(e.over.id) : null;
    setDraggingSchedule(null);
    if (!targetDay) return;
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    if (schedule.plannedWorkStart === targetDay) return;
    // Preservar duración: fin = fin anterior desplazado
    const oldStart = parseIso(schedule.plannedWorkStart);
    const oldEnd = parseIso(schedule.plannedWorkEnd);
    const durationDays = daysBetweenInclusive(oldStart, oldEnd) - 1;
    const newStart = parseIso(targetDay);
    const newEnd = addDays(newStart, durationDays);
    setMoveRequest({
      schedule,
      targetStart: formatIso(newStart),
      targetEnd: formatIso(newEnd),
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
    setSelectedScheduleId(null);
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
    setSelectedScheduleId(null);
  }

  function handleDayClick(dayIso: string) {
    const schedule = findScheduleForDay(schedules, dayIso);
    if (schedule) {
      setSelectedScheduleId(schedule.id);
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

  function handleYearDayClick(dayIso: string) {
    const schedule = findScheduleForDay(schedules, dayIso);
    const d = parseIso(dayIso);
    if (schedule) {
      // Cambiar a vista mensual del mes del schedule + seleccionar
      const sd = parseIso(schedule.plannedWorkStart);
      setYear(sd.getUTCFullYear());
      setMonth(sd.getUTCMonth() + 1);
      setView("month");
      setSelectedScheduleId(schedule.id);
    } else {
      setYear(d.getUTCFullYear());
      setMonth(d.getUTCMonth() + 1);
      setView("month");
      // Abrir modal con ese día pre-cargado como inicio
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
    setSelectedScheduleId(created.id);
    setShowNewModal(false);
    setNewModalPrefill(null);
  }

  const isLoading = view === "month" ? monthQuery.isLoading : yearQuery.isLoading;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingSchedule(null)}
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

        {/* Leyenda de equipos */}
        {teamsQuery.data && teamsQuery.data.length > 0 && (
          <TeamsLegend teams={teamsQuery.data} />
        )}

        <div className="flex gap-5 flex-col lg:flex-row">
          {/* Columna izquierda: calendario */}
          <div className="flex-1 min-w-0">
            {view === "month" ? (
              <MonthGrid
                year={year}
                month={month}
                schedules={schedules}
                selectedScheduleId={selectedScheduleId}
                onDayClick={handleDayClick}
              />
            ) : (
              <YearGrid
                year={year}
                schedules={schedules}
                onDayClick={handleYearDayClick}
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
                selectedSchedule={selectedSchedule}
                onConfirm={async (id) => {
                  try {
                    await confirmSchedule(id);
                    toast.success("Fecha confirmada correctamente");
                    queryClient.invalidateQueries({ queryKey: ["calendar"] });
                  } catch {
                    toast.error("No se pudo confirmar la fecha");
                  }
                }}
                onReprogramClick={() => setShowReprogram(true)}
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
          <ScheduleOverlay schedule={draggingSchedule} />
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
        />
      )}

      {showReprogram && selectedSchedule && (
        <ReprogramModal
          schedule={selectedSchedule}
          onCancel={() => setShowReprogram(false)}
          onConfirm={(start, end) =>
            moveMutation.mutate({
              id: selectedSchedule.id,
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

function TeamsLegend({ teams }: { teams: { teamName: string; teamColor: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
      {teams.map((t) => (
        <span
          key={t.teamName}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-0.5 text-[var(--color-text-secondary)]"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.teamColor }} />
          {t.teamName}
        </span>
      ))}
    </div>
  );
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

function MonthGrid({
  year,
  month,
  schedules,
  selectedScheduleId,
  onDayClick,
}: {
  year: number;
  month: number;
  schedules: InstallationSchedule[];
  selectedScheduleId: string | null;
  onDayClick: (dayIso: string) => void;
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
            selectedScheduleId={selectedScheduleId}
            onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  weekStart,
  monthNumber,
  todayIso,
  schedules,
  selectedScheduleId,
  onDayClick,
}: {
  weekStart: Date;
  monthNumber: number;
  todayIso: string;
  schedules: InstallationSchedule[];
  selectedScheduleId: string | null;
  onDayClick: (dayIso: string) => void;
}) {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));
  const weekStartIso = formatIso(weekStart);
  const weekEndIso = formatIso(addDays(weekStart, 6));

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const dayIso = formatIso(day);
        const isOtherMonth = day.getUTCMonth() + 1 !== monthNumber;
        const isToday = dayIso === todayIso;
        const schedule = findScheduleForDay(schedules, dayIso);
        const isFirstOfSegment = schedule
          ? dayIso === schedule.plannedWorkStart || dayIso === weekStartIso
          : false;
        const isLastOfSegment = schedule
          ? dayIso === schedule.plannedWorkEnd || dayIso === weekEndIso
          : false;
        const isFirstOfSchedule = schedule ? dayIso === schedule.plannedWorkStart : false;
        const isSelected = schedule?.id != null && schedule.id === selectedScheduleId;

        return (
          <DayCell
            key={dayIso}
            day={day}
            dayIso={dayIso}
            isOtherMonth={isOtherMonth}
            isToday={isToday}
            schedule={schedule}
            isFirstOfSegment={isFirstOfSegment}
            isLastOfSegment={isLastOfSegment}
            isFirstOfSchedule={isFirstOfSchedule}
            isSelected={isSelected}
            onClick={() => onDayClick(dayIso)}
          />
        );
      })}
    </div>
  );
}

function DayCell({
  day,
  dayIso,
  isOtherMonth,
  isToday,
  schedule,
  isFirstOfSegment,
  isLastOfSegment,
  isFirstOfSchedule,
  isSelected,
  onClick,
}: {
  day: Date;
  dayIso: string;
  isOtherMonth: boolean;
  isToday: boolean;
  schedule: InstallationSchedule | null;
  isFirstOfSegment: boolean;
  isLastOfSegment: boolean;
  isFirstOfSchedule: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayIso });
  const bg = schedule ? effectiveColor(schedule) : undefined;
  const textDark = bg ? !isColorDark(bg) : true;

  const cellStyle: CSSProperties = {
    background: bg,
    borderTopLeftRadius: isFirstOfSegment ? 6 : undefined,
    borderBottomLeftRadius: isFirstOfSegment ? 6 : undefined,
    borderTopRightRadius: isLastOfSegment ? 6 : undefined,
    borderBottomRightRadius: isLastOfSegment ? 6 : undefined,
    outline: isSelected ? "2px solid var(--color-accent)" : undefined,
    outlineOffset: isSelected ? "-2px" : undefined,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      className={`relative h-16 px-1.5 py-1 text-left transition-colors ${
        !bg
          ? `border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] rounded ${
              isOtherMonth ? "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]" : ""
            } ${isOver ? "outline outline-2 outline-[var(--color-accent-hover)]" : ""}`
          : isOver
            ? "outline outline-2 outline-[var(--color-accent-hover)]"
            : ""
      }`}
      style={cellStyle}
    >
      <span
        className={`block text-[10px] ${
          bg
            ? textDark
              ? "text-[#0c3b6e]/80"
              : "text-white/80"
            : isOtherMonth
              ? "text-[var(--color-text-muted)]"
              : "text-[var(--color-text-muted)]"
        }`}
      >
        {day.getUTCDate()}
        {isToday && !bg ? (
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] align-middle" />
        ) : null}
      </span>

      {isFirstOfSchedule && schedule ? (
        <ScheduleDraggable schedule={schedule} />
      ) : null}
    </button>
  );
}

function ScheduleDraggable({ schedule }: { schedule: InstallationSchedule }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: schedule.id });
  const textDark = !isColorDark(effectiveColor(schedule));
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`absolute left-1.5 right-1 bottom-1 block cursor-grab active:cursor-grabbing truncate text-[10px] font-medium ${
        textDark ? "text-[#0c3b6e]" : "text-white"
      } ${isDragging ? "opacity-40" : ""}`}
      title={schedule.project?.clientName ?? ""}
    >
      {schedule.project?.clientName ?? "Sin proyecto"}
    </span>
  );
}

function ScheduleOverlay({ schedule }: { schedule: InstallationSchedule }) {
  const color = effectiveColor(schedule);
  const textDark = !isColorDark(color);
  return (
    <div
      className={`rounded-md px-3 py-2 text-xs font-medium shadow-lg ${
        textDark ? "text-[#0c3b6e]" : "text-white"
      }`}
      style={{ background: color, minWidth: 160 }}
    >
      {schedule.project?.clientName ?? "Instalación"}
      <p className="text-[10px] opacity-80 mt-0.5">{schedule.teamName}</p>
    </div>
  );
}

// ─── YearGrid (vista anual) ───────────────────────────────────────────────────

function YearGrid({
  year,
  schedules,
  onDayClick,
}: {
  year: number;
  schedules: InstallationSchedule[];
  onDayClick: (dayIso: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <MiniMonth
          key={m}
          year={year}
          month={m}
          schedules={schedules}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}

function MiniMonth({
  year,
  month,
  schedules,
  onDayClick,
}: {
  year: number;
  month: number;
  schedules: InstallationSchedule[];
  onDayClick: (dayIso: string) => void;
}) {
  const weeks = useMemo(() => getWeeksForMonth(year, month), [year, month]);
  const today = new Date();
  const todayIso = formatIso(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
  );

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2">
      <p className="font-display text-[11px] font-semibold text-[var(--color-text-primary)] mb-1.5 text-center">
        {MONTHS_ES_CAP[month - 1]}
      </p>
      <div className="grid grid-cols-7 gap-[2px] mb-1">
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
        {weeks.map((weekStart) => {
          const weekStartIso = formatIso(weekStart);
          const weekEndIso = formatIso(addDays(weekStart, 6));
          return (
            <div key={weekStartIso} className="grid grid-cols-7 gap-[2px]">
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((day) => {
                const dayIso = formatIso(day);
                const isOtherMonth = day.getUTCMonth() + 1 !== month;
                const isToday = dayIso === todayIso;
                const schedule = findScheduleForDay(schedules, dayIso);
                const isFirstOfSegment = schedule
                  ? dayIso === schedule.plannedWorkStart || dayIso === weekStartIso
                  : false;
                const isLastOfSegment = schedule
                  ? dayIso === schedule.plannedWorkEnd || dayIso === weekEndIso
                  : false;
                return (
                  <MiniDayCell
                    key={dayIso}
                    day={day}
                    dayIso={dayIso}
                    isOtherMonth={isOtherMonth}
                    isToday={isToday}
                    schedule={schedule}
                    isFirstOfSegment={isFirstOfSegment}
                    isLastOfSegment={isLastOfSegment}
                    onClick={() => onDayClick(dayIso)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniDayCell({
  day,
  dayIso,
  isOtherMonth,
  isToday,
  schedule,
  isFirstOfSegment,
  isLastOfSegment,
  onClick,
}: {
  day: Date;
  dayIso: string;
  isOtherMonth: boolean;
  isToday: boolean;
  schedule: InstallationSchedule | null;
  isFirstOfSegment: boolean;
  isLastOfSegment: boolean;
  onClick: () => void;
}) {
  const bg = schedule ? effectiveColor(schedule) : undefined;
  const tooltip = schedule
    ? `${schedule.project?.clientName ?? "Sin proyecto"} · ${schedule.teamName} · ${formatRangeShort(schedule.plannedWorkStart, schedule.plannedWorkEnd)}`
    : `${day.getUTCDate()} de ${MONTHS_ES[day.getUTCMonth()]}`;

  const style: CSSProperties = {
    background: bg,
    borderTopLeftRadius: isFirstOfSegment ? 3 : undefined,
    borderBottomLeftRadius: isFirstOfSegment ? 3 : undefined,
    borderTopRightRadius: isLastOfSegment ? 3 : undefined,
    borderBottomRightRadius: isLastOfSegment ? 3 : undefined,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip}
      aria-label={tooltip}
      className={`relative h-5 w-full transition-colors ${
        !bg
          ? `rounded-[2px] ${
              isOtherMonth
                ? "bg-transparent hover:bg-[var(--color-bg-card-hover)]"
                : "bg-[var(--color-bg-app)] hover:bg-[var(--color-bg-card-hover)]"
            }`
          : "hover:opacity-90"
      }`}
      style={style}
    >
      {isToday && !bg ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
        </span>
      ) : null}
    </button>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function SidePanel({
  selectedSchedule,
  onConfirm,
  onReprogramClick,
  onDelete,
  onPatch,
  onProjectClick,
}: {
  selectedSchedule: InstallationSchedule | null;
  onConfirm: (id: string) => void;
  onReprogramClick: () => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, body: { teamName?: string; teamColor?: string; notes?: string | null }) => Promise<void>;
  onProjectClick: (projectId: string) => void;
}) {
  if (!selectedSchedule) {
    return (
      <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Seleccioná una instalación para ver el detalle.
        </p>
      </aside>
    );
  }

  return (
    <ScheduleDetail
      schedule={selectedSchedule}
      onConfirm={onConfirm}
      onReprogramClick={onReprogramClick}
      onDelete={onDelete}
      onPatch={onPatch}
      onProjectClick={onProjectClick}
    />
  );
}

function ScheduleDetail({
  schedule,
  onConfirm,
  onReprogramClick,
  onDelete,
  onPatch,
  onProjectClick,
}: {
  schedule: InstallationSchedule;
  onConfirm: (id: string) => void;
  onReprogramClick: () => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, body: { teamName?: string; teamColor?: string; notes?: string | null }) => Promise<void>;
  onProjectClick: (projectId: string) => void;
}) {
  const [teamName, setTeamName] = useState(schedule.teamName);
  const [teamColor, setTeamColor] = useState(schedule.teamColor);
  const [notes, setNotes] = useState(schedule.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTeamName(schedule.teamName);
    setTeamColor(schedule.teamColor);
    setNotes(schedule.notes ?? "");
    setConfirmDelete(false);
  }, [schedule.id, schedule.teamName, schedule.teamColor, schedule.notes]);

  const dirty =
    teamName !== schedule.teamName ||
    teamColor !== schedule.teamColor ||
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
      await onPatch(schedule.id, {
        teamName: teamName.trim(),
        teamColor,
        notes: notes.trim() ? notes.trim() : null,
      });
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
          <p className="text-[10px] opacity-80 mt-0.5">{schedule.teamName}</p>
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
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {TEAM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTeamColor(c)}
              className={`h-6 w-6 rounded-full transition-transform ${
                teamColor.toLowerCase() === c.toLowerCase() ? "scale-110 ring-2 ring-[var(--color-accent)]" : ""
              }`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
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

function NewScheduleModal({
  prefill,
  teams,
  onClose,
  onCreated,
}: {
  prefill: { start: string; end: string } | null;
  teams: { teamName: string; teamColor: string }[];
  onClose: () => void;
  onCreated: (s: InstallationSchedule) => void;
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
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState<string>(TEAM_COLORS[0]!);
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      createSchedule({
        projectId,
        teamName: teamName.trim(),
        teamColor,
        plannedWorkStart,
        plannedWorkEnd,
        notes: notes.trim() ? notes.trim() : null,
      }),
    onSuccess: (data) => {
      toast.success("Instalación agendada correctamente");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-teams"] });
      onCreated(data);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSubmitError(msg ?? "No se pudo agendar la instalación");
    },
  });

  function handleStartChange(v: string) {
    setPlannedWorkStart(v);
    // Auto-ajuste: si no hay fin o el fin queda antes, setear fin = viernes de esa semana o igual al inicio
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
      teamName.trim() &&
      !mutation.isPending
    );
  }

  const matchingTeams = teams.filter(
    (t) => t.teamName.toLowerCase().includes(teamName.trim().toLowerCase()) && t.teamName !== teamName,
  );

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

        <div className="relative">
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Equipo
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            onFocus={() => setShowTeamSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTeamSuggestions(false), 120)}
            placeholder="Ej. Equipo propio"
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            required
          />
          {showTeamSuggestions && matchingTeams.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg max-h-32 overflow-y-auto">
              {matchingTeams.map((t) => (
                <button
                  type="button"
                  key={t.teamName}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTeamName(t.teamName);
                    setTeamColor(t.teamColor);
                    setShowTeamSuggestions(false);
                  }}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: t.teamColor }}
                  />
                  {t.teamName}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Color del equipo
          </label>
          <div className="flex gap-1.5">
            {TEAM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setTeamColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  teamColor.toLowerCase() === c.toLowerCase() ? "scale-110 ring-2 ring-[var(--color-accent)]" : ""
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
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

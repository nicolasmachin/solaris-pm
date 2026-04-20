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
  getCalendar,
  getCalendarTeams,
  patchSchedule,
  type InstallationSchedule,
} from "../api/calendar.api";
import { getProjects } from "../api/projects.api";
import { Button } from "../components/ui/Button";

const TEAM_COLORS: string[] = [
  "#378ADD",
  "#1D9E75",
  "#D85A30",
  "#7F77DD",
  "#BA7517",
  "#888780",
];

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

function formatWeekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 4);
  const startDay = weekStart.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = MONTHS_ES[weekStart.getUTCMonth()];
  const endMonth = MONTHS_ES[end.getUTCMonth()];
  if (weekStart.getUTCMonth() !== end.getUTCMonth()) {
    return `${startDay} de ${startMonth}–${endDay} de ${endMonth}`;
  }
  return `${startDay}–${endDay} de ${endMonth}`;
}

function formatMonthTitle(year: number, month: number): string {
  return `${MONTHS_ES_CAP[month - 1]} ${year}`;
}

function formatShortMonthName(month: number): string {
  return MONTHS_ES[month - 1];
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

// ─── Página ───────────────────────────────────────────────────────────────────

export function Calendar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newModalPrefillWeek, setNewModalPrefillWeek] = useState<string | null>(null);
  const [showReprogram, setShowReprogram] = useState(false);
  const [moveRequest, setMoveRequest] = useState<
    | { schedule: InstallationSchedule; targetWeekStart: string }
    | null
  >(null);
  const [draggingSchedule, setDraggingSchedule] = useState<InstallationSchedule | null>(null);

  // Query param ?week=YYYY-MM-DD para preseleccionar desde ProjectDetail
  const lastProcessedQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const week = params.get("week");
    if (week && week !== lastProcessedQueryRef.current) {
      const d = parseIso(week);
      setYear(d.getUTCFullYear());
      setMonth(d.getUTCMonth() + 1);
      setSelectedWeek(week);
      lastProcessedQueryRef.current = week;
    }
  }, [location.search]);

  const calendarQuery = useQuery({
    queryKey: ["calendar", year, month],
    queryFn: () => getCalendar(year, month),
  });

  const teamsQuery = useQuery({
    queryKey: ["calendar-teams"],
    queryFn: getCalendarTeams,
  });

  const schedules = calendarQuery.data?.schedules ?? [];
  const freeWeeks = calendarQuery.data?.freeWeeks ?? [];

  const scheduleByWeek = useMemo(() => {
    const map = new Map<string, InstallationSchedule>();
    for (const s of schedules) map.set(s.weekStart, s);
    return map;
  }, [schedules]);

  const selectedSchedule = selectedWeek ? scheduleByWeek.get(selectedWeek) ?? null : null;

  const moveMutation = useMutation({
    mutationFn: (args: { id: string; weekStart: string }) =>
      patchSchedule(args.id, { weekStart: args.weekStart }),
    onSuccess: (data) => {
      toast.success("Instalación reprogramada");
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setSelectedWeek(data.weekStart);
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
      setSelectedWeek(null);
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
    const targetWeek = e.over?.id != null ? String(e.over.id) : null;
    setDraggingSchedule(null);
    if (!targetWeek) return;
    const schedule = schedules.find((s) => s.id === scheduleId);
    if (!schedule) return;
    if (schedule.weekStart === targetWeek) return;
    setMoveRequest({ schedule, targetWeekStart: targetWeek });
  }

  function goPrevMonth() {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
    setSelectedWeek(null);
  }

  function goNextMonth() {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
    setSelectedWeek(null);
  }

  function handleWeekClick(weekIso: string) {
    const hasSchedule = scheduleByWeek.has(weekIso);
    if (hasSchedule) {
      setSelectedWeek(weekIso);
    } else {
      setNewModalPrefillWeek(weekIso);
      setShowNewModal(true);
    }
  }

  function handleCreated(created: InstallationSchedule) {
    const targetDate = parseIso(created.weekStart);
    const targetY = targetDate.getUTCFullYear();
    const targetM = targetDate.getUTCMonth() + 1;
    if (targetY !== year || targetM !== month) {
      setYear(targetY);
      setMonth(targetM);
    }
    setSelectedWeek(created.weekStart);
    setShowNewModal(false);
    setNewModalPrefillWeek(null);
  }

  const prevMonth = month === 1 ? 12 : month - 1;
  const nextMonth = month === 12 ? 1 : month + 1;

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
                onClick={goPrevMonth}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                ‹ {formatShortMonthName(prevMonth)}
              </button>
              <span className="font-medium text-[var(--color-text-primary)]">
                {formatMonthTitle(year, month)}
              </span>
              <button
                type="button"
                onClick={goNextMonth}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {formatShortMonthName(nextMonth)} ›
              </button>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setNewModalPrefillWeek(null);
              setShowNewModal(true);
            }}
          >
            + Nueva instalación
          </Button>
        </div>

        <div className="flex gap-5 flex-col lg:flex-row">
          {/* Columna izquierda: calendario */}
          <div className="flex-1 min-w-0">
            <MonthGrid
              year={year}
              month={month}
              scheduleByWeek={scheduleByWeek}
              selectedWeek={selectedWeek}
              onSelectWeek={handleWeekClick}
            />
            {calendarQuery.isLoading && (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">Cargando…</p>
            )}
          </div>

          {/* Columna derecha: panel lateral */}
          <div className="w-full lg:w-[220px] lg:shrink-0">
            <SidePanel
              selectedWeek={selectedWeek}
              selectedSchedule={selectedSchedule}
              freeWeeks={freeWeeks}
              onOpenNewForWeek={(wk) => {
                setNewModalPrefillWeek(wk);
                setShowNewModal(true);
              }}
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
        </div>
      </div>

      <DragOverlay>
        {draggingSchedule ? (
          <ScheduleOverlay schedule={draggingSchedule} />
        ) : null}
      </DragOverlay>

      {showNewModal && (
        <NewScheduleModal
          prefillWeek={newModalPrefillWeek}
          teams={teamsQuery.data ?? []}
          onClose={() => {
            setShowNewModal(false);
            setNewModalPrefillWeek(null);
          }}
          onCreated={handleCreated}
        />
      )}

      {showReprogram && selectedSchedule && (
        <ReprogramModal
          schedule={selectedSchedule}
          onCancel={() => setShowReprogram(false)}
          onConfirm={(newWeek) =>
            moveMutation.mutate({ id: selectedSchedule.id, weekStart: newWeek })
          }
          loading={moveMutation.isPending}
        />
      )}

      {moveRequest && (
        <MoveConfirmDialog
          clientName={moveRequest.schedule.project?.clientName ?? "el proyecto"}
          targetWeekStart={moveRequest.targetWeekStart}
          onCancel={() => setMoveRequest(null)}
          onConfirm={() =>
            moveMutation.mutate({
              id: moveRequest.schedule.id,
              weekStart: moveRequest.targetWeekStart,
            })
          }
          loading={moveMutation.isPending}
        />
      )}
    </DndContext>
  );
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

function MonthGrid({
  year,
  month,
  scheduleByWeek,
  selectedWeek,
  onSelectWeek,
}: {
  year: number;
  month: number;
  scheduleByWeek: Map<string, InstallationSchedule>;
  selectedWeek: string | null;
  onSelectWeek: (weekIso: string) => void;
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
            schedule={scheduleByWeek.get(formatIso(weekStart)) ?? null}
            isSelected={selectedWeek === formatIso(weekStart)}
            onSelect={onSelectWeek}
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
  schedule,
  isSelected,
  onSelect,
}: {
  weekStart: Date;
  monthNumber: number;
  todayIso: string;
  schedule: InstallationSchedule | null;
  isSelected: boolean;
  onSelect: (weekIso: string) => void;
}) {
  const weekIso = formatIso(weekStart);
  const { setNodeRef, isOver } = useDroppable({ id: weekIso });

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

  return (
    <div
      ref={setNodeRef}
      className={`grid grid-cols-7 gap-1 rounded-md transition-[outline] ${
        isSelected ? "outline outline-2 outline-[var(--color-accent)]" : ""
      } ${isOver ? "outline outline-2 outline-[var(--color-accent-hover)]" : ""}`}
    >
      {days.map((day, idx) => {
        const dayIso = formatIso(day);
        const isInstallDay = idx < 5; // Lu-Vi
        const isOtherMonth = day.getUTCMonth() + 1 !== monthNumber;
        const isToday = dayIso === todayIso;
        const dayHasInstallation = schedule && isInstallDay;

        return (
          <DayCell
            key={dayIso}
            day={day}
            isOtherMonth={isOtherMonth}
            isToday={isToday}
            hasInstallation={Boolean(dayHasInstallation)}
            isFirstInstallDay={idx === 0 && Boolean(schedule)}
            isLastInstallDay={idx === 4 && Boolean(schedule)}
            schedule={dayHasInstallation ? schedule : null}
            onClick={() => onSelect(weekIso)}
          />
        );
      })}
    </div>
  );
}

function DayCell({
  day,
  isOtherMonth,
  isToday,
  hasInstallation,
  isFirstInstallDay,
  isLastInstallDay,
  schedule,
  onClick,
}: {
  day: Date;
  isOtherMonth: boolean;
  isToday: boolean;
  hasInstallation: boolean;
  isFirstInstallDay: boolean;
  isLastInstallDay: boolean;
  schedule: InstallationSchedule | null;
  onClick: () => void;
}) {
  const bg = hasInstallation && schedule ? schedule.teamColor : undefined;
  const textDark = bg ? !isColorDark(bg) : true;

  const cellStyle: CSSProperties = {
    background: bg,
    borderTopLeftRadius: isFirstInstallDay ? 6 : undefined,
    borderBottomLeftRadius: isFirstInstallDay ? 6 : undefined,
    borderTopRightRadius: isLastInstallDay ? 6 : undefined,
    borderBottomRightRadius: isLastInstallDay ? 6 : undefined,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-16 px-1.5 py-1 text-left transition-colors ${
        !bg
          ? `border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] rounded ${
              isOtherMonth ? "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]" : ""
            }`
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

      {isFirstInstallDay && schedule ? (
        <ScheduleDraggable schedule={schedule} />
      ) : null}
    </button>
  );
}

function ScheduleDraggable({ schedule }: { schedule: InstallationSchedule }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: schedule.id });
  const textDark = !isColorDark(schedule.teamColor);
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
  const textDark = !isColorDark(schedule.teamColor);
  return (
    <div
      className={`rounded-md px-3 py-2 text-xs font-medium shadow-lg ${
        textDark ? "text-[#0c3b6e]" : "text-white"
      }`}
      style={{ background: schedule.teamColor, minWidth: 160 }}
    >
      {schedule.project?.clientName ?? "Instalación"}
      <p className="text-[10px] opacity-80 mt-0.5">{schedule.teamName}</p>
    </div>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function SidePanel({
  selectedWeek,
  selectedSchedule,
  freeWeeks,
  onOpenNewForWeek,
  onConfirm,
  onReprogramClick,
  onDelete,
  onPatch,
  onProjectClick,
}: {
  selectedWeek: string | null;
  selectedSchedule: InstallationSchedule | null;
  freeWeeks: string[];
  onOpenNewForWeek: (weekIso: string) => void;
  onConfirm: (id: string) => void;
  onReprogramClick: () => void;
  onDelete: (id: string) => void;
  onPatch: (id: string, body: { teamName?: string; teamColor?: string; notes?: string | null }) => Promise<void>;
  onProjectClick: (projectId: string) => void;
}) {
  if (!selectedWeek) {
    return (
      <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          Seleccioná una semana para ver el detalle.
        </p>
        {freeWeeks.length > 0 && (
          <>
            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
              Semanas libres
            </p>
            <div className="flex flex-col gap-1.5">
              {freeWeeks.map((wk) => (
                <button
                  key={wk}
                  type="button"
                  onClick={() => onOpenNewForWeek(wk)}
                  className="text-left rounded border border-dashed border-[var(--color-border-hover)] px-2 py-1.5 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
                >
                  {formatWeekLabel(parseIso(wk))}
                </button>
              ))}
            </div>
          </>
        )}
      </aside>
    );
  }

  if (!selectedSchedule) {
    return (
      <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
          {formatWeekLabel(parseIso(selectedWeek))}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">Semana libre</p>
        <Button size="sm" onClick={() => onOpenNewForWeek(selectedWeek)}>
          + Asignar proyecto
        </Button>
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

  // sync cuando cambia el schedule seleccionado
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

  const textDark = !isColorDark(schedule.teamColor);
  const confirmed = Boolean(schedule.confirmedAt);

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
        <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)]">
          {formatWeekLabel(parseIso(schedule.weekStart))}
        </p>
        <div className="mt-1.5">
          {confirmed ? (
            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-[var(--color-state-done-text)] bg-[var(--color-state-done-bg)]">
              Confirmada
            </span>
          ) : (
            <span className="inline-block rounded px-2 py-0.5 text-[10px] font-semibold text-[var(--color-warning-text)] bg-[var(--color-warning-bg)]">
              Sin confirmar
            </span>
          )}
        </div>
      </div>

      {schedule.project && (
        <button
          type="button"
          onClick={() => schedule.project && onProjectClick(schedule.project.id)}
          className="block w-full rounded-md p-2.5 text-left transition-opacity hover:opacity-90"
          style={{ background: schedule.teamColor, color: textDark ? "#0c3b6e" : "#ffffff" }}
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

function NewScheduleModal({
  prefillWeek,
  teams,
  onClose,
  onCreated,
}: {
  prefillWeek: string | null;
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
  const [weekStart, setWeekStart] = useState(prefillWeek ?? "");
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState<string>(TEAM_COLORS[0]!);
  const [notes, setNotes] = useState("");
  const [weekError, setWeekError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      createSchedule({
        projectId,
        teamName: teamName.trim(),
        teamColor,
        weekStart,
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

  function handleWeekChange(value: string) {
    setWeekStart(value);
    setWeekError(null);
    if (!value) return;
    const d = parseIso(value);
    if (d.getUTCDay() !== 1) {
      setWeekError("Debe ser un lunes");
    }
  }

  function canSubmit() {
    return projectId && weekStart && teamName.trim() && !weekError && !mutation.isPending;
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

        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Semana de inicio (lunes)
          </label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => handleWeekChange(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            required
          />
          {weekError ? (
            <p className="mt-1 text-[10px] text-red-400">{weekError}</p>
          ) : null}
        </div>

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
  targetWeekStart,
  onCancel,
  onConfirm,
  loading,
}: {
  clientName: string;
  targetWeekStart: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <ModalShell title="Mover instalación" onClose={onCancel}>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        ¿Mover {clientName} a la semana del {formatWeekLabel(parseIso(targetWeekStart))}?
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
  onConfirm: (newWeek: string) => void;
  loading: boolean;
}) {
  const [value, setValue] = useState(schedule.weekStart);
  const [error, setError] = useState<string | null>(null);

  function handleChange(v: string) {
    setValue(v);
    setError(null);
    if (!v) return;
    const d = parseIso(v);
    if (d.getUTCDay() !== 1) setError("Debe ser un lunes");
  }

  return (
    <ModalShell title="Reprogramar instalación" onClose={onCancel}>
      <p className="text-xs text-[var(--color-text-muted)] mb-3">
        Seleccioná la nueva semana (debe ser un lunes).
      </p>
      <input
        type="date"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
      />
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          size="sm"
          loading={loading}
          disabled={!!error || !value || value === schedule.weekStart}
          onClick={() => onConfirm(value)}
        >
          Confirmar nueva fecha
        </Button>
      </div>
    </ModalShell>
  );
}


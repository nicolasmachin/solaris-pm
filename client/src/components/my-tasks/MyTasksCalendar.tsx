import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";

// Calendario para "Mis Tareas". Implementación sin librería externa: CSS
// Grid + Date nativo. Dos modos (Semana / Mes) con navegación ← → y "Hoy".
// Items sin fecha o COMPLETED se filtran antes en useCalendarEvents.

interface Props {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

type CalendarMode = "week" | "month";

// ─── Helpers de fecha ──────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const WEEKDAY_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function addMonths(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + n);
  return copy;
}

// Lunes de la semana de d (lunes=primer día, según UI rioplatense).
function startOfWeek(d: Date): Date {
  const copy = startOfDay(d);
  const dow = copy.getDay(); // 0=dom, 1=lun, ..., 6=sab
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(copy, diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

// Para la grilla mensual: arranca en el lunes de la semana del primer día
// del mes y termina en el domingo de la semana del último día.
function monthGridRange(d: Date): { start: Date; end: Date; weeks: number } {
  const first = startOfMonth(d);
  const last = endOfMonth(d);
  const start = startOfWeek(first);
  const lastWeekStart = startOfWeek(last);
  const end = addDays(lastWeekStart, 6);
  const msPerDay = 1000 * 60 * 60 * 24;
  const weeks = Math.round((end.getTime() - start.getTime()) / msPerDay / 7) + 1;
  return { start, end, weeks };
}

// ─── Color helpers ─────────────────────────────────────────────────────────

function pillClass(color: CalendarEvent["color"]): string {
  switch (color) {
    case "blue":
      return "bg-blue-500/20 text-blue-200 border-blue-500/40 hover:bg-blue-500/30";
    case "purple":
      return "bg-purple-500/20 text-purple-200 border-purple-500/40 hover:bg-purple-500/30";
    case "amber":
      return "bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30";
  }
}

// ─── Componente principal ──────────────────────────────────────────────────

export function MyTasksCalendar({ events, onEventClick, onDayClick }: Props) {
  const [mode, setMode] = useState<CalendarMode>("week");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));

  const today = useMemo(() => startOfDay(new Date()), []);

  // Indexamos events por YYYY-MM-DD para lookups O(1) por día.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`;
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  function getDayEvents(d: Date): CalendarEvent[] {
    return eventsByDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];
  }

  function goToday() {
    setCursor(startOfDay(new Date()));
  }

  function navigate(delta: number) {
    if (mode === "week") setCursor(addDays(cursor, delta * 7));
    else setCursor(addMonths(cursor, delta));
  }

  const headerLabel = useMemo(() => {
    if (mode === "week") {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      if (sameMonth) {
        return `${ws.getDate()} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
      }
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
    }
    return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [mode, cursor]);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-app)] text-[var(--color-text-secondary)] transition-colors"
            aria-label="Anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="p-1.5 rounded-md border border-[var(--color-border)] hover:bg-[var(--color-bg-app)] text-[var(--color-text-secondary)] transition-colors"
            aria-label="Siguiente"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="px-3 py-1.5 rounded-md border border-[var(--color-border)] text-xs font-medium hover:bg-[var(--color-bg-app)] text-[var(--color-text-secondary)] transition-colors"
          >
            Hoy
          </button>
          <span className="ml-2 text-sm font-medium text-[var(--color-text-primary)] capitalize">
            {headerLabel}
          </span>
        </div>
        <div className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("week")}
            className={`px-3 py-1 rounded transition-colors ${
              mode === "week"
                ? "bg-[var(--color-accent)] text-gray-900 font-medium"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            Semana
          </button>
          <button
            type="button"
            onClick={() => setMode("month")}
            className={`px-3 py-1 rounded transition-colors ${
              mode === "month"
                ? "bg-[var(--color-accent)] text-gray-900 font-medium"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            Mes
          </button>
        </div>
      </header>

      {mode === "week" ? (
        <WeekView
          cursor={cursor}
          today={today}
          getDayEvents={getDayEvents}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />
      ) : (
        <MonthView
          cursor={cursor}
          today={today}
          getDayEvents={getDayEvents}
          onEventClick={onEventClick}
          onDayClick={onDayClick}
        />
      )}

      <footer className="flex flex-wrap items-center gap-3 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
        <LegendDot color="blue" label="Subetapa" />
        <LegendDot color="purple" label="Tarea de proyecto" />
        <LegendDot color="amber" label="Tarea suelta" />
      </footer>
    </div>
  );
}

// ─── Vista Semana ──────────────────────────────────────────────────────────

interface ViewProps {
  cursor: Date;
  today: Date;
  getDayEvents: (d: Date) => CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (d: Date) => void;
}

function WeekView({ cursor, today, getDayEvents, onEventClick, onDayClick }: ViewProps) {
  const ws = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  return (
    <div className="grid grid-cols-7 min-h-[420px]">
      {days.map((d, i) => {
        const isToday = isSameDay(d, today);
        const dayEvents = getDayEvents(d);
        return (
          <DayCell
            key={i}
            date={d}
            isToday={isToday}
            isMuted={false}
            events={dayEvents}
            maxVisible={4}
            onEventClick={onEventClick}
            onDayClick={onDayClick}
            showWeekdayHeader
          />
        );
      })}
    </div>
  );
}

// ─── Vista Mes ─────────────────────────────────────────────────────────────

function MonthView({ cursor, today, getDayEvents, onEventClick, onDayClick }: ViewProps) {
  const { start, weeks } = monthGridRange(cursor);
  const totalCells = weeks * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => addDays(start, i));
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-app)]">
        {WEEKDAY_SHORT.map((w) => (
          <div
            key={w}
            className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] text-center"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-flow-row" style={{ gridAutoRows: "minmax(96px, 1fr)" }}>
        {cells.map((d, i) => {
          const isToday = isSameDay(d, today);
          const isMuted = d.getMonth() !== cursor.getMonth();
          const dayEvents = getDayEvents(d);
          return (
            <DayCell
              key={i}
              date={d}
              isToday={isToday}
              isMuted={isMuted}
              events={dayEvents}
              maxVisible={2}
              onEventClick={onEventClick}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Celda de día ──────────────────────────────────────────────────────────

interface DayCellProps {
  date: Date;
  isToday: boolean;
  isMuted: boolean;
  events: CalendarEvent[];
  maxVisible: number;
  onEventClick: (e: CalendarEvent) => void;
  onDayClick: (d: Date) => void;
  showWeekdayHeader?: boolean;
}

function DayCell({
  date,
  isToday,
  isMuted,
  events,
  maxVisible,
  onEventClick,
  onDayClick,
  showWeekdayHeader,
}: DayCellProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? events : events.slice(0, maxVisible);
  const hidden = events.length - visible.length;

  return (
    <div
      className={`relative border-r border-b border-[var(--color-border)] last:border-r-0 p-1.5 ${
        isMuted ? "bg-[var(--color-bg-app)]/40" : ""
      } cursor-pointer hover:bg-[var(--color-bg-card-hover)]/40 transition-colors`}
      onClick={(e) => {
        // Solo dispara onDayClick si el click fue sobre el fondo del día, no
        // sobre un pill o el botón "+N más".
        if (e.target === e.currentTarget) onDayClick(date);
      }}
    >
      <div
        className={`flex items-baseline gap-1.5 mb-1 ${
          isMuted ? "text-[var(--color-text-muted)]/60" : "text-[var(--color-text-secondary)]"
        }`}
      >
        {showWeekdayHeader ? (
          <span className="text-[10px] font-mono uppercase tracking-widest">
            {WEEKDAY_SHORT[date.getDay() === 0 ? 6 : date.getDay() - 1]}
          </span>
        ) : null}
        <span
          className={`inline-flex items-center justify-center text-xs font-semibold ${
            isToday
              ? "h-5 w-5 rounded-full bg-[var(--color-accent)] text-gray-900"
              : ""
          }`}
        >
          {date.getDate()}
        </span>
      </div>
      <ul className="space-y-0.5">
        {visible.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={(ev) => {
                ev.stopPropagation();
                onEventClick(e);
              }}
              className={`block w-full text-left truncate px-1.5 py-0.5 rounded text-[10px] border ${pillClass(
                e.color,
              )}`}
              title={e.projectName ? `${e.title} · ${e.projectName}` : e.title}
            >
              {e.title}
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={(ev) => {
            ev.stopPropagation();
            setExpanded(true);
          }}
          className="mt-0.5 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] underline"
        >
          + {hidden} más
        </button>
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: CalendarEvent["color"]; label: string }) {
  const dot =
    color === "blue"
      ? "bg-blue-500"
      : color === "purple"
        ? "bg-purple-500"
        : "bg-amber-500";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

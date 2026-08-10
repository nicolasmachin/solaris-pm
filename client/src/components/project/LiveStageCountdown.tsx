import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { StageCountdown } from "../../types/api.types";

// Cuenta regresiva EN VIVO de la etapa actual (tick por segundo). A diferencia
// del `CountdownHero` (días hábiles, estático), esta muestra días/horas/min/seg
// y se **pausa los fines de semana**: sólo descuenta tiempo de lun-vie. Se usa
// únicamente en la cabecera del proyecto abierto, al lado del estado.

const DAY_MS = 24 * 60 * 60 * 1000;
// Umbral (en ms hábiles) para pasar a amarillo: 2 días hábiles, alineado con
// STAGE_SLA_WARNING_DIAS del backend.
const WARNING_MS = 2 * DAY_MS;

type LiveStatus = "ok" | "warning" | "overdue";

// ms que caen en días hábiles (lun-vie, hora local) dentro de [from, to].
// Devuelve >= 0. Recorre el intervalo día por día, así que los ms de sábado y
// domingo no suman: por eso la cuenta "se congela" el fin de semana.
function businessMillisBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let total = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    const dow = cursor.getDay(); // 0 = domingo, 6 = sábado
    const nextMidnight = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
      0,
      0,
      0,
      0,
    );
    const segEnd = nextMidnight < to ? nextMidnight : to;
    if (dow !== 0 && dow !== 6) total += segEnd.getTime() - cursor.getTime();
    cursor.setTime(segEnd.getTime());
  }
  return total;
}

// El `deadline` viene como "YYYY-MM-DD" (fin del día hábil objetivo). El
// vencimiento real es el fin de ese día → medianoche local del día siguiente.
function deadlineInstant(deadlineStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadlineStr);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d + 1, 0, 0, 0, 0);
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}

interface Parts {
  status: LiveStatus;
  overdue: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isWeekend: boolean;
}

function computeParts(deadline: Date, now: Date): Parts {
  const overdue = now >= deadline;
  const ms = overdue
    ? businessMillisBetween(deadline, now)
    : businessMillisBetween(now, deadline);

  let status: LiveStatus;
  if (overdue) status = "overdue";
  else if (ms <= WARNING_MS) status = "warning";
  else status = "ok";

  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const dow = now.getDay();
  return { status, overdue, days, hours, minutes, seconds, isWeekend: dow === 0 || dow === 6 };
}

const TONE: Record<LiveStatus, { text: string; border: string; bg: string; glow: string }> = {
  ok: {
    text: "var(--color-success-text-strong)",
    border: "var(--color-success-text-strong)",
    bg: "var(--color-success-bg)",
    glow: "0 0 0 1px var(--color-success-text-strong)33",
  },
  warning: {
    text: "var(--color-warning-text)",
    border: "var(--color-warning-text)",
    bg: "var(--color-warning-bg)",
    glow: "0 0 0 1px var(--color-warning-text)33",
  },
  overdue: {
    text: "var(--color-danger-text)",
    border: "var(--color-danger-text)",
    bg: "var(--color-danger-bg)",
    glow: "0 0 0 1px var(--color-danger-text)44",
  },
};

export function LiveStageCountdown({
  countdown,
  stageLabel,
}: {
  countdown: StageCountdown;
  stageLabel?: string;
}) {
  const deadline = deadlineInstant(countdown.deadline);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!deadline) return null;

  const p = computeParts(deadline, now);
  const tone = TONE[p.status];
  const sign = p.overdue ? "−" : "";

  const seg = (value: number, label: string) => (
    <div className="flex flex-col items-center leading-none">
      <span className="font-mono text-lg font-bold tabular-nums md:text-xl">{two(value)}</span>
      <span className="mt-0.5 text-[8px] uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </span>
    </div>
  );

  return (
    <div
      className="flex flex-col items-center gap-1 rounded-lg border px-3 py-1.5"
      style={{ borderColor: tone.border, backgroundColor: tone.bg, boxShadow: tone.glow }}
      title={
        p.overdue
          ? `Etapa vencida. Plazo: ${countdown.slaDiasHabiles} días hábiles (venció el ${countdown.deadline})`
          : `Tiempo hábil restante en la etapa. Plazo: ${countdown.slaDiasHabiles} días hábiles (vence el ${countdown.deadline})`
      }
    >
      <div className="flex items-center gap-1">
        <Clock size={11} style={{ color: tone.text }} className="shrink-0" />
        <span
          className="max-w-[220px] truncate text-[10px] font-bold uppercase tracking-[0.1em]"
          style={{ color: tone.text }}
          title={stageLabel}
        >
          {stageLabel || (p.overdue ? "Etapa vencida" : "Tiempo de etapa")}
          {stageLabel && p.overdue ? " · Vencida" : ""}
        </span>
      </div>
      <div className="flex items-end gap-1.5" style={{ color: tone.text }}>
        {sign && (
          <span className="self-center font-mono text-lg font-bold md:text-xl">{sign}</span>
        )}
        {p.days > 0 && (
          <>
            {seg(p.days, p.days === 1 ? "día" : "días")}
            <span className="pb-3 font-mono text-base font-bold opacity-40">:</span>
          </>
        )}
        {seg(p.hours, "hs")}
        <span className="pb-3 font-mono text-base font-bold opacity-40">:</span>
        {seg(p.minutes, "min")}
        <span className="pb-3 font-mono text-base font-bold opacity-40">:</span>
        {seg(p.seconds, "seg")}
      </div>
      {p.isWeekend && (
        <span className="text-[8px] uppercase tracking-widest text-[var(--color-text-muted)]">
          ⏸ En pausa · fin de semana
        </span>
      )}
    </div>
  );
}

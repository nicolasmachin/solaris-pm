import { useQuery } from "@tanstack/react-query";
import { getAuditLog } from "../../api/audit.api";
import type { AuditLog } from "../../types/api.types";
import { Spinner } from "../ui/Spinner";

interface AuditHistoryProps {
  projectId: string;
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} día${days !== 1 ? "s" : ""}`;
}

function formatDay(ts: string): string {
  return new Date(ts).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function avatarColor(name: string): string {
  const colors = [
    "#f59e0b",
    "#60a5fa",
    "#4ade80",
    "#f87171",
    "#a78bfa",
    "#34d399",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return colors[idx];
}

function groupByDay(logs: AuditLog[]): Array<{ day: string; entries: AuditLog[] }> {
  const map = new Map<string, AuditLog[]>();
  for (const log of logs) {
    const day = new Date(log.timestamp).toISOString().slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(log);
  }
  return Array.from(map.entries()).map(([, entries]) => ({
    day: formatDay(entries[0].timestamp),
    entries,
  }));
}

export function AuditHistory({ projectId }: AuditHistoryProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", projectId],
    queryFn: () => getAuditLog(projectId, 20),
    staleTime: 30_000,
  });

  const groups = groupByDay(data ?? []);

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-4 mt-4">
      <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--color-text-muted)] mb-4">
        Historial de actividad
      </p>

      {isLoading && (
        <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs py-4">
          <Spinner size={14} /> Cargando historial...
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Sin actividad registrada aún
        </p>
      )}

      {groups.map((group) => (
        <div key={group.day} className="mb-4">
          <p className="text-[10px] font-medium text-[var(--color-text-muted)] capitalize mb-2 pb-1 border-b border-[var(--color-border)]">
            {group.day}
          </p>
          <ul className="space-y-3">
            {group.entries.map((log) => {
              const name = log.user?.name ?? "Sistema";
              const color = avatarColor(name);
              return (
                <li key={log.id} className="flex items-start gap-2.5">
                  <span
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-gray-900"
                    style={{ background: color }}
                  >
                    {initials(name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-text-primary)] leading-snug">
                      <span className="font-medium">{name}</span>{" "}
                      <span className="text-[var(--color-text-secondary)]">
                        {log.description}
                      </span>
                    </p>
                    <p
                      className="font-mono text-[10px] text-[var(--color-text-muted)] mt-0.5"
                      title={new Date(log.timestamp).toLocaleString("es-AR")}
                    >
                      {timeAgo(log.timestamp)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

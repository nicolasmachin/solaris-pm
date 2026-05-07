import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../../api/notifications.api";
import { useNotificationsStore } from "../../store/notifications.store";
import { Spinner } from "../ui/Spinner";
import type { NotificationType } from "../../types/api.types";

function getTypeIcon(type: NotificationType): string {
  switch (type) {
    case "task_due":
    case "TASK_OVERDUE":
      return "📅";
    case "stage_changed":
    case "STAGE_COMPLETED":
      return "✅";
    case "engineering_completed":
      return "⚡";
    case "progress_milestone":
    case "goals_not_configured":
      return "🎯";
    case "substage_blocked":
    case "SUBSTAGE_BLOCKED":
      return "🔒";
    case "stage_overdue":
      return "⚠️";
    case "project_delayed":
    case "PROJECT_DELAYED":
      return "🔴";
    default:
      return "📋";
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { unreadCount, setNotifications, markAsRead, markAllAsRead } = useNotificationsStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (data) setNotifications(data);
  }, [data, setNotifications]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const markOneMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (_, id) => {
      markAsRead(id);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      markAllAsRead();
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  function handleItemClick(id: string, projectId: string | null, read: boolean, type?: string) {
    if (!read) markOneMutation.mutate(id);
    setOpen(false);
    if (type === "goals_not_configured") {
      navigate("/admin");
    } else if (projectId) {
      navigate(`/projects/${projectId}`);
    }
  }

  const recent = (data ?? []).slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        aria-label="Notificaciones"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-84 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-2xl z-50" style={{ width: "22rem" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={20} />
              </div>
            ) : recent.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] text-center py-8">
                Sin notificaciones
              </p>
            ) : (
              recent.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n.id, n.projectId, n.read, n.type)}
                  className={`px-4 py-3 border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-bg-card-hover)] transition-colors ${
                    !n.read ? "bg-[var(--color-accent)]/5 border-l-2 border-l-[var(--color-accent)]" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0 mt-0.5">{getTypeIcon(n.type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--color-text-primary)] leading-snug">
                        {n.title}
                      </p>
                      {n.project && (
                        <p className="text-[11px] text-[var(--color-accent)] mt-0.5 truncate">
                          {n.project.clientName}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[var(--color-border)]">
            <button
              onClick={() => { setOpen(false); navigate("/notifications"); }}
              className="text-xs text-[var(--color-accent)] hover:underline w-full text-center"
            >
              Ver todas las notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

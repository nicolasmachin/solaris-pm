import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../api/notifications.api";
import { useNotificationsStore } from "../store/notifications.store";
import { Spinner } from "../components/ui/Spinner";
import type { Notification, NotificationType } from "../types/api.types";

const PAGE_SIZE = 20;

type FilterTab = "all" | "unread" | "type";

const TYPE_LABELS: Record<string, string> = {
  task_due: "Tarea vencida",
  TASK_OVERDUE: "Tarea vencida",
  stage_changed: "Etapa cambiada",
  STAGE_COMPLETED: "Etapa completada",
  progress_milestone: "Hito de progreso",
  substage_blocked: "Subetapa bloqueada",
  SUBSTAGE_BLOCKED: "Subetapa bloqueada",
  stage_overdue: "Etapa vencida",
  project_delayed: "Proyecto retrasado",
  PROJECT_DELAYED: "Proyecto retrasado",
  BUDGET_ALERT: "Alerta de presupuesto",
  TASK_ASSIGNED: "Tarea asignada",
};

function getTypeIcon(type: NotificationType): string {
  switch (type) {
    case "task_due":
    case "TASK_OVERDUE":
      return "📅";
    case "stage_changed":
    case "STAGE_COMPLETED":
      return "✅";
    case "progress_milestone":
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
  return new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

export function Notifications() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [typeFilter, setTypeFilter] = useState<NotificationType | "">("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { markAsRead, markAllAsRead } = useNotificationsStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    refetchInterval: 30_000,
  });

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

  const all = data ?? [];

  // Derive unique types present in data
  const presentTypes = Array.from(new Set(all.map((n) => n.type)));

  function applyFilter(notifications: Notification[]): Notification[] {
    if (filter === "unread") return notifications.filter((n) => !n.read);
    if (filter === "type" && typeFilter) return notifications.filter((n) => n.type === typeFilter);
    return notifications;
  }

  const filtered = applyFilter(all);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleFilterChange(tab: FilterTab) {
    setFilter(tab);
    setPage(1);
  }

  function handleItemClick(n: Notification) {
    if (!n.read) markOneMutation.mutate(n.id);
    if (n.projectId) navigate(`/projects/${n.projectId}`);
  }

  const unreadCount = all.filter((n) => !n.read).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {unreadCount} sin leer
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="text-sm text-[var(--color-accent)] hover:underline disabled:opacity-50"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-[var(--color-border)]">
        <button
          onClick={() => handleFilterChange("all")}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            filter === "all"
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Todas ({all.length})
        </button>
        <button
          onClick={() => handleFilterChange("unread")}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            filter === "unread"
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          No leídas ({unreadCount})
        </button>
        <div className="relative ml-1">
          <button
            onClick={() => handleFilterChange("type")}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1 ${
              filter === "type"
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            Por tipo
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Type sub-filter */}
      {filter === "type" && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => { setTypeFilter(""); setPage(1); }}
            className={`px-2 py-1 text-xs rounded-full border transition-colors ${
              typeFilter === ""
                ? "bg-[var(--color-accent)] text-gray-900 border-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
            }`}
          >
            Todos los tipos
          </button>
          {presentTypes.map((type) => (
            <button
              key={type}
              onClick={() => { setTypeFilter(type); setPage(1); }}
              className={`px-2 py-1 text-xs rounded-full border transition-colors flex items-center gap-1 ${
                typeFilter === type
                  ? "bg-[var(--color-accent)] text-gray-900 border-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
              }`}
            >
              {getTypeIcon(type)} {TYPE_LABELS[type] ?? type}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={28} />
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] text-sm">Todo al día, sin notificaciones</p>
        </div>
      ) : (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          {paginated.map((n, idx) => (
            <div
              key={n.id}
              onClick={() => handleItemClick(n)}
              className={`px-4 py-4 cursor-pointer hover:bg-[var(--color-bg-card-hover)] transition-colors ${
                idx < paginated.length - 1 ? "border-b border-[var(--color-border)]" : ""
              } ${!n.read ? "bg-[var(--color-accent)]/5 border-l-4 border-l-[var(--color-accent)]" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0 mt-0.5">{getTypeIcon(n.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${!n.read ? "font-semibold text-[var(--color-text-primary)]" : "font-medium text-[var(--color-text-primary)]"}`}>
                      {n.title}
                    </p>
                    <span className="text-[11px] text-[var(--color-text-muted)] flex-shrink-0">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                    {n.message}
                  </p>
                  {n.project && (
                    <p className="text-xs text-[var(--color-accent)] mt-1 truncate">
                      {n.project.clientName}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-border)] px-1.5 py-0.5 rounded">
                      {TYPE_LABELS[n.type] ?? n.type}
                    </span>
                    {!n.read && (
                      <button
                        onClick={(e) => { e.stopPropagation(); markOneMutation.mutate(n.id); }}
                        className="text-[11px] text-[var(--color-accent)] hover:underline"
                      >
                        Marcar como leída
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md disabled:opacity-40 hover:bg-[var(--color-bg-card-hover)] transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-[var(--color-text-secondary)]">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md disabled:opacity-40 hover:bg-[var(--color-bg-card-hover)] transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

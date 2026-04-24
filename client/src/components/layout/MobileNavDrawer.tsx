import { useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  TrendingUp,
  Wallet,
  Package,
  BarChart3,
  Users,
  ListTodo,
  FileCheck,
  X,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { CanAccess } from "../ui/CanAccess";

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // ESC cierra + focus inicial al abrir
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Al abrir, mover foco al primer link.
    const t = setTimeout(() => firstLinkRef.current?.focus(), 40);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose]);

  // Si la pantalla pasa a desktop, cerrar automáticamente.
  useEffect(() => {
    if (!open) return;
    function onResize() {
      if (window.innerWidth >= 768) onClose();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, onClose]);

  // Cerrar al cambiar de ruta
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Focus trap básico: al TAB sobre el último, vuelve al primero y viceversa.
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = panelRef.current.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "U";

  function handleLogout() {
    clearAuth();
    window.location.href = "/login";
  }

  function linkClass({ isActive }: { isActive: boolean }): string {
    return [
      "flex items-center gap-3 px-4 py-3 text-sm transition-colors border-l-2",
      isActive
        ? "border-l-[var(--color-accent)] bg-[var(--color-warning-bg)] text-[var(--color-text-primary)]"
        : "border-l-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]",
    ].join(" ");
  }

  return (
    <div
      className={`md:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <nav
        ref={panelRef}
        role="navigation"
        aria-label="Menú principal"
        onKeyDown={handleKeyDown}
        className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-sidebar)] shadow-2xl transition-transform duration-200"
        style={{ transform: open ? "translateX(0)" : "translateX(-100%)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4" style={{ height: 52 }}>
          <span className="font-display font-bold text-base tracking-wide text-[var(--color-text-primary)]">
            VOLTIA PM
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto py-2">
          <NavLink ref={firstLinkRef} to="/mis-tareas" className={linkClass}>
            <ListTodo size={18} className="shrink-0" />
            <span>Mis tareas</span>
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            <LayoutDashboard size={18} className="shrink-0" />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/projects" className={linkClass}>
            <FolderKanban size={18} className="shrink-0" />
            <span>Proyectos</span>
          </NavLink>
          <CanAccess module="OPERACIONES" action="VIEW">
            <NavLink to="/calendario" className={linkClass}>
              <Calendar size={18} className="shrink-0" />
              <span>Calendario</span>
            </NavLink>
          </CanAccess>
          <CanAccess module="VENTAS" action="VIEW">
            <NavLink to="/ventas" className={linkClass}>
              <TrendingUp size={18} className="shrink-0" />
              <span>Ventas</span>
            </NavLink>
          </CanAccess>
          <CanAccess module="FINANZAS" action="VIEW">
            <NavLink to="/finanzas" className={linkClass}>
              <Wallet size={18} className="shrink-0" />
              <span>Finanzas</span>
            </NavLink>
          </CanAccess>
          <CanAccess module="STOCK" action="VIEW">
            <NavLink to="/stock" className={linkClass}>
              <Package size={18} className="shrink-0" />
              <span>Stock</span>
            </NavLink>
          </CanAccess>
          <CanAccess module="TRAMITES_UTE" action="VIEW">
            <NavLink to="/tramites-ute" className={linkClass}>
              <FileCheck size={18} className="shrink-0" />
              <span>Trámites UTE</span>
            </NavLink>
          </CanAccess>
          <CanAccess module="METRICAS" action="VIEW">
            <NavLink to="/metrics" className={linkClass}>
              <BarChart3 size={18} className="shrink-0" />
              <span>Métricas</span>
            </NavLink>
          </CanAccess>
          <CanAccess module="USUARIOS" action="VIEW">
            <NavLink to="/admin" className={linkClass}>
              <Users size={18} className="shrink-0" />
              <span>Admin</span>
            </NavLink>
          </CanAccess>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/settings");
            }}
            className="flex w-full items-center gap-3 rounded-md py-1.5 text-left transition-colors hover:bg-[var(--color-bg-card-hover)]"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-bold text-gray-900">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">
                {user?.name ?? "Usuario"}
              </span>
              <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
                {user?.email ?? ""}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-red-400 hover:bg-[var(--color-bg-card-hover)] transition-colors"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

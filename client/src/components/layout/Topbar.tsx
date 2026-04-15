import { useRef, useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../../hooks/useTheme";
import { useAuthStore } from "../../store/auth.store";
import { NotificationBell } from "../notifications/NotificationBell";
import { CanAccess } from "../ui/CanAccess";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

interface TopbarProps {
  onMenuToggle: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { mode, toggle } = useTheme();
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const initials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "U";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm transition-colors pb-0.5 ${
      isActive
        ? "text-[var(--color-accent)] border-b border-[var(--color-accent)]"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
    }`;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-sidebar)]"
      style={{ height: 52 }}
    >
      {/* Left: hamburger (mobile) + logo */}
      <div className="flex items-center gap-3">
        <button
          className="md:hidden p-1.5 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors"
          onClick={onMenuToggle}
          aria-label="Menú"
        >
          <HamburgerIcon />
        </button>

        <NavLink to="/dashboard" className="flex items-center gap-2 no-underline">
          {/* Electric blue + yellow mark */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4fa6ff"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="5" fill="#ffd84d" fillOpacity="0.28" />
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          <span className="font-display font-bold text-base tracking-wide text-[var(--color-text-primary)]">
            VOLTIA PM
          </span>
        </NavLink>

        {/* Nav links — hidden on mobile */}
        <nav className="hidden md:flex items-center gap-6 ml-6">
          <NavLink to="/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/projects" className={navLinkClass}>
            Proyectos
          </NavLink>
          <CanAccess module="VENTAS" action="VIEW">
            <NavLink to="/ventas" className={navLinkClass}>
              Ventas
            </NavLink>
          </CanAccess>
          <CanAccess module="METRICAS" action="VIEW">
            <NavLink to="/metrics" className={navLinkClass}>
              Métricas
            </NavLink>
          </CanAccess>
          <CanAccess module="USUARIOS" action="VIEW">
            <NavLink to="/admin" className={navLinkClass}>
              Admin
            </NavLink>
          </CanAccess>
        </nav>
      </div>

      {/* Right: theme toggle + bell + user */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggle}
          className="p-2 rounded-md hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          aria-label="Cambiar tema"
        >
          {mode === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <NotificationBell />

        {/* User avatar + dropdown */}
        <div className="relative ml-1" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-border)] transition-colors"
          >
            <span className="hidden md:block text-sm text-[var(--color-text-secondary)]">
              {user?.name ?? "Usuario"}
            </span>
            <span className="w-7 h-7 rounded-full bg-[var(--color-accent)] text-gray-900 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {initials}
            </span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 py-1">
              <div className="px-4 py-2 border-b border-[var(--color-border)]">
                <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                  {user?.name}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {user?.email}
                </p>
              </div>
              <button
                onClick={() => { setUserMenuOpen(false); navigate("/settings"); }}
                className="w-full text-left px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
              >
                Configuración
              </button>
              <button
                onClick={() => {
                  clearAuth();
                  window.location.href = "/login";
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[var(--color-bg-card-hover)] transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

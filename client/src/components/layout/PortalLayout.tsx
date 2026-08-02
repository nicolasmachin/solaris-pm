import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { PortalNotificationBell } from './PortalNotificationBell';

export function PortalLayout() {
  const { user, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  function logout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] flex flex-col">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/portal" className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4fa6ff" strokeWidth="2">
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
              VOLTIA
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <PortalNotificationBell />
            <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-[var(--color-bg-card-hover)] text-sm text-[var(--color-text-secondary)]"
            >
              <span className="hidden sm:inline">{user?.name ?? 'Mi cuenta'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-lg z-20">
                  <Link
                    to="/cambiar-password"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                  >
                    <KeyRound className="w-4 h-4" />
                    Cambiar contraseña
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
        <nav className="max-w-3xl mx-auto flex items-center gap-1 px-4">
          {[
            { to: "/portal", label: "Mis proyectos", end: true },
            { to: "/portal/reportes", label: "Reportes", end: false },
            { to: "/portal/tickets", label: "Mis tickets", end: false },
            { to: "/portal/encuestas", label: "Encuestas", end: false },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "px-3 py-2 text-sm border-b-2 -mb-[1px] transition-colors",
                  isActive
                    ? "border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-[var(--color-border)] py-3 text-center text-[10px] text-[var(--color-text-muted)] font-mono">
        Voltia · Portal de Generadores
      </footer>
    </div>
  );
}

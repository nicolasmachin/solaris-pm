import { Navigate, NavLink, Outlet } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

import { usePermission } from "../hooks/usePermission";

// Layout de Soporte con tabs por URL: Mesa (índice), Tickets y Evolución. Los
// tickets se mudaron acá desde Mis tareas, y los ven muchos más roles que la
// mesa: por eso se entra con SOPORTE o con TICKETS, y cada tab pide el suyo.
export function SoporteLayout() {
  const canSoporte = usePermission("SOPORTE", "VIEW");
  const canTickets = usePermission("TICKETS", "VIEW");

  if (!canSoporte && !canTickets) return <Navigate to="/dashboard" replace />;

  const tabs = [
    { to: "", label: "Mesa", end: true, show: canSoporte },
    { to: "tickets", label: "Tickets", end: false, show: canTickets },
    { to: "evolucion", label: "Evolución", end: false, show: canSoporte },
  ].filter((t) => t.show);

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b border-[var(--color-border)]">
        <h1 className="flex items-center gap-2 pb-2 font-display text-xl font-bold text-[var(--color-text-primary)]">
          <LifeBuoy className="h-5 w-5 text-[var(--color-accent)]" /> Soporte
        </h1>
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to || "index"}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                [
                  "px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-[1px] transition-colors",
                  isActive
                    ? "border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                ].join(" ")
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      <Outlet />
    </div>
  );
}

/** Índice de /soporte: la mesa, o los tickets si el rol no ve la mesa. */
export function SoporteIndex({ children }: { children: React.ReactNode }) {
  const canSoporte = usePermission("SOPORTE", "VIEW");
  if (!canSoporte) return <Navigate to="tickets" replace />;
  return <>{children}</>;
}

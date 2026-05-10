import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "movimientos", label: "Movimientos" },
  { to: "proveedores", label: "Proveedores" },
  { to: "cobros", label: "Cobros" },
  { to: "flujo", label: "Flujo de fondos" },
  { to: "resultados", label: "Estado de resultados" },
  { to: "cuentas", label: "Cuentas" },
];

export function FinanceLayout() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Finanzas
        </h1>
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--color-border)] overflow-x-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
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

      <Outlet />
    </div>
  );
}

export function FinancePlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-12 text-center">
      <p className="text-base font-medium text-[var(--color-text-secondary)] mb-1">{title}</p>
      <p className="text-sm text-[var(--color-text-muted)]">Próximamente disponible.</p>
    </div>
  );
}

import { Fragment } from "react";
import { NavLink, Outlet } from "react-router-dom";

// Menú de Finanzas agrupado como los programas de contabilidad: lo que entra
// (Ventas), lo que sale (Compras), dónde está la plata (Bancos) y qué dice todo
// junto (Informes), más un Inicio con lo urgente. Una sola fila, con el nombre
// del grupo antes de sus pestañas: sin segundo nivel, así nada queda a dos clics.
// Las direcciones viejas (pendientes, cuentas-por-pagar) redirigen en App.tsx.
const GRUPOS: Array<{ label: string | null; tabs: Array<{ to: string; label: string }> }> = [
  { label: null, tabs: [{ to: "inicio", label: "Inicio" }] },
  { label: "Ventas", tabs: [{ to: "cobros", label: "Cobros" }, { to: "facturacion", label: "Facturación" }] },
  {
    label: "Compras",
    tabs: [
      { to: "facturas-proveedores", label: "Facturas" },
      { to: "proveedores", label: "Proveedores" },
      { to: "instaladores", label: "Instaladores" },
      { to: "costos-fijos", label: "Costos fijos" },
    ],
  },
  {
    label: "Bancos",
    tabs: [
      { to: "banco", label: "Banco" },
      { to: "tarjetas", label: "Tarjetas" },
      { to: "movimientos", label: "Movimientos" },
      { to: "cuentas", label: "Cuentas" },
    ],
  },
  {
    label: "Informes",
    tabs: [
      { to: "flujo", label: "Flujo" },
      { to: "resultados", label: "Resultados" },
      { to: "cierre", label: "Cierre" },
      { to: "historial", label: "Historial" },
    ],
  },
];

export function FinanceLayout() {
  return (
    <div className="space-y-5 p-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Finanzas
        </h1>
      </div>

      <div className="flex items-end gap-1 border-b border-[var(--color-border)] overflow-x-auto">
        {GRUPOS.map((g, gi) => (
          <Fragment key={g.label ?? "inicio"}>
            {gi > 0 && <span className="mx-1 mb-2.5 h-5 w-px shrink-0 bg-[var(--color-border)]" aria-hidden />}
            {g.label && (
              <span className="mb-3 shrink-0 pl-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                {g.label}
              </span>
            )}
            {g.tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  [
                    "px-2.5 py-2.5 text-[13px] whitespace-nowrap border-b-2 -mb-[1px] transition-colors",
                    isActive
                      ? "border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                  ].join(" ")
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </Fragment>
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

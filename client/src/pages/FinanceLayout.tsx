import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight, Banknote, CalendarCheck, ChartColumn, CreditCard, FileText, History, Home, Landmark,
  Receipt, Repeat, TrendingUp, Truck, Users, Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getTotalParaHacerHoy } from "../api/bancoConciliacion.api";

// Menú de Finanzas agrupado como los programas de contabilidad: lo que entra
// (Ventas), lo que sale (Compras), dónde está la plata (Bancos) y qué dice todo
// junto (Informes), más un Inicio con lo urgente. En pantalla grande es un menú
// lateral con los grupos y sus pantallas; en el celular, un desplegable.
// Las direcciones viejas (pendientes, cuentas-por-pagar) redirigen en App.tsx.
type Item = { to: string; label: string; icon: LucideIcon };
const GRUPOS: Array<{ label: string | null; items: Item[] }> = [
  { label: null, items: [{ to: "inicio", label: "Inicio", icon: Home }] },
  {
    label: "Ventas",
    items: [
      { to: "cobros", label: "Cobros", icon: Banknote },
      { to: "facturacion", label: "Facturación", icon: Receipt },
    ],
  },
  {
    label: "Compras",
    items: [
      { to: "facturas-proveedores", label: "Facturas", icon: FileText },
      { to: "proveedores", label: "Proveedores", icon: Truck },
      { to: "instaladores", label: "Instaladores", icon: Wrench },
      { to: "costos-fijos", label: "Costos fijos", icon: Repeat },
    ],
  },
  {
    label: "Bancos",
    items: [
      { to: "banco", label: "Banco", icon: Landmark },
      { to: "tarjetas", label: "Tarjetas", icon: CreditCard },
      { to: "movimientos", label: "Movimientos", icon: ArrowLeftRight },
      { to: "cuentas", label: "Cuentas", icon: Users },
    ],
  },
  {
    label: "Informes",
    items: [
      { to: "flujo", label: "Flujo de fondos", icon: TrendingUp },
      { to: "resultados", label: "Resultados", icon: ChartColumn },
      { to: "cierre", label: "Cierre de mes", icon: CalendarCheck },
      { to: "historial", label: "Historial", icon: History },
    ],
  },
];

const TODOS = GRUPOS.flatMap((g) => g.items);

export function FinanceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const actual = TODOS.find((i) => location.pathname.startsWith(`/finanzas/${i.to}`))?.to ?? "inicio";
  // El número de "Para hacer hoy" junto a Inicio (misma consulta que el menú principal).
  const { data: hoy } = useQuery({ queryKey: ["para-hacer-hoy-total"], queryFn: getTotalParaHacerHoy, staleTime: 60_000, retry: false });

  return (
    <div className="p-4 md:p-6">
      <h1 className="mb-4 font-display text-2xl font-bold text-[var(--color-text-primary)]">Finanzas</h1>

      {/* Celular: un desplegable agrupado. */}
      <select
        className="mb-4 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] md:hidden"
        value={actual}
        onChange={(e) => navigate(`/finanzas/${e.target.value}`)}
        aria-label="Sección de Finanzas"
      >
        {GRUPOS.map((g) =>
          g.label ? (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((i) => <option key={i.to} value={i.to}>{i.label}</option>)}
            </optgroup>
          ) : (
            g.items.map((i) => <option key={i.to} value={i.to}>{i.label}</option>)
          ),
        )}
      </select>

      <div className="md:flex md:gap-6">
        {/* Pantalla grande: menú lateral con los grupos. */}
        <nav className="hidden md:block w-48 shrink-0" aria-label="Secciones de Finanzas">
          <div className="sticky top-4 space-y-4">
            {GRUPOS.map((g) => (
              <div key={g.label ?? "inicio"}>
                {g.label && (
                  <p className="mb-1 px-3 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">{g.label}</p>
                )}
                <ul className="space-y-0.5">
                  {g.items.map((i) => {
                    const Icon = i.icon;
                    return (
                      <li key={i.to}>
                        <NavLink
                          to={i.to}
                          className={({ isActive }) =>
                            [
                              "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                              isActive
                                ? "bg-[var(--color-accent)]/15 text-[var(--color-text-primary)] font-medium"
                                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-secondary)]",
                            ].join(" ")
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1">{i.label}</span>
                          {i.to === "inicio" && (hoy?.total ?? 0) > 0 && (
                            <span className={`rounded-full px-1.5 text-[10px] font-bold ${hoy?.vencidos ? "bg-red-500 text-white" : "bg-[var(--color-accent)] text-black"}`}>
                              {hoy!.total}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1 space-y-5">
          <Outlet />
        </div>
      </div>
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

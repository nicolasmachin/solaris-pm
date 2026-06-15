import { NavLink } from "react-router-dom";
import { TrendingUp, HardHat, Wallet, MoreHorizontal, type LucideIcon } from "lucide-react";

import { CanAccess } from "../ui/CanAccess";

interface BottomTabBarProps {
  // Abre el MobileNavDrawer existente (estado en AppLayout).
  onMore: () => void;
}

function tabClass(isActive: boolean): string {
  return [
    "tap-target flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors",
    isActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
  ].join(" ");
}

function Tab({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink to={to} className={({ isActive }) => tabClass(isActive)}>
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  );
}

// Bottom tab bar móvil (solo `< md`). Se suma al MobileNavDrawer existente: los
// 3 módulos de campo + "Más" (que abre el drawer). Respeta permisos vía
// <CanAccess>; "Más" siempre se muestra → fallback natural si el rol no ve
// ninguno de los 3.
export function BottomTabBar({ onMore }: BottomTabBarProps) {
  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[var(--color-border)] bg-[var(--color-bg-sidebar)] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <CanAccess module="VENTAS" action="VIEW">
        <Tab to="/ventas" icon={TrendingUp} label="Ventas" />
      </CanAccess>
      <CanAccess module="OPERACIONES" action="VIEW">
        <Tab to="/projects" icon={HardHat} label="Operaciones" />
      </CanAccess>
      <CanAccess module="FINANZAS" action="VIEW">
        <Tab to="/finanzas" icon={Wallet} label="Finanzas" />
      </CanAccess>
      <button type="button" onClick={onMore} aria-label="Más opciones" className={tabClass(false)}>
        <MoreHorizontal className="h-5 w-5" />
        <span>Más</span>
      </button>
    </nav>
  );
}

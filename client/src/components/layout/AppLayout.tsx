import { useState } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { VersionFooter } from "./VersionFooter";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { BottomTabBar } from "./BottomTabBar";
import { FinanceInvariantBanner } from "../finance/FinanceInvariantBanner";
import { EngineeringProjectsSidebar } from "../ingenieria/EngineeringProjectsSidebar";
import { ClientesSidebar } from "../../modules/clientes/components/ClientesSidebar";
import { SidebarContextual, SIDEBAR_ANCHO } from "./SidebarContextual";
import { useSidebarColapsado } from "../../hooks/useSidebarColapsado";
import { TraspasoPopup } from "../traspasos/TraspasoPopup";

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isProjectDetail = !!useMatch("/projects/:id");
  // Workspace del módulo Ingeniería (incluye sub-páginas como /unifilar). El
  // sidebar lateral se mantiene visible mientras el usuario navega entre
  // herramientas del mismo proyecto. Los dos `useMatch` deben llamarse
  // INCONDICIONALMENTE en cada render — usar `||` entre ellos rompe las
  // rules of hooks por short-circuit.
  const matchIngenieriaWorkspace = useMatch("/ingenieria/proyecto/:id");
  const matchIngenieriaWorkspaceSub = useMatch("/ingenieria/proyecto/:id/*");
  const isIngenieriaWorkspace = !!matchIngenieriaWorkspace || !!matchIngenieriaWorkspaceSub;
  // La ficha del Generador tiene la misma necesidad que el detalle del proyecto:
  // saltar de un cliente a otro sin volver al listado.
  const isClienteFicha = !!useMatch("/clientes/:projectId");
  const showSidebar = isProjectDetail || isIngenieriaWorkspace || isClienteFicha;
  const [sidebarColapsado] = useSidebarColapsado();

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)]">
      <Topbar onMenuToggle={() => setMobileNavOpen((v) => !v)} />

      {/* Menú principal para móvil (hamburguesa en el topbar) */}
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Sidebar contextual: la lista del módulo en el que se está trabajando.
          Los tres comparten el marco y la preferencia de plegado. */}
      {showSidebar && (
        <SidebarContextual>
          {isProjectDetail && <Sidebar open={false} onClose={() => undefined} />}
          {isIngenieriaWorkspace && <EngineeringProjectsSidebar />}
          {isClienteFicha && <ClientesSidebar />}
        </SidebarContextual>
      )}

      <main
        className="overflow-y-auto min-h-screen"
        style={{
          marginLeft: showSidebar ? (sidebarColapsado ? 28 : SIDEBAR_ANCHO) : 0,
          paddingTop: 52,
        }}
      >
        {/* On mobile, remove the sidebar margin */}
        <style>{`
          @media (max-width: 767px) {
            main { margin-left: 0 !important; }
          }
        `}</style>
        {/* pb extra en móvil para que el bottom tab bar no tape el contenido
            (alto del tab bar + safe area). En ≥md vuelve al pb-10 normal. */}
        {/* pt chico a propósito: entre el menú de módulos y el título de la
            pantalla había ~80px muertos (este padding + el de cada página), que
            en un portátil es una franja de pantalla perdida en cada vista. */}
        <div className="px-6 pt-3 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-10">
          <FinanceInvariantBanner />
          <Outlet />
        </div>
      </main>
      <BottomTabBar onMore={() => setMobileNavOpen(true)} />
      <VersionFooter />
      <TraspasoPopup />
    </div>
  );
}

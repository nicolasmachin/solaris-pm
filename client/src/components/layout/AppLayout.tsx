import { useState } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { VersionFooter } from "./VersionFooter";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { FinanceInvariantBanner } from "../finance/FinanceInvariantBanner";
import { AIFloatingButton } from "../ai/AIFloatingButton";
import { EngineeringProjectsSidebar } from "../ingenieria/EngineeringProjectsSidebar";

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isProjectDetail = !!useMatch("/projects/:id");
  // Workspace del módulo Ingeniería (incluye sub-páginas como /unifilar). El
  // sidebar lateral se mantiene visible mientras el usuario navega entre
  // herramientas del mismo proyecto.
  const isIngenieriaWorkspace =
    !!useMatch("/ingenieria/proyecto/:id") || !!useMatch("/ingenieria/proyecto/:id/*");
  const showSidebar = isProjectDetail || isIngenieriaWorkspace;

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)]">
      <Topbar onMenuToggle={() => setMobileNavOpen((v) => !v)} />

      {/* Menú principal para móvil (hamburguesa en el topbar) */}
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Sidebar contextual: Proyectos en /projects/:id, Ingeniería en /ingenieria/proyecto/:id */}
      {isProjectDetail && <Sidebar open={false} onClose={() => undefined} />}
      {isIngenieriaWorkspace && <EngineeringProjectsSidebar />}

      <main
        className="overflow-y-auto min-h-screen"
        style={{ marginLeft: showSidebar ? 220 : 0, paddingTop: 52 }}
      >
        {/* On mobile, remove the sidebar margin */}
        <style>{`
          @media (max-width: 767px) {
            main { margin-left: 0 !important; }
          }
        `}</style>
        <div className="p-6 pb-10">
          <FinanceInvariantBanner />
          <Outlet />
        </div>
      </main>
      <VersionFooter />
      <AIFloatingButton />
    </div>
  );
}

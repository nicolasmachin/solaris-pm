import { useState } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { VersionFooter } from "./VersionFooter";
import { MobileNavDrawer } from "./MobileNavDrawer";
import { FinanceInvariantBanner } from "../finance/FinanceInvariantBanner";

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isProjectDetail = !!useMatch("/projects/:id");

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)]">
      <Topbar onMenuToggle={() => setMobileNavOpen((v) => !v)} />

      {/* Menú principal para móvil (hamburguesa en el topbar) */}
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* Sidebar de navegación interna del proyecto (solo en desktop) */}
      {isProjectDetail && <Sidebar open={false} onClose={() => undefined} />}

      <main
        className="overflow-y-auto min-h-screen"
        style={{ marginLeft: isProjectDetail ? 220 : 0, paddingTop: 52 }}
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
    </div>
  );
}

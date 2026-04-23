import { useState } from "react";
import { Outlet, useMatch } from "react-router-dom";
import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { VersionFooter } from "./VersionFooter";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isProjectDetail = !!useMatch("/projects/:id");

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)]">
      <Topbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
      {isProjectDetail && (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}

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
          <Outlet />
        </div>
      </main>
      <VersionFooter />
    </div>
  );
}

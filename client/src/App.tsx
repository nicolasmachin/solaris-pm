import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { toast } from "react-hot-toast";
import { AppLayout } from "./components/layout/AppLayout";
import { Spinner } from "./components/ui/Spinner";
import { useAuthStore } from "./store/auth.store";
import { usePermission } from "./hooks/usePermission";
import { getMe } from "./api/auth.api";
import type { UserRole } from "./types/api.types";

const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Projects = lazy(() => import("./pages/Projects").then((module) => ({ default: module.Projects })));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail").then((module) => ({ default: module.ProjectDetail })));
const Sales = lazy(() => import("./pages/Sales").then((module) => ({ default: module.Sales })));
const Metrics = lazy(() => import("./pages/Metrics").then((module) => ({ default: module.Metrics })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));
const Notifications = lazy(() => import("./pages/Notifications").then((module) => ({ default: module.Notifications })));
const NotFound = lazy(() => import("./pages/NotFound").then((module) => ({ default: module.NotFound })));
const Finance = lazy(() => import("./pages/Finance").then((module) => ({ default: module.Finance })));
const FinanceMovements = lazy(() => import("./pages/FinanceMovements").then((module) => ({ default: module.FinanceMovements })));
const FinanceSuppliers = lazy(() => import("./pages/FinanceSuppliers").then((module) => ({ default: module.FinanceSuppliers })));
const FinanceReports = lazy(() => import("./pages/FinanceReports").then((module) => ({ default: module.FinanceReports })));
const Stock = lazy(() => import("./pages/Stock").then((module) => ({ default: module.Stock })));
const Calendar = lazy(() => import("./pages/Calendar").then((module) => ({ default: module.Calendar })));
const MisTareas = lazy(() => import("./pages/MisTareas").then((module) => ({ default: module.MisTareas })));
const TramitesUte = lazy(() => import("./pages/TramitesUte").then((module) => ({ default: module.TramitesUte })));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PermissionRoute({
  children,
  module,
  action,
}: {
  children: ReactNode;
  module: string;
  action: string;
}) {
  const allowed = usePermission(module, action);
  const location = useLocation();

  useEffect(() => {
    if (!allowed) {
      toast.error("No tenés permiso para acceder a esa sección");
    }
  }, [allowed, location.pathname]);

  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function App() {
  const { token, user, permissions, setAuth, clearAuth } = useAuthStore();
  const [bootstrappingAuth, setBootstrappingAuth] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (user && (user.role === "ADMIN" || permissions.length > 0)) return;

    let cancelled = false;
    setBootstrappingAuth(true);

    getMe()
      .then((me) => {
        if (cancelled) return;
        setAuth(token, { id: me.id, name: me.name, email: me.email, role: me.role as UserRole }, me.permissions);
      })
      .catch(() => {
        if (cancelled) return;
        clearAuth();
      })
      .finally(() => {
        if (!cancelled) setBootstrappingAuth(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, user, permissions, setAuth, clearAuth]);

  if (token && bootstrappingAuth && (!user || (user.role !== "ADMIN" && permissions.length === 0))) {
    return null;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />

      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Protected layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/mis-tareas" element={<MisTareas />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />

        <Route
          path="/ventas"
          element={
            <PermissionRoute module="VENTAS" action="VIEW">
              <Sales />
            </PermissionRoute>
          }
        />
        <Route path="/sales" element={<Navigate to="/ventas" replace />} />
        <Route
          path="/metrics"
          element={
            <PermissionRoute module="METRICAS" action="VIEW">
              <Metrics />
            </PermissionRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PermissionRoute module="USUARIOS" action="VIEW">
              <Admin />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <Finance />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/movimientos"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceMovements />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/proveedores"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceSuppliers />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/reportes"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceReports />
            </PermissionRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <PermissionRoute module="STOCK" action="VIEW">
              <Stock />
            </PermissionRoute>
          }
        />
        <Route
          path="/tramites-ute"
          element={
            <PermissionRoute module="TRAMITES_UTE" action="VIEW">
              <TramitesUte />
            </PermissionRoute>
          }
        />
        <Route
          path="/calendario"
          element={
            <PermissionRoute module="OPERACIONES" action="VIEW">
              <Calendar />
            </PermissionRoute>
          }
        />
      </Route>

      {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

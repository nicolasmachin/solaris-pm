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
const ProposalBuilderPage = lazy(() => import("./pages/ProposalBuilderPage").then((module) => ({ default: module.ProposalBuilderPage })));
const Metrics = lazy(() => import("./pages/Metrics").then((module) => ({ default: module.Metrics })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const Admin = lazy(() => import("./pages/Admin").then((module) => ({ default: module.Admin })));
const CalculatorMemoryPage = lazy(() =>
  import("./pages/CalculatorMemoryPage").then((module) => ({ default: module.CalculatorMemoryPage })),
);
const Notifications = lazy(() => import("./pages/Notifications").then((module) => ({ default: module.Notifications })));
const NotFound = lazy(() => import("./pages/NotFound").then((module) => ({ default: module.NotFound })));
const Finance = lazy(() => import("./pages/Finance").then((module) => ({ default: module.Finance })));
const FinanceLayout = lazy(() => import("./pages/FinanceLayout").then((module) => ({ default: module.FinanceLayout })));
const FinancePlaceholder = lazy(() =>
  import("./pages/FinanceLayout").then((module) => ({ default: module.FinancePlaceholder })),
);
const FinanceMovementsTab = lazy(() =>
  import("./pages/FinanceMovementsTab").then((module) => ({ default: module.FinanceMovementsTab })),
);
const FinancePendientesTab = lazy(() =>
  import("./pages/FinancePendientesTab").then((module) => ({ default: module.FinancePendientesTab })),
);
const FinanceCashflowTab = lazy(() =>
  import("./pages/FinanceCashflowTab").then((module) => ({ default: module.FinanceCashflowTab })),
);
const FinanceResultsTab = lazy(() =>
  import("./pages/FinanceResultsTab").then((module) => ({ default: module.FinanceResultsTab })),
);
const FinanceMovements = lazy(() => import("./pages/FinanceMovements").then((module) => ({ default: module.FinanceMovements })));
const FinanceSuppliers = lazy(() => import("./pages/FinanceSuppliers").then((module) => ({ default: module.FinanceSuppliers })));
const FinanceReports = lazy(() => import("./pages/FinanceReports").then((module) => ({ default: module.FinanceReports })));
const FinanceAPagar = lazy(() => import("./pages/FinanceAPagar").then((module) => ({ default: module.FinanceAPagar })));
const FinancePayments = lazy(() => import("./pages/FinancePayments").then((module) => ({ default: module.FinancePayments })));
const FinanceSupplierDetail = lazy(() => import("./pages/FinanceSupplierDetail").then((module) => ({ default: module.FinanceSupplierDetail })));
const FinanceCuentas = lazy(() => import("./pages/FinanceCuentas").then((module) => ({ default: module.FinanceCuentas })));
const FinanceCobros = lazy(() => import("./pages/FinanceCobros").then((module) => ({ default: module.FinanceCobros })));
const FinanceCobroDetail = lazy(() => import("./pages/FinanceCobroDetail").then((module) => ({ default: module.FinanceCobroDetail })));
const FinanceIncomeStatement = lazy(() => import("./pages/FinanceIncomeStatement").then((module) => ({ default: module.FinanceIncomeStatement })));
const Stock = lazy(() => import("./pages/Stock").then((module) => ({ default: module.Stock })));
const InformesPage = lazy(() => import("./pages/InformesPage"));
const ConsultaUte = lazy(() => import("./pages/ConsultaUte"));
const Calendar = lazy(() => import("./pages/Calendar").then((module) => ({ default: module.Calendar })));
const MisTareas = lazy(() => import("./pages/MisTareas").then((module) => ({ default: module.MisTareas })));
const TramitesUte = lazy(() => import("./pages/TramitesUte").then((module) => ({ default: module.TramitesUte })));
const Ingenieria = lazy(() => import("./pages/Ingenieria").then((module) => ({ default: module.Ingenieria })));
const IngenieriaWorkspace = lazy(() => import("./pages/IngenieriaWorkspace").then((module) => ({ default: module.IngenieriaWorkspace })));
const ProyectoFinal = lazy(() => import("./pages/ProyectoFinal").then((module) => ({ default: module.ProyectoFinal })));
const UteDocsPage = lazy(() => import("./pages/UteDocsPage").then((module) => ({ default: module.UteDocsPage })));
const MaterialesConsolidados = lazy(() => import("./pages/MaterialesConsolidados").then((module) => ({ default: module.MaterialesConsolidados })));
const VisitaTecnica = lazy(() => import("./pages/VisitaTecnica").then((module) => ({ default: module.VisitaTecnica })));
const VisitaRapida = lazy(() => import("./pages/VisitaRapida").then((module) => ({ default: module.VisitaRapida })));
const PortalProjects = lazy(() => import("./pages/PortalProjects").then((module) => ({ default: module.PortalProjects })));
const PortalProjectUte = lazy(() => import("./pages/PortalProjectUte").then((module) => ({ default: module.PortalProjectUte })));
const PortalLayout = lazy(() => import("./components/layout/PortalLayout").then((module) => ({ default: module.PortalLayout })));
const ChangePassword = lazy(() => import("./pages/ChangePassword").then((module) => ({ default: module.ChangePassword })));
const Clientes = lazy(() => import("./modules/clientes/pages/ClientesPage").then((module) => ({ default: module.ClientesPage })));
const ClienteFicha = lazy(() => import("./modules/clientes/pages/ClienteFichaPage").then((module) => ({ default: module.ClienteFichaPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Si es CLIENT con password temporal, forzar cambio de contraseña.
  if (user?.role === "CLIENT" && user.passwordTemporary && location.pathname !== "/cambiar-password") {
    return <Navigate to="/cambiar-password" replace />;
  }
  // Si es CLIENT, solo puede entrar a rutas /portal/* y /cambiar-password.
  if (user?.role === "CLIENT" && !location.pathname.startsWith("/portal") && location.pathname !== "/cambiar-password") {
    return <Navigate to="/portal" replace />;
  }
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

      {/* Cambio de contraseña (forzado para passwordTemporary) — sin layout */}
      <Route
        path="/cambiar-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Portal cliente — layout simple, sin sidebar admin */}
      <Route
        element={
          <ProtectedRoute>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/portal" element={<PortalProjects />} />
        <Route path="/portal/:id" element={<PortalProjectUte />} />
      </Route>

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
          path="/leads/:leadId/propuesta"
          element={
            <PermissionRoute module="VENTAS" action="EDIT">
              <ProposalBuilderPage />
            </PermissionRoute>
          }
        />
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
          path="/admin/propuestas/memoria-calculo"
          element={
            <PermissionRoute module="VENTAS" action="ACCESS_MEMORIA">
              <CalculatorMemoryPage />
            </PermissionRoute>
          }
        />
        {/* Layout con 6 pestañas. Las rutas detalle (proveedores/:id, cobros/:id, etc.) viven fuera. */}
        <Route
          path="/finanzas"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceLayout />
            </PermissionRoute>
          }
        >
          <Route index element={<Navigate to="movimientos" replace />} />
          <Route path="movimientos" element={<FinanceMovementsTab />} />
          <Route path="pendientes" element={<FinancePendientesTab />} />
          <Route path="proveedores" element={<FinanceSuppliers />} />
          <Route path="cobros" element={<FinanceCobros />} />
          <Route path="flujo" element={<FinanceCashflowTab />} />
          <Route path="resultados" element={<FinanceResultsTab />} />
          <Route path="cuentas" element={<FinanceCuentas />} />
        </Route>

        {/* Rutas detalle / legacy mantenidas fuera del layout de pestañas. */}
        <Route
          path="/finanzas-legacy"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <Finance />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/movimientos-legacy"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceMovements />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/a-pagar"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceAPagar />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/pagos"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinancePayments />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/proveedores-legacy"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceSuppliers />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/proveedores/:id"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceSupplierDetail />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/cobros/:id"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceCobroDetail />
            </PermissionRoute>
          }
        />
        <Route
          path="/finanzas/resultado"
          element={
            <PermissionRoute module="FINANZAS" action="VIEW">
              <FinanceIncomeStatement />
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
          path="/informes"
          element={
            <PermissionRoute module="INFORMES" action="VIEW">
              <InformesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <PermissionRoute module="EXPERIENCIA_CLIENTES" action="VIEW">
              <Clientes />
            </PermissionRoute>
          }
        />
        <Route
          path="/clientes/:projectId"
          element={
            <PermissionRoute module="EXPERIENCIA_CLIENTES" action="VIEW">
              <ClienteFicha />
            </PermissionRoute>
          }
        />
        <Route
          path="/proyecto/:projectId/consulta-ute"
          element={
            <PermissionRoute module="TRAMITES_UTE" action="VIEW">
              <ConsultaUte />
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
          path="/ingenieria"
          element={
            <PermissionRoute module="INGENIERIA" action="VIEW">
              <Ingenieria />
            </PermissionRoute>
          }
        />
        <Route
          path="/ingenieria/proyecto/:id"
          element={
            <PermissionRoute module="INGENIERIA" action="VIEW">
              <IngenieriaWorkspace />
            </PermissionRoute>
          }
        />
        <Route
          path="/ingenieria/proyecto/:projectId/proyecto-final"
          element={
            <PermissionRoute module="INGENIERIA" action="VIEW">
              <ProyectoFinal />
            </PermissionRoute>
          }
        />
        <Route
          path="/ingenieria/proyecto/:projectId/ute-docs"
          element={
            <PermissionRoute module="INGENIERIA" action="VIEW">
              <UteDocsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/ingenieria/materiales-consolidados"
          element={
            <PermissionRoute module="INGENIERIA" action="VIEW">
              <MaterialesConsolidados />
            </PermissionRoute>
          }
        />
        <Route
          path="/projects/:projectId/visita/:visitId"
          element={
            <PermissionRoute module="OPERACIONES" action="VIEW">
              <VisitaTecnica />
            </PermissionRoute>
          }
        />
        <Route
          path="/visita-rapida"
          element={
            <PermissionRoute module="OPERACIONES" action="EDIT">
              <VisitaRapida />
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

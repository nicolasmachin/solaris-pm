import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { toast } from "react-hot-toast";
import { AppLayout } from "./components/layout/AppLayout";
import { Spinner } from "./components/ui/Spinner";
import { useAuthStore } from "./store/auth.store";
import { usePermission } from "./hooks/usePermission";
import { useTravelViewer } from "./hooks/useTravelViewer";
import { getMe } from "./api/auth.api";
import type { UserRole } from "./types/api.types";

const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Projects = lazy(() => import("./pages/Projects").then((module) => ({ default: module.Projects })));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail").then((module) => ({ default: module.ProjectDetail })));
const Sales = lazy(() => import("./pages/Sales").then((module) => ({ default: module.Sales })));
const Metrics = lazy(() => import("./pages/Metrics").then((module) => ({ default: module.Metrics })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const ComisionesAsesor = lazy(() =>
  import("./pages/ComisionesAsesor").then((module) => ({ default: module.ComisionesAsesor })),
);
const PagosInstalador = lazy(() =>
  import("./pages/PagosInstalador").then((module) => ({ default: module.PagosInstalador })),
);
const ViajeSaoPaulo = lazy(() =>
  import("./pages/ViajeSaoPaulo").then((module) => ({ default: module.ViajeSaoPaulo })),
);
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
const FinanceFacturacionTab = lazy(() => import("./pages/FinanceFacturacionTab").then((module) => ({ default: module.FinanceFacturacionTab })));
const FinanceCobroDetail = lazy(() => import("./pages/FinanceCobroDetail").then((module) => ({ default: module.FinanceCobroDetail })));
const FinanceIncomeStatement = lazy(() => import("./pages/FinanceIncomeStatement").then((module) => ({ default: module.FinanceIncomeStatement })));
const Stock = lazy(() => import("./pages/Stock").then((module) => ({ default: module.Stock })));
const InformesPage = lazy(() => import("./pages/InformesPage"));
const ConsultaUte = lazy(() => import("./pages/ConsultaUte"));
const SuministroIndividualUte = lazy(() => import("./pages/SuministroIndividualUte"));
const Calendar = lazy(() => import("./pages/Calendar").then((module) => ({ default: module.Calendar })));
const MisTareas = lazy(() => import("./pages/MisTareas").then((module) => ({ default: module.MisTareas })));
const MisTareasLayout = lazy(() => import("./pages/MisTareasLayout").then((module) => ({ default: module.MisTareasLayout })));
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
const PortalTickets = lazy(() => import("./pages/PortalTickets").then((module) => ({ default: module.PortalTickets })));
const PortalTicketDetail = lazy(() => import("./pages/PortalTicketDetail").then((module) => ({ default: module.PortalTicketDetail })));
const PortalSurveys = lazy(() => import("./pages/PortalSurveys").then((module) => ({ default: module.PortalSurveys })));
const PortalReportes = lazy(() => import("./pages/PortalReportes").then((module) => ({ default: module.PortalReportes })));
const PortalLayout = lazy(() => import("./components/layout/PortalLayout").then((module) => ({ default: module.PortalLayout })));
const ChangePassword = lazy(() => import("./pages/ChangePassword").then((module) => ({ default: module.ChangePassword })));
const Clientes = lazy(() => import("./modules/clientes/pages/ClientesPage").then((module) => ({ default: module.ClientesPage })));
const PendientesSection = lazy(() => import("./modules/traspasos/pages/PendientesSection").then((module) => ({ default: module.PendientesSection })));
const TicketsSection = lazy(() => import("./modules/tickets/TicketsSection").then((module) => ({ default: module.TicketsSection })));
const ClienteFicha = lazy(() => import("./modules/clientes/pages/ClienteFichaPage").then((module) => ({ default: module.ClienteFichaPage })));
const EncuestasPage = lazy(() => import("./modules/encuestas/EncuestasPage").then((module) => ({ default: module.EncuestasPage })));
const ExperienciaSolarLayout = lazy(() => import("./modules/clientes/pages/ExperienciaSolarLayout").then((module) => ({ default: module.ExperienciaSolarLayout })));
const ClientesCobros = lazy(() => import("./modules/clientes/pages/ClientesCobros").then((module) => ({ default: module.ClientesCobros })));
const ReportesFvPanel = lazy(() => import("./modules/clientes/pages/ReportesFvPanel").then((module) => ({ default: module.ReportesFvPanel })));
const MonitoreoFvPanel = lazy(() => import("./modules/clientes/pages/MonitoreoFvPanel").then((module) => ({ default: module.MonitoreoFvPanel })));

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

// Gate del módulo provisional "Guía de viaje São Paulo": solo Nicolás y Gabriel.
function TravelRoute({ children }: { children: ReactNode }) {
  const allowed = useTravelViewer();
  if (!allowed) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function App() {
  const { token, user, permissions } = useAuthStore();
  const [bootstrappingAuth, setBootstrappingAuth] = useState(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    // Si ya hay auth cacheada (usuario + permisos, o ADMIN) la usamos para el
    // render inmediato, pero IGUAL revalidamos contra /users/me en cada carga.
    // Así un permiso que un admin agregó (o quitó) al rol toma efecto en la
    // próxima carga de la app, sin tener que desloguear y volver a entrar.
    // Antes se retornaba temprano cuando había permisos cacheados y quedaban
    // congelados en localStorage indefinidamente.
    const snap = useAuthStore.getState();
    const teniaAuth = Boolean(snap.user && (snap.user.role === "ADMIN" || snap.permissions.length > 0));
    if (!teniaAuth) setBootstrappingAuth(true);

    getMe()
      .then((me) => {
        if (cancelled) return;
        useAuthStore
          .getState()
          .setAuth(token, { id: me.id, name: me.name, email: me.email, role: me.role as UserRole }, me.permissions);
      })
      .catch(() => {
        if (cancelled) return;
        // Un error transitorio de red no debe desloguear a alguien con auth
        // válida cacheada: sólo limpiamos si no teníamos nada para mostrar.
        if (!teniaAuth) useAuthStore.getState().clearAuth();
      })
      .finally(() => {
        if (!cancelled) setBootstrappingAuth(false);
      });

    return () => {
      cancelled = true;
    };
    // Sólo al montar / cambiar el token. NO dependemos de user/permissions para
    // no re-disparar en loop cuando setAuth los actualiza (los leemos con getState).
  }, [token]);

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
        <Route path="/portal/tickets" element={<PortalTickets />} />
        <Route path="/portal/tickets/:id" element={<PortalTicketDetail />} />
        <Route path="/portal/encuestas" element={<PortalSurveys />} />
        <Route path="/portal/reportes" element={<PortalReportes />} />
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
        {/* Mis tareas: layout con tabs por URL (Tareas / Pendientes / Tickets). */}
        <Route path="/mis-tareas" element={<MisTareasLayout />}>
          <Route index element={<MisTareas />} />
          <Route
            path="pendientes"
            element={
              <PermissionRoute module="TRASPASOS" action="VIEW">
                <PendientesSection />
              </PermissionRoute>
            }
          />
          <Route
            path="tickets"
            element={
              <PermissionRoute module="TICKETS" action="VIEW">
                <TicketsSection />
              </PermissionRoute>
            }
          />
        </Route>
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
          path="/comisiones"
          element={
            <PermissionRoute module="COMISIONES" action="VIEW">
              <ComisionesAsesor />
            </PermissionRoute>
          }
        />
        <Route
          path="/pagos-instalador"
          element={
            <PermissionRoute module="PAGOS_INSTALADOR" action="VIEW">
              <PagosInstalador />
            </PermissionRoute>
          }
        />
        <Route
          path="/viaje-sao-paulo"
          element={
            <TravelRoute>
              <ViajeSaoPaulo />
            </TravelRoute>
          }
        />
        {/* El constructor dejó de ser página (ahora es modal en el panel del lead).
            Links viejos a esta ruta redirigen a Ventas. */}
        <Route path="/leads/:leadId/propuesta" element={<Navigate to="/ventas" replace />} />
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
          {/* Misma pantalla que /pagos-instalador: acá el admin la ve completa
              (todos los instaladores + gestión); el tercerizado entra por el
              menú de su cuenta y solo ve lo suyo. */}
          <Route path="instaladores" element={<PagosInstalador />} />
          <Route path="facturacion" element={<FinanceFacturacionTab />} />
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
        {/* Pendientes se mudó a una tab dentro de Mis tareas. */}
        <Route path="/pendientes" element={<Navigate to="/mis-tareas/pendientes" replace />} />
        <Route
          path="/clientes"
          element={
            <PermissionRoute module="EXPERIENCIA_CLIENTES" action="VIEW">
              <ExperienciaSolarLayout />
            </PermissionRoute>
          }
        >
          <Route index element={<Clientes />} />
          <Route path="reportes" element={<ReportesFvPanel />} />
          <Route path="monitoreo" element={<MonitoreoFvPanel />} />
          <Route path="cobros" element={<ClientesCobros />} />
          <Route path="encuestas" element={<EncuestasPage />} />
        </Route>
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
          path="/proyecto/:projectId/suministro-individual"
          element={
            <PermissionRoute module="TRAMITES_UTE" action="VIEW">
              <SuministroIndividualUte />
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

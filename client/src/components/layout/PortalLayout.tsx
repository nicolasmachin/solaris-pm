import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  ChevronDown,
  Eye,
  FileCheck,
  FileText,
  Home,
  KeyRound,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  PlayCircle,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { usePortalPreviewStore } from '../../store/portalPreview.store';
import { PortalNotificationBell } from './PortalNotificationBell';
import { AvisosModal } from '../pwa/AvisosDispositivo';

export function PortalLayout() {
  const { user, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [avisosAbierto, setAvisosAbierto] = useState(false);

  // Instalado desde el portal, el ícono tiene que decir "Voltia" y abrir en el
  // portal, no "Voltia PM" en el tablero interno: se cambia el manifiesto
  // mientras se está acá.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const titulo = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const antes = { href: link?.getAttribute('href'), titulo: titulo?.content };
    link?.setAttribute('href', '/portal.webmanifest');
    if (titulo) titulo.content = 'Voltia';
    return () => {
      if (link && antes.href) link.setAttribute('href', antes.href);
      if (titulo && antes.titulo) titulo.content = antes.titulo;
    };
  }, []);
  const navigate = useNavigate();
  const { preview, salir } = usePortalPreviewStore();
  const location = useLocation();

  function logout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  function salirDeLaVista() {
    salir();
    navigate('/clientes', { replace: true });
    // Recarga dura: hay consultas del portal ya cacheadas con los datos del
    // cliente, y arrastrarlas de vuelta al panel interno confunde más que
    // esperar un segundo.
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] flex flex-col">
      {/* Cartel imposible de pasar por alto: mientras esté, lo que se ve NO es
          la pantalla propia sino la del cliente. */}
      {preview && (
        <div className="sticky top-0 z-30 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm text-amber-200">
              <Eye className="h-4 w-4 shrink-0" />
              <span>
                Estás viendo esta pantalla <strong>tal como la ve el cliente</strong>
                {preview.clientName ? `: ${preview.clientName}` : ''}. Es sólo lectura.
              </span>
            </div>
            <button
              onClick={salirDeLaVista}
              className="flex items-center gap-1 rounded-lg border border-amber-500/50 px-2.5 py-1 text-xs font-medium text-amber-100 hover:bg-amber-500/20"
            >
              <X className="h-3.5 w-3.5" />
              Salir de la vista del cliente
            </button>
          </div>
        </div>
      )}
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/portal" className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4fa6ff" strokeWidth="2">
              <circle cx="12" cy="12" r="5" fill="#ffd84d" fillOpacity="0.28" />
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <span className="font-display font-bold text-base tracking-wide text-[var(--color-text-primary)]">
              VOLTIA
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <PortalNotificationBell />
            <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 hover:bg-[var(--color-bg-card-hover)] text-sm text-[var(--color-text-secondary)]"
            >
              {/* En la vista del cliente se muestra el nombre del cliente: ver
                  el propio nombre acá haría dudar de qué se está mirando. */}
              <span className="hidden sm:inline">{preview?.clientName ?? user?.name ?? 'Mi cuenta'}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute right-0 mt-1 w-56 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-lg z-20">
                  {preview ? (
                    // Cambiar contraseña o cerrar sesión acá afectaría al usuario
                    // interno, no al cliente. La única salida es volver al panel.
                    <button
                      onClick={salirDeLaVista}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                    >
                      <X className="w-4 h-4" />
                      Salir de la vista del cliente
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setOpen(false);
                          setAvisosAbierto(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] w-full text-left"
                      >
                        <Bell className="w-4 h-4" />
                        Avisos en este celular
                      </button>
                      <Link
                        to="/cambiar-password"
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
                      >
                        <KeyRound className="w-4 h-4" />
                        Cambiar contraseña
                      </Link>
                      <button
                        onClick={logout}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)] w-full text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        Cerrar sesión
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            </div>
          </div>
        </div>
        {/* Computadora: pestañas arriba. En el celular van abajo (PortalBottomNav). */}
        <nav className="max-w-6xl mx-auto hidden sm:flex items-center gap-1 px-4">
          {PORTAL_NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={esActiva(item, location.pathname) ? 'page' : undefined}
              className={[
                'px-3 py-2 text-sm border-b-2 -mb-[1px] transition-colors whitespace-nowrap',
                esActiva(item, location.pathname)
                  ? 'border-[var(--color-accent)] text-[var(--color-text-primary)] font-medium'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      {/* En el celular el pie queda arriba de la barra de abajo, que es fija. */}
      <footer className="border-t border-[var(--color-border)] py-3 pb-[calc(0.75rem+4rem+env(safe-area-inset-bottom))] sm:pb-3 text-center text-[10px] text-[var(--color-text-muted)] font-mono">
        Voltia · Portal de Generadores
      </footer>
      <PortalBottomNav pathname={location.pathname} />
      {avisosAbierto && <AvisosModal publico="cliente" onClose={() => setAvisosAbierto(false)} />}
    </div>
  );
}

type PortalNavItem = { to: string; label: string; corto: string; icon: LucideIcon };

// Las secciones del portal. Agregar una acá la suma a los dos menús: las
// pestañas de arriba (computadora) y la barra de abajo (celular).
const PORTAL_NAV: PortalNavItem[] = [
  { to: '/portal', label: 'Inicio', corto: 'Inicio', icon: Home },
  { to: '/portal/reportes', label: 'Reportes', corto: 'Reportes', icon: BarChart3 },
  { to: '/portal/tickets', label: 'Mis reclamos', corto: 'Reclamos', icon: MessageSquare },
  { to: '/portal/documentos', label: 'Documentos', corto: 'Documentos', icon: FileText },
  { to: '/portal/encuestas', label: 'Encuestas', corto: 'Encuestas', icon: Star },
  { to: '/portal/videos', label: 'Videos', corto: 'Videos', icon: PlayCircle },
  { to: '/portal/ute', label: 'Trámite UTE', corto: 'UTE', icon: FileCheck },
];

// En la barra de abajo entran cómodas cinco. Si hay más, las primeras cuatro
// quedan a la vista y el resto va a "Más".
const MAX_BARRA = 5;

function esActiva(item: PortalNavItem, pathname: string) {
  if (item.to === '/portal') return pathname === '/portal' || pathname === '/portal/';
  if (pathname === item.to || pathname.startsWith(`${item.to}/`)) return true;
  // "Trámite UTE" abarca también el detalle de un proyecto (/portal/:id).
  return (
    item.to === '/portal/ute' &&
    pathname.startsWith('/portal/') &&
    !PORTAL_NAV.some((o) => o.to !== '/portal' && (pathname === o.to || pathname.startsWith(`${o.to}/`)))
  );
}

/**
 * Menú del portal en el celular: una barra fija abajo, con ícono y nombre corto,
 * como las aplicaciones del teléfono. Las pestañas de arriba no entraban en un
 * celular angosto y quedaban cortadas.
 */
function PortalBottomNav({ pathname }: { pathname: string }) {
  const [masAbierto, setMasAbierto] = useState(false);
  const sobran = PORTAL_NAV.length > MAX_BARRA;
  const visibles = sobran ? PORTAL_NAV.slice(0, MAX_BARRA - 1) : PORTAL_NAV;
  const resto = sobran ? PORTAL_NAV.slice(MAX_BARRA - 1) : [];
  const restoActivo = resto.some((i) => esActiva(i, pathname));

  useEffect(() => setMasAbierto(false), [pathname]);

  const claseItem = (activa: boolean) =>
    [
      'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] transition-colors',
      activa ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text-muted)]',
    ].join(' ');

  return (
    <>
      {masAbierto && (
        <div className="fixed inset-0 z-30 bg-black/40 sm:hidden" onClick={() => setMasAbierto(false)}>
          <div
            className="absolute inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-1 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {resto.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--color-bg-card-hover)] ${
                    esActiva(item, pathname) ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <nav
        aria-label="Secciones del portal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-bg-card)] pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        {visibles.map((item) => {
          const Icon = item.icon;
          const activa = esActiva(item, pathname);
          return (
            <Link key={item.to} to={item.to} aria-current={activa ? 'page' : undefined} className={claseItem(activa)}>
              <Icon className="h-5 w-5" />
              {item.corto}
            </Link>
          );
        })}
        {sobran && (
          <button type="button" onClick={() => setMasAbierto((v) => !v)} className={claseItem(restoActivo || masAbierto)}>
            <MoreHorizontal className="h-5 w-5" />
            Más
          </button>
        )}
      </nav>
    </>
  );
}

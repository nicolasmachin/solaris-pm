import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronRight, FileClock } from 'lucide-react';

import { getPortalProjects } from '../api/portal.api';
import { getPlantasDelCliente } from '../api/energiaFv.api';
import { PortalEnergiaPlantas } from '../components/portal/PortalEnergiaPlantas';
import { Spinner } from '../components/ui/Spinner';
import { useAuthStore } from '../store/auth.store';
import { usePortalPreviewStore } from '../store/portalPreview.store';
import { PortalProjectUte } from './PortalProjectUte';
import { PortalProjects } from './PortalProjects';

/**
 * Inicio del portal. Mientras el cliente no está habilitado, lo que le importa
 * es el trámite UTE y eso es lo que ve. Una vez habilitado, el trámite es
 * historia (queda en el menú, "Trámite UTE") y el Inicio pasa a ser su planta:
 * el flujo de energía de ahora y la generación y el consumo.
 */
export function PortalInicio() {
  const { user } = useAuthStore();
  const { preview } = usePortalPreviewStore();
  // En la vista del cliente, el saludo es para el cliente, no para quien mira.
  const nombre = (preview?.clientName ?? user?.name ?? '').split(' ')[0];
  const proyectosQ = useQuery({ queryKey: ['portal-projects'], queryFn: getPortalProjects });
  const plantasQ = useQuery({ queryKey: ['portal-energia-plantas'], queryFn: getPlantasDelCliente });

  if (proyectosQ.isLoading || plantasQ.isLoading) return <Spinner />;

  const proyectos = proyectosQ.data ?? [];
  const plantas = plantasQ.data ?? [];
  const habilitados = proyectos.filter((p) => p.habilitado);
  const enTramite = proyectos.filter((p) => !p.habilitado);

  // Ninguno habilitado: el Inicio es el trámite, como siempre.
  if (habilitados.length === 0) {
    if (proyectos.length === 1) return <PortalProjectUte projectId={proyectos[0].id} />;
    return <PortalProjects />;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-[var(--color-text-muted)]">Hola, {nombre}</p>
        <h1 className="mt-1 text-lg font-medium text-[var(--color-text-primary)]">Tu planta solar</h1>
      </div>

      {/* Si tiene otro proyecto que todavía está en trámite, que lo vea arriba. */}
      {enTramite.map((p) => (
        <Link
          key={p.id}
          to={`/portal/${p.id}`}
          className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 hover:bg-blue-500/15"
        >
          <FileClock className="h-5 w-5 shrink-0 text-blue-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {p.clientName} · {p.capacityKwp} kWp
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">Trámite UTE en curso: ver cómo va</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        </Link>
      ))}

      {plantas.length > 0 ? (
        <PortalEnergiaPlantas />
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          Tu planta ya está habilitada. Todavía no tenemos conectados los datos de tu inversor a este portal: apenas
          estén, vas a ver acá lo que generás y lo que consumís.
        </div>
      )}
    </div>
  );
}

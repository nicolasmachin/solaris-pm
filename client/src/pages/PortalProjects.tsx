import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { getPortalProjects } from '../api/portal.api';
import { useAuthStore } from '../store/auth.store';

export function PortalProjects() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-projects'],
    queryFn: getPortalProjects,
  });

  // Si tiene un solo proyecto, redirigir directo al detalle.
  useEffect(() => {
    if (data && data.length === 1) {
      navigate(`/portal/${data[0].id}`, { replace: true });
    }
  }, [data, navigate]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-5">
        <p className="text-xs text-[var(--color-text-muted)]">Hola, {user?.name?.split(' ')[0] ?? ''}</p>
        <h1 className="text-lg font-medium text-[var(--color-text-primary)] mt-1">
          Tus proyectos
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Elegí un proyecto para ver el avance del trámite UTE.
        </p>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Cargando…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          No pudimos cargar tus proyectos. Refrescá la página o cerrá sesión y volvé a entrar.
        </div>
      ) : data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id}>
              <Link
                to={`/portal/${p.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 hover:bg-[var(--color-bg-card-hover)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {p.clientName}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {p.location} · {p.capacityKwp} kWp
                    {p.uteCaseNumber && ` · Caso UTE ${p.uteCaseNumber}`}
                  </p>
                  {p.uteFinalized ? (
                    <span className="inline-block mt-1.5 text-[10px] font-mono uppercase rounded bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5">
                      Trámite finalizado
                    </span>
                  ) : p.uteCurrentStage ? (
                    <span className="inline-block mt-1.5 text-[10px] font-mono uppercase rounded bg-blue-500/15 text-blue-400 px-1.5 py-0.5">
                      En curso
                    </span>
                  ) : null}
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Aún no tenés proyectos asignados. Si esperabas ver alguno acá, contactá a Voltia.
        </div>
      )}
    </div>
  );
}

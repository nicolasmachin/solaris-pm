import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Mail, Phone } from 'lucide-react';
import {
  getPortalProjectUte,
  type PortalTimelineItem,
} from '../api/portal.api';
import { useAuthStore } from '../store/auth.store';

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  // Las fechas de hitos se guardan como fecha-sólo (medianoche UTC). Formateamos
  // en UTC para mostrar el día tal como fue cargado, sin que la TZ local (UTC−3)
  // lo retroceda un día.
  return d.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function PortalProjectUte() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal-project-ute', id],
    queryFn: () => getPortalProjectUte(id!),
    enabled: !!id,
  });

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        to="/portal"
        className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] mb-3"
      >
        <ArrowLeft className="w-3 h-3" />
        Volver a mis proyectos
      </Link>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Cargando…
        </div>
      ) : error || !data ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          No pudimos cargar el proyecto. ¿Tenés permiso para verlo?
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 space-y-5">
          {/* Header */}
          <div className="border-b border-[var(--color-border)] pb-4">
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Hola, {user?.name?.split(' ')[0] ?? ''}
            </p>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mt-1">
              {data.clientName}{' '}
              <span className="text-[var(--color-text-muted)] font-normal">
                · {data.capacityKwp} kWp
              </span>
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {data.location} · Trámite UTE
            </p>
            {data.ute?.caseNumber && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[var(--color-text-muted)]">
                  Caso UTE
                </span>
                <code className="text-xs bg-[var(--color-bg-app)] border border-[var(--color-border)] px-2 py-0.5 rounded font-mono text-[var(--color-text-primary)]">
                  {data.ute.caseNumber}
                </code>
              </div>
            )}
            {data.ute?.finalizedAt && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 text-emerald-400 px-2.5 py-1 text-[11px] font-medium">
                <Check className="w-3.5 h-3.5" />
                Trámite finalizado el {fmtDate(data.ute.finalizedAt)}
              </div>
            )}
          </div>

          {/* Timeline */}
          <Timeline items={data.timeline} />

          {/* Contactos UTE */}
          <div className="rounded-md bg-[var(--color-bg-app)] border border-[var(--color-border)] p-4">
            <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--color-text-muted)] mb-3">
              ¿Querés contactar a UTE directamente?
            </p>
            <div className="space-y-2 text-sm text-[var(--color-text-primary)]">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[var(--color-text-muted)]" />
                <span>155 (internos 22150, 22151 o 22152)</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[var(--color-text-muted)]" />
                <a
                  href="mailto:microgeneracion@ute.com.uy"
                  className="hover:text-[var(--color-accent)]"
                >
                  microgeneracion@ute.com.uy
                </a>
              </div>
            </div>
            <a
              href="https://www.voltia.com.uy/ute"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-[11px] font-medium text-[var(--color-accent)] hover:opacity-80"
            >
              Cómo funciona el trámite UTE →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ items }: { items: PortalTimelineItem[] }) {
  // Índice del último hito con fecha cargada. Solo marcamos "Último avance"
  // mientras el trámite no esté finalizado (queda al menos un hito sin fecha);
  // si están todos cumplidos, no se muestra.
  const lastDoneIndex = items.reduce((acc, it, idx) => (it.completedAt ? idx : acc), -1);
  const allDone = items.length > 0 && items.every((it) => it.completedAt);
  const lastAdvanceIndex = !allDone ? lastDoneIndex : -1;

  return (
    <ol className="relative">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        // Modelo binario: hito con fecha = cumplido (verde); sin fecha = pendiente
        // (gris). No hay estado "en espera" destacado.
        const done = item.status === 'completed';
        return (
          <li key={item.key} className="relative pl-8 pb-5 last:pb-0">
            {/* Línea vertical */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={
                  done
                    ? 'absolute left-[10px] top-5 bottom-0 w-0.5 bg-emerald-500/40'
                    : 'absolute left-[10px] top-5 bottom-0 w-0.5 bg-[var(--color-border)]'
                }
              />
            )}
            {/* Punto */}
            <span
              aria-hidden="true"
              className={
                done
                  ? 'absolute left-1 top-1.5 w-[18px] h-[18px] rounded-full bg-emerald-500 flex items-center justify-center'
                  : 'absolute left-1.5 top-2 w-[14px] h-[14px] rounded-full border border-[var(--color-border)] bg-[var(--color-bg-app)]'
              }
            >
              {done && <Check className="w-3 h-3 text-white" />}
            </span>
            {/* Contenido */}
            <div>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <p
                  className={
                    done
                      ? 'text-sm font-medium text-[var(--color-text-primary)]'
                      : 'text-sm text-[var(--color-text-muted)]'
                  }
                >
                  {item.label}
                  {i === lastAdvanceIndex && (
                    <span className="ml-2 align-middle rounded-full bg-[var(--color-bg-app)] border border-[var(--color-border)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                      Último avance
                    </span>
                  )}
                </p>
                {item.completedAt && (
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    {fmtDate(item.completedAt)}
                  </span>
                )}
              </div>
              <p
                className={
                  done
                    ? 'text-[11px] text-[var(--color-text-muted)] mt-0.5'
                    : 'text-[11px] text-[var(--color-text-muted)] mt-0.5 italic'
                }
              >
                {item.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

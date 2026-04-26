import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, X, AlertTriangle, ArrowRight } from "lucide-react";
import { getProjects } from "../api/projects.api";
import { getPendingDetailMovements } from "../api/finance.api";
import { Spinner } from "../components/ui/Spinner";
import { LATEST_RELEASE } from "../data/latestRelease";
import { usePermission } from "../hooks/usePermission";

const READ_VERSION_KEY = "voltia-changelog-read-version";

export function Dashboard() {
  const canViewFinance = usePermission("FINANZAS", "VIEW");
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
    staleTime: 60_000,
  });

  const { data: pendingDetail = [] } = useQuery({
    queryKey: ["pending-detail"],
    queryFn: getPendingDetailMovements,
    enabled: canViewFinance,
    staleTime: 60_000,
  });

  const activeCount = projects?.filter(
    (p) => p.status === "ACTIVE" || p.status === "IN_PROGRESS"
  ).length ?? 0;

  const totalKwp = projects?.reduce((sum, p) => sum + p.capacityKwp, 0) ?? 0;

  const completedCount = projects?.filter(
    (p) => p.status === "COMPLETED"
  ).length ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Resumen general de proyectos
        </p>
      </div>

      {canViewFinance && pendingDetail.length > 0 && (
        <Link
          to="/finanzas/movimientos"
          className="mb-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-3 hover:bg-amber-500/15 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-300 font-medium">
            {pendingDetail.length} factura{pendingDetail.length > 1 ? "s" : ""} con stock sin desglosar
          </span>
          <ArrowRight className="w-4 h-4 text-amber-400 ml-auto" />
        </Link>
      )}

      {isLoading ? (
        <div className="flex items-center gap-3 text-[var(--color-text-muted)] text-sm py-12">
          <Spinner />
          Cargando datos...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <KpiCard
            title="Proyectos activos"
            value={activeCount}
            unit="proyectos"
            icon="⚡"
          />
          <KpiCard
            title="kWp totales"
            value={totalKwp.toFixed(1)}
            unit="kWp instalados"
            icon="☀️"
          />
          <KpiCard
            title="Completados"
            value={completedCount}
            unit="proyectos entregados"
            icon="✅"
          />
        </div>
      )}

      <LatestReleaseCard />
    </div>
  );
}

interface KpiCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: string;
  highlight?: boolean;
}

function KpiCard({ title, value, unit, icon, highlight = false }: KpiCardProps) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-5 py-4 hover:bg-[var(--color-bg-card-hover)] transition-colors">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">
          {title}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <p
        className={`text-3xl font-display font-bold ${
          highlight
            ? "text-orange-400"
            : "text-[var(--color-text-primary)]"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{unit}</p>
    </div>
  );
}

// ─── Card de novedades de la última versión ─────────────────────────────────

function LatestReleaseCard() {
  // "leído" se persiste por versión: si bumpeás a v2.2, el card vuelve a
  // aparecer como nuevo aunque ya hayas leído la v2.1.
  const [isUnread, setIsUnread] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const lastRead = window.localStorage.getItem(READ_VERSION_KEY);
      setIsUnread(lastRead !== LATEST_RELEASE.version);
    } catch {
      /* localStorage bloqueado: tratamos como leído (no insistimos) */
    }
  }, []);

  function markAsRead() {
    try {
      window.localStorage.setItem(READ_VERSION_KEY, LATEST_RELEASE.version);
    } catch {
      /* noop */
    }
    setIsUnread(false);
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <section
      className={`rounded-xl border bg-[var(--color-bg-card)] p-5 transition-colors ${
        isUnread
          ? "border-[var(--color-accent)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]"
          : "border-[var(--color-border)]"
      }`}
      aria-labelledby="release-card-title"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "var(--color-warning-bg)",
              color: "var(--color-warning-text)",
            }}
            aria-hidden
          >
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="release-card-title"
                className="font-display text-base font-bold text-[var(--color-text-primary)]"
              >
                Novedades · v{LATEST_RELEASE.version}
              </h2>
              {isUnread ? (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                  style={{
                    background: "var(--color-accent)",
                    color: "#1f2937",
                  }}
                >
                  Nuevo
                </span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {LATEST_RELEASE.date}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={markAsRead}
          aria-label="Marcar como leído"
          title="Marcar como leído"
          className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
        >
          <X size={14} />
        </button>
      </header>

      <div className="space-y-4">
        {LATEST_RELEASE.sections.map((section, idx) => (
          <div key={idx}>
            <h3 className="mb-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
              {section.title}
            </h3>
            <ul className="space-y-1">
              {section.items.map((item, j) => (
                <li
                  key={j}
                  className="flex gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[var(--color-text-muted)]"
                  />
                  <span>{renderInlineMarkdown(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// Mini-renderer para `**bold**` inline en bullets de novedades. Cualquier
// otro markdown se ignora (queda como texto plano).
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--color-text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mic, Search } from "lucide-react";
import { getProjects } from "../api/projects.api";
import { VisitasToolPanel } from "../components/ingenieria/visitas/VisitasToolPanel";
import { VisitFloatingButton } from "../components/visitas/VisitFloatingButton";

/**
 * Página de "atajo" para que el operario cargue una entrada de visita técnica
 * sin tener que entrar al proyecto, abrir el StageDrawer, etc. Selector de
 * proyecto arriba, panel con los 3 botones (Audio/Foto/Nota) abajo.
 */
export function VisitaRapida() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projectsQ = useQuery({
    queryKey: ["projects-active"],
    queryFn: () => getProjects(),
  });

  const filtered = useMemo(() => {
    const all = projectsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.clientName.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.locationCity.toLowerCase().includes(q),
    );
  }, [projectsQ.data, search]);

  const selected = projectsQ.data?.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <header>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al dashboard
        </Link>
        <div className="mt-2 flex items-center gap-2">
          <Mic className="w-5 h-5 text-[var(--color-accent)]" />
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Cargar entrada de visita técnica
          </h1>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          Elegí el proyecto y la app crea (o reusa) tu visita activa para cargar audio, foto o nota.
        </p>
      </header>

      {/* Selector de proyecto */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Proyecto
        </p>

        {selected ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {selected.clientName}
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                {selected.code} · {selected.locationCity}
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedId(null);
                setSearch("");
              }}
              className="text-[10px] text-[var(--color-accent)] hover:underline shrink-0"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <input
                type="search"
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] pl-8 pr-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)]"
                placeholder="Buscar por cliente, código o ciudad…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {projectsQ.isLoading ? (
              <p className="text-xs text-[var(--color-text-muted)]">Cargando proyectos…</p>
            ) : filtered.length === 0 ? (
              <p className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
                Sin proyectos que coincidan.
              </p>
            ) : (
              <ul className="space-y-1 max-h-72 overflow-auto">
                {filtered.slice(0, 30).map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className="w-full text-left rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 hover:bg-[var(--color-bg-card-hover)]"
                    >
                      <p className="text-xs text-[var(--color-text-primary)]">{p.clientName}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
                        {p.code} · {p.locationCity}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {filtered.length > 30 && (
              <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
                Mostrando 30 de {filtered.length}. Refiná la búsqueda.
              </p>
            )}
          </>
        )}
      </section>

      {/* Panel de visita una vez elegido el proyecto */}
      {selected && (
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-3">
            Visita técnica · {selected.clientName}
          </p>
          <VisitasToolPanel projectId={selected.id} />
        </section>
      )}

      {selected && <VisitFloatingButton projectId={selected.id} />}
    </div>
  );
}

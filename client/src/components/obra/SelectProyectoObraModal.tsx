import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { getProjects } from "../../api/projects.api";
import { Sheet } from "../ui/Sheet";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Selector de proyecto para el acceso directo del Dashboard a "Cargar fotos
// de obra": como no hay proyecto en contexto, se elige acá y se navega al tab
// Obra. Busca por cliente, código o ciudad. Mismo patrón que VisitaRapida.
export function SelectProyectoObraModal({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const projectsQ = useQuery({
    queryKey: ["projects-active"],
    queryFn: () => getProjects({ status: "ACTIVE" }),
    enabled: isOpen,
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

  function select(projectId: string) {
    onClose();
    setSearch("");
    navigate(`/projects/${projectId}?focus=obra`);
  }

  return (
    <Sheet open={isOpen} onClose={onClose} title="Cargar fotos de obra">
      <p className="mb-3 text-[11px] text-[var(--color-text-muted)]">
        Elegí el proyecto para abrir su galería de fotos.
      </p>

      <div className="relative mb-3">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="search"
          className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 pl-8 pr-2 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          placeholder="Buscar por cliente, código o ciudad…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {projectsQ.isLoading ? (
        <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Cargando proyectos…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
          Sin proyectos que coincidan.
        </p>
      ) : (
        <ul className="space-y-1">
          {filtered.slice(0, 30).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => select(p.id)}
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-left hover:bg-[var(--color-bg-card-hover)]"
              >
                <p className="text-xs text-[var(--color-text-primary)]">{p.clientName}</p>
                <p className="mt-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
                  {p.code} · {p.locationCity}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {filtered.length > 30 && (
        <p className="mt-2 font-mono text-[10px] text-[var(--color-text-muted)]">
          Mostrando 30 de {filtered.length}. Refiná la búsqueda.
        </p>
      )}
    </Sheet>
  );
}

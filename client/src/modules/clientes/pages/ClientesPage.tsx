import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, Search, SlidersHorizontal } from "lucide-react";

import {
  exportClientes,
  type ClienteEstado,
  type ClienteListItem,
  type ClientesFilters as Filters,
  type ClienteSortBy,
} from "../../../api/clientes.api";
import { getAssignableUsers } from "../../../api/users.api";
import { ResponsiveTable, type Column } from "../../../components/ui/ResponsiveTable";
import { Sheet } from "../../../components/ui/Sheet";
import { Spinner } from "../../../components/ui/Spinner";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { ActiveFilterChips, ClientesFilters } from "../components/ClientesFilters";
import { EtapaChip } from "../components/EtapaChip";
import { ESTADO_LABELS } from "../constants";
import { useClientes } from "../hooks/useClientes";

const PAGE_SIZE = 50;
const SORTABLE: Record<string, ClienteSortBy> = {
  nombre: "nombre",
  etapa: "etapa",
  potenciaKwp: "potenciaKwp",
  fechaEntrega: "fechaEntrega",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ESTADO_PILL: Record<ClienteEstado, string> = {
  ACTIVO: "bg-[var(--color-state-active-bg)] text-[var(--color-state-active-text)]",
  FINALIZADO: "bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]",
  ARCHIVADO: "bg-[var(--color-bg-app)] text-[var(--color-text-muted)]",
  PROSPECTO: "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]",
};

function EstadoPill({ estado }: { estado: ClienteEstado }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${ESTADO_PILL[estado]}`}
    >
      {ESTADO_LABELS[estado]}
    </span>
  );
}


export function ClientesPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [filters, setFilters] = useState<Filters>({ sortBy: "nombre", sortDir: "asc" });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  // Debounce de la búsqueda → evita un request por tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => ({ ...f, search: searchInput.trim() || undefined }));
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data: asesoresRaw = [] } = useQuery({
    queryKey: ["clientes-asesores"],
    queryFn: getAssignableUsers,
  });
  const asesores = useMemo(
    () => asesoresRaw.map((u) => ({ id: u.id, nombre: u.name })),
    [asesoresRaw],
  );

  const { data, isLoading, isError } = useClientes(filters, page, PAGE_SIZE);

  // Filtros que vienen del componente (excepto search, que se maneja con debounce).
  function patchFilters(patch: Partial<Filters>) {
    if ("search" in patch) {
      setSearchInput(patch.search ?? "");
      return;
    }
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  function clearAll() {
    setSearchInput("");
    setFilters({ sortBy: "nombre", sortDir: "asc" });
    setPage(1);
  }

  function handleSort(key: string) {
    const sortBy = SORTABLE[key];
    if (!sortBy) return;
    setFilters((f) => ({
      ...f,
      sortBy,
      sortDir: f.sortBy === sortBy && f.sortDir === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }

  async function handleExport() {
    try {
      await exportClientes(filters);
    } catch {
      toast.error("No se pudo exportar el listado");
    }
  }

  // El search vive en searchInput; el resto en filters.
  const filtersForChips: Filters = { ...filters, search: searchInput.trim() || undefined };

  const columns: Column<ClienteListItem>[] = [
    {
      key: "nombre",
      label: "Nombre",
      cardRole: "title",
      sortable: true,
      className: "font-medium text-[var(--color-text-primary)]",
    },
    { key: "estado", label: "Estado", render: (c) => <EstadoPill estado={c.estado} /> },
    {
      key: "etapa",
      label: "Etapa",
      sortable: true,
      render: (c) => <EtapaChip etapa={c.etapa} />,
    },
    {
      key: "asesor",
      label: "Asesor",
      className: "text-[var(--color-text-muted)]",
      render: (c) => c.asesor?.nombre ?? "—",
    },
    {
      key: "departamento",
      label: "Departamento",
      className: "text-[var(--color-text-muted)]",
      render: (c) => c.departamento ?? "—",
    },
    {
      key: "potenciaKwp",
      label: "Potencia",
      align: "right",
      sortable: true,
      cardRole: "highlight",
      className: "tabular-nums",
      render: (c) => (c.potenciaKwp != null ? `${c.potenciaKwp} kWp` : "—"),
    },
    {
      key: "fechaEntrega",
      label: "Entrega",
      sortable: true,
      className: "text-[var(--color-text-muted)] text-[11px]",
      render: (c) => fmtDate(c.fechaEntrega),
    },
    {
      key: "telefono",
      label: "Teléfono",
      className: "text-[var(--color-text-muted)]",
      render: (c) => c.telefono ?? "—",
    },
    {
      key: "mail",
      label: "Mail",
      className: "text-[var(--color-text-muted)]",
      render: (c) => c.mail ?? "—",
    },
  ];

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
            Experiencia de Clientes
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {total} cliente{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-card-hover)]"
        >
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      {/* Filtros: inline en desktop, en Sheet en mobile */}
      {isMobile ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Buscar cliente"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-2 pl-9 pr-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <button
            onClick={() => setFiltersSheetOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-xs text-[var(--color-text-secondary)]"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filtros
          </button>
        </div>
      ) : (
        <ClientesFilters
          filters={{ ...filters, search: searchInput || undefined }}
          onChange={patchFilters}
          asesores={asesores}
        />
      )}

      <ActiveFilterChips
        filters={filtersForChips}
        asesores={asesores}
        onChange={patchFilters}
        onClearAll={clearAll}
      />

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="py-12 text-center text-sm text-[var(--color-danger-text)]">
            No se pudo cargar el listado de clientes.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ResponsiveTable
              columns={columns}
              data={items}
              rowKey={(c) => c.projectId}
              onRowClick={(c) => navigate(`/clientes/${c.projectId}`)}
              rowClickableOnDesktop
              sortBy={filters.sortBy}
              sortOrder={filters.sortDir}
              onSort={handleSort}
              emptyMessage="Ningún cliente coincide con los filtros."
            />
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)] disabled:opacity-40 enabled:hover:bg-[var(--color-bg-card-hover)]"
          >
            Anterior
          </button>
          <span className="text-[var(--color-text-muted)]">
            Página {page} de {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text-secondary)] disabled:opacity-40 enabled:hover:bg-[var(--color-bg-card-hover)]"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Filtros en Sheet (mobile) */}
      <Sheet open={filtersSheetOpen} onClose={() => setFiltersSheetOpen(false)} title="Filtros">
        <div className="space-y-4">
          <ClientesFilters
            filters={{ ...filters, search: searchInput || undefined }}
            onChange={patchFilters}
            asesores={asesores}
          />
          <ActiveFilterChips
            filters={filtersForChips}
            asesores={asesores}
            onChange={patchFilters}
            onClearAll={clearAll}
          />
        </div>
      </Sheet>
    </div>
  );
}

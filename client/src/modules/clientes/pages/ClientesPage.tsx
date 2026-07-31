import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, Search, SlidersHorizontal, Trash2, Upload, UserCheck, UserPlus } from "lucide-react";

import {
  deleteCliente,
  exportClientes,
  type ClienteEstado,
  type ClienteListItem,
  type ClienteRecorrido,
  type ClientesFilters as Filters,
  type ClienteSortBy,
} from "../../../api/clientes.api";
import { getAssignableUsers } from "../../../api/users.api";
import { DeleteConfirmModal } from "../../../components/ui/DeleteConfirmModal";
import { ResponsiveTable, type Column } from "../../../components/ui/ResponsiveTable";
import { Sheet } from "../../../components/ui/Sheet";
import { Spinner } from "../../../components/ui/Spinner";
import { useIsMobile } from "../../../hooks/useIsMobile";
import { usePermission } from "../../../hooks/usePermission";
import { ActiveFilterChips, ClientesFilters } from "../components/ClientesFilters";
import { EditableCell } from "../components/EditableCell";
import { ImportClientesModal } from "../components/ImportClientesModal";
import { CrearUsuarioModal } from "../components/CrearUsuarioModal";
import { EtapaChip } from "../components/EtapaChip";
import { DEPARTAMENTOS_UY, ESTADO_LABELS, RECORRIDO_SHORT } from "../constants";
import { useClientes } from "../hooks/useClientes";
import { useUpdateCliente } from "../hooks/useUpdateCliente";

const PAGE_SIZE = 50;
const SORTABLE: Record<string, ClienteSortBy> = {
  nombre: "nombre",
  etapa: "etapa",
  potenciaKwp: "potenciaKwp",
  fechaEntrega: "fechaEntrega",
  proximoMantenimiento: "proximoMantenimiento",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
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

  // Edición inline. Solo con permiso EDIT.
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const canDelete = usePermission("EXPERIENCIA_CLIENTES", "DELETE");
  const [importOpen, setImportOpen] = useState(false);
  const [crearUserFor, setCrearUserFor] = useState<ClienteListItem | null>(null);
  const updateCliente = useUpdateCliente();
  function saveField(projectId: string, patch: Parameters<typeof updateCliente.mutateAsync>[0]["patch"]) {
    return updateCliente.mutateAsync({ projectId, patch }).then(() => undefined);
  }

  // Borrado lógico del Generador (desaparece del listado; recuperable en la base).
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<ClienteListItem | null>(null);
  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => deleteCliente(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Generador borrado");
      setToDelete(null);
    },
    onError: () => toast.error("No se pudo borrar el Generador"),
  });

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

  const deptOptions = [
    { value: "", label: "— Sin departamento —" },
    ...DEPARTAMENTOS_UY.map((d) => ({ value: d, label: d })),
  ];
  const asesorOptions = [
    { value: "", label: "Sin asignar" },
    ...asesores.map((a) => ({ value: a.id, label: a.nombre })),
  ];
  const estadoOptions = (Object.keys(ESTADO_LABELS) as ClienteEstado[]).map((e) => ({
    value: e,
    label: ESTADO_LABELS[e],
  }));
  const etapaOptions = [
    { value: "", label: "— Sin etapa —" },
    ...(["E1", "E2", "E3"] as ClienteRecorrido[]).map((r) => ({ value: r, label: RECORRIDO_SHORT[r] })),
  ];

  const columns: Column<ClienteListItem>[] = [
    {
      key: "nombre",
      label: "Nombre",
      cardRole: "title",
      sortable: true,
      className: "font-medium text-[var(--color-text-primary)]",
      render: (c) => (
        <EditableCell
          value={c.nombre}
          type="text"
          canEdit={canEdit}
          ariaLabel="nombre"
          onSave={(v) => saveField(c.projectId, { nombre: v ?? "" })}
        />
      ),
    },
    {
      key: "estado",
      label: "Estado",
      render: (c) => (
        <EditableCell
          value={c.estado}
          type="text"
          options={estadoOptions}
          canEdit={canEdit}
          ariaLabel="estado"
          render={(v) => <EstadoPill estado={(v ?? c.estado) as ClienteEstado} />}
          onSave={(v) => saveField(c.projectId, { estado: (v ?? c.estado) as ClienteEstado })}
        />
      ),
    },
    {
      key: "etapa",
      label: "Etapa",
      sortable: true,
      render: (c) => (
        <EditableCell
          value={c.etapa?.recorrido.codigo ?? null}
          type="text"
          options={etapaOptions}
          canEdit={canEdit}
          ariaLabel="etapa"
          render={() => <EtapaChip etapa={c.etapa} />}
          onSave={(v) => saveField(c.projectId, { etapa: (v as ClienteRecorrido) ?? null })}
        />
      ),
    },
    {
      key: "ultimoContactoEn",
      label: "Último contacto",
      className: "text-[11px]",
      render: (c) => {
        const d = daysSince(c.ultimoContactoEn);
        const overdue = d != null && d > 7;
        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={
                overdue
                  ? "font-medium text-[var(--color-warning-text)]"
                  : "text-[var(--color-text-muted)]"
              }
            >
              {c.ultimoContactoEn
                ? `${fmtDate(c.ultimoContactoEn)}${d != null ? ` · ${d}d` : ""}`
                : "Sin contacto"}
            </span>
            {c.avisoHabilitacionPendiente && (
              <span className="inline-flex w-fit items-center rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]">
                ⚠ Aviso pendiente
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "asesor",
      label: "Asesor",
      className: "text-[var(--color-text-muted)]",
      render: (c) => (
        <EditableCell
          value={c.asesor?.id ?? null}
          type="text"
          options={asesorOptions}
          canEdit={canEdit}
          ariaLabel="asesor"
          render={(v) => asesores.find((a) => a.id === v)?.nombre ?? c.asesor?.nombre ?? "—"}
          onSave={(v) => saveField(c.projectId, { asesor: v })}
        />
      ),
    },
    {
      key: "departamento",
      label: "Departamento",
      className: "text-[var(--color-text-muted)]",
      render: (c) => (
        <EditableCell
          value={c.departamento}
          type="text"
          options={deptOptions}
          canEdit={canEdit}
          ariaLabel="departamento"
          onSave={(v) => saveField(c.projectId, { departamento: v ?? "" })}
        />
      ),
    },
    {
      key: "potenciaKwp",
      label: "Potencia",
      sortable: true,
      cardRole: "highlight",
      className: "tabular-nums",
      render: (c) => (
        <EditableCell
          value={c.potenciaKwp != null ? String(c.potenciaKwp) : null}
          type="number"
          canEdit={canEdit}
          ariaLabel="potencia"
          render={(v) => (v != null && v !== "" ? `${v} kWp` : <span className="text-[var(--color-text-muted)]">—</span>)}
          onSave={(v) => saveField(c.projectId, { potencia: v ? Number(v) : 0 })}
        />
      ),
    },
    {
      key: "fechaEntrega",
      label: "Entrega",
      sortable: true,
      className: "text-[var(--color-text-muted)] text-[11px]",
      render: (c) => (
        <EditableCell
          value={c.fechaEntrega}
          type="date"
          canEdit={canEdit}
          ariaLabel="fecha de entrega"
          render={(v) => (v ? fmtDate(v) : <span className="text-[var(--color-text-muted)]">—</span>)}
          onSave={(v) => saveField(c.projectId, { fechaEntrega: v })}
        />
      ),
    },
    {
      key: "proximoMantenimiento",
      label: "Próx. mantenimiento",
      sortable: true,
      className: "text-[11px]",
      render: (c) => {
        const m = c.mantenimiento;
        if (!m) return <span className="text-[var(--color-text-muted)]">—</span>;
        const inminente = m.diasRestantes <= 30;
        const falta = m.diasRestantes === 0 ? "hoy" : `en ${m.diasRestantes} d`;
        return (
          <span
            className={
              inminente
                ? "font-medium text-[var(--color-warning-text)]"
                : "text-[var(--color-text-muted)]"
            }
          >
            cumple {m.aniosQueCumple} {m.aniosQueCumple === 1 ? "año" : "años"} · {falta}
          </span>
        );
      },
    },
    {
      key: "telefono",
      label: "Teléfono",
      className: "text-[var(--color-text-muted)]",
      render: (c) => (
        <EditableCell
          value={c.telefono}
          type="tel"
          canEdit={canEdit}
          ariaLabel="teléfono"
          onSave={(v) => saveField(c.projectId, { telefono: v })}
        />
      ),
    },
    {
      key: "mail",
      label: "Mail",
      className: "text-[var(--color-text-muted)]",
      render: (c) => (
        <EditableCell
          value={c.mail}
          type="email"
          canEdit={canEdit}
          ariaLabel="mail"
          onSave={(v) => saveField(c.projectId, { mail: v })}
        />
      ),
    },
    {
      key: "usuario",
      label: "Usuario",
      render: (c) =>
        c.hasPortalUser ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-400">
            <UserCheck className="h-3.5 w-3.5" /> Con acceso
          </span>
        ) : canCreate ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCrearUserFor(c);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
          >
            <UserPlus className="h-3.5 w-3.5" /> Crear usuario
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
            <UserPlus className="h-3.5 w-3.5" /> Sin acceso
          </span>
        ),
    },
  ];

  if (canDelete) {
    columns.push({
      key: "acciones",
      label: "",
      className: "w-10 text-right",
      render: (c) => (
        <button
          type="button"
          aria-label={`Borrar ${c.nombre}`}
          title="Borrar Generador"
          onClick={(e) => {
            e.stopPropagation();
            setToDelete(c);
          }}
          className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    });
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {total} Generador{total !== 1 ? "es" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreate && (
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-card-hover)]"
            >
              <Upload className="h-4 w-4" /> Importar
            </button>
          )}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-card-hover)]"
          >
            <Download className="h-4 w-4" /> Exportar
          </button>
        </div>
      </div>

      {importOpen && <ImportClientesModal open={importOpen} onClose={() => setImportOpen(false)} />}

      {crearUserFor && (
        <CrearUsuarioModal cliente={crearUserFor} onClose={() => setCrearUserFor(null)} />
      )}

      <DeleteConfirmModal
        open={toDelete !== null}
        title="Borrar Generador"
        description={
          toDelete
            ? `Se va a borrar "${toDelete.nombre}". Desaparece de todas las listas de la app (queda recuperable en la base).`
            : undefined
        }
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.projectId)}
        onClose={() => !deleteMutation.isPending && setToDelete(null)}
      />

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
          // Contenedor de scroll con altura acotada: el thead sticky se ancla a
          // ESTE div (no al viewport, roto por <main overflow-y-auto>).
          // overflow-auto cubre scroll vertical (sticky) y horizontal a la vez.
          <div className="max-h-[calc(100vh-18rem)] overflow-auto">
            <ResponsiveTable
              columns={columns}
              data={items}
              rowKey={(c) => c.projectId}
              onRowClick={(c) => navigate(`/clientes/${c.projectId}`)}
              rowClickableOnDesktop
              stickyHeader
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

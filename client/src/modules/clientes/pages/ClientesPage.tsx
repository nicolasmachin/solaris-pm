import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, Circle, Download, Eye, Search, Send, SlidersHorizontal, Trash2, Upload, UserCheck, UserPlus } from "lucide-react";

import {
  deleteCliente,
  exportClientes,
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
import { ReenviarAccesoModal } from "../components/ReenviarAccesoModal";
import { EtapaChip } from "../components/EtapaChip";
import { RECORRIDO_SHORT } from "../constants";
import { BLOQUES as BLOQUES_ETAPA } from "../components/RecorridoPipeline";
import { usePortalPreviewStore } from "../../../store/portalPreview.store";
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


export function ClientesPage() {
  const navigate = useNavigate();
  const activarPreview = usePortalPreviewStore((s) => s.activar);
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
  const [reenviarAccesoFor, setReenviarAccesoFor] = useState<ClienteListItem | null>(null);
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

  const asesorOptions = [
    { value: "", label: "Sin asignar" },
    ...asesores.map((a) => ({ value: a.id, label: a.nombre })),
  ];
  const etapaOptions = [
    { value: "", label: "— Sin etapa —" },
    ...(["E1", "E2", "E3"] as ClienteRecorrido[]).map((r) => ({ value: r, label: RECORRIDO_SHORT[r] })),
  ];

  // Sin orden de columna explícito, la cartera se muestra agrupada por etapa y
  // ordenada por prioridad de contacto (lo resuelve el backend).
  const agrupadoPorEtapa = !filters.sortBy || filters.sortBy === "prioridad";
  // Fila en rojo cuando falta uno de los tres avisos clave: el triángulo solo se
  // pierde entre las columnas.
  const rowClassName = (c: ClienteListItem) =>
    c.avisosClavePendientes.length > 0 ? "bg-[var(--color-danger-bg)]/30" : "";

  const columns: Column<ClienteListItem>[] = [
    {
      // Las dos señales del recorrido, juntas y primeras: son lo que hace que la
      // lista se lea de un golpe. Significan cosas distintas a propósito —
      // el triángulo pide una acción con plazo, el punto solo dice "mirá esto"—
      // y por eso ninguna de las dos reordena la lista.
      key: "señales",
      label: "",
      className: "w-8",
      cardRole: "hidden",
      render: (c) => (
        <div className="flex items-center gap-1">
          {c.avisosClavePendientes.length > 0 ? (
            <span title={`Acción requerida: ${c.avisosClavePendientes.join(" · ")}`} className="flex">
              <AlertTriangle
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-danger-text)]"
                aria-label={c.avisosClavePendientes.join(". ")}
              />
            </span>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          {c.hayNovedad ? (
            <span title="Novedad: pasó algo y todavía no se lo dijimos" className="flex">
              <Circle
                className="h-2 w-2 shrink-0 fill-[var(--color-accent)] text-[var(--color-accent)]"
                aria-label="Hay algo nuevo desde el último contacto"
              />
            </span>
          ) : (
            <span className="w-2 shrink-0" />
          )}
        </div>
      ),
    },
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
        // El veredicto lo da el backend con la cadencia configurada (Admin →
        // Cadencia de contacto), no un umbral fijo en la pantalla.
        const d = c.diasSinContacto;
        return (
          <div className="flex flex-col gap-0.5">
            <span
              className={
                c.fueraDeCadencia
                  ? "font-medium text-[var(--color-danger-text)]"
                  : "text-[var(--color-text-muted)]"
              }
              title={c.fueraDeCadencia ? "Supera la cadencia de contacto de su etapa" : undefined}
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
      label: "Acceso",
      className: "w-14",
      render: (c) =>
        c.hasPortalUser ? (
          <div className="inline-flex items-center gap-1">
            <span title="Tiene acceso al portal" className="flex">
              <UserCheck className="h-4 w-4 text-green-400" aria-label="Con acceso al portal" />
            </span>
            {canCreate && (
              <button
                type="button"
                title="Reenviar el acceso (resetea la contraseña y arma el mensaje)"
                aria-label={`Reenviar el acceso de ${c.nombre}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setReenviarAccesoFor(c);
                }}
                className="rounded p-0.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : canCreate ? (
          <button
            type="button"
            title="Sin acceso al portal — crear el usuario"
            aria-label={`Crear el usuario de portal de ${c.nombre}`}
            onClick={(e) => {
              e.stopPropagation();
              setCrearUserFor(c);
            }}
            className="rounded p-0.5 text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
          >
            <UserPlus className="h-4 w-4" />
          </button>
        ) : (
          <span title="Sin acceso al portal" className="flex">
            <UserPlus className="h-4 w-4 text-[var(--color-text-muted)]" aria-label="Sin acceso" />
          </span>
        ),
    },
  ];

  columns.push({
    key: "acciones",
    label: "",
    className: "w-20 text-right",
    cardRole: "hidden",
    render: (c) => (
      <div className="flex items-center justify-end gap-0.5">
        {c.hasPortalUser && (
          <button
            type="button"
            aria-label={`Ver el portal de ${c.nombre}`}
            title="Ver la pantalla como la ve el cliente"
            onClick={(e) => {
              e.stopPropagation();
              activarPreview({ projectId: c.projectId, clientName: c.nombre });
              navigate(`/portal/${c.projectId}`);
            }}
            className="rounded p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-accent)]"
          >
            <Eye className="h-4 w-4" />
          </button>
        )}
        {canDelete && (
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
        )}
      </div>
    ),
  });

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

      {reenviarAccesoFor && (
        <ReenviarAccesoModal cliente={reenviarAccesoFor} onClose={() => setReenviarAccesoFor(null)} />
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
            {agrupadoPorEtapa ? (
              // Sin orden de columna elegido, la cartera se lee por etapa: dentro
              // de cada bloque manda la prioridad de contacto. Mezclar las tres
              // etapas en una sola lista obliga a leer la columna Etapa en cada
              // fila para saber de qué se está hablando.
              // El cuarto bloque no es decorativo: 45 de 93 clientes no tienen
              // etapa (finalizados, importados por planilla), y sin él
              // desaparecían de la pantalla al agrupar.
              [...BLOQUES_ETAPA, { codigo: null, label: "Sin etapa" } as const].map((b) => {
                const delBloque = items.filter((c) => (c.etapa?.recorrido.codigo ?? null) === b.codigo);
                if (delBloque.length === 0) return null;
                const urgentes = delBloque.filter((c) => c.avisosClavePendientes.length > 0).length;
                return (
                  <section key={b.codigo ?? "sin-etapa"}>
                    <div className="sticky top-0 z-20 flex items-baseline gap-2 border-y border-[var(--color-border)] bg-[var(--color-bg-app)] px-4 py-2">
                      {b.codigo && (
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                          {b.codigo}
                        </span>
                      )}
                      <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{b.label}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {delBloque.length}
                        {urgentes > 0 && (
                          <span className="ml-2 text-[var(--color-danger-text)]">{urgentes} para hoy</span>
                        )}
                      </span>
                    </div>
                    <ResponsiveTable
                      columns={columns}
                      data={delBloque}
                      rowKey={(c) => c.projectId}
                      rowClassName={rowClassName}
                      onRowClick={(c) => navigate(`/clientes/${c.projectId}`)}
                      rowClickableOnDesktop
                      emptyMessage=""
                    />
                  </section>
                );
              })
            ) : (
              <ResponsiveTable
                columns={columns}
                data={items}
                rowKey={(c) => c.projectId}
                rowClassName={rowClassName}
                onRowClick={(c) => navigate(`/clientes/${c.projectId}`)}
                rowClickableOnDesktop
                stickyHeader
                sortBy={filters.sortBy}
                sortOrder={filters.sortDir}
                onSort={handleSort}
                emptyMessage="Ningún cliente coincide con los filtros."
              />
            )}
            {items.length === 0 && (
              <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
                Ningún cliente coincide con los filtros.
              </p>
            )}
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

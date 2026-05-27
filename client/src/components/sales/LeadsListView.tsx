import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { getLeadsFlat, type GetLeadsFlatParams, type LeadFlatRow } from "../../api/leads.api";
import { STAGE_COLORS, STAGE_LABELS, type SalesStage } from "../../types/leads.types";
import { Spinner } from "../ui/Spinner";
import { UserSelect } from "../ui/UserSelect";

// Vista de lista (tabla) para el módulo Ventas. Estado fuente de verdad
// vive en la URL (useSearchParams) para que sea compartible y sobreviva
// refresh. Búsqueda con debounce 300ms, paginación offset/limit con
// metadata, sort por columna clickeando el header.

interface Props {
  onOpenLead: (leadId: string) => void;
}

type SortKey = NonNullable<GetLeadsFlatParams["sortBy"]>;
type SortOrder = NonNullable<GetLeadsFlatParams["sortOrder"]>;
type DateField = NonNullable<GetLeadsFlatParams["dateField"]>;

const DEFAULT_LIMIT = 50;
const DEFAULT_SORT_BY: SortKey = "leadCreatedAt";
const DEFAULT_SORT_ORDER: SortOrder = "desc";

const COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "clientName", label: "Lead" },
  { key: "stage", label: "Etapa" },
  { key: "leadCreatedAt", label: "Fecha de creación" },
  { key: "proposalSentAt", label: "Propuesta enviada" },
  { key: "closedAt", label: "Fecha de cierre" },
  { key: "owner", label: "Propietario" },
];

const DATE_FIELDS: Array<{ value: DateField; label: string }> = [
  { value: "leadCreatedAt", label: "Fecha de creación" },
  { value: "proposalSentAt", label: "Propuesta enviada" },
  { value: "closedAt", label: "Fecha de cierre" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function LeadsListView({ onOpenLead }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Lectura de filtros desde la URL ─────────────────────────────────────
  const q = searchParams.get("q") ?? "";
  const stage = searchParams.get("stage") ?? "";
  const ownerId = searchParams.get("ownerId") ?? "";
  const dateField = (searchParams.get("dateField") as DateField | null) ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const sortBy = (searchParams.get("sortBy") as SortKey | null) ?? DEFAULT_SORT_BY;
  const sortOrder = (searchParams.get("sortOrder") as SortOrder | null) ?? DEFAULT_SORT_ORDER;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // ── Búsqueda con debounce: estado local sincronizado con la URL ────────
  const [searchDraft, setSearchDraft] = useState(q);
  useEffect(() => {
    if (searchDraft === q) return;
    const t = setTimeout(() => {
      updateParam("q", searchDraft || null);
      updateParam("page", null); // reset paginación al buscar
    }, 300);
    return () => clearTimeout(t);
    // updateParam usa el setSearchParams del hook, que es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, q]);

  // Si la URL cambia desde otro lado (ej. clear filters), resincronizar.
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === null || value === "") next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setStage = (newStage: string) => {
    updateParam("stage", newStage || null);
    updateParam("page", null);
  };
  const setOwner = (newOwner: string | null) => {
    updateParam("ownerId", newOwner ?? null);
    updateParam("page", null);
  };
  const setDateField = (v: string) => {
    updateParam("dateField", v || null);
    if (!v) {
      updateParam("dateFrom", null);
      updateParam("dateTo", null);
    }
    updateParam("page", null);
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      updateParam("sortOrder", sortOrder === "asc" ? "desc" : "asc");
    } else {
      updateParam("sortBy", key);
      updateParam("sortOrder", "asc");
    }
    updateParam("page", null);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────
  const params: GetLeadsFlatParams = useMemo(
    () => ({
      q: q || undefined,
      stage: stage || undefined,
      ownerId: ownerId || undefined,
      dateField,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      sortOrder,
      page,
      limit: DEFAULT_LIMIT,
    }),
    [q, stage, ownerId, dateField, dateFrom, dateTo, sortBy, sortOrder, page],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["leads-flat", params],
    queryFn: () => getLeadsFlat(params),
    staleTime: 30_000,
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  const hasActiveFilters = Boolean(q || stage || ownerId || dateField || dateFrom || dateTo);

  const clearFilters = () => {
    setSearchParams(new URLSearchParams(), { replace: true });
    setSearchDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Toolbar de filtros */}
      <div className="flex shrink-0 flex-wrap items-end gap-2">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Buscar por cliente o dirección…"
            className="w-64 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] py-1.5 pl-7 pr-2 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
        >
          <option value="">Todas las etapas</option>
          {(Object.entries(STAGE_LABELS) as Array<[SalesStage, string]>).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <div className="w-44">
          <UserSelect
            value={ownerId === "unassigned" ? null : ownerId || null}
            onChange={(id) => setOwner(id)}
            allowUnassigned
            unassignedLabel="Cualquier propietario"
            placeholder="Cualquier propietario"
            ariaLabel="Filtrar por propietario"
          />
        </div>

        <select
          value={dateField ?? ""}
          onChange={(e) => setDateField(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
        >
          <option value="">Sin filtro de fecha</option>
          {DATE_FIELDS.map((d) => (
            <option key={d.value} value={d.value}>
              Filtrar por {d.label.toLowerCase()}
            </option>
          ))}
        </select>

        {dateField ? (
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                updateParam("dateFrom", e.target.value || null);
                updateParam("page", null);
              }}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <span className="text-xs text-[var(--color-text-muted)]">a</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                updateParam("dateTo", e.target.value || null);
                updateParam("page", null);
              }}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </>
        ) : null}

        {hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            Limpiar filtros
          </button>
        ) : null}

        <div className="ml-auto text-xs text-[var(--color-text-muted)]">
          {pagination
            ? `${pagination.total} lead${pagination.total === 1 ? "" : "s"}`
            : isLoading
              ? "Cargando…"
              : null}
        </div>
      </div>

      {/* Tabla */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--color-bg-card)]">
              <tr
                className="border-b border-[var(--color-border)] text-[10px] font-mono uppercase tracking-widest"
                style={{ color: "var(--color-text-muted)" }}
              >
                {COLUMNS.map((col) => {
                  const active = sortBy === col.key;
                  const Icon = active ? (sortOrder === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="cursor-pointer select-none px-3 py-2 text-left font-semibold hover:text-[var(--color-text-secondary)]"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <Icon size={11} className={active ? "text-[var(--color-accent)]" : "opacity-50"} />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center">
                    <Spinner />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-[var(--color-text-muted)]">
                    No hay leads que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                rows.map((lead) => <LeadRow key={lead.id} lead={lead} onOpenLead={onOpenLead} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination && pagination.totalPages > 1 ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-xs">
            <span className="text-[var(--color-text-muted)]">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1 || isFetching}
                onClick={() => updateParam("page", String(page - 1))}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft size={12} /> Anterior
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages || isFetching}
                onClick={() => updateParam("page", String(page + 1))}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadRow({ lead, onOpenLead }: { lead: LeadFlatRow; onOpenLead: (id: string) => void }) {
  const stageColor = STAGE_COLORS[lead.stage];
  return (
    <tr
      onClick={() => onOpenLead(lead.id)}
      className="cursor-pointer border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg-card-hover)]/40"
    >
      <td className="px-3 py-2">
        <div className="text-sm font-medium text-[var(--color-text-primary)]">{lead.clientName}</div>
        {lead.address ? (
          <div className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[280px]">{lead.address}</div>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <span
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{
            borderColor: stageColor.border,
            color: stageColor.dot,
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageColor.dot }} />
          {STAGE_LABELS[lead.stage]}
        </span>
      </td>
      <td className="px-3 py-2 tabular-nums text-[var(--color-text-secondary)]">{formatDate(lead.leadCreatedAt)}</td>
      <td className="px-3 py-2 tabular-nums text-[var(--color-text-secondary)]">{formatDate(lead.proposalSentAt)}</td>
      <td className="px-3 py-2 tabular-nums text-[var(--color-text-secondary)]">{formatDate(lead.closedAt)}</td>
      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{lead.assignedTo?.name ?? "—"}</td>
    </tr>
  );
}

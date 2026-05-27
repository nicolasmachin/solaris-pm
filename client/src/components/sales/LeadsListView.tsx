import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  getLeadsFlat,
  patchLeadStage,
  type GetLeadsFlatParams,
  type LeadFlatRow,
  type LeadListResponse,
} from "../../api/leads.api";
import { STAGE_LABELS, type SalesStage } from "../../types/leads.types";
import { Spinner } from "../ui/Spinner";
import { UserSelect } from "../ui/UserSelect";
import { StageSelect } from "./StageSelect";
import { LostReasonModal } from "./LostReasonModal";
import { MarkAsWonModal } from "./MarkAsWonModal";
import { LeadToProjectModal } from "./LeadToProjectModal";

const LOST_STAGE: SalesStage = "CERRADO_PERDIDO";
const WON_STAGE: SalesStage = "CERRADO_GANADO";

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

  // Aplica varios cambios a los search params en UNA SOLA llamada a
  // setSearchParams. Importante: react-router v6 traduce setSearchParams
  // a navigate() que es async; llamadas sucesivas en el mismo tick leen
  // todas el `prev` desde la URL "vieja" (no se acumulan), entonces si
  // hacíamos updateParam("sortBy", ...) seguido de updateParam("page",
  // null), el segundo pisaba el primero. Agrupando en una sola llamada,
  // el reducer aplica todos los cambios juntos.
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Versión singular para casos con un solo cambio (paginación). Se
  // mantiene para no perder claridad de intención cuando el cambio es uno.
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      updateParams({ [key]: value });
    },
    [updateParams],
  );

  // ── Búsqueda con debounce: estado local sincronizado con la URL ────────
  const [searchDraft, setSearchDraft] = useState(q);
  useEffect(() => {
    if (searchDraft === q) return;
    const t = setTimeout(() => {
      // q + reset de page en una sola llamada para evitar que el segundo
      // updateParam pise al primero.
      updateParams({ q: searchDraft || null, page: null });
    }, 300);
    return () => clearTimeout(t);
  }, [searchDraft, q, updateParams]);

  // Si la URL cambia desde otro lado (ej. clear filters), resincronizar.
  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const setStage = (newStage: string) => {
    updateParams({ stage: newStage || null, page: null });
  };
  const setOwner = (newOwner: string | null) => {
    updateParams({ ownerId: newOwner ?? null, page: null });
  };
  const setDateField = (v: string) => {
    if (!v) {
      updateParams({ dateField: null, dateFrom: null, dateTo: null, page: null });
    } else {
      updateParams({ dateField: v, page: null });
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      updateParams({
        sortOrder: sortOrder === "asc" ? "desc" : "asc",
        page: null,
      });
    } else {
      updateParams({ sortBy: key, sortOrder: "asc", page: null });
    }
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

  const qc = useQueryClient();
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

  // ─── Cambio de stage desde la lista ─────────────────────────────────────
  // Para etapas intermedias: mutación directa con optimistic update.
  // Para CERRADO_PERDIDO: abre LostReasonModal antes de mutar.
  // Para CERRADO_GANADO: abre MarkAsWonModal antes de mutar; al confirmar
  // muta y después abre LeadToProjectModal para crear el proyecto.

  const [pendingLost, setPendingLost] = useState<string | null>(null);
  const [pendingWon, setPendingWon] = useState<string | null>(null);
  const [conversionFor, setConversionFor] = useState<string | null>(null);

  const stageMutation = useMutation({
    mutationFn: ({ leadId, stage, lostReason }: { leadId: string; stage: SalesStage; lostReason?: string | null }) =>
      patchLeadStage(leadId, { stage, lostReason: lostReason ?? null }),
    onMutate: async ({ leadId, stage }) => {
      // Optimistic: actualizamos el stage del lead afectado en TODAS las
      // queries de leads-flat en cache (con distintos params puede haber
      // varias). El refetch en onSettled trae las fechas auto-rellenadas.
      await qc.cancelQueries({ queryKey: ["leads-flat"] });
      const previous = qc.getQueriesData<LeadListResponse>({ queryKey: ["leads-flat"] });
      previous.forEach(([key, value]) => {
        if (!value) return;
        qc.setQueryData<LeadListResponse>(key, {
          ...value,
          data: value.data.map((lead) =>
            lead.id === leadId ? { ...lead, stage } : lead,
          ),
        });
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      // Rollback
      ctx?.previous?.forEach(([key, value]) => {
        qc.setQueryData(key, value);
      });
      toast.error("No se pudo cambiar la etapa");
    },
    onSuccess: (_data, vars) => {
      // Si era WON, abrir el modal de convertir a proyecto.
      if (vars.stage === WON_STAGE) {
        setConversionFor(vars.leadId);
      }
    },
    onSettled: () => {
      // Refetch para traer fechas actualizadas (visitScheduledAt si fue a
      // AGENDAR_VISITA, closedAt si cerró, etc.). También invalida el
      // Kanban en caso de que esté abierto en paralelo.
      qc.invalidateQueries({ queryKey: ["leads-flat"] });
      qc.invalidateQueries({ queryKey: ["lead-groups"] });
    },
  });

  const handleStageChange = (leadId: string, newStage: SalesStage) => {
    if (newStage === LOST_STAGE) {
      setPendingLost(leadId);
      return;
    }
    if (newStage === WON_STAGE) {
      setPendingWon(leadId);
      return;
    }
    stageMutation.mutate({ leadId, stage: newStage });
  };

  const confirmLost = (reason: string) => {
    if (!pendingLost) return;
    stageMutation.mutate(
      { leadId: pendingLost, stage: LOST_STAGE, lostReason: reason },
      { onSettled: () => setPendingLost(null) },
    );
  };

  const confirmWon = () => {
    if (!pendingWon) return;
    const leadId = pendingWon;
    setPendingWon(null);
    stageMutation.mutate({ leadId, stage: WON_STAGE });
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
              onChange={(e) => updateParams({ dateFrom: e.target.value || null, page: null })}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
            <span className="text-xs text-[var(--color-text-muted)]">a</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => updateParams({ dateTo: e.target.value || null, page: null })}
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
                rows.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onOpenLead={onOpenLead}
                    onStageChange={handleStageChange}
                  />
                ))
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

      <LostReasonModal
        open={pendingLost !== null}
        onCancel={() => setPendingLost(null)}
        onConfirm={confirmLost}
        isPending={stageMutation.isPending}
      />

      <MarkAsWonModal
        open={pendingWon !== null}
        onCancel={() => setPendingWon(null)}
        onConfirm={confirmWon}
        isPending={stageMutation.isPending}
      />

      {conversionFor ? (
        <LeadToProjectModal
          leadId={conversionFor}
          onClose={() => setConversionFor(null)}
        />
      ) : null}
    </div>
  );
}

function LeadRow({
  lead,
  onOpenLead,
  onStageChange,
}: {
  lead: LeadFlatRow;
  onOpenLead: (id: string) => void;
  onStageChange: (leadId: string, newStage: SalesStage) => void;
}) {
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
        <StageSelect
          currentStage={lead.stage}
          onChange={(next) => onStageChange(lead.id, next)}
          ariaLabel={`Etapa de ${lead.clientName} — ${STAGE_LABELS[lead.stage]}`}
        />
      </td>
      <td className="px-3 py-2 tabular-nums text-[var(--color-text-secondary)]">{formatDate(lead.leadCreatedAt)}</td>
      <td className="px-3 py-2 tabular-nums text-[var(--color-text-secondary)]">{formatDate(lead.proposalSentAt)}</td>
      <td className="px-3 py-2 tabular-nums text-[var(--color-text-secondary)]">{formatDate(lead.closedAt)}</td>
      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{lead.assignedTo?.name ?? "—"}</td>
    </tr>
  );
}

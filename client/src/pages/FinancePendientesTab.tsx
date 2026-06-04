import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { CalendarDays, ChevronDown, ChevronRight, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";

import {
  deletePendingItem,
  getPendingItems,
  type PendingItem,
  type PendingItemSourceType,
  type ProjectMaterialGroup,
} from "../api/pending.api";
import { fmtCurrency, fmtDate } from "../lib/finance";
import { getMovement, patchMovement, transitionMovement } from "../api/finance.api";
import { updateCashflowEventFecha, type EditableEventSourceType } from "../api/cashflow.api";
import { todayLocalISO } from "../utils/date";
import type { Moneda } from "../types/finance.types";
import { ProjectPicker } from "../components/finance/ProjectPicker";
import { PayManualPendingModal } from "../components/finance/PayManualPendingModal";
import { ManualPendingModal } from "../components/finance/ManualPendingModal";

const SOURCE_LABEL: Record<PendingItemSourceType, string> = {
  FIXED_COST: "Costo fijo",
  PROJECT_MATERIAL: "Material proyectado",
  SUPPLIER_DEBT: "Factura proveedor",
  COMMITTED_EXPENSE: "Compromiso manual",
  MANUAL_PENDING: "Pendiente manual",
};

const SOURCE_TONE: Record<PendingItemSourceType, string> = {
  FIXED_COST: "bg-zinc-500/15 text-zinc-300",
  PROJECT_MATERIAL: "bg-blue-500/15 text-blue-400",
  SUPPLIER_DEBT: "bg-yellow-500/15 text-yellow-400",
  COMMITTED_EXPENSE: "bg-purple-500/15 text-purple-400",
  MANUAL_PENDING: "bg-emerald-500/15 text-emerald-400",
};

export function FinancePendientesTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["finance-pending"],
    queryFn: getPendingItems,
    refetchInterval: 60_000,
  });

  const [filtroOrigen, setFiltroOrigen] = useState<"" | PendingItemSourceType>("");
  const [filtroProyecto, setFiltroProyecto] = useState<string>("");
  const [filtroProveedor, setFiltroProveedor] = useState<string>("");

  const items = data?.items ?? [];
  const projectMaterialGroups = data?.projectMaterialGroups ?? [];
  const [showManual, setShowManual] = useState(false);

  const proyectos = useMemo(() => {
    const m = new Map<string, { id: string; clientName: string; code: string }>();
    for (const it of items) if (it.project) m.set(it.project.id, it.project);
    return Array.from(m.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [items]);
  const proveedores = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string }>();
    for (const it of items) if (it.supplier) m.set(it.supplier.id, it.supplier);
    return Array.from(m.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [items]);

  const filtered = items.filter((it) => {
    if (filtroOrigen && it.sourceType !== filtroOrigen) return false;
    if (filtroProyecto && it.project?.id !== filtroProyecto) return false;
    if (filtroProveedor && it.supplier?.id !== filtroProveedor) return false;
    return true;
  });

  const totals = useMemo(() => {
    const t = {
      FIXED_COST: 0,
      PROJECT_MATERIAL: 0,
      SUPPLIER_DEBT: 0,
      COMMITTED_EXPENSE: 0,
      MANUAL_PENDING: 0,
    };
    for (const it of items) t[it.sourceType] += it.monto;
    for (const g of projectMaterialGroups) t.PROJECT_MATERIAL += g.totalAmount;
    return t;
  }, [items, projectMaterialGroups]);

  // Agrupamos los filtrados por sourceType para vista colapsable.
  const groups = useMemo(() => {
    const order: PendingItemSourceType[] = [
      "FIXED_COST",
      "SUPPLIER_DEBT",
      "COMMITTED_EXPENSE",
      "MANUAL_PENDING",
    ];
    return order
      .map((type) => {
        const groupItems = filtered.filter((it) => it.sourceType === type);
        const totalMonto = groupItems.reduce((s, it) => s + it.monto, 0);
        const overdueCount = groupItems.filter((it) => it.isOverdue).length;
        return { type, items: groupItems, totalMonto, overdueCount };
      })
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  // Materiales proyectados también respetan filtros (origen + proyecto).
  const filteredProjectMaterialGroups = useMemo(() => {
    if (filtroOrigen && filtroOrigen !== "PROJECT_MATERIAL") return [];
    if (filtroProveedor) return []; // materiales no tienen proveedor
    return filtroProyecto
      ? projectMaterialGroups.filter((g) => g.projectId === filtroProyecto)
      : projectMaterialGroups;
  }, [projectMaterialGroups, filtroOrigen, filtroProyecto, filtroProveedor]);

  const hasAny = groups.length > 0 || filteredProjectMaterialGroups.length > 0;

  const [editingCommittedId, setEditingCommittedId] = useState<string | null>(null);
  const [payingManualId, setPayingManualId] = useState<string | null>(null);
  // Grupos abiertos. Por defecto: ninguno (vista compacta de categorías).
  const [expandedGroups, setExpandedGroups] = useState<Set<PendingItemSourceType>>(new Set());
  function toggleGroup(type: PendingItemSourceType) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function invalidatePending() {
    qc.invalidateQueries({ queryKey: ["finance-pending"] });
    qc.invalidateQueries({ queryKey: ["finance-movements-tab"] });
    qc.invalidateQueries({ queryKey: ["finance-movements"] });
    qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
    qc.invalidateQueries({ queryKey: ["fixed-costs-pending"] });
  }

  const transitionMut = useMutation({
    mutationFn: (movementId: string) =>
      transitionMovement(movementId, { newStatus: "PAGADO", paidDate: todayLocalISO() }),
    onSuccess: () => {
      toast.success("Marcado como pagado");
      invalidatePending();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo marcar como pagado");
    },
  });

  // Edición inline de fecha por fila. La key del row en edición y la fecha
  // tentativa viven en el contenedor para sobrevivir re-renders de la tabla.
  const [editingFechaId, setEditingFechaId] = useState<string | null>(null);
  const [editingFechaValue, setEditingFechaValue] = useState<string>("");
  const editFechaMut = useMutation({
    mutationFn: ({ sourceType, sourceId, fecha }: { sourceType: EditableEventSourceType; sourceId: string; fecha: string }) =>
      updateCashflowEventFecha(sourceType, sourceId, fecha),
    onSuccess: () => {
      toast.success("Fecha actualizada");
      setEditingFechaId(null);
      invalidatePending();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo actualizar la fecha");
    },
  });

  const deletePendingMut = useMutation({
    mutationFn: ({ type, id }: { type: PendingItemSourceType; id: string }) =>
      deletePendingItem(type, id),
    onSuccess: () => {
      toast.success("Pendiente eliminado");
      invalidatePending();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo eliminar");
    },
  });

  function deletePending(item: PendingItem) {
    const monto = fmtCurrency(item.monto, item.moneda);
    const messages: Record<PendingItemSourceType, string> = {
      FIXED_COST: `¿Saltear "${item.descripcion}" este mes? Solo afecta a ${new Date().toLocaleDateString("es-UY", { month: "long", year: "numeric" })}; el costo fijo sigue activo para los próximos meses.`,
      PROJECT_MATERIAL: `¿Quitar la fecha esperada del material "${item.descripcion}"? El material queda en el proyecto pero sale de Pendientes y del Flujo de fondos.`,
      SUPPLIER_DEBT: `¿Anular la factura "${item.descripcion}" por ${monto}? Esto la marca como ANULADA en la cuenta del proveedor.`,
      COMMITTED_EXPENSE: `¿Eliminar el compromiso "${item.descripcion}" por ${monto}?`,
      MANUAL_PENDING: `¿Eliminar el pendiente "${item.descripcion}" por ${monto}?`,
    };
    if (!confirm(messages[item.sourceType])) return;
    deletePendingMut.mutate({ type: item.sourceType, id: item.sourceId });
  }

  function handlePay(item: PendingItem) {
    if (item.sourceType === "COMMITTED_EXPENSE") {
      if (!confirm(`¿Marcar pagado "${item.descripcion}" por ${fmtCurrency(item.monto, item.moneda)}?`))
        return;
      transitionMut.mutate(item.sourceId);
      return;
    }
    if (item.sourceType === "SUPPLIER_DEBT" && item.supplier) {
      navigate(`/finanzas/proveedores/${item.supplier.id}`);
      return;
    }
    if (item.sourceType === "FIXED_COST" && item.fixedCost) {
      const params = new URLSearchParams({
        new: "1",
        fixedCostId: item.fixedCost.id,
        descripcion: item.descripcion,
        monto: String(item.monto),
        moneda: item.moneda,
      });
      navigate(`/finanzas/movimientos?${params.toString()}`);
      return;
    }
    if (item.sourceType === "PROJECT_MATERIAL" && item.project) {
      navigate(`/projects/${item.project.id}`);
      toast(
        "Confirmá la compra desde el módulo Ingeniería del proyecto (compromiso → pago).",
        { icon: "ℹ️", duration: 6000 },
      );
      return;
    }
    if (item.sourceType === "MANUAL_PENDING") {
      // Cobros / gastos previstos manuales: abre modal para elegir fecha real
      // y cuenta destino antes de transicionar a PAGADO.
      setPayingManualId(item.sourceId);
      return;
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Todo lo comprometido a pagar: costos fijos del mes, materiales proyectados de obras,
        facturas a proveedores y otros compromisos (sueldos, comisiones).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Metric label="Costos fijos" value={fmtCurrency(totals.FIXED_COST, "UYU")} />
        <Metric label="Materiales de obras" value={fmtCurrency(totals.PROJECT_MATERIAL, "UYU")} />
        <Metric label="Deuda proveedores" value={fmtCurrency(totals.SUPPLIER_DEBT, "UYU")} />
        <Metric label="Otros compromisos" value={fmtCurrency(totals.COMMITTED_EXPENSE, "UYU")} />
        <Metric label="Pendientes manuales" value={fmtCurrency(totals.MANUAL_PENDING, "UYU")} />
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filtroOrigen}
            onChange={(e) => setFiltroOrigen(e.target.value as "" | PendingItemSourceType)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">Todos los tipos</option>
            <option value="FIXED_COST">Costos fijos</option>
            <option value="PROJECT_MATERIAL">Materiales de obras</option>
            <option value="SUPPLIER_DEBT">Deuda proveedores</option>
            <option value="COMMITTED_EXPENSE">Otros compromisos</option>
            <option value="MANUAL_PENDING">Pendientes manuales</option>
          </select>
          <select
            value={filtroProyecto}
            onChange={(e) => setFiltroProyecto(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">Todos los proyectos</option>
            {proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.clientName}
              </option>
            ))}
          </select>
          <select
            value={filtroProveedor}
            onChange={(e) => setFiltroProveedor(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowManual(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="w-4 h-4" /> Pendiente manual
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Cargando…</p>
      ) : !hasAny ? (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-12 text-center text-sm text-[var(--color-text-muted)]">
          {items.length === 0 && projectMaterialGroups.length === 0
            ? "Sin compromisos pendientes."
            : "Ningún pendiente coincide con los filtros."}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Sección de materiales proyectados: jerarquía proyecto → categoría → ítems */}
          {filteredProjectMaterialGroups.length > 0 && (
            <ProjectMaterialsGroupCard
              groups={filteredProjectMaterialGroups}
              expanded={expandedGroups.has("PROJECT_MATERIAL")}
              onToggle={() => toggleGroup("PROJECT_MATERIAL")}
              onInvalidate={invalidatePending}
            />
          )}
          {groups.map((g) => {
            const isOpen = expandedGroups.has(g.type);
            return (
              <div
                key={g.type}
                className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(g.type)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-bg-card-hover)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                    )}
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${SOURCE_TONE[g.type]}`}
                    >
                      {SOURCE_LABEL[g.type]}
                    </span>
                    <span className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                      {g.items.length} pendiente{g.items.length === 1 ? "" : "s"}
                    </span>
                    {g.overdueCount > 0 && (
                      <span className="text-[11px] text-red-400 font-medium">
                        · {g.overdueCount} vencido{g.overdueCount === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <span className="text-base font-semibold tabular-nums text-red-400">
                    -{fmtCurrency(g.totalMonto, "UYU")}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--color-border)]">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-bg-app)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium">Fecha esperada</th>
                          <th className="text-left px-4 py-2 font-medium">Descripción</th>
                          <th className="text-left px-4 py-2 font-medium">Categoría</th>
                          <th className="text-right px-4 py-2 font-medium">Monto</th>
                          <th className="text-right px-4 py-2 font-medium w-72">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {g.items.map((it) => (
                          <PendingRow
                            key={it.id}
                            item={it}
                            hideOrigen
                            onPay={() => handlePay(it)}
                            onEditCommitted={(id) => setEditingCommittedId(id)}
                            onDelete={() => deletePending(it)}
                            editingFechaId={editingFechaId}
                            editingFechaValue={editingFechaValue}
                            isFechaSaving={editFechaMut.isPending}
                            onStartFechaEdit={(id, current) => {
                              setEditingFechaId(id);
                              setEditingFechaValue(current.slice(0, 10));
                            }}
                            onCancelFechaEdit={() => setEditingFechaId(null)}
                            onChangeFechaValue={setEditingFechaValue}
                            onSaveFecha={() =>
                              editFechaMut.mutate({
                                sourceType: it.sourceType,
                                sourceId: it.sourceId,
                                fecha: editingFechaValue,
                              })
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data?.generatedAt && (
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
          Generado: {fmtDate(data.generatedAt)}. Esta lista es la fuente única de los compromisos:
          aparece igual en el Flujo de fondos.
        </p>
      )}

      {showManual && <ManualPendingModal onClose={() => setShowManual(false)} />}

      {editingCommittedId && (
        <EditCommittedModal
          movementId={editingCommittedId}
          onClose={() => setEditingCommittedId(null)}
          onSaved={() => {
            setEditingCommittedId(null);
            invalidatePending();
          }}
        />
      )}

      {payingManualId && (
        <PayManualPendingModal
          movementId={payingManualId}
          onClose={() => setPayingManualId(null)}
          onPaid={() => {
            setPayingManualId(null);
            invalidatePending();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-5 py-4">
      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-mono mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">{value}</p>
    </div>
  );
}

function PendingRow({
  item,
  onPay,
  onEditCommitted,
  onDelete,
  hideOrigen,
  editingFechaId,
  editingFechaValue,
  isFechaSaving,
  onStartFechaEdit,
  onCancelFechaEdit,
  onChangeFechaValue,
  onSaveFecha,
}: {
  item: PendingItem;
  onPay: () => void;
  onEditCommitted: (movementId: string) => void;
  onDelete: () => void;
  hideOrigen?: boolean;
  editingFechaId: string | null;
  editingFechaValue: string;
  isFechaSaving: boolean;
  onStartFechaEdit: (id: string, current: string) => void;
  onCancelFechaEdit: () => void;
  onChangeFechaValue: (v: string) => void;
  onSaveFecha: () => void;
}) {
  const navigate = useNavigate();
  const isFixedCost = item.sourceType === "FIXED_COST";
  const isEditingFecha = editingFechaId === item.id;
  return (
    <tr className={`hover:bg-[var(--color-bg-card-hover)] ${item.isOverdue ? "bg-red-500/5" : ""}`}>
      <td className="px-4 py-3 whitespace-nowrap">
        {isEditingFecha ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={editingFechaValue}
              onChange={(e) => onChangeFechaValue(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
              autoFocus
            />
            <button
              type="button"
              onClick={onSaveFecha}
              disabled={isFechaSaving || !editingFechaValue}
              className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={onCancelFechaEdit}
              className="text-xs text-[var(--color-text-muted)] hover:underline"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (isFixedCost) {
                toast(
                  "La fecha de un costo fijo se cambia desde Administración → Costos fijos.",
                  { icon: "ℹ️" },
                );
                return;
              }
              onStartFechaEdit(item.id, item.fecha);
            }}
            title={isFixedCost ? "Editable solo desde Administración" : "Click para cambiar la fecha"}
            className={`tabular-nums text-left ${
              item.isOverdue
                ? "text-red-400 font-semibold"
                : "text-[var(--color-text-secondary)]"
            } ${isFixedCost ? "cursor-not-allowed" : "hover:underline"}`}
          >
            {fmtDate(item.fecha)}
          </button>
        )}
        {item.isOverdue && !isEditingFecha && (
          <p className="text-[10px] text-red-400 mt-0.5">Vencido</p>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="text-[var(--color-text-primary)]">{item.descripcion}</p>
        {item.project && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {item.project.code} · {item.project.clientName}
          </p>
        )}
        {item.supplier && !item.project && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{item.supplier.nombre}</p>
        )}
      </td>
      {!hideOrigen && (
        <td className="px-4 py-3">
          <span
            className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${SOURCE_TONE[item.sourceType]}`}
          >
            {SOURCE_LABEL[item.sourceType]}
          </span>
        </td>
      )}
      <td className="px-4 py-3 text-[11px] text-[var(--color-text-secondary)]">{item.categoria}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span
          className={
            item.tipoMovimiento === "INGRESO"
              ? "text-green-400 font-semibold"
              : "text-red-400 font-semibold"
          }
        >
          {item.tipoMovimiento === "INGRESO" ? "+" : "-"}
          {fmtCurrency(item.monto, item.moneda)}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1">
          <button
            onClick={onPay}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-accent)] hover:text-gray-900 hover:border-[var(--color-accent)] transition-colors"
          >
            Marcar pagado
          </button>

          {/* Editar */}
          {item.sourceType === "COMMITTED_EXPENSE" || item.sourceType === "MANUAL_PENDING" ? (
            <button
              onClick={() => onEditCommitted(item.sourceId)}
              title={item.sourceType === "MANUAL_PENDING" ? "Editar previsto" : "Editar compromiso"}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)] hover:text-gray-900 hover:border-[var(--color-accent)] transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Editar
            </button>
          ) : (
            <button
              onClick={() => {
                if (item.sourceType === "FIXED_COST") navigate("/admin");
                else if (item.sourceType === "PROJECT_MATERIAL" && item.project) navigate(`/projects/${item.project.id}`);
                else if (item.sourceType === "SUPPLIER_DEBT" && item.supplier) navigate(`/finanzas/proveedores/${item.supplier.id}`);
              }}
              title={
                item.sourceType === "FIXED_COST"
                  ? "Editar en Administración → Costos fijos"
                  : item.sourceType === "PROJECT_MATERIAL"
                    ? "Editar desde Ingeniería del proyecto"
                    : "Editar en cuenta del proveedor"
              }
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Editar
            </button>
          )}

          {/* Eliminar — disponible para TODOS los pendientes. El backend hace la
              acción semántica según el tipo (skip mes para FIXED_COST, clear
              expectedDate para PROJECT_MATERIAL, anular factura para
              SUPPLIER_DEBT, soft-delete para COMMITTED_EXPENSE). En ningún caso
              se crea un movimiento PAGADO. */}
          <button
            onClick={onDelete}
            title={
              item.sourceType === "FIXED_COST"
                ? "Saltear este mes"
                : item.sourceType === "PROJECT_MATERIAL"
                  ? "Quitar fecha esperada"
                  : item.sourceType === "SUPPLIER_DEBT"
                    ? "Anular factura"
                    : "Eliminar compromiso"
            }
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Tarjeta de materiales proyectados (proyecto → categoría → ítems) ────

type MaterialMutations = {
  editFecha: (ids: string[], fecha: string, label: string) => void;
  deleteIds: (ids: string[], label: string) => void;
  isPending: boolean;
};

function ProjectMaterialsGroupCard({
  groups,
  expanded,
  onToggle,
  onInvalidate,
}: {
  groups: ProjectMaterialGroup[];
  expanded: boolean;
  onToggle: () => void;
  onInvalidate: () => void;
}) {
  const totalAll = groups.reduce((s, g) => s + g.totalAmount, 0);
  const overdueAll = groups.reduce((s, g) => s + g.overdueCount, 0);
  const monedas = new Set(groups.map((g) => g.moneda));
  const displayMoneda = monedas.size === 1 ? Array.from(monedas)[0] : "UYU";

  // Mutaciones bulk: usan el endpoint single-item ya existente y disparan N
  // requests en paralelo. Para grupos chicos (decenas de ítems) está bien;
  // si en algún momento hay cientos de ítems por proyecto se puede agregar
  // un endpoint bulk dedicado.
  const editFechaMut = useMutation({
    mutationFn: async ({ ids, fecha }: { ids: string[]; fecha: string }) => {
      await Promise.all(ids.map((id) => updateCashflowEventFecha("PROJECT_MATERIAL", id, fecha)));
      return ids.length;
    },
    onSuccess: (count, vars) => {
      toast.success(`${count} material${count === 1 ? "" : "es"} reagendado${count === 1 ? "" : "s"} para ${vars.fecha}`);
      onInvalidate();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo reagendar");
    },
  });

  const deleteMut = useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      await Promise.all(ids.map((id) => deletePendingItem("PROJECT_MATERIAL", id)));
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} material${count === 1 ? "" : "es"} sacado${count === 1 ? "" : "s"} de Pendientes`);
      onInvalidate();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo eliminar");
    },
  });

  const mutations: MaterialMutations = {
    editFecha: (ids, fecha, _label) => editFechaMut.mutate({ ids, fecha }),
    deleteIds: (ids, label) => {
      if (!confirm(`¿Sacar de Pendientes ${label}? Los materiales no se borran del proyecto, solo se les quita la fecha esperada y dejan de impactar al Flujo de fondos.`)) return;
      deleteMut.mutate({ ids });
    },
    isPending: editFechaMut.isPending || deleteMut.isPending,
  };

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-bg-card-hover)] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          )}
          <span
            className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${SOURCE_TONE.PROJECT_MATERIAL}`}
          >
            {SOURCE_LABEL.PROJECT_MATERIAL}
          </span>
          <span className="text-sm text-[var(--color-text-secondary)] tabular-nums">
            {groups.length} proyecto{groups.length === 1 ? "" : "s"}
          </span>
          {overdueAll > 0 && (
            <span className="text-[11px] text-red-400 font-medium">
              · {overdueAll} vencido{overdueAll === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <span className="text-base font-semibold tabular-nums text-red-400">
          -{fmtCurrency(totalAll, displayMoneda)}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--color-border)]">
          {groups.map((g) => (
            <ProjectMaterialsProjectRow
              key={`${g.projectId}-${g.moneda}`}
              group={g}
              mutations={mutations}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Acciones inline (reagendar fecha + eliminar) que se reusan en cada nivel
// (proyecto / categoría / ítem). Maneja su propio estado de edición.
function MaterialActions({
  ids,
  defaultFecha,
  label,
  size = "sm",
  mutations,
}: {
  ids: string[];
  defaultFecha: string;
  label: string;
  size?: "sm" | "xs";
  mutations: MaterialMutations;
}) {
  const [editingFecha, setEditingFecha] = useState(false);
  const [fechaValue, setFechaValue] = useState("");
  const iconSize = size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5";

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setFechaValue(defaultFecha.slice(0, 10));
    setEditingFecha(true);
  }
  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingFecha(false);
  }
  function saveFecha(e: React.MouseEvent) {
    e.stopPropagation();
    if (!fechaValue) return;
    mutations.editFecha(ids, fechaValue, label);
    setEditingFecha(false);
  }
  function deleteAll(e: React.MouseEvent) {
    e.stopPropagation();
    mutations.deleteIds(ids, label);
  }

  if (editingFecha) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="date"
          value={fechaValue}
          onChange={(e) => setFechaValue(e.target.value)}
          autoFocus
          className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-primary)]"
        />
        <button
          type="button"
          onClick={saveFecha}
          disabled={mutations.isPending || !fechaValue}
          className="text-[11px] text-[var(--color-accent)] hover:underline disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="text-[11px] text-[var(--color-text-muted)] hover:underline"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={startEdit}
        title="Reagendar todos a una fecha"
        className="p-1 rounded text-[var(--color-text-muted)] hover:bg-[var(--color-accent)]/15 hover:text-[var(--color-accent)] transition-colors"
      >
        <CalendarDays className={iconSize} />
      </button>
      <button
        type="button"
        onClick={deleteAll}
        title="Sacar de Pendientes (no borra del proyecto)"
        className="p-1 rounded text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 transition-colors"
      >
        <Trash2 className={iconSize} />
      </button>
    </div>
  );
}

function ProjectMaterialsProjectRow({
  group,
  mutations,
}: {
  group: ProjectMaterialGroup;
  mutations: MaterialMutations;
}) {
  const [open, setOpen] = useState(false);
  const allIds = group.categorias.flatMap((c) => c.items.map((it) => it.sourceId));
  return (
    <div className="border-t border-[var(--color-border)] first:border-t-0">
      <div
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 pl-9 hover:bg-[var(--color-bg-card-hover)] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
          )}
          <span className="text-sm text-[var(--color-text-primary)] font-medium truncate">
            {group.clientName}
          </span>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {group.projectCode}
          </span>
          {group.overdueCount > 0 && (
            <span className="text-[10px] text-red-400 font-medium">
              · {group.overdueCount} vencido{group.overdueCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm tabular-nums text-red-400 font-medium">
            -{fmtCurrency(group.totalAmount, group.moneda)}
          </span>
          <MaterialActions
            ids={allIds}
            defaultFecha={group.earliestDate}
            label={`los ${allIds.length} materiales de "${group.clientName}"`}
            mutations={mutations}
          />
        </div>
      </div>

      {open && (
        <div>
          {group.categorias.map((cat) => (
            <ProjectMaterialsCategoriaRow
              key={`${group.projectId}-${cat.categoria}`}
              categoria={cat}
              moneda={group.moneda}
              mutations={mutations}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectMaterialsCategoriaRow({
  categoria,
  moneda,
  mutations,
}: {
  categoria: ProjectMaterialGroup["categorias"][number];
  moneda: Moneda;
  mutations: MaterialMutations;
}) {
  const [open, setOpen] = useState(false);
  const ids = categoria.items.map((it) => it.sourceId);
  const earliestDate = categoria.items.reduce(
    (min, it) => (it.fecha < min ? it.fecha : min),
    categoria.items[0]?.fecha ?? todayLocalISO(),
  );
  return (
    <>
      <div
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2 pl-14 border-t border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] transition-colors text-xs cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDown className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
          )}
          <span className="text-[var(--color-text-secondary)] truncate">{categoria.categoria}</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {categoria.items.length} ítem{categoria.items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="tabular-nums text-red-400">
            -{fmtCurrency(categoria.totalAmount, moneda)}
          </span>
          <MaterialActions
            ids={ids}
            defaultFecha={earliestDate}
            label={`los ${ids.length} ítems de "${categoria.categoria}"`}
            size="xs"
            mutations={mutations}
          />
        </div>
      </div>

      {open && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-app)]/40">
          {categoria.items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-3 px-4 py-1.5 pl-20 text-[11px]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`tabular-nums ${
                    it.isOverdue ? "text-red-400" : "text-[var(--color-text-muted)]"
                  }`}
                >
                  {fmtDate(it.fecha)}
                </span>
                <span className="text-[var(--color-text-secondary)] truncate">
                  {it.materialNombre}
                </span>
                <span className="text-[var(--color-text-muted)] tabular-nums">
                  {it.quantity} × {fmtCurrency(it.unitPrice, it.moneda)}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="tabular-nums text-red-400">
                  -{fmtCurrency(it.monto, it.moneda)}
                </span>
                <MaterialActions
                  ids={[it.sourceId]}
                  defaultFecha={it.fecha}
                  label={`"${it.materialNombre}"`}
                  size="xs"
                  mutations={mutations}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Modal: editar compromiso manual (A_PAGAR sin proveedor) ──────────────

function EditCommittedModal({
  movementId,
  onClose,
  onSaved,
}: {
  movementId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: movement, isLoading } = useQuery({
    queryKey: ["movement-detail-edit", movementId],
    queryFn: () => getMovement(movementId),
  });

  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [dueDate, setDueDate] = useState<string>(todayLocalISO());
  const [projectId, setProjectId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  // Las cuotas del plan de pagos viven con prefijo "[PLAN] " en la descripción
  // (es el marcador que usa el backend para identificarlas). Stripeamos al
  // mostrar y lo re-agregamos al guardar para no romper la identificación.
  const PLAN_PREFIX = "[PLAN] ";
  const [isPlanCuota, setIsPlanCuota] = useState(false);
  const isManualPrevisto = movement?.status === "PREVISTO";

  // Hidratar el form una vez que llegan los datos.
  if (movement && !hydrated) {
    const rawDesc = movement.descripcion;
    const hadPlan = rawDesc.startsWith(PLAN_PREFIX);
    setIsPlanCuota(hadPlan);
    setDescripcion(hadPlan ? rawDesc.slice(PLAN_PREFIX.length) : rawDesc);
    setMonto(String(movement.monto));
    setMoneda(movement.moneda);
    setDueDate((movement.dueDate ?? movement.fecha).slice(0, 10));
    setProjectId(movement.projectId ?? "");
    setHydrated(true);
  }

  const patchMut = useMutation({
    mutationFn: () => {
      const trimmed = descripcion.trim();
      const finalDesc = isPlanCuota ? `${PLAN_PREFIX}${trimmed}` : trimmed;
      return patchMovement(movementId, {
        descripcion: finalDesc,
        monto: Number(monto),
        moneda,
        dueDate,
        ...(projectId ? { proyectoId: projectId } : {}),
      });
    },
    onSuccess: () => {
      toast.success(isManualPrevisto ? "Previsto actualizado" : "Compromiso actualizado");
      onSaved();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo actualizar");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) return toast.error("Falta la descripción");
    const n = Number(monto);
    if (!n || n <= 0) return toast.error("Monto inválido");
    patchMut.mutate();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isManualPrevisto ? (isPlanCuota ? "Editar cuota del plan" : "Editar previsto") : "Editar compromiso"}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Cargando…</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                Descripción
              </label>
              <input
                type="text"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                  Moneda
                </label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value as Moneda)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
                >
                  <option value="UYU">UYU</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                Fecha esperada de pago
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                Proyecto (opcional)
              </label>
              <ProjectPicker value={projectId} onChange={setProjectId} />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={patchMut.isPending}
                className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {patchMut.isPending ? "Guardando…" : "Guardar cambios"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

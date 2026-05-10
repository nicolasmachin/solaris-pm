import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ExternalLink, Pencil, Trash2, X } from "lucide-react";

import {
  deletePendingItem,
  getPendingItems,
  type PendingItem,
  type PendingItemSourceType,
} from "../api/pending.api";
import { fmtCurrency, fmtDate } from "../lib/finance";
import { getMovement, patchMovement, transitionMovement } from "../api/finance.api";
import { todayLocalISO } from "../utils/date";
import type { Moneda } from "../types/finance.types";
import { ProjectPicker } from "../components/finance/ProjectPicker";

const SOURCE_LABEL: Record<PendingItemSourceType, string> = {
  FIXED_COST: "Costo fijo",
  PROJECT_MATERIAL: "Material proyectado",
  SUPPLIER_DEBT: "Factura proveedor",
  COMMITTED_EXPENSE: "Compromiso manual",
};

const SOURCE_TONE: Record<PendingItemSourceType, string> = {
  FIXED_COST: "bg-zinc-500/15 text-zinc-300",
  PROJECT_MATERIAL: "bg-blue-500/15 text-blue-400",
  SUPPLIER_DEBT: "bg-yellow-500/15 text-yellow-400",
  COMMITTED_EXPENSE: "bg-purple-500/15 text-purple-400",
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
    const t = { FIXED_COST: 0, PROJECT_MATERIAL: 0, SUPPLIER_DEBT: 0, COMMITTED_EXPENSE: 0 };
    for (const it of items) t[it.sourceType] += it.monto;
    return t;
  }, [items]);

  const [editingCommittedId, setEditingCommittedId] = useState<string | null>(null);

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
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Todo lo comprometido a pagar: costos fijos del mes, materiales proyectados de obras,
        facturas a proveedores y otros compromisos (sueldos, comisiones).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Costos fijos" value={fmtCurrency(totals.FIXED_COST, "UYU")} />
        <Metric label="Materiales de obras" value={fmtCurrency(totals.PROJECT_MATERIAL, "UYU")} />
        <Metric label="Deuda proveedores" value={fmtCurrency(totals.SUPPLIER_DEBT, "UYU")} />
        <Metric label="Otros compromisos" value={fmtCurrency(totals.COMMITTED_EXPENSE, "UYU")} />
      </div>

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

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-12 text-center text-sm text-[var(--color-text-muted)]">
          {items.length === 0
            ? "Sin compromisos pendientes."
            : "Ningún pendiente coincide con los filtros."}
        </div>
      ) : (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-app)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Fecha esperada</th>
                <th className="text-left px-4 py-2.5 font-medium">Descripción</th>
                <th className="text-left px-4 py-2.5 font-medium">Origen</th>
                <th className="text-left px-4 py-2.5 font-medium">Categoría</th>
                <th className="text-right px-4 py-2.5 font-medium">Monto</th>
                <th className="text-right px-4 py-2.5 font-medium w-72">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map((it) => (
                <PendingRow
                  key={it.id}
                  item={it}
                  onPay={() => handlePay(it)}
                  onEditCommitted={(id) => setEditingCommittedId(id)}
                  onDelete={() => deletePending(it)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.generatedAt && (
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
          Generado: {fmtDate(data.generatedAt)}. Esta lista es la fuente única de los compromisos:
          aparece igual en el Flujo de fondos.
        </p>
      )}

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
}: {
  item: PendingItem;
  onPay: () => void;
  onEditCommitted: (movementId: string) => void;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  return (
    <tr className={`hover:bg-[var(--color-bg-card-hover)] ${item.isOverdue ? "bg-red-500/5" : ""}`}>
      <td className="px-4 py-3 whitespace-nowrap">
        <p
          className={`tabular-nums ${
            item.isOverdue ? "text-red-400 font-semibold" : "text-[var(--color-text-secondary)]"
          }`}
        >
          {fmtDate(item.fecha)}
        </p>
        {item.isOverdue && <p className="text-[10px] text-red-400 mt-0.5">Vencido</p>}
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
      <td className="px-4 py-3">
        <span
          className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${SOURCE_TONE[item.sourceType]}`}
        >
          {SOURCE_LABEL[item.sourceType]}
        </span>
      </td>
      <td className="px-4 py-3 text-[11px] text-[var(--color-text-secondary)]">{item.categoria}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="text-red-400 font-semibold">
          -{fmtCurrency(item.monto, item.moneda)}
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
          {item.sourceType === "COMMITTED_EXPENSE" ? (
            <button
              onClick={() => onEditCommitted(item.sourceId)}
              title="Editar compromiso"
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

  // Hidratar el form una vez que llegan los datos.
  if (movement && !hydrated) {
    setDescripcion(movement.descripcion);
    setMonto(String(movement.monto));
    setMoneda(movement.moneda);
    setDueDate((movement.dueDate ?? movement.fecha).slice(0, 10));
    setProjectId(movement.projectId ?? "");
    setHydrated(true);
  }

  const patchMut = useMutation({
    mutationFn: () =>
      patchMovement(movementId, {
        descripcion: descripcion.trim(),
        monto: Number(monto),
        moneda,
        dueDate,
        ...(projectId ? { proyectoId: projectId } : {}),
      }),
    onSuccess: () => {
      toast.success("Compromiso actualizado");
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
            Editar compromiso
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

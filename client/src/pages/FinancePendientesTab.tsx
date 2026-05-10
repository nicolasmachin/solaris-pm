import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ChevronDown, MoreHorizontal } from "lucide-react";

import { getPendingItems, type PendingItem, type PendingItemSourceType } from "../api/pending.api";
import { fmtCurrency, fmtDate } from "../lib/finance";
import { transitionMovement } from "../api/finance.api";

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

  const transitionMut = useMutation({
    mutationFn: (movementId: string) =>
      transitionMovement(movementId, { newStatus: "PAGADO" }),
    onSuccess: () => {
      toast.success("Marcado como pagado");
      qc.invalidateQueries({ queryKey: ["finance-pending"] });
      qc.invalidateQueries({ queryKey: ["finance-movements-tab"] });
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo marcar como pagado");
    },
  });

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
    if (item.sourceType === "FIXED_COST") {
      navigate(`/finanzas/movimientos?new=1`);
      toast(
        `Cargá el pago como movimiento PAGADO con categoría "Costo fijo" y elegí "${item.fixedCost?.nombre}" en el selector.`,
        { icon: "ℹ️", duration: 6000 },
      );
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
                <th className="text-right px-4 py-2.5 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.map((it) => (
                <PendingRow key={it.id} item={it} onPay={() => handlePay(it)} />
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

function PendingRow({ item, onPay }: { item: PendingItem; onPay: () => void }) {
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
      <td className="px-4 py-3 text-right">
        <button
          onClick={onPay}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-accent)] hover:text-gray-900 hover:border-[var(--color-accent)] transition-colors"
        >
          Marcar pagado
        </button>
      </td>
    </tr>
  );
}

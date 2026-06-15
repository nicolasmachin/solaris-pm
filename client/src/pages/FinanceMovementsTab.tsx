import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowRightLeft, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import {
  createMovement,
  createTransfer,
  deleteMovement,
  getMovements,
  getSuppliers,
  isMovementRow,
  isPaymentRow,
  patchMovement,
} from "../api/finance.api";
import type { FinanceListItem, FinanceMovement } from "../types/finance.types";
import { ResponsiveTable, type Column } from "../components/ui/ResponsiveTable";
import { ProjectPicker } from "../components/finance/ProjectPicker";
import { getAccounts } from "../api/accounts.api";
import { getProjects } from "../api/projects.api";
import { listPendingFixedCosts, type FixedCostPendingDto } from "../api/fixedCosts.api";
import {
  CATEGORIA_LABEL,
  CATEGORIAS_POR_TIPO,
  type CategoriaPrincipal,
  type Moneda,
  type TipoMovimiento,
} from "../types/finance.types";
import { fmtCurrency, fmtDate, currentMonthYear, MONTH_NAMES } from "../lib/finance";
import { todayLocalISO } from "../utils/date";

// ─── Helpers UI ─────────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-5 py-4">
      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-mono mb-1">
        {label}
      </p>
      <p className="text-xl font-bold text-[var(--color-text-primary)] tabular-nums">{value}</p>
    </div>
  );
}

const CATEGORIA_BADGE: Record<CategoriaPrincipal, string> = {
  COBRO_CLIENTE: "bg-green-500/15 text-green-400",
  PROYECTO_ENTRADA: "bg-green-500/15 text-green-400",
  PAGO_PROVEEDOR: "bg-yellow-500/15 text-yellow-400",
  FIJO: "bg-zinc-500/15 text-zinc-300",
  VARIABLE: "bg-zinc-500/15 text-zinc-300",
  PROYECTO_SALIDA: "bg-red-500/15 text-red-400",
  COMPRA_STOCK: "bg-blue-500/15 text-blue-400",
  CONSUMO_STOCK: "bg-blue-500/15 text-blue-400",
  TRANSFERENCIA: "bg-indigo-500/15 text-indigo-400",
  OTRO: "bg-zinc-500/15 text-zinc-300",
};

function CategoryBadge({ categoria }: { categoria: CategoriaPrincipal }) {
  const tone = CATEGORIA_BADGE[categoria] ?? "bg-zinc-500/15 text-zinc-300";
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded ${tone}`}>
      {CATEGORIA_LABEL[categoria]}
    </span>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────

type Rango = "ANUAL" | "MENSUAL";

type NewMovementPrefill = {
  fixedCostId?: string;
  descripcion?: string;
  monto?: string;
  moneda?: Moneda;
};

function readPrefill(params: URLSearchParams): NewMovementPrefill | null {
  if (params.get("new") !== "1") return null;
  const out: NewMovementPrefill = {};
  const fc = params.get("fixedCostId");
  if (fc) out.fixedCostId = fc;
  const d = params.get("descripcion");
  if (d) out.descripcion = d;
  const m = params.get("monto");
  if (m) out.monto = m;
  const mn = params.get("moneda");
  if (mn === "USD" || mn === "UYU") out.moneda = mn;
  return Object.keys(out).length > 0 ? out : null;
}

export function FinanceMovementsTab() {
  const { mes: defaultMes, anio: defaultAnio } = currentMonthYear();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rango, setRango] = useState<Rango>("ANUAL");
  const [mes, setMes] = useState<number>(defaultMes);
  const [anio, setAnio] = useState<number>(defaultAnio);
  const [tipo, setTipo] = useState<"" | TipoMovimiento>("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");
  const [showTransfer, setShowTransfer] = useState(false);
  const [prefill, setPrefill] = useState<NewMovementPrefill | null>(() => readPrefill(searchParams));

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowForm(true);
      setPrefill(readPrefill(searchParams));
      // Limpiamos los params para no reabrir el modal en navegación back.
      const next = new URLSearchParams(searchParams);
      ["new", "fixedCostId", "descripcion", "monto", "moneda"].forEach((k) => next.delete(k));
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["finance-movements-tab", rango, mes, anio, tipo],
    queryFn: () =>
      getMovements({
        ...(rango === "MENSUAL" ? { mes } : {}),
        anio,
        ...(tipo ? { tipo } : {}),
        // Sin rowType: incluimos Movements ejecutados + Payments
        // (los pagos a proveedores son egresos reales y deben verse acá).
        limit: 5000,
      }),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active-tab"],
    queryFn: () => getAccounts({ activa: "all" }),
  });
  const accountNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts) m.set(a.id, a.nombre);
    return m;
  }, [accounts]);

  const allItems = useMemo(() => data?.data ?? [], [data]);

  // Búsqueda client-side: matchea por descripción, proveedor, cliente del
  // proyecto, código del proyecto, cuenta o monto.
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((it) => {
      const desc = it.descripcion?.toLowerCase() ?? "";
      const montoStr = String(Math.abs(it.monto));
      if (desc.includes(q)) return true;
      if (montoStr.includes(q)) return true;
      if (isMovementRow(it)) {
        if (it.project?.clientName.toLowerCase().includes(q)) return true;
        if (it.project?.code.toLowerCase().includes(q)) return true;
        if (it.supplier?.nombre.toLowerCase().includes(q)) return true;
        if (it.accountId && accountNameById.get(it.accountId)?.toLowerCase().includes(q)) return true;
      }
      if (isPaymentRow(it)) {
        if (it.supplier?.nombre.toLowerCase().includes(q)) return true;
        if (it.account?.nombre.toLowerCase().includes(q)) return true;
        if (it.referencia?.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [allItems, search, accountNameById]);

  const qcRoot = useQueryClient();
  const [editingMovement, setEditingMovement] = useState<FinanceMovement | null>(null);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteMovement(id),
    onSuccess: () => {
      toast.success("Movimiento eliminado");
      qcRoot.invalidateQueries({ queryKey: ["finance-movements-tab"] });
      qcRoot.invalidateQueries({ queryKey: ["finance-movements"] });
      qcRoot.invalidateQueries({ queryKey: ["finance-pending"] });
      qcRoot.invalidateQueries({ queryKey: ["finance-cashflow"] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo eliminar");
    },
  });
  const saldoUSD = data?.saldoActualUSD ?? 0;
  const saldoUYU = data?.saldoActualUYU ?? 0;

  // Columnas declarativas para ResponsiveTable. El render ramifica por los type
  // guards (pago = read-only; movimiento = con acciones). Desktop queda idéntico
  // al markup anterior; en móvil cada fila es una card (title/highlight/label).
  const columns: Column<FinanceListItem>[] = [
    {
      key: "fecha",
      label: "Fecha",
      className: "whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums",
      render: (it) => fmtDate(it.fecha),
    },
    {
      key: "descripcion",
      label: "Descripción",
      cardRole: "title",
      render: (it) => {
        if (isPaymentRow(it)) {
          const desc = it.descripcion || `Pago a ${it.supplier?.nombre ?? "proveedor"}`;
          return (
            <>
              <p className="text-[var(--color-text-primary)]">{desc}</p>
              {it.supplier && (
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{it.supplier.nombre}</p>
              )}
            </>
          );
        }
        return (
          <>
            <p className="text-[var(--color-text-primary)]">{it.descripcion}</p>
            {it.project && (
              <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{it.project.clientName}</p>
            )}
          </>
        );
      },
    },
    {
      key: "categoria",
      label: "Categoría",
      render: (it) =>
        isPaymentRow(it) ? (
          <CategoryBadge categoria="PAGO_PROVEEDOR" />
        ) : (
          <CategoryBadge categoria={it.categoriaPrincipal} />
        ),
    },
    {
      key: "cuenta",
      label: "Cuenta",
      className: "text-[var(--color-text-secondary)]",
      render: (it) => {
        if (isPaymentRow(it)) {
          return it.account?.nombre ?? (it.accountId && accountNameById.get(it.accountId)) ?? "—";
        }
        return (it.accountId && accountNameById.get(it.accountId)) ?? "—";
      },
    },
    {
      key: "monto",
      label: "Monto",
      align: "right",
      cardRole: "highlight",
      className: "tabular-nums",
      render: (it) => {
        if (isPaymentRow(it)) {
          return (
            <span className="font-semibold text-red-400">
              {it.monto < 0 ? "+" : "-"}
              {fmtCurrency(Math.abs(it.monto), it.moneda)}
            </span>
          );
        }
        return (
          <span className={it.tipoMovimiento === "INGRESO" ? "font-semibold text-green-400" : "font-semibold text-red-400"}>
            {it.tipoMovimiento === "INGRESO" ? "+" : "-"}
            {fmtCurrency(it.monto, it.moneda)}
          </span>
        );
      },
    },
    {
      key: "acciones",
      label: "Acciones",
      align: "right",
      cardRole: "hidden",
      className: "w-20 whitespace-nowrap",
      render: (it) => {
        if (isPaymentRow(it)) {
          return (
            <span className="text-[11px] text-[var(--color-text-muted)]" title="Los pagos a proveedores se editan desde la cuenta del proveedor.">
              Editar en Proveedores
            </span>
          );
        }
        return (
          <div className="inline-flex items-center gap-1">
            <button
              onClick={() => setEditingMovement(it)}
              title="Editar movimiento"
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-gray-900"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
            <button
              onClick={() => {
                if (confirm(`¿Eliminar movimiento "${it.descripcion}" por ${fmtCurrency(it.monto, it.moneda)}?`)) {
                  deleteMut.mutate(it.id);
                }
              }}
              title="Eliminar movimiento"
              disabled={deleteMut.isPending}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard label="Saldo actual UYU" value={fmtCurrency(saldoUYU, "UYU")} />
        <MetricCard label="Saldo actual USD" value={fmtCurrency(saldoUSD, "USD")} />
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
            <input
              type="text"
              placeholder="Buscar por descripción, proveedor, cliente, cuenta o monto…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden text-sm">
            {(["ANUAL", "MENSUAL"] as Rango[]).map((r) => (
              <button
                key={r}
                onClick={() => setRango(r)}
                className={`px-3 py-2 transition-colors ${
                  rango === r
                    ? "bg-[var(--color-accent)] text-gray-900 font-semibold"
                    : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
                }`}
              >
                {r === "ANUAL" ? "Año en curso" : "Por mes"}
              </button>
            ))}
          </div>
          {rango === "MENSUAL" && (
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {MONTH_NAMES.map((label, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {[defaultAnio - 2, defaultAnio - 1, defaultAnio, defaultAnio + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "" | TipoMovimiento)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            <option value="">Todos los tipos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="GASTO">Gastos</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTransfer(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" /> Transferencia
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="w-4 h-4" /> Nuevo movimiento
          </button>
        </div>
      </div>

      {!isLoading && allItems.length > 0 && (
        <p className="text-[11px] text-[var(--color-text-muted)] font-mono">
          {search.trim()
            ? `${items.length} de ${allItems.length} movimiento${allItems.length === 1 ? "" : "s"} (filtrado por "${search.trim()}")`
            : `${allItems.length} movimiento${allItems.length === 1 ? "" : "s"} en ${rango === "ANUAL" ? anio : `${MONTH_NAMES[mes - 1]} ${anio}`}`}
        </p>
      )}

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-[var(--color-text-muted)]">Cargando…</span>
          </div>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={items}
            rowKey={(it) => (isPaymentRow(it) ? `p-${it.id}` : `m-${it.id}`)}
            onRowClick={(it) => {
              if (isMovementRow(it)) setEditingMovement(it);
            }}
            isRowClickable={(it) => isMovementRow(it)}
            emptyMessage="Sin movimientos para los filtros seleccionados."
          />
        )}
      </div>

      {showForm && (
        <NewMovementModal
          prefill={prefill}
          onClose={() => {
            setShowForm(false);
            setPrefill(null);
          }}
        />
      )}
      {editingMovement && (
        <EditMovementModal
          movement={editingMovement}
          onClose={() => setEditingMovement(null)}
        />
      )}
      {showTransfer && <NewTransferModal onClose={() => setShowTransfer(false)} />}
    </div>
  );
}

// ─── Modal: Transferencia entre cuentas ─────────────────────────────────────

function NewTransferModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: () => getAccounts({ activa: "true" }),
  });

  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState<string>(todayLocalISO());
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);

  const fromAcct = accounts.find((a) => a.id === fromId);
  const toAcct = accounts.find((a) => a.id === toId);
  const monedaEffective = fromAcct?.moneda;
  // Las cuentas destino válidas: distintas de origen + misma moneda.
  const destOptions = accounts.filter(
    (a) => a.id !== fromId && (!monedaEffective || a.moneda === monedaEffective),
  );

  const createMut = useMutation({
    mutationFn: () =>
      createTransfer({
        fecha,
        fromAccountId: fromId,
        toAccountId: toId,
        monto: Number(monto),
        moneda: monedaEffective as Moneda,
        ...(descripcion.trim() ? { descripcion: descripcion.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Transferencia registrada");
      qc.invalidateQueries({ queryKey: ["finance-movements-tab"] });
      qc.invalidateQueries({ queryKey: ["finance-movements"] });
      qc.invalidateQueries({ queryKey: ["finance-pending"] });
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
      qc.invalidateQueries({ queryKey: ["accounts-summary"] });
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo registrar la transferencia");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromId) return toast.error("Elegí la cuenta origen");
    if (!toId) return toast.error("Elegí la cuenta destino");
    if (fromId === toId) return toast.error("Origen y destino deben ser distintas");
    const n = Number(monto);
    if (!n || n <= 0) return toast.error("Monto inválido");
    if (fromAcct && toAcct && fromAcct.moneda !== toAcct.moneda) {
      return toast.error("Las dos cuentas deben tener la misma moneda");
    }
    setSaving(true);
    createMut.mutate(undefined, { onSettled: () => setSaving(false) });
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
            Transferencia entre cuentas
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Cuenta origen">
            <select
              value={fromId}
              onChange={(e) => {
                setFromId(e.target.value);
                // Si la cuenta destino dejó de ser válida (moneda distinta),
                // la reseteamos.
                const newFrom = accounts.find((a) => a.id === e.target.value);
                const stillValid =
                  toId &&
                  toId !== e.target.value &&
                  accounts.find((a) => a.id === toId)?.moneda === newFrom?.moneda;
                if (!stillValid) setToId("");
              }}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Elegí la cuenta…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.moneda})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cuenta destino">
            <select
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              disabled={!fromId}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] disabled:opacity-60"
            >
              <option value="">{fromId ? "Elegí la cuenta…" : "Primero elegí la origen"}</option>
              {destOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.moneda})
                </option>
              ))}
            </select>
            {fromAcct && (
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Solo se muestran cuentas en {fromAcct.moneda} (misma moneda que la origen).
              </p>
            )}
          </Field>
          <Field label="Monto">
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 pr-14 text-sm text-[var(--color-text-primary)]"
              />
              {monedaEffective && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)] font-mono">
                  {monedaEffective}
                </span>
              )}
            </div>
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </Field>
          <Field label="Descripción (opcional)">
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej: pago a Banco República"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </Field>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Se van a crear 2 movimientos PAGADO ligados: un egreso en la cuenta origen y un
            ingreso en la destino. El saldo total no cambia.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {saving ? "Registrando…" : "Registrar transferencia"}
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
      </div>
    </div>
  );
}

// ─── Modal: Editar movimiento ───────────────────────────────────────────────

function EditMovementModal({
  movement,
  onClose,
}: {
  movement: FinanceMovement;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [descripcion, setDescripcion] = useState(movement.descripcion);
  const [monto, setMonto] = useState(String(movement.monto));
  const [moneda, setMoneda] = useState<Moneda>(movement.moneda);
  const [fecha, setFecha] = useState<string>(movement.fecha.slice(0, 10));
  const [accountId, setAccountId] = useState<string>(movement.accountId ?? "");
  const [categoria, setCategoria] = useState<CategoriaPrincipal>(movement.categoriaPrincipal);
  const [supplierId, setSupplierId] = useState<string>(movement.supplierId ?? "");
  const [projectId, setProjectId] = useState<string>(movement.projectId ?? "");
  const [saving, setSaving] = useState(false);

  const { data: accounts = [] } = useQuery({ queryKey: ["accounts-active"], queryFn: () => getAccounts({ activa: "true" }) });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers-active"], queryFn: () => getSuppliers({ activo: "true" }) });
  const { data: projects = [] } = useQuery({ queryKey: ["projects-list-finance"], queryFn: () => getProjects() });

  const categoriasDisponibles = CATEGORIAS_POR_TIPO[movement.tipoMovimiento];

  const patchMut = useMutation({
    mutationFn: () =>
      patchMovement(movement.id, {
        descripcion: descripcion.trim(),
        monto: Number(monto),
        moneda,
        fecha,
        ...(accountId ? { accountId } : {}),
        categoriaPrincipal: categoria,
        ...(movement.tipoMovimiento === "GASTO" ? { proveedorId: supplierId || undefined } : {}),
        ...(projectId ? { proyectoId: projectId } : {}),
      }),
    onSuccess: () => {
      toast.success("Movimiento actualizado");
      qc.invalidateQueries({ queryKey: ["finance-movements-tab"] });
      qc.invalidateQueries({ queryKey: ["finance-movements"] });
      qc.invalidateQueries({ queryKey: ["finance-pending"] });
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
      onClose();
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
    setSaving(true);
    patchMut.mutate(undefined, { onSettled: () => setSaving(false) });
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
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Editar movimiento</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Descripción">
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </Field>
          <Field label="Categoría">
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaPrincipal)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              {categoriasDisponibles.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto">
              <input
                type="number"
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </Field>
            <Field label="Moneda">
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as Moneda)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>
          <Field label="Cuenta">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Sin cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.moneda})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </Field>
          {movement.tipoMovimiento === "GASTO" && (
            <Field label="Proveedor (opcional)">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Proyecto (opcional)">
            <ProjectPicker value={projectId} onChange={setProjectId} />
          </Field>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
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
      </div>
    </div>
  );
}

// ─── Modal: Nuevo movimiento ────────────────────────────────────────────────

function NewMovementModal({
  prefill,
  onClose,
}: {
  prefill?: NewMovementPrefill | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  // Si vinimos con fixedCostId, arrancamos en categoría FIJO.
  const initialCategoria: CategoriaPrincipal = prefill?.fixedCostId ? "FIJO" : "VARIABLE";

  const [tipo, setTipo] = useState<TipoMovimiento>("GASTO");
  const [categoria, setCategoria] = useState<CategoriaPrincipal>(initialCategoria);
  const [descripcion, setDescripcion] = useState(prefill?.descripcion ?? "");
  const [monto, setMonto] = useState(prefill?.monto ?? "");
  const [moneda, setMoneda] = useState<Moneda>(prefill?.moneda ?? "USD");
  const [accountId, setAccountId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(todayLocalISO());
  const [supplierId, setSupplierId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [fixedCostId, setFixedCostId] = useState<string>(prefill?.fixedCostId ?? "");
  const [saving, setSaving] = useState(false);

  // Para el selector de costos fijos: usamos el mes/anio de la fecha del form.
  const fechaParts = fecha.split("-");
  const formAnio = Number(fechaParts[0] ?? new Date().getFullYear());
  const formMes = Number(fechaParts[1] ?? new Date().getMonth() + 1);
  const { data: pendingFixedCosts = [] } = useQuery({
    queryKey: ["fixed-costs-pending", formMes, formAnio],
    queryFn: () => listPendingFixedCosts(formMes, formAnio),
    enabled: tipo === "GASTO" && categoria === "FIJO",
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: () => getAccounts({ activa: "true" }),
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-active"],
    queryFn: () => getSuppliers({ activo: "true" }),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list-finance"],
    queryFn: () => getProjects(),
  });

  // Si cambia tipo, ajustar la categoría a una válida.
  useEffect(() => {
    const opciones = CATEGORIAS_POR_TIPO[tipo];
    if (!opciones.includes(categoria)) {
      setCategoria(opciones[0] ?? "OTRO");
    }
  }, [tipo, categoria]);

  // Si la categoría deja de ser FIJO, limpiar la selección de costo fijo.
  useEffect(() => {
    if (categoria !== "FIJO") setFixedCostId("");
  }, [categoria]);

  function applyFixedCost(fc: FixedCostPendingDto | null) {
    if (!fc) {
      setFixedCostId("");
      return;
    }
    setFixedCostId(fc.id);
    if (!descripcion.trim()) setDescripcion(fc.nombre);
    setMoneda(fc.moneda);
    // No autocompletamos el monto: el usuario carga el real.
  }

  // Auto-set moneda según la cuenta seleccionada.
  useEffect(() => {
    if (!accountId) return;
    const acct = accounts.find((a) => a.id === accountId);
    if (acct && acct.moneda !== moneda) setMoneda(acct.moneda);
  }, [accountId, accounts, moneda]);

  const createMut = useMutation({
    mutationFn: () =>
      createMovement({
        fecha,
        tipoMovimiento: tipo,
        categoriaPrincipal: categoria,
        descripcion: descripcion.trim(),
        monto: Number(monto),
        moneda,
        accountId,
        status: "PAGADO",
        pagado: true,
        cobrado: tipo === "INGRESO",
        impactaFlujo: true,
        estadoAprobacion: "APROBADO",
        ...(tipo === "GASTO" && supplierId ? { proveedorId: supplierId } : {}),
        ...(projectId ? { proyectoId: projectId } : {}),
        ...(fixedCostId ? { fixedCostId } : {}),
      }),
    onSuccess: () => {
      toast.success("Movimiento creado");
      qc.invalidateQueries({ queryKey: ["finance-movements-tab"] });
      qc.invalidateQueries({ queryKey: ["finance-movements"] });
      qc.invalidateQueries({ queryKey: ["finance-pending"] });
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
      qc.invalidateQueries({ queryKey: ["accounts-summary"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
      qc.invalidateQueries({ queryKey: ["fixed-costs-pending"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo crear el movimiento";
      toast.error(msg);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) return toast.error("Falta la descripción");
    const n = Number(monto);
    if (!n || n <= 0) return toast.error("Monto inválido");
    if (!accountId) return toast.error("Elegí una cuenta");
    setSaving(true);
    createMut.mutate(undefined, { onSettled: () => setSaving(false) });
  }

  const categoriasDisponibles = CATEGORIAS_POR_TIPO[tipo];

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
            Nuevo movimiento
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Tipo">
            <div className="flex gap-2">
              {(["INGRESO", "GASTO"] as TipoMovimiento[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border ${
                    tipo === t
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {t === "INGRESO" ? "Ingreso" : "Gasto"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Categoría">
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaPrincipal)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              {categoriasDisponibles.map((c) => (
                <option key={c} value={c}>
                  {CATEGORIA_LABEL[c]}
                </option>
              ))}
            </select>
          </Field>

          {tipo === "GASTO" && categoria === "FIJO" && (
            <Field label="Costo fijo predefinido">
              {pendingFixedCosts.length > 0 ? (
                <>
                  <select
                    value={fixedCostId}
                    onChange={(e) => {
                      const fc = pendingFixedCosts.find((p) => p.id === e.target.value) ?? null;
                      applyFixedCost(fc);
                    }}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    <option value="">Sin costo fijo asociado</option>
                    {pendingFixedCosts.map((fc) => (
                      <option key={fc.id} value={fc.id}>
                        {fc.nombre} (último pago: {fmtCurrency(fc.ultimoMontoPagado, fc.moneda)})
                      </option>
                    ))}
                    {fixedCostId && !pendingFixedCosts.some((p) => p.id === fixedCostId) && (
                      <option value={fixedCostId}>{descripcion || "(costo seleccionado)"}</option>
                    )}
                  </select>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    Solo se muestran los que faltan pagar este mes. Al elegir uno se completa el
                    nombre y la moneda; el monto lo cargás vos.
                  </p>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
                  No hay costos fijos pendientes este mes. Configurálos desde{" "}
                  <span className="font-mono">Administración → Costos fijos</span>, o seguí sin
                  asociar.
                </div>
              )}
            </Field>
          )}

          <Field label="Descripción">
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto">
              <input
                type="number"
                step="0.01"
                min="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              />
            </Field>
            <Field label="Moneda">
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as Moneda)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>

          <Field label="Cuenta">
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option value="">Elegí una cuenta…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.moneda})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fecha">
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </Field>

          {tipo === "GASTO" && (
            <Field label="Proveedor (opcional)">
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="">Sin proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Proyecto (opcional)">
            <ProjectPicker value={projectId} onChange={setProjectId} />
          </Field>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar"}
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
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
        {label}
      </span>
      {children}
    </label>
  );
}

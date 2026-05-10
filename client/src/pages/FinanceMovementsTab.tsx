import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import {
  createMovement,
  deleteMovement,
  getMovements,
  getSuppliers,
  isMovementRow,
  isPaymentRow,
  patchMovement,
} from "../api/finance.api";
import type { FinanceMovement } from "../types/finance.types";
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

export function FinanceMovementsTab() {
  const { mes: defaultMes, anio: defaultAnio } = currentMonthYear();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mes, setMes] = useState<number>(defaultMes);
  const [anio, setAnio] = useState<number>(defaultAnio);
  const [tipo, setTipo] = useState<"" | TipoMovimiento>("");
  const [showForm, setShowForm] = useState(searchParams.get("new") === "1");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowForm(true);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["finance-movements-tab", mes, anio, tipo],
    queryFn: () =>
      getMovements({
        mes,
        anio,
        ...(tipo ? { tipo } : {}),
        // Sin rowType: incluimos Movements ejecutados + Payments
        // (los pagos a proveedores son egresos reales y deben verse acá).
        limit: 100,
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

  const items = useMemo(() => data?.data ?? [], [data]);

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard label="Saldo actual UYU" value={fmtCurrency(saldoUYU, "UYU")} />
        <MetricCard label="Saldo actual USD" value={fmtCurrency(saldoUSD, "USD")} />
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
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
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            {[defaultAnio - 1, defaultAnio, defaultAnio + 1].map((y) => (
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
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="w-4 h-4" /> Nuevo movimiento
        </button>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-[var(--color-text-muted)]">Cargando…</span>
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
            Sin movimientos para los filtros seleccionados.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-app)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Fecha</th>
                <th className="text-left px-4 py-2.5 font-medium">Descripción</th>
                <th className="text-left px-4 py-2.5 font-medium">Categoría</th>
                <th className="text-left px-4 py-2.5 font-medium">Cuenta</th>
                <th className="text-right px-4 py-2.5 font-medium">Monto</th>
                <th className="text-right px-4 py-2.5 font-medium w-20">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {items.map((it) => {
                if (isPaymentRow(it)) {
                  // Pago a proveedor — siempre es egreso.
                  const accountName = it.account?.nombre ?? (it.accountId && accountNameById.get(it.accountId)) ?? "—";
                  const desc = it.descripcion || `Pago a ${it.supplier?.nombre ?? "proveedor"}`;
                  return (
                    <tr key={`p-${it.id}`} className="hover:bg-[var(--color-bg-card-hover)]">
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                        {fmtDate(it.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[var(--color-text-primary)]">{desc}</p>
                        {it.supplier && (
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                            {it.supplier.nombre}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge categoria="PAGO_PROVEEDOR" />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{accountName}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="text-red-400 font-semibold">
                          {it.monto < 0 ? "+" : "-"}
                          {fmtCurrency(Math.abs(it.monto), it.moneda)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] text-[var(--color-text-muted)]">
                        <span title="Los pagos a proveedores se editan desde la cuenta del proveedor.">—</span>
                      </td>
                    </tr>
                  );
                }
                if (isMovementRow(it)) {
                  return (
                    <tr key={`m-${it.id}`} className="hover:bg-[var(--color-bg-card-hover)]">
                      <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                        {fmtDate(it.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[var(--color-text-primary)]">{it.descripcion}</p>
                        {it.project && (
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                            {it.project.clientName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge categoria={it.categoriaPrincipal} />
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {(it.accountId && accountNameById.get(it.accountId)) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span
                          className={
                            it.tipoMovimiento === "INGRESO"
                              ? "text-green-400 font-semibold"
                              : "text-red-400 font-semibold"
                          }
                        >
                          {it.tipoMovimiento === "INGRESO" ? "+" : "-"}
                          {fmtCurrency(it.monto, it.moneda)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditingMovement(it)}
                          title="Editar"
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-accent)] p-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `¿Eliminar movimiento "${it.descripcion}" por ${fmtCurrency(it.monto, it.moneda)}?`,
                              )
                            ) {
                              deleteMut.mutate(it.id);
                            }
                          }}
                          title="Eliminar"
                          disabled={deleteMut.isPending}
                          className="text-[var(--color-text-muted)] hover:text-red-400 p-1 ml-1 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                }
                return null;
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <NewMovementModal onClose={() => setShowForm(false)} />}
      {editingMovement && (
        <EditMovementModal
          movement={editingMovement}
          onClose={() => setEditingMovement(null)}
        />
      )}
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
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.clientName}
                </option>
              ))}
            </select>
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

function NewMovementModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<TipoMovimiento>("GASTO");
  const [categoria, setCategoria] = useState<CategoriaPrincipal>("VARIABLE");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("UYU");
  const [accountId, setAccountId] = useState<string>("");
  const [fecha, setFecha] = useState<string>(todayLocalISO());
  const [supplierId, setSupplierId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [fixedCostId, setFixedCostId] = useState<string>("");
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
      qc.invalidateQueries({ queryKey: ["accounts-summary"] });
      qc.invalidateQueries({ queryKey: ["finance-dashboard"] });
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

          {tipo === "GASTO" && categoria === "FIJO" && pendingFixedCosts.length > 0 && (
            <Field label="Costo fijo predefinido">
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
              </select>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Solo se muestran los que faltan pagar este mes. Al elegir uno se completa el
                nombre; el monto lo cargás vos.
              </p>
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
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.clientName}
                </option>
              ))}
            </select>
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

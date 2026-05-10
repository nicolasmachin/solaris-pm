import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Plus, X } from "lucide-react";

import {
  type FixedCostDto,
  type FixedCostInput,
  type FixedCostPeriodicity,
  createFixedCost,
  deleteFixedCost,
  formatPeriodicidad,
  listFixedCosts,
  updateFixedCost,
} from "../api/fixedCosts.api";
import { fmtCurrency } from "../lib/finance";
import type { Moneda } from "../types/finance.types";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-xs font-mono text-[var(--color-text-muted)] mb-1 uppercase tracking-wider";

export function TabCostosFijos() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FixedCostDto | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["fixed-costs-admin"],
    queryFn: listFixedCosts,
  });

  const toggleMut = useMutation({
    mutationFn: (fc: FixedCostDto) => updateFixedCost(fc.id, { activo: !fc.activo }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["fixed-costs-admin"] });
    },
    onError: () => toast.error("No se pudo cambiar el estado"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFixedCost(id),
    onSuccess: () => {
      toast.success("Costo fijo eliminado");
      qc.invalidateQueries({ queryKey: ["fixed-costs-admin"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Alquiler, contador, seguros y otros costos que se repiten cada mes, bimestre o año.
            En el formulario de "Nuevo movimiento" aparecen como sugerencia cuando elegís
            categoría "Costo fijo".
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)]"
        >
          <Plus className="w-4 h-4" /> Agregar costo fijo
        </button>
      </div>

      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {isLoading ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-12">
            Aún no se cargaron costos fijos.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-app)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Nombre</th>
                <th className="text-left px-4 py-2.5 font-medium">Periodicidad</th>
                <th className="text-left px-4 py-2.5 font-medium">Día</th>
                <th className="text-right px-4 py-2.5 font-medium">Monto referencia</th>
                <th className="text-left px-4 py-2.5 font-medium">Estado</th>
                <th className="text-right px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {items.map((fc) => (
                <tr key={fc.id} className="hover:bg-[var(--color-bg-card-hover)]">
                  <td className="px-4 py-3">
                    <p className="text-[var(--color-text-primary)] font-medium">{fc.nombre}</p>
                    {fc.descripcion && (
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{fc.descripcion}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {formatPeriodicidad(fc)}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">Día {fc.diaDelMes}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {fmtCurrency(fc.montoReferencia, fc.moneda)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                        fc.activo
                          ? "bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]"
                          : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {fc.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditing(fc);
                        setShowForm(true);
                      }}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleMut.mutate(fc)}
                      disabled={toggleMut.isPending}
                      className="text-xs text-[var(--color-text-secondary)] hover:underline disabled:opacity-50"
                    >
                      {fc.activo ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar ${fc.nombre}?`)) deleteMut.mutate(fc.id);
                      }}
                      disabled={deleteMut.isPending}
                      className="text-xs text-red-400 hover:underline disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <FixedCostFormModal
          initial={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Form Modal ─────────────────────────────────────────────────────────────

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function FixedCostFormModal({
  initial,
  onClose,
}: {
  initial: FixedCostDto | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [periodicidad, setPeriodicidad] = useState<FixedCostPeriodicity>(
    initial?.periodicidad ?? "MENSUAL",
  );
  const [diaDelMes, setDiaDelMes] = useState<number>(initial?.diaDelMes ?? 1);
  const [mesesPares, setMesesPares] = useState<boolean>(initial?.mesesPares ?? true);
  const [mesAnual, setMesAnual] = useState<number>(initial?.mesAnual ?? 1);
  const [montoReferencia, setMontoReferencia] = useState<string>(
    initial?.montoReferencia ? String(initial.montoReferencia) : "",
  );
  const [moneda, setMoneda] = useState<Moneda>(initial?.moneda ?? "UYU");

  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return toast.error("Falta el nombre");
    const monto = Number(montoReferencia);
    if (!monto || monto <= 0) return toast.error("Monto de referencia inválido");
    if (diaDelMes < 1 || diaDelMes > 31) return toast.error("Día inválido");

    const body: FixedCostInput = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      periodicidad,
      diaDelMes,
      mesesPares: periodicidad === "BIMENSUAL" ? mesesPares : null,
      mesAnual: periodicidad === "ANUAL" ? mesAnual : null,
      montoReferencia: monto,
      moneda,
    };

    setSaving(true);
    try {
      if (initial) await updateFixedCost(initial.id, body);
      else await createFixedCost(body);
      toast.success(initial ? "Costo fijo actualizado" : "Costo fijo creado");
      qc.invalidateQueries({ queryKey: ["fixed-costs-admin"] });
      onClose();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "No se pudo guardar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
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
            {initial ? "Editar costo fijo" : "Nuevo costo fijo"}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={lbl}>Nombre *</label>
            <input
              className={inp}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Alquiler oficina"
              autoFocus
            />
          </div>
          <div>
            <label className={lbl}>Descripción (opcional)</label>
            <input
              className={inp}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div>
            <label className={lbl}>Periodicidad *</label>
            <select
              className={inp}
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as FixedCostPeriodicity)}
            >
              <option value="MENSUAL">Mensual</option>
              <option value="BIMENSUAL">Bimensual (cada dos meses)</option>
              <option value="ANUAL">Anual</option>
            </select>
          </div>
          {periodicidad === "BIMENSUAL" && (
            <div>
              <label className={lbl}>¿Qué meses? *</label>
              <select
                className={inp}
                value={mesesPares ? "true" : "false"}
                onChange={(e) => setMesesPares(e.target.value === "true")}
              >
                <option value="true">Pares (feb, abr, jun, ago, oct, dic)</option>
                <option value="false">Impares (ene, mar, may, jul, sep, nov)</option>
              </select>
            </div>
          )}
          {periodicidad === "ANUAL" && (
            <div>
              <label className={lbl}>¿En qué mes del año? *</label>
              <select
                className={inp}
                value={mesAnual}
                onChange={(e) => setMesAnual(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={lbl}>Día del mes de pago *</label>
            <input
              type="number"
              min={1}
              max={31}
              className={inp}
              value={diaDelMes}
              onChange={(e) => setDiaDelMes(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Monto referencia *</label>
              <input
                type="number"
                step="0.01"
                min={0}
                className={inp}
                value={montoReferencia}
                onChange={(e) => setMontoReferencia(e.target.value)}
              />
            </div>
            <div>
              <label className={lbl}>Moneda</label>
              <select
                className={inp}
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as Moneda)}
              >
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            El monto se actualiza solo: cuando registres un pago real con este costo fijo
            asociado, ese pasa a ser el "último monto pagado" que la app sugiere la próxima vez.
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear costo fijo"}
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

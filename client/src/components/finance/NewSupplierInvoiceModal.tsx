import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";

import { createSupplierInvoice, getSuppliers, patchMovement } from "../../api/finance.api";
import { ProjectPicker } from "./ProjectPicker";
import type { Moneda } from "../../types/finance.types";
import { todayLocalISO } from "../../utils/date";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl =
  "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

// Factura existente a editar. Si viene, el modal entra en modo edición:
// precarga los valores y guarda con patchMovement en vez de crear.
export type EditableInvoice = {
  id: string;
  descripcion: string;
  monto: number;
  moneda: Moneda;
  fecha: string; // fecha de emisión (yyyy-mm-dd)
  dueDate: string | null;
};

type Props = {
  supplierId?: string;
  supplierName?: string;
  invoice?: EditableInvoice;
  onClose: () => void;
  onCreated?: () => void;
};

export function NewSupplierInvoiceModal({ supplierId, supplierName, invoice, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const isEdit = !!invoice;

  const [form, setForm] = useState({
    supplierId: supplierId ?? "",
    descripcion: invoice?.descripcion ?? "",
    invoiceNumber: "",
    monto: invoice ? String(invoice.monto) : "",
    moneda: invoice?.moneda ?? ("UYU" as Moneda),
    fechaEmision: invoice?.fecha ?? todayLocalISO(),
    fechaVencimiento: invoice?.dueDate ?? "",
    projectId: "",
  });
  const [saving, setSaving] = useState(false);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", "active-for-invoice"],
    queryFn: () => getSuppliers({ activo: "true" }),
    enabled: !supplierId && !isEdit,
  });

  // En edición no se cambia el proveedor; en alta queda bloqueado si vino preseleccionado.
  const supplierBloqueado = !!supplierId || isEdit;

  const saveMut = useMutation({
    mutationFn: () =>
      isEdit
        ? patchMovement(invoice!.id, {
            descripcion: form.descripcion.trim(),
            monto: Number(form.monto),
            moneda: form.moneda,
            fecha: form.fechaEmision || undefined,
            dueDate: form.fechaVencimiento || undefined,
          })
        : createSupplierInvoice({
            supplierId: form.supplierId,
            descripcion: form.descripcion.trim(),
            monto: Number(form.monto),
            moneda: form.moneda,
            fechaEmision: form.fechaEmision || undefined,
            fechaVencimiento: form.fechaVencimiento,
            invoiceNumber: form.invoiceNumber.trim() || undefined,
            projectId: form.projectId || undefined,
          }),
    onSuccess: () => {
      toast.success(isEdit ? "Factura actualizada" : "Factura creada correctamente");
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["supplier"] });
      qc.invalidateQueries({ queryKey: ["account-summary"] });
      qc.invalidateQueries({ queryKey: ["finance-movements"] });
      qc.invalidateQueries({ queryKey: ["finance-pending"] });
      qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
      onCreated?.();
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? (isEdit ? "Error al actualizar la factura" : "Error al crear la factura"));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !form.supplierId) return toast.error("Seleccioná un proveedor");
    if (!form.descripcion.trim()) return toast.error("Ingresá una descripción");
    const n = Number(form.monto);
    if (!n || n <= 0) return toast.error("Ingresá un monto válido");
    if (!form.fechaVencimiento) return toast.error("Ingresá la fecha de vencimiento");
    setSaving(true);
    saveMut.mutate(undefined, { onSettled: () => setSaving(false) });
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
            {isEdit ? "Editar factura" : "Cargar factura a pagar"}
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className={lbl}>Proveedor *</label>
            {supplierBloqueado ? (
              <div className={`${inp} bg-[var(--color-bg-app)]/60 cursor-not-allowed`}>
                {supplierName ?? "Proveedor preseleccionado"}
              </div>
            ) : (
              <select
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                className={inp}
                autoFocus
              >
                <option value="">— Elegí un proveedor —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className={lbl}>Descripción *</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Compra paneles AESolar lote marzo"
              className={inp}
            />
          </div>

          {!isEdit && (
            <div>
              <label className={lbl}>Número de factura</label>
              <input
                type="text"
                value={form.invoiceNumber}
                onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                placeholder="Ej: A-001234"
                className={inp}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Monto *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Moneda *</label>
              <select
                value={form.moneda}
                onChange={(e) => setForm({ ...form, moneda: e.target.value as Moneda })}
                className={inp}
              >
                <option value="UYU">UYU</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Fecha de emisión</label>
              <input
                type="date"
                value={form.fechaEmision}
                onChange={(e) => setForm({ ...form, fechaEmision: e.target.value })}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Fecha de vencimiento *</label>
              <input
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })}
                className={inp}
              />
            </div>
          </div>

          {!isEdit && (
            <div>
              <label className={lbl}>Proyecto (opcional)</label>
              <ProjectPicker value={form.projectId} onChange={(v) => setForm({ ...form, projectId: v })} />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Cargar factura"}
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

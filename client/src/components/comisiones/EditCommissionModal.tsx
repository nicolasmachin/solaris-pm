import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { deleteCommission, updateCommission, type CommissionListItem } from "../../api/comisiones.api";
import { Button } from "../ui/Button";

// Modal de edición de una comisión ya congelada (solo ADMIN). Permite ajustar el
// monto y las dos fechas (venta / pago previsto) y borrar la comisión. La edición
// re-sincroniza el movimiento en Finanzas y deja registro (nota + auditoría).

function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  commission: CommissionListItem | null;
  onClose: () => void;
}

export function EditCommissionModal({ commission, onClose }: Props) {
  const qc = useQueryClient();
  const [monto, setMonto] = useState("");
  const [fechaVenta, setFechaVenta] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [motivo, setMotivo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [initialized, setInitialized] = useState<string | null>(null);

  // Inicializar los campos cuando cambia la comisión seleccionada.
  if (commission && initialized !== commission.id) {
    setMonto(String(commission.montoUsd));
    setFechaVenta(isoToDateInput(commission.fechaVenta));
    setDueDate(isoToDateInput(commission.dueDate));
    setMotivo("");
    setConfirmDelete(false);
    setInitialized(commission.id);
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["commissions"] });
    qc.invalidateQueries({ queryKey: ["commission-metrics"] });
    qc.invalidateQueries({ queryKey: ["finance"] });
  };

  const saveM = useMutation({
    mutationFn: () => {
      if (!commission) throw new Error("no commission");
      const body: { montoUsd?: number; fechaVenta?: string; dueDate?: string; motivo?: string } = {};
      const montoNum = Number(monto);
      if (montoNum !== commission.montoUsd) body.montoUsd = montoNum;
      if (fechaVenta !== isoToDateInput(commission.fechaVenta)) body.fechaVenta = fechaVenta;
      if (dueDate !== isoToDateInput(commission.dueDate)) body.dueDate = dueDate;
      if (motivo.trim()) body.motivo = motivo.trim();
      return updateCommission(commission.id, body);
    },
    onSuccess: () => {
      toast.success("Comisión actualizada.");
      invalidate();
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo actualizar la comisión.");
    },
  });

  const deleteM = useMutation({
    mutationFn: () => {
      if (!commission) throw new Error("no commission");
      return deleteCommission(commission.id);
    },
    onSuccess: (res) => {
      toast.success(
        res.liberatedApplications > 0
          ? `Comisión borrada · se liberaron ${res.liberatedApplications} pago(s) aplicados.`
          : "Comisión borrada.",
      );
      invalidate();
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo borrar la comisión.");
    },
  });

  if (!commission) return null;

  const montoNum = Number(monto);
  const busy = saveM.isPending || deleteM.isPending;
  const sinCambios =
    montoNum === commission.montoUsd &&
    fechaVenta === isoToDateInput(commission.fechaVenta) &&
    dueDate === isoToDateInput(commission.dueDate);
  const canSave = montoNum > 0 && Boolean(fechaVenta) && Boolean(dueDate) && !sinCambios;

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <h3 className="mb-1 font-display text-lg font-bold text-[var(--color-text-primary)]">Editar comisión</h3>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {commission.leadClientName} · {commission.asesorName}
          {commission.status === "PAGADA" && (
            <span className="ml-1 text-amber-300">· ya pagada</span>
          )}
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Monto (USD)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Fecha vendida</span>
              <input
                type="date"
                value={fechaVenta}
                onChange={(e) => setFechaVenta(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Fecha de pago prevista</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            La fecha vendida carga la comisión a ese mes. La fecha de pago es, por defecto, el 1° del mes
            siguiente; si la ajustás a mano deja de recalcularse sola al cambiar la venta.
          </p>

          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Motivo del cambio (opcional)</span>
            <input
              type="text"
              maxLength={300}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. corrección de fecha real de cierre"
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>

          {commission.notaEdicion && (
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-[11px] text-[var(--color-text-muted)]">
              Última edición: {commission.notaEdicion}
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          {/* Borrado con confirmación inline */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              Borrar
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">
                {commission.status === "PAGADA" ? "¿Borrar una comisión pagada?" : "¿Seguro?"}
              </span>
              <button
                type="button"
                onClick={() => deleteM.mutate()}
                disabled={busy}
                className="rounded-md bg-red-500/90 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteM.isPending ? "Borrando…" : "Sí, borrar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                No
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button loading={saveM.isPending} disabled={!canSave || busy} onClick={() => saveM.mutate()}>
              Guardar
            </Button>
          </div>
        </div>

        <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">
          Venta actual: {fmtDate(commission.fechaVenta)} · Pago previsto: {fmtDate(commission.dueDate)}
        </p>
      </div>
    </div>
  );
}

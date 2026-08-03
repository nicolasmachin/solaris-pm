import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { createManualCommission } from "../../api/comisiones.api";
import { getAssignableUsers } from "../../api/users.api";
import { Button } from "../ui/Button";

// Modal para que un ADMIN/FINANZAS cargue una comisión manual a un asesor
// (sin lead). Genera el pendiente en Finanzas igual que las demás.

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Valores con los que abrir el modal precargado (ej. desde la vista de proyecto:
// asesor de la venta + 3% del presupuesto). Todos editables por el usuario.
export interface ManualCommissionInitial {
  asesorId?: string;
  montoUsd?: number | null;
  fecha?: string; // YYYY-MM-DD
  concepto?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: ManualCommissionInitial;
}

export function ManualCommissionModal({ open, onClose, initial }: Props) {
  const qc = useQueryClient();
  const [asesorId, setAsesorId] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(today());
  const [concepto, setConcepto] = useState("");

  // Al abrir, precargar desde `initial` (si viene). Se hace en un effect para que
  // reabrir el modal con otros valores los refresque.
  useEffect(() => {
    if (!open) return;
    setAsesorId(initial?.asesorId ?? "");
    setMonto(initial?.montoUsd != null ? String(initial.montoUsd) : "");
    setFecha(initial?.fecha || today());
    setConcepto(initial?.concepto ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const asesoresQ = useQuery({
    queryKey: ["assignable-users"],
    queryFn: getAssignableUsers,
    enabled: open,
  });
  // Asesores comerciales y gerencia comercial: ambos cierran ventas y pueden
  // tener comisiones.
  const asesores = (asesoresQ.data ?? []).filter(
    (u) => u.role === "ASESOR_COMERCIAL" || u.role === "GERENTE_COMERCIAL",
  );

  const mut = useMutation({
    mutationFn: () =>
      createManualCommission({
        asesorId,
        montoUsd: Number(monto),
        fecha,
        concepto: concepto.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Comisión manual registrada.");
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["commission-metrics"] });
      reset();
      onClose();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo registrar la comisión.");
    },
  });

  function reset() {
    setAsesorId("");
    setMonto("");
    setFecha(today());
    setConcepto("");
  }

  if (!open) return null;

  const montoNum = Number(monto);
  const canConfirm = Boolean(asesorId) && montoNum > 0 && Boolean(fecha);

  return (
    <div
      className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <h3 className="mb-1 font-display text-lg font-bold text-[var(--color-text-primary)]">
          Comisión manual
        </h3>
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Cargá una comisión suelta a un asesor. Genera el pendiente en Finanzas.
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Asesor</span>
            <select
              value={asesorId}
              onChange={(e) => setAsesorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Elegí un asesor…</option>
              {asesores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Monto (USD)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-muted)]">Fecha</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-[var(--color-text-muted)]">Concepto (opcional)</span>
            <input
              type="text"
              maxLength={200}
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Bono Q2, venta externa…"
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={mut.isPending} disabled={!canConfirm} onClick={() => mut.mutate()}>
            Registrar comisión
          </Button>
        </div>
      </div>
    </div>
  );
}

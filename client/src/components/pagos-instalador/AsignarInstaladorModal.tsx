import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { updateInstallerPayment, type InstallerPayment } from "../../api/pagosInstalador.api";
import type { AssignableUser } from "../../api/users.api";
import { Button } from "../ui/Button";

interface Props {
  payment: InstallerPayment;
  instaladores: AssignableUser[];
  onClose: () => void;
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

/**
 * Asigna a quién se le paga y permite corregir el monto.
 *
 * El monto viene del cotizador (mano de obra + IVA) pero es editable: lo que se
 * negocia con el instalador no siempre coincide con lo que estimó la propuesta.
 */
export function AsignarInstaladorModal({ payment, instaladores, onClose }: Props) {
  const qc = useQueryClient();
  const [installerId, setInstallerId] = useState(payment.installerId ?? "");
  const [monto, setMonto] = useState(String(payment.montoUsd));
  const [fechaTrabajo, setFechaTrabajo] = useState(toDateInput(payment.fechaTrabajo));
  const [notas, setNotas] = useState(payment.notas ?? "");

  const mut = useMutation({
    mutationFn: () => {
      const montoNum = Number(monto);
      return updateInstallerPayment(payment.id, {
        installerId: installerId || null,
        // Solo se manda si cambió: mandarlo siempre marcaría "monto corregido"
        // aunque el admin solo haya asignado el instalador.
        ...(montoNum !== payment.montoUsd && montoNum > 0 ? { montoUsd: montoNum } : {}),
        ...(fechaTrabajo !== toDateInput(payment.fechaTrabajo) ? { fechaTrabajo } : {}),
        ...(notas !== (payment.notas ?? "") ? { notas } : {}),
      });
    },
    onSuccess: () => {
      toast.success("Pago actualizado");
      qc.invalidateQueries({ queryKey: ["installer-payments"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar");
    },
  });

  const montoNum = Number(monto);
  const montoInvalido = !Number.isFinite(montoNum) || montoNum <= 0;
  const sinCambios =
    (installerId || null) === payment.installerId &&
    montoNum === payment.montoUsd &&
    fechaTrabajo === toDateInput(payment.fechaTrabajo) &&
    notas === (payment.notas ?? "");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          Pago a instalador
        </p>
        <h2 className="mb-4 font-display text-lg font-bold text-[var(--color-text-primary)]">
          {payment.clientName}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Instalador</label>
            <select
              value={installerId}
              onChange={(e) => setInstallerId(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
            >
              <option value="">— Sin asignar —</option>
              {instaladores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            {instaladores.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-300">
                No hay usuarios con el rol Instalador tercerizado todavía.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Monto a pagar (USD, con IVA)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm tabular-nums"
            />
            {payment.origenManual && payment.montoUsd === 0 && (
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                La propuesta no traía mano de obra, así que hay que cargarlo a mano.
              </p>
            )}
            {payment.pagadoUsd > 0 && (
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                Ya se pagaron US$ {payment.pagadoUsd.toFixed(2)}: el monto no puede quedar por debajo.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Fecha del trabajo
            </label>
            <input
              type="date"
              value={fechaTrabajo}
              onChange={(e) => setFechaTrabajo(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Notas</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            Cancelar
          </button>
          <Button disabled={montoInvalido || sinCambios || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

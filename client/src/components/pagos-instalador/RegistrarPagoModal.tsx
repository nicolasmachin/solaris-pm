import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { registrarPagoInstalador, type InstallerPayment } from "../../api/pagosInstalador.api";
import { todayLocalISO } from "../../utils/date";
import { Button } from "../ui/Button";

interface Props {
  payment: InstallerPayment;
  onClose: () => void;
}

function fmtUsd(v: number) {
  return "US$ " + v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Registra una entrega de plata al instalador. Puede ser parcial: el saldo se
 * recalcula solo y el estado pasa a Parcial o Pagado según corresponda.
 *
 * Cada entrega genera un movimiento en Finanzas, así que representa plata que
 * realmente salió — no una previsión.
 */
export function RegistrarPagoModal({ payment, onClose }: Props) {
  const qc = useQueryClient();
  // Arranca con el saldo completo: lo más común es saldar de una.
  const [monto, setMonto] = useState(String(payment.saldoUsd));
  const [fecha, setFecha] = useState(todayLocalISO());
  const [notas, setNotas] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      registrarPagoInstalador(payment.id, {
        montoUsd: Number(monto),
        fecha,
        notas: notas.trim() || null,
      }),
    onSuccess: (actualizado) => {
      toast.success(
        actualizado.saldoUsd <= 0
          ? "Pago registrado — trabajo saldado"
          : `Pago registrado — queda ${fmtUsd(actualizado.saldoUsd)}`,
      );
      qc.invalidateQueries({ queryKey: ["installer-payments"] });
      // El movimiento impacta Finanzas: refrescar lo que dependa de eso.
      qc.invalidateQueries({ queryKey: ["finance-movements"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo registrar el pago");
    },
  });

  const montoNum = Number(monto);
  const invalido =
    !Number.isFinite(montoNum) || montoNum <= 0 || montoNum > payment.saldoUsd + 0.005;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          Registrar pago
        </p>
        <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">
          {payment.clientName}
        </h2>
        <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
          {payment.installerName} · saldo pendiente {fmtUsd(payment.saldoUsd)}
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Monto a pagar (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max={payment.saldoUsd}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm tabular-nums"
            />
            {montoNum > payment.saldoUsd + 0.005 && (
              <p className="mt-1 text-[11px] text-red-400">
                No puede superar el saldo de {fmtUsd(payment.saldoUsd)}.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Fecha del pago
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Notas (opcional)
            </label>
            <input
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Nº de transferencia, adelanto, etc."
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        {payment.pagos.length > 0 && (
          <div className="mt-4 rounded border border-[var(--color-border)] p-2">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Pagos anteriores
            </p>
            {payment.pagos.map((p) => (
              <div key={p.id} className="flex justify-between text-[11px] text-[var(--color-text-secondary)]">
                <span>{new Date(p.fecha).toLocaleDateString("es-UY")}</span>
                <span className="tabular-nums">{fmtUsd(p.montoUsd)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            Cancelar
          </button>
          <Button disabled={invalido || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Registrando…" : "Registrar pago"}
          </Button>
        </div>
      </div>
    </div>
  );
}

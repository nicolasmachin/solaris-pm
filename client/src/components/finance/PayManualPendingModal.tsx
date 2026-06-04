import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { X } from "lucide-react";

import { getMovement, transitionMovement } from "../../api/finance.api";
import { getAccounts } from "../../api/accounts.api";
import { ACCOUNT_TYPE_LABEL } from "../../types/accounts.types";
import { todayLocalISO } from "../../utils/date";

// Marca un movimiento PREVISTO (manual / cuota de plan de pagos) como pagado.
// Pide fecha real y cuenta destino, y transiciona PREVISTO→PAGADO. Compartido
// entre la tab Pendientes y el detalle de cobros del proyecto.
export function PayManualPendingModal({
  movementId,
  onClose,
  onPaid,
}: {
  movementId: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { data: movement, isLoading } = useQuery({
    queryKey: ["movement-detail-pay", movementId],
    queryFn: () => getMovement(movementId),
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", "true"],
    queryFn: () => getAccounts({ activa: "true" }),
  });

  const [paidDate, setPaidDate] = useState(todayLocalISO());
  const [accountId, setAccountId] = useState("");

  const isIngreso = movement?.tipoMovimiento === "INGRESO";
  const moneda = movement?.moneda ?? "USD";
  const accountsFiltered = accounts.filter((a) => a.moneda === moneda);

  const transitionMut = useMutation({
    mutationFn: () =>
      transitionMovement(movementId, {
        newStatus: "PAGADO",
        paidDate,
        ...(accountId ? { accountId } : {}),
      }),
    onSuccess: () => {
      toast.success(isIngreso ? "Cobro registrado" : "Pago registrado");
      onPaid();
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo marcar como pagado");
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!paidDate) return toast.error("Falta la fecha");
    if (!accountId) return toast.error(isIngreso ? "Elegí la cuenta donde entró el dinero" : "Elegí la cuenta de donde salió el dinero");
    transitionMut.mutate();
  }

  // Stripea el prefijo [PLAN] al mostrar la descripción.
  const PLAN_PREFIX = "[PLAN] ";
  const displayDesc = movement
    ? movement.descripcion.startsWith(PLAN_PREFIX)
      ? movement.descripcion.slice(PLAN_PREFIX.length)
      : movement.descripcion
    : "";

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isIngreso ? "Registrar cobro" : "Registrar pago"}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading || !movement ? (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Cargando…</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/50 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
                Previsto
              </p>
              <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{displayDesc}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 tabular-nums">
                {moneda} {Number(movement.monto).toLocaleString("es-UY", { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                {isIngreso ? "Fecha del cobro" : "Fecha del pago"} *
              </label>
              <input
                type="date"
                value={paidDate}
                max={todayLocalISO()}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono">
                {isIngreso ? "Cuenta donde entró el dinero" : "Cuenta de donde salió"} *
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
              >
                <option value="">— Elegí una cuenta —</option>
                {accountsFiltered.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} ({ACCOUNT_TYPE_LABEL[a.tipo]} · {a.moneda})
                  </option>
                ))}
              </select>
              {accountsFiltered.length === 0 && (
                <p className="text-[10px] text-amber-400 mt-1">
                  No hay cuentas activas en {moneda}. Creá una desde Admin → Cuentas.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={transitionMut.isPending || !accountId}
                className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-gray-900 text-sm font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {transitionMut.isPending ? "Guardando…" : "Confirmar"}
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

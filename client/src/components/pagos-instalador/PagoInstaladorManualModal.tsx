import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { createInstallerPayment } from "../../api/pagosInstalador.api";
import type { AssignableUser } from "../../api/users.api";
import { todayLocalISO } from "../../utils/date";
import { Button } from "../ui/Button";

interface Props {
  instaladores: AssignableUser[];
  onClose: () => void;
}

/**
 * Carga a mano un pago que no salió de un proyecto ganado: una reparación, un
 * trabajo suelto, o una obra vieja anterior a esta funcionalidad.
 *
 * Los pagos de proyectos se crean solos al ganarse, así que acá no se elige
 * proyecto — para no pisar el que ya existe. Si hace falta corregir el de un
 * proyecto, se edita desde el listado.
 */
export function PagoInstaladorManualModal({ instaladores, onClose }: Props) {
  const qc = useQueryClient();
  const [installerId, setInstallerId] = useState("");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaTrabajo, setFechaTrabajo] = useState(todayLocalISO());

  const mut = useMutation({
    mutationFn: () =>
      createInstallerPayment({
        installerId: installerId || null,
        concepto: concepto.trim(),
        montoUsd: Number(monto),
        fechaTrabajo,
      }),
    onSuccess: () => {
      toast.success("Pago cargado");
      qc.invalidateQueries({ queryKey: ["installer-payments"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo cargar");
    },
  });

  const montoNum = Number(monto);
  const invalido = !concepto.trim() || !Number.isFinite(montoNum) || montoNum <= 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          Cargar pago manual
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Concepto</label>
            <input
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej: Reparación en garantía — González"
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Instalador</label>
            <select
              value={installerId}
              onChange={(e) => setInstallerId(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm"
            >
              <option value="">— Asignar después —</option>
              {instaladores.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">
              Monto (USD, con IVA)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm tabular-nums"
            />
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
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            Cancelar
          </button>
          <Button disabled={invalido || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Cargando…" : "Cargar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

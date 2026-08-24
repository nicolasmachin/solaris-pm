import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";

import {
  registrarPagoInstalador,
  editarEntregaInstalador,
  borrarEntregaInstalador,
  type InstallerPayment,
} from "../../api/pagosInstalador.api";
import { todayLocalISO } from "../../utils/date";
import { Button } from "../ui/Button";

interface Props {
  payment: InstallerPayment;
  onClose: () => void;
}

function fmtUsd(v: number) {
  return "US$ " + v.toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function apiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

/**
 * Gestiona las entregas de plata a un instalador: registra nuevas y permite
 * corregir o anular las ya cargadas. Cada entrega es un movimiento de Finanzas,
 * así que representa plata que realmente salió — corregir/anular una entrega
 * corrige/anula ese movimiento y el cambio se ve en Finanzas.
 */
export function RegistrarPagoModal({ payment, onClose }: Props) {
  const qc = useQueryClient();
  // Estado local del pago para reflejar ediciones sin cerrar el modal.
  const [current, setCurrent] = useState<InstallerPayment>(payment);

  const [monto, setMonto] = useState(String(payment.saldoUsd));
  const [fecha, setFecha] = useState(todayLocalISO());
  const [notas, setNotas] = useState("");

  // Edición inline de una entrega existente.
  const [editId, setEditId] = useState<string | null>(null);
  const [editMonto, setEditMonto] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["installer-payments"] });
    // Los movimientos impactan Finanzas: refrescar lo que dependa de eso.
    qc.invalidateQueries({ queryKey: ["finance-movements"] });
    qc.invalidateQueries({ queryKey: ["finance-cashflow"] });
    qc.invalidateQueries({ queryKey: ["finance-pending"] });
  };

  const registrar = useMutation({
    mutationFn: () =>
      registrarPagoInstalador(current.id, { montoUsd: Number(monto), fecha, notas: notas.trim() || null }),
    onSuccess: (upd) => {
      toast.success(upd.saldoUsd <= 0 ? "Pago registrado — trabajo saldado" : `Pago registrado — queda ${fmtUsd(upd.saldoUsd)}`);
      setCurrent(upd);
      setMonto(String(upd.saldoUsd));
      setNotas("");
      invalidate();
    },
    onError: (err) => toast.error(apiErr(err) ?? "No se pudo registrar el pago"),
  });

  const editar = useMutation({
    mutationFn: (v: { movementId: string; montoUsd: number; fecha: string }) =>
      editarEntregaInstalador(current.id, v.movementId, { montoUsd: v.montoUsd, fecha: v.fecha }),
    onSuccess: (upd) => {
      toast.success("Entrega corregida");
      setCurrent(upd);
      setEditId(null);
      invalidate();
    },
    onError: (err) => toast.error(apiErr(err) ?? "No se pudo corregir la entrega"),
  });

  const borrar = useMutation({
    mutationFn: (movementId: string) => borrarEntregaInstalador(current.id, movementId),
    onSuccess: (upd) => {
      toast.success("Entrega anulada");
      setCurrent(upd);
      setConfirmDel(null);
      invalidate();
    },
    onError: (err) => toast.error(apiErr(err) ?? "No se pudo anular la entrega"),
  });

  const montoNum = Number(monto);
  const invalido = !Number.isFinite(montoNum) || montoNum <= 0 || montoNum > current.saldoUsd + 0.005;
  const puedeRegistrar = current.saldoUsd > 0.005;

  function startEdit(id: string, montoUsd: number, isoFecha: string) {
    setConfirmDel(null);
    setEditId(id);
    setEditMonto(String(montoUsd));
    setEditFecha(isoFecha.slice(0, 10));
  }

  const inputCls = "rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-sm tabular-nums";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          Pagos al instalador
        </p>
        <h2 className="font-display text-lg font-bold text-[var(--color-text-primary)]">{current.clientName}</h2>
        <p className="mb-4 text-xs text-[var(--color-text-secondary)]">
          {current.installerName} · saldo pendiente {fmtUsd(current.saldoUsd)}
        </p>

        {/* Registrar nueva entrega (solo si queda saldo) */}
        {puedeRegistrar ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Monto a pagar (USD)</label>
              <input type="number" step="0.01" min="0" max={current.saldoUsd} value={monto} onChange={(e) => setMonto(e.target.value)} className={`w-full ${inputCls}`} />
              {montoNum > current.saldoUsd + 0.005 && (
                <p className="mt-1 text-[11px] text-red-400">No puede superar el saldo de {fmtUsd(current.saldoUsd)}.</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Fecha del pago</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--color-text-secondary)]">Notas (opcional)</label>
              <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Nº de transferencia, adelanto, etc." className={`w-full ${inputCls}`} />
            </div>
            <div className="flex justify-end">
              <Button disabled={invalido || registrar.isPending} onClick={() => registrar.mutate()}>
                {registrar.isPending ? "Registrando…" : "Registrar pago"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            Trabajo saldado. Podés corregir o anular las entregas de abajo.
          </p>
        )}

        {/* Entregas registradas: corregir / anular */}
        {current.pagos.length > 0 && (
          <div className="mt-4 rounded border border-[var(--color-border)] p-2">
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
              Entregas registradas ({current.pagos.length})
            </p>
            <div className="space-y-1">
              {current.pagos.map((p) =>
                editId === p.id ? (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} className={`${inputCls} flex-1 py-1`} />
                    <input type="number" step="0.01" min="0" value={editMonto} onChange={(e) => setEditMonto(e.target.value)} className={`${inputCls} w-24 py-1 text-right`} />
                    <button
                      type="button"
                      disabled={editar.isPending || !(Number(editMonto) > 0)}
                      onClick={() => editar.mutate({ movementId: p.id, montoUsd: Number(editMonto), fecha: editFecha })}
                      className="rounded bg-[var(--color-accent)] px-2 py-1 text-[11px] font-semibold text-gray-900 disabled:opacity-40"
                    >
                      Guardar
                    </button>
                    <button type="button" onClick={() => setEditId(null)} className="rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]">
                      Cancelar
                    </button>
                  </div>
                ) : confirmDel === p.id ? (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded bg-red-500/5 px-1 py-1 text-[11px]">
                    <span className="text-red-300">¿Anular {fmtUsd(p.montoUsd)}?</span>
                    <span className="flex gap-1.5">
                      <button type="button" disabled={borrar.isPending} onClick={() => borrar.mutate(p.id)} className="rounded bg-red-500/80 px-2 py-1 font-semibold text-white disabled:opacity-40">Anular</button>
                      <button type="button" onClick={() => setConfirmDel(null)} className="rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-text-secondary)]">No</button>
                    </span>
                  </div>
                ) : (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-[12px] text-[var(--color-text-secondary)]">
                    <span>{new Date(p.fecha).toLocaleDateString("es-UY")}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{fmtUsd(p.montoUsd)}</span>
                      <button type="button" title="Corregir" onClick={() => startEdit(p.id, p.montoUsd, p.fecha)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" title="Anular" onClick={() => { setEditId(null); setConfirmDel(p.id); }} className="text-[var(--color-text-muted)] hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

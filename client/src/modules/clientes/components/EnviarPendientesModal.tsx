import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, RefreshCw, Send, X } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

import {
  enviarPendientes,
  getPendientes,
  regenerarPendientes,
  type ResultadoEnvioPendiente,
} from "../../../api/reportesFv.api";
import { Spinner } from "../../../components/ui/Spinner";

interface Props {
  canRegenerar: boolean;
  onClose: () => void;
}

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Envío de todo lo pendiente a una fecha de corte, sin importar el mes.
 *
 * Se manda cada reporte generado cuyo período cerró antes de la fecha y que el
 * cliente todavía no recibió. Así un cliente con día de corte (su "agosto" va
 * del 7 de julio al 6 de agosto) sale junto con el resto, y si a alguien le
 * quedó un mes sin mandar, recibe los dos.
 *
 * Dos pasos, como antes: la lista de pendientes, y después una simulación con
 * las direcciones exactas antes de que salga un solo mail.
 */
export function EnviarPendientesModal({ canRegenerar, onClose }: Props) {
  const qc = useQueryClient();
  const [hasta, setHasta] = useState(hoyLocal());
  const [previo, setPrevio] = useState<ResultadoEnvioPendiente[] | null>(null);

  const { data: pendientes, isLoading } = useQuery({
    queryKey: ["reportes-fv", "pendientes", hasta],
    queryFn: () => getPendientes(hasta),
    enabled: /^\d{4}-\d{2}-\d{2}$/.test(hasta),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["reportes-fv", "pendientes"] });
    qc.invalidateQueries({ queryKey: ["reportes-fv", "panel"] });
  };

  const regenerar = useMutation({
    mutationFn: () => regenerarPendientes(hasta),
    onSuccess: (r) => {
      toast.success(`${r.regenerados} reporte(s) regenerado(s)`);
      if (r.errores.length) {
        toast.error(
          `${r.errores.length} con error: ${r.errores.map((e) => `${e.cliente} (${e.motivo})`).join("; ")}`,
          { duration: 12000 },
        );
      }
      invalidar();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudieron regenerar"),
  });

  const simular = useMutation({
    mutationFn: () => enviarPendientes(hasta, { dryRun: true }),
    onSuccess: (r) => setPrevio(r.resultados),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo consultar a quién se enviaría"),
  });

  const listos = previo?.filter((r) => r.estado === "DRY_RUN") ?? [];
  const omitidos = previo?.filter((r) => r.estado === "OMITIDO") ?? [];

  const enviar = useMutation({
    // Sólo los que se vieron en la simulación: si entre medio se generó otro,
    // no sale sin que se haya visto.
    mutationFn: () => enviarPendientes(hasta, { emisionIds: listos.map((r) => r.emisionId) }),
    onSuccess: (r) => {
      const enviados = r.resumen.ENVIADO ?? 0;
      const fallidos = r.resumen.FALLIDO ?? 0;
      if (enviados) toast.success(`${enviados} reporte(s) enviado(s)`);
      if (fallidos) toast.error(`${fallidos} no se pudieron enviar`);
      if (!enviados && !fallidos) toast("No había nada para enviar");
      invalidar();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Falló el envío"),
  });

  const ocupado = regenerar.isPending || simular.isPending || enviar.isPending;
  const viejos = pendientes?.filter((p) => p.formatoViejo).length ?? 0;
  const clientes = new Set(pendientes?.map((p) => p.projectId)).size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-[var(--color-bg-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-base font-semibold">
            {previo ? "Confirmar envío" : "Enviar reportes pendientes"}
          </h2>
          <button type="button" onClick={onClose} disabled={ocupado} className="opacity-70 hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!previo && (
            <>
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                    Fecha de corte
                  </span>
                  <input
                    type="date"
                    value={hasta}
                    max={hoyLocal()}
                    onChange={(e) => setHasta(e.target.value)}
                    disabled={ocupado}
                    className="rounded-lg border border-[var(--color-border)] bg-transparent px-2 py-1"
                  />
                </label>
                <p className="flex-1 text-xs text-[var(--color-text-secondary)]">
                  Entran todos los reportes generados cuyo período terminó antes de esta fecha y que el
                  cliente todavía no recibió, sean del mes que sean.
                </p>
              </div>

              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Spinner /> Buscando pendientes…
                </div>
              )}

              {pendientes && pendientes.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No hay reportes pendientes de envío a esa fecha.
                </p>
              )}

              {pendientes && pendientes.length > 0 && (
                <>
                  <p className="mb-2 text-sm">
                    <strong>{pendientes.length}</strong> reporte(s) de <strong>{clientes}</strong> cliente(s).
                  </p>

                  {viejos > 0 && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                      <span>
                        {viejos} PDF se generaron con el formato anterior, que dice solo el mes en vez de los
                        días que cubre. Conviene regenerarlos antes de enviar.
                      </span>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">
                        <tr>
                          <th className="py-1 pr-3">Cliente</th>
                          <th className="py-1 pr-3">Período</th>
                          <th className="py-1 pr-3">Destinatarios</th>
                          <th className="py-1">Aviso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {pendientes.map((p) => (
                          <tr key={p.emisionId}>
                            <td className="py-1.5 pr-3 font-medium">{p.cliente}</td>
                            <td className="whitespace-nowrap py-1.5 pr-3">{p.periodoTexto}</td>
                            <td className="py-1.5 pr-3 text-xs text-[var(--color-text-secondary)]">
                              {p.destinatarios.join(", ") || "—"}
                            </td>
                            <td className="py-1.5 text-xs">
                              {p.bloqueosEnvio.length > 0 && (
                                <span className="text-red-400">{p.bloqueosEnvio.join("; ")}</span>
                              )}
                              {p.bloqueosEnvio.length === 0 && p.formatoViejo && (
                                <span className="text-amber-400">formato anterior</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {previo && (
            <>
              {listos.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Ninguno pasa los controles de envío.</p>
              ) : (
                <>
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                    <span>
                      Se van a mandar <strong>{listos.length} reporte(s)</strong>. Cada uno sale en su propio
                      correo, de inmediato, y no se puede deshacer.
                    </span>
                  </div>
                  <ul className="divide-y divide-[var(--color-border)] text-sm">
                    {listos.map((r) => (
                      <li key={r.emisionId} className="py-2">
                        <div className="font-medium">
                          {r.cliente} <span className="font-normal text-[var(--color-text-secondary)]">· {r.periodoTexto}</span>
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)]">
                          {r.destinatarios.join(", ") || "sin destinatarios"}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {omitidos.length > 0 && (
                <div className="mt-4 rounded-lg border border-[var(--color-border)] p-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                    No se envían ({omitidos.length})
                  </p>
                  <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                    {omitidos.map((r) => (
                      <li key={r.emisionId}>
                        {r.cliente} · {r.periodoTexto} — {r.motivo ?? "omitido"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          {!previo ? (
            <>
              {canRegenerar && (
                <button
                  type="button"
                  disabled={ocupado || !pendientes?.length}
                  onClick={() => {
                    if (
                      window.confirm(
                        `¿Regenerar el PDF de los ${pendientes?.length} reportes pendientes? Se crea una versión nueva de cada uno con los datos actuales (no se envía nada). Puede tardar unos minutos.`,
                      )
                    ) {
                      regenerar.mutate();
                    }
                  }}
                  className="mr-auto flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  <RefreshCw size={14} className={regenerar.isPending ? "animate-spin" : ""} />
                  {regenerar.isPending ? "Regenerando… (puede tardar)" : "Regenerar PDF de todos"}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                disabled={ocupado}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => simular.mutate()}
                disabled={ocupado || !pendientes?.length}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
              >
                {simular.isPending ? "Revisando…" : "Revisar envío"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPrevio(null)}
                disabled={ocupado}
                className="mr-auto flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <ArrowLeft size={14} /> Volver
              </button>
              <button
                type="button"
                onClick={() => enviar.mutate()}
                disabled={ocupado || listos.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
              >
                <Send size={14} />
                {enviar.isPending ? "Enviando…" : `Enviar ${listos.length} reporte(s)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { enviarLote, type ResultadoEnvio } from "../../../api/reportesFv.api";
import { Spinner } from "../../../components/ui/Spinner";

interface Props {
  periodo: string;
  /** emisionId → nombre del cliente, para mostrar a quién se le manda. */
  nombrePorEmision: Map<string, string>;
  onClose: () => void;
  onEnviado: () => void;
}

/**
 * Confirmación en dos pasos del envío masivo.
 *
 * El primer paso es un `dryRun`: pregunta al servidor exactamente a quién le
 * mandaría y muestra la lista de direcciones, sin enviar nada. Recién el segundo
 * clic manda los mails. Es la única acción del módulo que sale hacia afuera y no
 * se puede deshacer, así que no alcanza con un "¿estás seguro?": hay que poder
 * leer la lista antes.
 */
export function EnviarLoteModal({ periodo, nombrePorEmision, onClose, onEnviado }: Props) {
  const [previo, setPrevio] = useState<ResultadoEnvio[] | null>(null);

  const simular = useMutation({
    mutationFn: () => enviarLote(periodo, { dryRun: true }),
    onSuccess: (r) => setPrevio(r.resultados),
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? "No se pudo consultar a quién se enviaría"),
  });

  const enviar = useMutation({
    mutationFn: () => enviarLote(periodo),
    onSuccess: (r) => {
      const enviados = r.resumen.ENVIADO ?? 0;
      const fallidos = r.resumen.FALLIDO ?? 0;
      if (enviados) toast.success(`${enviados} reporte(s) enviado(s)`);
      if (fallidos) toast.error(`${fallidos} no se pudieron enviar`);
      if (!enviados && !fallidos) toast("No había nada para enviar");
      onEnviado();
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "Falló el envío"),
  });

  useEffect(() => {
    simular.mutate();
    // Sólo al abrir: el dry run no depende de nada que cambie mientras está abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listos = previo?.filter((r) => r.estado === "DRY_RUN") ?? [];
  const omitidos = previo?.filter((r) => r.estado === "OMITIDO") ?? [];
  const enviando = enviar.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-[var(--color-bg-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-base font-semibold">Enviar los reportes de {periodo}</h2>
          <button type="button" onClick={onClose} disabled={enviando} className="opacity-70 hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {simular.isPending && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Spinner /> Consultando a quién se le enviaría…
            </div>
          )}

          {previo && listos.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No hay reportes listos para enviar en este período. Generá los PDF primero.
            </p>
          )}

          {listos.length > 0 && (
            <>
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <span>
                  Se le va a mandar el reporte a <strong>{listos.length} cliente(s)</strong>. El
                  correo sale de inmediato y no se puede deshacer.
                </span>
              </div>

              <ul className="divide-y divide-[var(--color-border)] text-sm">
                {listos.map((r) => (
                  <li key={r.emisionId} className="py-2">
                    <div className="font-medium">
                      {nombrePorEmision.get(r.emisionId) ?? "Generador"}
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
                    {nombrePorEmision.get(r.emisionId) ?? r.emisionId} — {r.motivo ?? "omitido"}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => enviar.mutate()}
            disabled={enviando || listos.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-gray-900 disabled:opacity-50"
          >
            <Send size={14} />
            {enviando ? "Enviando…" : `Enviar a ${listos.length} cliente(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { altaAppApi, type LinkAltaApp } from "../../../api/altaApp.api";

const fecha = (s: string) => new Date(s).toLocaleDateString("es-UY", { day: "numeric", month: "short", year: "numeric" });

// El acceso del cliente a la aplicación del inversor. En vez de crearle usuario
// y contraseña y mandárselos por WhatsApp, se le manda un link de un solo uso:
// el cliente los elige y Voltia PM crea la cuenta en Growatt con su planta.
export function AltaAppModal({ projectId, nombre, onClose }: { projectId: string; nombre: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [link, setLink] = useState<LinkAltaApp | null>(null);
  const { data: estado } = useQuery({ queryKey: ["alta-app-estado", projectId], queryFn: () => altaAppApi.estado(projectId) });

  const generar = useMutation({
    mutationFn: () => altaAppApi.generarLink(projectId),
    onSuccess: (l) => {
      setLink(l);
      qc.invalidateQueries({ queryKey: ["alta-app-estado", projectId] });
    },
    onError: () => toast.error("No se pudo generar el link"),
  });

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado");
    } catch {
      window.prompt("Copiá:", texto);
    }
  }

  const btn = "rounded-lg px-3 py-2 text-xs font-semibold";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Acceso a la aplicación del inversor"
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">Acceso a la aplicación del inversor</div>
            <div className="text-xs text-[var(--color-text-muted)]">{nombre}{estado?.plantaNombre ? ` · planta Growatt "${estado.plantaNombre}"` : ""}</div>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Cerrar">✕</button>
        </div>

        {!estado ? (
          <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
        ) : !estado.tienePlantaGrowatt ? (
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            El cliente no tiene una planta de Growatt vinculada. Vincularla primero (Experiencia Solar → Reportes → plantas sin vincular).
            Por ahora esto funciona solo con Growatt.
          </p>
        ) : !estado.webConfigurada ? (
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            Falta configurar en el servidor el usuario de la web de Growatt. Avisar a quien administra Voltia PM.
          </p>
        ) : (
          <div className="space-y-3 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {estado.hecha && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                Ya tiene su acceso: usuario <strong>{estado.hecha.usuario}</strong>, creado el {fecha(estado.hecha.cuando)}
                {estado.hecha.canal === "PORTAL" ? " desde el portal" : estado.hecha.canal === "MANUAL" ? " a mano en la web de Growatt" : " con el link"}. La contraseña la eligió él.
                Si se la olvidó, se le puede mandar un link nuevo.
              </div>
            )}
            {!link && estado.linkPendiente && !estado.hecha && (
              <p>Ya hay un link sin usar, generado el {fecha(estado.linkPendiente.creadoEn)} (vence el {fecha(estado.linkPendiente.expiraEn)}). Generar otro anula el anterior.</p>
            )}
            {!link ? (
              <>
                <p>
                  Se le manda al cliente un link de un solo uso (vale 7 días). Ahí elige su usuario y su contraseña, y la cuenta queda
                  creada en Growatt con su planta. Nadie de Voltia ve la contraseña.
                </p>
                <button
                  onClick={() => generar.mutate()}
                  disabled={generar.isPending}
                  className={`${btn} w-full bg-[var(--color-accent)] text-black disabled:opacity-50`}
                >
                  {generar.isPending ? "Generando…" : estado.hecha ? "Generar un link nuevo" : "Generar el link"}
                </button>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-[var(--color-border)] p-2 font-mono text-[11px] break-all text-[var(--color-text-primary)]">{link.url}</div>
                <div className="grid grid-cols-2 gap-2">
                  {link.whatsapp ? (
                    <a href={link.whatsapp} target="_blank" rel="noreferrer" className={`${btn} bg-[var(--color-accent)] text-center text-black`}>
                      Mandar por WhatsApp
                    </a>
                  ) : (
                    <span className="self-center text-[11px] text-[var(--color-text-muted)]">Sin teléfono cargado</span>
                  )}
                  <button onClick={() => copiar(link.mensaje)} className={`${btn} border border-[var(--color-border)] text-[var(--color-text-primary)]`}>
                    Copiar el mensaje
                  </button>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Cuando el cliente termine, queda anotado en los comentarios del proyecto con el usuario que eligió.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

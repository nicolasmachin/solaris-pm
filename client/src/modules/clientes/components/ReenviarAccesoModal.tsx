import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Check, Copy, KeyRound, RefreshCw, Send, X } from "lucide-react";

import { resetPortalUser, type ClienteListItem, type ResetPortalUserResult } from "../../../api/clientes.api";
import { Button } from "../../../components/ui/Button";
import { buildPortalWelcomeMessage } from "../../../lib/portalWelcomeMessage";
import { useLockBodyScroll } from "../../../hooks/useLockBodyScroll";

// Misma temporal por defecto que al crear el usuario. Editable por si se quiere otra.
const DEFAULT_PASSWORD = "12345678";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const labelClass = "mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]";

export function ReenviarAccesoModal({ cliente, onClose }: { cliente: ClienteListItem; onClose: () => void }) {
  const qc = useQueryClient();
  useLockBodyScroll(true);

  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [done, setDone] = useState<ResetPortalUserResult | null>(null);
  const [copied, setCopied] = useState(false);

  const resetear = useMutation({
    mutationFn: () => resetPortalUser(cliente.projectId, password),
    onSuccess: (res) => {
      setDone(res);
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Contraseña reseteada");
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo resetear la contraseña"),
  });

  async function copiarMensaje() {
    const texto = buildPortalWelcomeMessage({
      name: done?.name ?? cliente.nombre ?? "",
      email: done?.email ?? cliente.mail ?? "",
      password,
    });
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
      toast.success("Mensaje copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Reenviar acceso al portal"
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <Send size={16} className="text-[var(--color-accent)]" />
              <span className="font-medium">Reenviar acceso al portal</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">{cliente.nombre}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        {done ? (
          // ── Resultado ──────────────────────────────────────────────────────
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-[13px] text-green-300">
              Contraseña reseteada. Copiá el mensaje y enviáselo al cliente — deberá cambiarla en el próximo ingreso.
            </div>
            <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
              <div>
                <p className={labelClass}>Usuario</p>
                <p className="text-sm text-[var(--color-text-primary)]">{done.email}</p>
              </div>
              <div>
                <p className={labelClass}>Nueva contraseña temporal</p>
                <p className="font-mono text-sm text-[var(--color-text-primary)]">{password}</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={copiarMensaje} className="w-full">
              {copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
              {copied ? "Copiado" : "Copiar mensaje"}
            </Button>
            <div className="flex justify-end border-t border-[var(--color-border)] pt-3">
              <Button size="sm" onClick={onClose}>Listo</Button>
            </div>
          </div>
        ) : (
          // ── Confirmación ───────────────────────────────────────────────────
          <div className="space-y-3 p-4">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              La contraseña actual no se puede recuperar, así que reenviar el acceso genera una
              <strong> nueva contraseña temporal</strong>. El cliente la cambia en el próximo ingreso.
            </p>
            <div>
              <label className={labelClass}>Nueva contraseña temporal</label>
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-accent)]">
                <KeyRound size={14} className="text-[var(--color-text-muted)]" />
                <input
                  className="flex-1 bg-transparent py-2 font-mono text-sm text-[var(--color-text-primary)] focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {password.length < 8 && (
                <p className="mt-1 text-[11px] text-[var(--color-danger-text)]">Mínimo 8 caracteres.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button
                size="sm"
                loading={resetear.isPending}
                disabled={password.length < 8 || resetear.isPending}
                onClick={() => resetear.mutate()}
              >
                <RefreshCw size={14} className="mr-1.5" /> Resetear y mostrar mensaje
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

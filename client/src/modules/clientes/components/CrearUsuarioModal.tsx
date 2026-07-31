import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Check, Copy, KeyRound, User, X } from "lucide-react";

import { crearPortalUser, type ClienteListItem, type CrearPortalUserResult } from "../../../api/clientes.api";
import { Button } from "../../../components/ui/Button";
import { useLockBodyScroll } from "../../../hooks/useLockBodyScroll";

// Contraseña temporal por defecto. El cliente la cambia en el primer ingreso
// (el usuario se crea con passwordTemporary=true). Editable por si se quiere otra.
const DEFAULT_PASSWORD = "12345678";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const inputClass =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const labelClass = "mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]";

export function CrearUsuarioModal({ cliente, onClose }: { cliente: ClienteListItem; onClose: () => void }) {
  const qc = useQueryClient();
  useLockBodyScroll(true);

  const [name, setName] = useState(cliente.nombre ?? "");
  const [email, setEmail] = useState(cliente.mail ?? "");
  const [phone, setPhone] = useState(cliente.telefono ?? "");
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [done, setDone] = useState<CrearPortalUserResult | null>(null);
  const [copied, setCopied] = useState(false);

  const crear = useMutation({
    mutationFn: () =>
      crearPortalUser(cliente.projectId, {
        name: name.trim(),
        email: email.trim(),
        temporaryPassword: password,
        phone: phone.trim() || null,
      }),
    onSuccess: (res) => {
      setDone(res);
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(res.linked ? "Generador vinculado al proyecto" : "Usuario creado");
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo crear el usuario"),
  });

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const puedeCrear = name.trim().length > 0 && emailValido && password.length >= 8;

  async function copiarCredenciales() {
    const texto = `Acceso a Voltia PM\nUsuario: ${done?.email ?? email.trim()}\nContraseña temporal: ${password}\nIngresá en el portal y cambiala en el primer ingreso.`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopied(true);
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
        aria-label="Crear usuario de portal"
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
              <User size={16} className="text-[var(--color-accent)]" />
              <span className="font-medium">Crear usuario de portal</span>
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
            {done.linked ? (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-[13px] text-blue-300">
                Ya existía un Generador con ese email. Se lo <strong>vinculó a este proyecto</strong>. Conserva
                sus credenciales actuales (no se generó una nueva contraseña).
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-[13px] text-green-300">
                  Usuario creado. Compartí estas credenciales con el cliente — deberá cambiar la contraseña en el
                  primer ingreso.
                </div>
                <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
                  <div>
                    <p className={labelClass}>Usuario</p>
                    <p className="text-sm text-[var(--color-text-primary)]">{done.email}</p>
                  </div>
                  <div>
                    <p className={labelClass}>Contraseña temporal</p>
                    <p className="font-mono text-sm text-[var(--color-text-primary)]">{password}</p>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={copiarCredenciales} className="w-full">
                  {copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                  {copied ? "Copiado" : "Copiar credenciales"}
                </Button>
              </>
            )}
            <div className="flex justify-end border-t border-[var(--color-border)] pt-3">
              <Button size="sm" onClick={onClose}>Listo</Button>
            </div>
          </div>
        ) : (
          // ── Formulario ─────────────────────────────────────────────────────
          <div className="space-y-3 p-4">
            <p className="text-[12px] text-[var(--color-text-muted)]">
              Se toman el nombre, el mail y el teléfono ya cargados en el cliente. Podés ajustarlos.
            </p>
            <div>
              <label className={labelClass}>Nombre</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email (usuario de ingreso)</label>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@ejemplo.com"
              />
              {email.trim() && !emailValido && (
                <p className="mt-1 text-[11px] text-[var(--color-danger-text)]">Email inválido.</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Teléfono (opcional)</label>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Contraseña temporal</label>
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
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                Por defecto <span className="font-mono">12345678</span>; el cliente la cambia en el primer ingreso.
                Si el email ya pertenece a un Generador existente, se lo vincula a este proyecto y esta contraseña se ignora.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" loading={crear.isPending} disabled={!puedeCrear || crear.isPending} onClick={() => crear.mutate()}>
                Crear usuario
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

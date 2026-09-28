import { useMemo, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { toast } from "react-hot-toast";

import type { DanioPlan, PlanGranizo } from "../../api/planGranizo.api";
import { usePermission } from "../../hooks/usePermission";
import { useCreateInteraction } from "../../modules/clientes/hooks/useClienteInteractions";
import { marcadoresPendientes } from "../../modules/clientes/plantillas";
import { useAuthStore } from "../../store/auth.store";
import { Button } from "../ui/Button";
import { MENSAJES_PLAN, mensajeSugerido, renderMensaje, type MensajePlan } from "./mensajes";

// Mensajes modelo del plan de granizo, listos para copiar. Igual que los del
// recorrido: se pueden editar antes de copiar y, al copiar, se ofrece registrar
// el contacto en la bitácora (tildado por defecto).
export function MensajesPlanModal({ plan, danio, onClose }: { plan: PlanGranizo; danio?: DanioPlan | null; onClose: () => void }) {
  const referente = useAuthStore((s) => s.user?.name ?? null);
  const canRegistrar = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const mensajes = useMemo(() => MENSAJES_PLAN.filter((m) => Boolean(m.deDanio) === Boolean(danio)), [danio]);
  const inicial = mensajes.find((m) => m.id === mensajeSugerido(plan, danio)) ?? mensajes[0]!;

  const [sel, setSel] = useState<MensajePlan>(inicial);
  const [texto, setTexto] = useState(() => renderMensaje(inicial.cuerpo, plan, referente, danio));
  const [registrar, setRegistrar] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const registro = useCreateInteraction(plan.projectId);
  const pendientes = marcadoresPendientes(texto);

  function elegir(m: MensajePlan) {
    setSel(m);
    setTexto(renderMensaje(m.cuerpo, plan, referente, danio));
    setCopiado(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      toast.error("El navegador no dejó copiar. Seleccioná el texto y copialo a mano.");
      return;
    }
    setCopiado(true);
    if (!registrar || !canRegistrar) {
      toast.success("Mensaje copiado");
      return;
    }
    registro.mutate(
      { channel: "WHATSAPP", direction: "SALIENTE", reason: "SEGUIMIENTO", content: texto },
      {
        onSuccess: () => toast.success("Mensaje copiado y contacto registrado"),
        onError: () => toast.error("Se copió el mensaje, pero no se pudo registrar el contacto"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mensajes al cliente"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div>
            <p className="font-medium text-[var(--color-text-primary)]">Mensajes al cliente · Plan de granizo</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {plan.project.clientName}. Adaptá lo que haga falta. Nunca digas “seguro”: es un plan.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]">
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <ul className="shrink-0 space-y-1 overflow-y-auto border-b border-[var(--color-border)] p-2 sm:w-56 sm:border-b-0 sm:border-r">
            {mensajes.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => elegir(m)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] ${
                    sel.id === m.id
                      ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
                  }`}
                >
                  {m.titulo}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
            <p className="text-[11px] text-[var(--color-text-muted)]">{sel.cuando}</p>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setCopiado(false);
              }}
              rows={11}
              className="min-h-[200px] flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-[13px] leading-relaxed text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
            {pendientes.length > 0 ? (
              <p className="text-[11px] text-[var(--color-warning-text)]">Falta completar: {pendientes.join(" · ")}</p>
            ) : null}
            {canRegistrar ? (
              <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                <input type="checkbox" checked={registrar} onChange={(e) => setRegistrar(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-accent)]" />
                Registrar el contacto en la bitácora al copiar
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={onClose}>Cerrar</Button>
              <Button size="sm" onClick={copiar}>
                {copiado ? <Check size={14} className="mr-1.5 inline" /> : <Copy size={14} className="mr-1.5 inline" />}
                {copiado ? "Copiado" : "Copiar mensaje"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

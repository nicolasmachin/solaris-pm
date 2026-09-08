import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Check, Copy, X } from "lucide-react";

import { type ClienteRecorrido } from "../../../api/clientes.api";
import { Button } from "../../../components/ui/Button";
import { useLockBodyScroll } from "../../../hooks/useLockBodyScroll";
import { usePermission } from "../../../hooks/usePermission";
import { useAuthStore } from "../../../store/auth.store";
import { useCreateInteraction } from "../hooks/useClienteInteractions";
import {
  marcadoresPendientes,
  plantillasDe,
  renderPlantilla,
  type CredencialesPortal,
  type Plantilla,
} from "../plantillas";

// Los mensajes modelo de una etapa, listos para copiar. El texto se puede editar
// antes de copiar: son un piso de tono, no un molde.
//
// Al copiar se ofrece registrar el contacto en la bitácora, tildado por defecto.
// No es una comodidad: hoy la bitácora es 100% manual y por eso está casi vacía,
// así que el momento de copiar el mensaje es la única oportunidad realista de
// que quede registrado que se contactó al cliente.
export function PlantillasModal({
  projectId,
  cliente,
  recorrido,
  plantillaInicial,
  portal,
  onClose,
}: {
  projectId: string;
  cliente: string;
  recorrido: ClienteRecorrido;
  /** Id de la plantilla a abrir seleccionada (cuando se entra desde un paso). */
  plantillaInicial?: string;
  /**
   * Credenciales reales del portal, para que el mensaje de acceso salga con el
   * usuario y la contraseña de verdad en vez de los huecos genéricos.
   */
  portal?: CredencialesPortal | null;
  onClose: () => void;
}) {
  useLockBodyScroll(true);
  const referente = useAuthStore((s) => s.user?.name ?? null);
  const canRegistrar = usePermission("EXPERIENCIA_CLIENTES", "CREATE");

  const plantillas = useMemo(() => plantillasDe(recorrido), [recorrido]);
  const inicial =
    plantillas.find((p) => p.id === plantillaInicial) ?? plantillas[0] ?? null;

  const [seleccionada, setSeleccionada] = useState<Plantilla | null>(inicial);
  const [texto, setTexto] = useState(() =>
    inicial ? renderPlantilla(inicial.cuerpo, { nombre: cliente, referente, portal }) : "",
  );
  const [registrar, setRegistrar] = useState(true);
  const [copiado, setCopiado] = useState(false);

  function elegir(p: Plantilla) {
    setSeleccionada(p);
    setTexto(renderPlantilla(p.cuerpo, { nombre: cliente, referente, portal }));
    setCopiado(false);
  }

  // Se reusa el hook de la bitácora para que el registro invalide exactamente lo
  // mismo que registrar a mano desde la pestaña Interacciones.
  const registro = useCreateInteraction(projectId);

  const pendientes = marcadoresPendientes(texto);

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
      {
        channel: "WHATSAPP",
        direction: "SALIENTE",
        reason: seleccionada?.motivo === "OTRO" ? undefined : seleccionada?.motivo,
        content: texto,
      },
      {
        onSuccess: () => toast.success("Mensaje copiado y contacto registrado"),
        onError: () => toast.error("Se copió el mensaje, pero no se pudo registrar el contacto"),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mensajes modelo"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div className="min-w-0">
            <p className="font-medium text-[var(--color-text-primary)]">Mensajes modelo</p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {cliente} · etapa {recorrido}. Adaptá lo que haga falta: son un piso de tono, no un texto obligatorio.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Lista de plantillas de la etapa. */}
          <div className="shrink-0 overflow-y-auto border-b border-[var(--color-border)] p-2 sm:w-56 sm:border-b-0 sm:border-r">
            <ul className="space-y-1">
              {plantillas.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => elegir(p)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${
                      seleccionada?.id === p.id
                        ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
                    }`}
                  >
                    {p.titulo}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Texto editable. */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
            {seleccionada ? (
              <>
                <p className="text-[11px] text-[var(--color-text-muted)]">{seleccionada.cuando}</p>
                <textarea
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value);
                    setCopiado(false);
                  }}
                  rows={12}
                  className="min-h-[220px] flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 text-[13px] leading-relaxed text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
                />
                {pendientes.length > 0 && (
                  <p className="text-[11px] text-[var(--color-warning-text)]">
                    Falta completar: {pendientes.join(" · ")}
                  </p>
                )}
                {canRegistrar && (
                  <label className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={registrar}
                      onChange={(e) => setRegistrar(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                    />
                    Registrar el contacto en la bitácora al copiar
                  </label>
                )}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onClick={onClose}>
                    Cerrar
                  </Button>
                  <Button size="sm" onClick={copiar}>
                    {copiado ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                    {copiado ? "Copiado" : "Copiar mensaje"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-[13px] text-[var(--color-text-muted)]">
                No hay mensajes modelo para esta etapa.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { toast } from "react-hot-toast";

import type { InteractionChannel, InteractionReason } from "../../../api/clientes.api";
import { Button } from "../../../components/ui/Button";
import { CHANNEL_LABELS, CHANNEL_OPTIONS } from "../constants";
import { useCreateInteraction } from "../hooks/useClienteInteractions";

const MAX = 2000;

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const selectClass =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const labelClass =
  "font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]";

export function ClienteInteractionForm({ projectId }: { projectId: string }) {
  const [channel, setChannel] = useState<InteractionChannel>("WHATSAPP");
  const [content, setContent] = useState("");
  const mutation = useCreateInteraction(projectId);

  function registrar(overrides?: { reason?: InteractionReason; content?: string }) {
    const finalContent = (overrides?.content ?? content).trim();
    if (!finalContent) {
      toast.error("Escribí un resumen del contacto");
      return;
    }
    // Dirección y motivo ya no se piden: eran dos selects que había que tocar en
    // cada registro y que nadie usaba para filtrar ni para decidir nada. El motivo
    // sigue existiendo, pero lo pone el sistema cuando significa algo — el aviso
    // de habilitación (que apaga la Regla de Oro) y las plantillas.
    mutation.mutate(
      { channel, content: finalContent, reason: overrides?.reason },
      {
        onSuccess: () => {
          setContent("");
          toast.success(
            overrides?.reason === "AVISO_HABILITACION"
              ? "Aviso al Generador registrado"
              : "Interacción registrada",
          );
        },
        onError: (err) => toast.error(getApiErr(err) ?? "No se pudo registrar la interacción"),
      },
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    registrar();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label className={labelClass}>Canal</label>
          <select
            className={selectClass}
            value={channel}
            onChange={(e) => setChannel(e.target.value as InteractionChannel)}
          >
            {CHANNEL_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        rows={3}
        maxLength={MAX}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Resumen del contacto con el Generador…"
        className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {content.length}/{MAX}
        </span>
        <div className="flex items-center gap-2">
          {/* Regla de Oro: registra el aviso post-habilitación y corta las alertas. */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            loading={mutation.isPending}
            onClick={() =>
              registrar({
                reason: "AVISO_HABILITACION",
                content: content.trim() || "Se avisó al Generador que ya puede empezar a producir su energía.",
              })
            }
            title="Registra el aviso de habilitación y corta las alertas de la Regla de Oro"
          >
            Marcar avisado al Generador
          </Button>
          <Button type="submit" size="sm" loading={mutation.isPending} disabled={!content.trim()}>
            Registrar interacción
          </Button>
        </div>
      </div>
    </form>
  );
}

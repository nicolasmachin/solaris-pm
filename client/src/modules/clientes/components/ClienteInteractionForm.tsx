import { useState } from "react";
import { toast } from "react-hot-toast";

import type { InteractionChannel } from "../../../api/clientes.api";
import { Button } from "../../../components/ui/Button";
import { CHANNEL_LABELS, CHANNEL_OPTIONS } from "../constants";
import { useCreateInteraction } from "../hooks/useClienteInteractions";

const MAX = 2000;

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const selectClass =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

export function ClienteInteractionForm({ projectId }: { projectId: string }) {
  const [channel, setChannel] = useState<InteractionChannel>("WHATSAPP");
  const [content, setContent] = useState("");
  const mutation = useCreateInteraction(projectId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    mutation.mutate(
      { channel, content: trimmed },
      {
        onSuccess: () => {
          setContent("");
          toast.success("Interacción registrada");
        },
        onError: (err) => toast.error(getApiErr(err) ?? "No se pudo registrar la interacción"),
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          Canal
        </label>
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

      <textarea
        rows={3}
        maxLength={MAX}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Resumen del contacto con el cliente…"
        className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {content.length}/{MAX}
        </span>
        <Button type="submit" size="sm" loading={mutation.isPending} disabled={!content.trim()}>
          Registrar interacción
        </Button>
      </div>
    </form>
  );
}

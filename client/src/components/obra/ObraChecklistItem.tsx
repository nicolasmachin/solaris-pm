import { useEffect, useState } from "react";
import { Check, Trash2 } from "lucide-react";

import type { ObraChecklistItem as Item } from "../../api/obra.api";

interface Props {
  item: Item;
  busy: boolean;
  onToggle: (next: "OK" | "PENDING") => void;
  onSaveObservation: (observation: string) => void;
  onDelete: () => void;
}

export function ObraChecklistItem({ item, busy, onToggle, onSaveObservation, onDelete }: Props) {
  const isOk = item.status === "OK";
  const [obs, setObs] = useState(item.observation ?? "");

  // Mantener el textarea en sync si el item cambia desde el server (refetch).
  useEffect(() => {
    setObs(item.observation ?? "");
  }, [item.observation]);

  const dirty = obs !== (item.observation ?? "");

  return (
    <div className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      {/* Checkbox de estado: área tappable de 44px con el check visual de 20px
          centrado adentro (cómodo de marcar con el dedo). */}
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggle(isOk ? "PENDING" : "OK")}
        aria-label={isOk ? "Marcar como pendiente" : "Marcar como OK"}
        className="tap-target -my-2 -ml-2 shrink-0 self-start disabled:opacity-50"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
            isOk
              ? "border-green-500 bg-green-500 text-white"
              : "border-[var(--color-border)] bg-transparent"
          }`}
        >
          {isOk && <Check size={13} strokeWidth={3} />}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-medium ${
                  isOk
                    ? "text-[var(--color-text-muted)] line-through"
                    : "text-[var(--color-text-primary)]"
                }`}
              >
                {item.name}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isOk
                    ? "bg-green-500/15 text-green-500"
                    : "bg-[var(--color-border)]/50 text-[var(--color-text-muted)]"
                }`}
              >
                {isOk ? "OK" : "Pendiente"}
              </span>
            </div>
            {item.description && (
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{item.description}</p>
            )}
          </div>

          {item.isCustom && (
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              aria-label="Eliminar ítem"
              className="tap-target shrink-0 rounded text-[var(--color-text-muted)] hover:bg-red-600/10 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Observación */}
        <div className="mt-2">
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            onBlur={() => {
              if (dirty) onSaveObservation(obs);
            }}
            placeholder="Observación…"
            rows={obs ? 2 : 1}
            className="w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

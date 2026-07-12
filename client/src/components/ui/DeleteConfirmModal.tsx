import { useEffect, useState } from "react";

import { Sheet } from "./Sheet";
import { Button } from "./Button";

// Confirmación anti-accidente para borrados: mostramos un número al azar (1-9)
// y el usuario tiene que escribirlo en letras para habilitar "Borrar". Rápido,
// pero suficiente para que nadie borre de un clic sin querer.
const NUM_WORDS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];

function randomDigit(): number {
  return 1 + Math.floor(Math.random() * 9);
}

interface DeleteConfirmModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Borrar",
  loading = false,
  onConfirm,
  onClose,
}: DeleteConfirmModalProps) {
  const [num, setNum] = useState(randomDigit);
  const [input, setInput] = useState("");

  // Cada vez que se abre: número nuevo + input limpio.
  useEffect(() => {
    if (open) {
      setNum(randomDigit());
      setInput("");
    }
  }, [open]);

  const ok = input.trim().toLowerCase() === NUM_WORDS[num];

  function handleConfirm() {
    if (ok && !loading) onConfirm();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" size="sm" onClick={handleConfirm} loading={loading} disabled={!ok}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {description && <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>}
        <div className="text-sm text-[var(--color-text-secondary)]">
          Para confirmar, escribí el número{" "}
          <span className="font-mono text-lg font-bold text-[var(--color-text-primary)]">{num}</span>{" "}
          en letras:
        </div>
        <input
          type="text"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleConfirm();
          }}
          placeholder="el número en letras…"
          disabled={loading}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-danger-text)] focus:outline-none"
        />
      </div>
    </Sheet>
  );
}

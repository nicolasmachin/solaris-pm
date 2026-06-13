import { useRef, useState } from "react";
import { X } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

// Lista de direcciones como chips: Enter o coma agrega, la cruz quita, Backspace
// (con input vacío) borra el último, las direcciones inválidas se marcan en rojo.
export function RecipientChips({ value, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const addr = raw.trim().replace(/,$/, "").trim();
    if (!addr) return;
    onChange([...value, addr]);
    setDraft("");
  }

  function removeAt(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      removeAt(value.length - 1);
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`flex min-h-[38px] w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-[var(--color-bg-app)] px-2 py-1.5 ${
        focused ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30" : "border-[var(--color-border)]"
      }`}
    >
      {value.map((addr, idx) => {
        const bad = !isEmail(addr);
        return (
          <span
            key={`${addr}-${idx}`}
            title={bad ? "Dirección inválida" : undefined}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${
              bad
                ? "border-rose-400/60 bg-rose-500/10 text-rose-500"
                : "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)]"
            }`}
          >
            {addr}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(idx);
              }}
              className="opacity-70 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          add(draft); // commitea lo que haya quedado escrito
        }}
        placeholder={value.length === 0 ? placeholder ?? "agregar…" : ""}
        className="min-w-[90px] flex-1 border-0 bg-transparent py-0.5 text-sm text-[var(--color-text-primary)] outline-none"
      />
    </div>
  );
}

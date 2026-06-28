import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";

import { useIsMobile } from "../../../hooks/useIsMobile";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

type FieldType = "email" | "tel" | "date";

interface EditableCellProps {
  value: string | null;
  type: FieldType;
  canEdit: boolean;
  // Guarda el valor nuevo (null = vaciar). Debe rechazar (throw) en error para
  // que la celda muestre el mensaje del server.
  onSave: (newValue: string | null) => Promise<void>;
  // Render en modo lectura (default: el valor crudo o el placeholder).
  render?: (value: string | null) => ReactNode;
  placeholder?: string;
  ariaLabel?: string;
}

// Celda editable inline: hover→lápiz; click lápiz (o click en celda vacía)→input;
// Enter/blur con cambios→guarda; Esc→cancela; loading visible; error debajo sin
// perder lo tipeado. Si canEdit=false, render solo lectura sin lápiz.
export function EditableCell({
  value,
  type,
  canEdit,
  onSave,
  render,
  placeholder = "—",
  ariaLabel,
}: EditableCellProps) {
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Evita un commit espurio del blur que dispara el desmontaje del input (tras
  // guardar o cancelar con Esc).
  const skipBlurRef = useRef(false);

  useEffect(() => {
    if (!editing) return;
    setDraft(value ?? "");
    setError(null);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [editing, value]);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    if (canEdit) setEditing(true);
  }

  function closeNoSave() {
    skipBlurRef.current = true;
    setEditing(false);
    setError(null);
  }

  async function commit() {
    const normalized = draft.trim();
    const newValue = normalized === "" ? null : normalized;
    if ((value ?? "") === (newValue ?? "")) {
      closeNoSave();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(newValue);
      skipBlurRef.current = true;
      setSaving(false);
      setEditing(false);
    } catch (err) {
      setSaving(false);
      setError(getApiErr(err) ?? "No se pudo guardar");
      inputRef.current?.focus();
    }
  }

  if (editing) {
    return (
      <div className="min-w-[130px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type={type}
            value={draft}
            disabled={saving}
            aria-label={ariaLabel}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                closeNoSave();
              }
            }}
            onBlur={() => {
              if (skipBlurRef.current) {
                skipBlurRef.current = false;
                return;
              }
              if (!saving) void commit();
            }}
            className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-app)] px-1.5 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none"
          />
          {saving && (
            <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
          )}
        </div>
        {error && <p className="mt-0.5 text-[10px] text-[var(--color-danger-text)]">{error}</p>}
      </div>
    );
  }

  const isEmpty = (value ?? "") === "";
  const content: ReactNode = render
    ? render(value)
    : isEmpty
      ? <span className="text-[var(--color-text-muted)]">{placeholder}</span>
      : value;

  if (!canEdit) return <>{content}</>;

  return (
    <div
      className="group/cell relative flex items-center gap-1 pr-5"
      onClick={isEmpty ? startEdit : undefined}
    >
      <span className={isEmpty ? "cursor-pointer" : undefined}>{content}</span>
      <button
        type="button"
        onClick={startEdit}
        aria-label={ariaLabel ? `Editar ${ariaLabel}` : "Editar"}
        className={`absolute right-0 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ${
          isMobile ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100"
        }`}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

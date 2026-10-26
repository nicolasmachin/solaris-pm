import { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listRolesAsignables } from "../../api/documentacion.api";

export const inputClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]";

export const labelClass = "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";

/** "2026-10-22" o un ISO completo → "22/10/2026". */
export function fmtFecha(iso: string | null | undefined) {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function fmtPeso(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mensajeError(e: unknown, porDefecto: string) {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto;
}

/** Quién ve el documento: un tilde por rol, con "todos" y "ninguno". */
export function RolesCheckboxes({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data: roles = [] } = useQuery({
    queryKey: ["documentacion", "roles"],
    queryFn: listRolesAsignables,
  });
  const sel = new Set(value);
  const toggle = (id: string) => onChange(sel.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-xs">
        <button type="button" className="text-[var(--color-accent)] hover:underline" onClick={() => onChange(roles.map((r) => r.id))}>
          Todos
        </button>
        <button type="button" className="text-[var(--color-text-muted)] hover:underline" onClick={() => onChange([])}>
          Ninguno
        </button>
      </div>
      <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-2 sm:grid-cols-2">
        {roles.map((r) => (
          <label key={r.id} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} />
            {r.label}
          </label>
        ))}
      </div>
      {value.length === 0 && (
        <p className="text-[11px] text-amber-400">Sin roles, solo lo ve quien gestiona Documentación.</p>
      )}
    </div>
  );
}

/**
 * Texto largo recortado a unas líneas, con «Ver más / Ver menos». El botón
 * aparece solo si el texto de verdad no entra.
 */
export function TextoRecortado({ texto, lineas = 4, className = "" }: { texto: string; lineas?: number; className?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cortado, setCortado] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !abierto) setCortado(el.scrollHeight > el.clientHeight + 1);
  }, [texto, abierto]);
  return (
    <span className={className}>
      <span
        ref={ref}
        className="block"
        style={
          abierto
            ? undefined
            : { display: "-webkit-box", WebkitLineClamp: lineas, WebkitBoxOrient: "vertical", overflow: "hidden" }
        }
      >
        {texto}
      </span>
      {(cortado || abierto) && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="mt-0.5 text-[11px] font-medium text-[var(--color-accent)] hover:underline"
        >
          {abierto ? "Ver menos" : "Ver más"}
        </button>
      )}
    </span>
  );
}

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { apiClient } from "../../api/axios";

// ─── Tipos y API ────────────────────────────────────────────────────────────

export interface ActiveUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Reutiliza el mismo endpoint/queryKey que UserSelect (["users","assignable"]),
// de modo que el cache se comparte entre ambos selectores.
async function getActiveUsers(): Promise<ActiveUser[]> {
  const { data } = await apiClient.get<ActiveUser[]>("/api/users/assignable");
  return data;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTE = [
  "#378ADD", "#1D9E75", "#D85A30", "#7F77DD", "#BA7517",
  "#C2557B", "#3B9E9E", "#8E44AD", "#16A085", "#D4861F",
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Avatar({ user, size = 22 }: { user: ActiveUser; size?: number }) {
  return (
    <span
      className="flex items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: avatarColor(user.id),
      }}
      aria-hidden="true"
    >
      {getInitials(user.name)}
    </span>
  );
}

// ─── Componente principal ───────────────────────────────────────────────────

export interface MultiUserSelectProps {
  /** ids de los usuarios seleccionados */
  value: string[];
  onChange: (userIds: string[]) => void;
  disabled?: boolean;
  ariaLabel?: string;
  /** Placeholder cuando no hay nadie seleccionado */
  placeholder?: string;
  className?: string;
}

export function MultiUserSelect({
  value,
  onChange,
  disabled,
  ariaLabel = "Seleccionar asignados",
  placeholder = "Sin asignar",
  className = "",
}: MultiUserSelectProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLLIElement[]>([]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", "assignable"],
    queryFn: getActiveUsers,
    staleTime: 5 * 60_000,
  });

  const users = useMemo(() => data ?? [], [data]);
  const selectedSet = useMemo(() => new Set(value), [value]);
  const selectedUsers = useMemo(
    () => users.filter((u) => selectedSet.has(u.id)),
    [users, selectedSet],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return users;
    return users.filter(
      (u) => normalize(u.name).includes(q) || normalize(u.email).includes(q),
    );
  }, [users, query]);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Al abrir: reset búsqueda + foco + highlight
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightIdx(0);
    const t = setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (highlightIdx >= filtered.length) setHighlightIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, highlightIdx]);

  useEffect(() => {
    optionsRef.current[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  function toggle(userId: string) {
    if (selectedSet.has(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
    // Se mantiene el dropdown abierto para permitir seleccionar varios.
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const u = filtered[highlightIdx];
      if (u) toggle(u.id);
      return;
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`flex w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-text-secondary)] focus:border-[var(--color-accent)] focus:outline-none ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
      >
        {selectedUsers.length > 0 ? (
          <span className="flex flex-1 flex-wrap items-center gap-1 text-left">
            {selectedUsers.map((u) => (
              <span
                key={u.id}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] pl-1 pr-1.5 py-0.5"
              >
                <Avatar user={u} size={16} />
                <span className="text-[11px] text-[var(--color-text-primary)]">{u.name}</span>
                {!disabled ? (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Quitar a ${u.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(u.id);
                    }}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <X size={11} />
                  </span>
                ) : null}
              </span>
            ))}
          </span>
        ) : (
          <span className="flex-1 truncate text-left text-[var(--color-text-muted)]">
            {placeholder}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-[var(--color-text-muted)]" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIdx(0);
              }}
              onKeyDown={handleKeyDown}
              aria-label="Buscar usuario"
              aria-controls={listboxId}
              placeholder="Buscar…"
              className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
            />
          </div>
          {isLoading ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
              Cargando usuarios…
            </p>
          ) : isError ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
              No se pudieron cargar los usuarios.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
              Sin resultados
            </p>
          ) : (
            <ul
              id={listboxId}
              role="listbox"
              aria-multiselectable="true"
              className="max-h-72 overflow-y-auto py-1"
            >
              {filtered.map((u, idx) => {
                const isHighlighted = idx === highlightIdx;
                const isSelected = selectedSet.has(u.id);
                return (
                  <li
                    key={u.id}
                    ref={(el) => {
                      if (el) optionsRef.current[idx] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => toggle(u.id)}
                    className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm ${
                      isHighlighted ? "bg-[var(--color-bg-card-hover)]" : ""
                    }`}
                  >
                    <Avatar user={u} size={22} />
                    <span className="flex-1 truncate text-[var(--color-text-primary)]">
                      {u.name}
                    </span>
                    <span className="shrink-0 rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                      {u.role}
                    </span>
                    {isSelected ? (
                      <Check size={14} className="shrink-0 text-[var(--color-accent)]" />
                    ) : (
                      <span className="w-3.5 shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

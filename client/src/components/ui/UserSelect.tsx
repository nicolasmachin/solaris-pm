import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Check, Search } from "lucide-react";
import { apiClient } from "../../api/axios";

// ─── Tipos y API ────────────────────────────────────────────────────────────

export interface ActiveUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Llama al endpoint que filtra clientes del portal. Ningún selector de
// asignación debe mostrar PORTAL_CLIENTs — esa decisión está centralizada
// en el backend (GET /api/users/assignable). Si en algún momento aparece
// un caso donde un consumer SÍ necesita mostrar clientes del portal,
// agregar una prop opcional aquí en lugar de volver a /users/active.
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

// Genera un color determinístico basado en el id del usuario, para que cada
// avatar tenga un color distintivo pero estable entre renders.
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

// ─── Componentes internos ───────────────────────────────────────────────────

function Avatar({
  user,
  size = 24,
}: {
  user: ActiveUser | null;
  size?: number;
}) {
  if (!user) {
    return (
      <span
        className="flex items-center justify-center rounded-full bg-[var(--color-border)] text-[var(--color-text-muted)]"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        ?
      </span>
    );
  }
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

export interface UserSelectProps {
  /** id del usuario seleccionado, o null para "sin asignar" */
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
  /** Etiqueta accesible del selector */
  ariaLabel?: string;
  /** Placeholder cuando value=null */
  placeholder?: string;
  /** Mostrar o no la opción "Sin asignar" al tope */
  allowUnassigned?: boolean;
  /** Texto para la opción "Sin asignar" */
  unassignedLabel?: string;
  className?: string;
}

export function UserSelect({
  value,
  onChange,
  disabled,
  ariaLabel = "Seleccionar responsable",
  placeholder = "Sin asignar",
  allowUnassigned = true,
  unassignedLabel = "Sin asignar",
  className = "",
}: UserSelectProps) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLLIElement[]>([]);

  // queryKey "assignable" para que el cache no comparta con consumers
  // que todavía consultan /api/users/active (ej. MisTareas usa esa key
  // para el banner informativo y devuelve un shape distinto).
  const { data, isLoading, isError } = useQuery({
    queryKey: ["users", "assignable"],
    queryFn: getActiveUsers,
    staleTime: 5 * 60_000, // 5 min
  });

  const users = useMemo(() => data ?? [], [data]);
  const selected = useMemo(
    () => users.find((u) => u.id === value) ?? null,
    [users, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return users;
    return users.filter(
      (u) => normalize(u.name).includes(q) || normalize(u.email).includes(q),
    );
  }, [users, query]);

  // Lista final con la opción "Sin asignar" al tope (si aplica)
  const options = useMemo<Array<{ kind: "unassigned" } | { kind: "user"; user: ActiveUser }>>(() => {
    const list: Array<{ kind: "unassigned" } | { kind: "user"; user: ActiveUser }> = [];
    if (allowUnassigned && (!query.trim() || normalize(unassignedLabel).includes(normalize(query.trim())))) {
      list.push({ kind: "unassigned" });
    }
    for (const u of filtered) list.push({ kind: "user", user: u });
    return list;
  }, [filtered, allowUnassigned, unassignedLabel, query]);

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

  // Al abrir: reset búsqueda + foco al search + resetear highlight
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlightIdx(0);
    const t = setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  // Mantener el highlight dentro de rango cuando cambia la lista filtrada
  useEffect(() => {
    if (highlightIdx >= options.length) setHighlightIdx(Math.max(0, options.length - 1));
  }, [options.length, highlightIdx]);

  // Scroll al highlight
  useEffect(() => {
    optionsRef.current[highlightIdx]?.scrollIntoView({ block: "nearest" });
  }, [highlightIdx]);

  function choose(idx: number) {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.kind === "unassigned" ? null : opt.user.id);
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(options.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      choose(highlightIdx);
      return;
    }
  }

  const triggerLabel = selected ? selected.name : placeholder;

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
        <Avatar user={selected} size={22} />
        <span className={`flex-1 truncate text-left ${selected ? "" : "text-[var(--color-text-muted)]"}`}>
          {triggerLabel}
        </span>
        {selected ? (
          <span className="shrink-0 rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
            {selected.role}
          </span>
        ) : null}
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
          ) : options.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
              Sin resultados
            </p>
          ) : (
            <ul
              id={listboxId}
              role="listbox"
              className="max-h-72 overflow-y-auto py-1"
            >
              {options.map((opt, idx) => {
                const isHighlighted = idx === highlightIdx;
                const isSelected =
                  opt.kind === "unassigned" ? value === null : value === opt.user.id;
                return (
                  <li
                    key={opt.kind === "unassigned" ? "__unassigned" : opt.user.id}
                    ref={(el) => {
                      if (el) optionsRef.current[idx] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onClick={() => choose(idx)}
                    className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm ${
                      isHighlighted ? "bg-[var(--color-bg-card-hover)]" : ""
                    }`}
                  >
                    {opt.kind === "unassigned" ? (
                      <>
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-[var(--color-text-muted)] text-[var(--color-text-muted)]">
                          —
                        </span>
                        <span className="flex-1 truncate text-[var(--color-text-secondary)]">
                          {unassignedLabel}
                        </span>
                      </>
                    ) : (
                      <>
                        <Avatar user={opt.user} size={22} />
                        <span className="flex-1 truncate text-[var(--color-text-primary)]">
                          {opt.user.name}
                        </span>
                        <span className="shrink-0 rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                          {opt.user.role}
                        </span>
                      </>
                    )}
                    {isSelected ? (
                      <Check size={14} className="shrink-0 text-[var(--color-accent)]" />
                    ) : null}
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

import {
  TIPOS_CALENDARIO,
  TIPO_CALENDARIO_META,
  type TipoCalendario,
} from "../../api/agenda.api";

interface Props {
  muestra: (t: TipoCalendario) => boolean;
  todosVisibles: boolean;
  onToggle: (t: TipoCalendario) => void;
  onTodos: () => void;
  counts: Map<TipoCalendario, number>;
}

/**
 * Filtro por tipo de evento. Mismo lenguaje visual que el filtro por equipo que
 * ya existe arriba (píldoras con punto de color y conteo), para que se lean como
 * dos cortes de lo mismo y no como dos controles distintos.
 */
export function FiltrosTipo({ muestra, todosVisibles, onToggle, onTodos, counts }: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
        Mostrar
      </span>
      <button
        type="button"
        onClick={onTodos}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-colors ${
          todosVisibles
            ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]"
            : "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        }`}
      >
        Todo
      </button>
      {TIPOS_CALENDARIO.map((tipo) => {
        const meta = TIPO_CALENDARIO_META[tipo];
        const activo = muestra(tipo);
        // Cuando están todos prendidos ninguno se resalta: resaltar todo es no
        // resaltar nada y además compite con el botón "Todo".
        const destacado = activo && !todosVisibles;
        return (
          <button
            key={tipo}
            type="button"
            onClick={() => onToggle(tipo)}
            title={meta.label}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition-colors ${
              activo
                ? "text-[var(--color-text-primary)]"
                : "text-[var(--color-text-muted)] line-through opacity-60 hover:opacity-100"
            }`}
            style={{
              background: destacado ? `${meta.color}26` : "var(--color-bg-card)",
              borderColor: destacado ? meta.color : "var(--color-border)",
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
            <span>{meta.label}</span>
            <span className="opacity-60">({counts.get(tipo) ?? 0})</span>
          </button>
        );
      })}
    </div>
  );
}

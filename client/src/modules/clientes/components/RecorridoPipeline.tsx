import { AlertTriangle } from "lucide-react";

import type { ClienteRecorrido, RecorridoCheck } from "../../../api/clientes.api";

// El pipeline del recorrido del cliente: las tres etapas como bloques, con el
// mismo lenguaje visual que el pipeline del proyecto (mismo estado, mismos dots,
// mismos colores) para que se lean igual sin tener que aprender dos cosas.
//
// La diferencia con el del proyecto es qué significa "avance": acá no lo mueve la
// obra sino los pasos de acompañamiento, y una etapa puede estar vencida sin que
// eso frene nada. Por eso el rojo dice "hay algo vencido", no "está bloqueado".

export const BLOQUES: Array<{
  codigo: ClienteRecorrido;
  corto: string;
  /** Rótulo del bloque en el listado. */
  label: string;
  largo: string;
}> = [
  { codigo: "E1", corto: "Pre-obra", label: "Pre-obra", largo: "De la venta a la obra" },
  { codigo: "E2", corto: "Habilitación", label: "Habilitación", largo: "De la obra a la habilitación" },
  { codigo: "E3", corto: "Post-habilitación", label: "Post-habilitación", largo: "Puesta en marcha y acompañamiento" },
];

type Estado = "COMPLETED" | "IN_PROGRESS" | "PENDING" | "VENCIDO";

function estadoDe(checks: RecorridoCheck[]): Estado {
  if (checks.some((c) => c.vencido)) return "VENCIDO";
  if (checks.length > 0 && checks.every((c) => c.completado)) return "COMPLETED";
  if (checks.some((c) => c.completado)) return "IN_PROGRESS";
  return "PENDING";
}

const BLOCK: Record<Estado, string> = {
  COMPLETED: "bg-[var(--color-pipe-done-bg)] border-[var(--color-pipe-done-border)]",
  IN_PROGRESS: "bg-[var(--color-pipe-active-bg)] border-[var(--color-pipe-active-border)]",
  PENDING: "bg-[var(--color-bg-card-hover)] border-[var(--color-border-hover)]",
  VENCIDO: "bg-[var(--color-danger-bg)] border-[var(--color-danger-text)]/40",
};

const HEADER: Record<Estado, string> = {
  COMPLETED: "text-[var(--color-pipe-done-label)]",
  IN_PROGRESS: "text-[var(--color-pipe-active-label)]",
  PENDING: "text-[var(--color-text-primary)]",
  VENCIDO: "text-[var(--color-danger-text)]",
};

function Dot({ c }: { c: RecorridoCheck }) {
  const color = c.completado
    ? "bg-[var(--color-pipe-done-dot)]"
    : c.vencido
      ? "bg-[var(--color-danger-text)]"
      : "bg-[var(--color-text-muted)]";
  return <span className={`mt-1 inline-block h-[5px] w-[5px] shrink-0 rounded-full ${color}`} />;
}

function Bloque({
  codigo,
  corto,
  largo,
  checks,
  actual,
  seleccionado,
  onClick,
}: {
  codigo: ClienteRecorrido;
  corto: string;
  largo: string;
  checks: RecorridoCheck[];
  /** Es la etapa en la que está el cliente hoy. */
  actual: boolean;
  seleccionado: boolean;
  onClick: () => void;
}) {
  const estado = estadoDe(checks);
  const hechos = checks.filter((c) => c.completado).length;
  const pct = checks.length ? Math.round((hechos / checks.length) * 100) : 0;
  const vencidos = checks.filter((c) => c.vencido).length;
  // Se muestran los pendientes primero: es lo que hay para hacer.
  const visibles = [...checks].sort((a, b) => Number(a.completado) - Number(b.completado)).slice(0, 3);
  const extra = checks.length - visibles.length;

  return (
    <button
      type="button"
      onClick={onClick}
      title={largo}
      className="w-full min-w-0 text-left transition-opacity hover:opacity-80 md:flex-1"
    >
      <p className={`mb-1.5 truncate font-mono text-[11px] uppercase tracking-[0.05em] ${HEADER[estado]}`}>
        {codigo}. {corto}
        {actual && <span className="ml-1.5 normal-case tracking-normal text-[var(--color-accent)]">· acá está</span>}
      </p>

      <div
        className={`min-h-[96px] rounded-md border px-3 py-2.5 ${BLOCK[estado]} ${
          seleccionado ? "ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg-app)]" : ""
        }`}
      >
        <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold">
          {estado === "COMPLETED" ? (
            <span className="text-[var(--color-pipe-done-title)]">✓ Completo 100%</span>
          ) : estado === "VENCIDO" ? (
            <span className="inline-flex items-center gap-1 text-[var(--color-danger-text)]">
              <AlertTriangle className="h-3 w-3" />
              {vencidos} vencido{vencidos === 1 ? "" : "s"} · {pct}%
            </span>
          ) : estado === "IN_PROGRESS" ? (
            <span className="text-[var(--color-pipe-active-title)]">▶ En curso {pct}%</span>
          ) : (
            <span className="font-medium text-[var(--color-text-primary)]">◌ Sin empezar 0%</span>
          )}
          <span className="ml-auto font-normal text-[var(--color-text-muted)]">
            {hechos}/{checks.length}
          </span>
        </div>

        <ul className="space-y-[3px]">
          {visibles.map((c) => (
            <li key={c.id} className="flex items-start gap-1.5 text-[11px]">
              <Dot c={c} />
              <span
                className={`truncate ${
                  c.completado ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]"
                }`}
              >
                {c.titulo}
              </span>
            </li>
          ))}
          {extra > 0 && <li className="text-[10px] text-[var(--color-text-muted)]">+ {extra} más</li>}
        </ul>
      </div>
    </button>
  );
}

export function RecorridoPipeline({
  checks,
  etapaActual,
  seleccionada,
  onSelect,
}: {
  checks: RecorridoCheck[];
  etapaActual: ClienteRecorrido | null;
  seleccionada: ClienteRecorrido;
  onSelect: (r: ClienteRecorrido) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
        Recorrido del cliente
      </p>
      <div className="flex flex-col gap-2 md:flex-row">
        {BLOQUES.map((b) => (
          <Bloque
            key={b.codigo}
            codigo={b.codigo}
            corto={b.corto}
            largo={b.largo}
            checks={checks.filter((c) => c.recorrido === b.codigo)}
            actual={etapaActual === b.codigo}
            seleccionado={seleccionada === b.codigo}
            onClick={() => onSelect(b.codigo)}
          />
        ))}
      </div>
    </div>
  );
}

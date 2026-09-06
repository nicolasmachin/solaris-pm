import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Circle, Phone } from "lucide-react";

import { type ClienteListItem, getRecorrido } from "../../../api/clientes.api";
import { Spinner } from "../../../components/ui/Spinner";

// Colores por bloque: mismo código que el resto del módulo (E1 → E2 → E3).
const BLOQUE_COLOR: Record<string, string> = {
  E1: "border-t-blue-500",
  E2: "border-t-amber-500",
  E3: "border-t-emerald-500",
};

function diasTexto(d: number | null): string {
  if (d === null) return "Sin contacto";
  if (d === 0) return "hoy";
  return `${d} d`;
}

function FilaCliente({ c, onClick }: { c: ClienteListItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-bg-card-hover)] ${
        c.avisoHabilitacionPendiente
          ? "border-[var(--color-danger-text)]/40 bg-[var(--color-danger-bg)]/30"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
      }`}
    >
      {/* Alerta con plazo: se apaga cuando se registra el aviso. */}
      {c.avisoHabilitacionPendiente ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-danger-text)]" />
      ) : (
        <span className="w-4 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">{c.nombre}</p>
        <p className="truncate text-[11px] text-[var(--color-text-muted)]">
          {c.etapa?.pipeline.label ?? "Sin pipeline"}
        </p>
      </div>

      {/* Novedad: es un "no leído", por eso NO reordena la lista. */}
      {c.hayNovedad && (
        <Circle
          className="h-2 w-2 shrink-0 fill-[var(--color-accent)] text-[var(--color-accent)]"
          aria-label="Hay algo nuevo"
        />
      )}

      <span
        className={`shrink-0 text-[11px] tabular-nums ${
          c.fueraDeCadencia
            ? "font-semibold text-[var(--color-danger-text)]"
            : "text-[var(--color-text-muted)]"
        }`}
      >
        {diasTexto(c.diasSinContacto)}
      </span>
    </button>
  );
}

export function RecorridoPage() {
  const navigate = useNavigate();
  const [soloPendientes, setSoloPendientes] = useState(false);

  const { data: bloques, isLoading } = useQuery({
    queryKey: ["recorrido"],
    queryFn: () => getRecorrido(),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size={24} /></div>;
  }
  if (!bloques) {
    return <p className="py-12 text-center text-sm text-[var(--color-danger-text)]">No se pudo cargar el recorrido.</p>;
  }

  const filtrar = (cs: ClienteListItem[]) =>
    soloPendientes ? cs.filter((c) => c.fueraDeCadencia || c.avisoHabilitacionPendiente) : cs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          La cartera por etapa del recorrido, ordenada por días sin contacto. Las alertas con plazo van arriba.
        </p>
        <button
          type="button"
          onClick={() => setSoloPendientes((v) => !v)}
          className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
            soloPendientes
              ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          }`}
        >
          Solo lo que requiere acción
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {bloques.map((b) => {
          const clientes = filtrar(b.clientes);
          return (
            <section
              key={b.recorrido}
              className={`rounded-xl border border-t-4 border-[var(--color-border)] bg-[var(--color-bg-app)] ${BLOQUE_COLOR[b.recorrido] ?? ""}`}
            >
              <header className="border-b border-[var(--color-border)] p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {b.recorrido} · {b.nombreCorto}
                  </h2>
                  <span className="text-[11px] text-[var(--color-text-muted)]">{b.total}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">{b.nombreLargo}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  {b.conAlerta > 0 && (
                    <span className="font-medium text-[var(--color-danger-text)]">{b.conAlerta} con alerta</span>
                  )}
                  {b.fueraDeCadencia > 0 && (
                    <span className="text-[var(--color-warning-text)]">{b.fueraDeCadencia} fuera de cadencia</span>
                  )}
                  {b.conNovedad > 0 && (
                    <span className="text-[var(--color-text-muted)]">{b.conNovedad} con novedad</span>
                  )}
                </div>
              </header>

              <div className="max-h-[calc(100vh-22rem)] space-y-1.5 overflow-y-auto p-2">
                {clientes.length === 0 ? (
                  <p className="px-1 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
                    {soloPendientes ? "Nada pendiente acá." : "Sin clientes en esta etapa."}
                  </p>
                ) : (
                  clientes.map((c) => (
                    <FilaCliente key={c.projectId} c={c} onClick={() => navigate(`/clientes/${c.projectId}`)} />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3 text-[var(--color-danger-text)]" /> alerta con plazo: hay que avisarle
        </span>
        <span className="flex items-center gap-1">
          <Circle className="h-2 w-2 fill-[var(--color-accent)] text-[var(--color-accent)]" /> novedad: hay algo para mirar
        </span>
        <span className="flex items-center gap-1">
          <Phone className="h-3 w-3" /> los días son desde el último contacto registrado
        </span>
      </p>
    </div>
  );
}

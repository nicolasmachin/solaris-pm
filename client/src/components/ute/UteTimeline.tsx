import { Check } from "lucide-react";

// Los diez hitos del trámite UTE. Es el MISMO componente que ve el cliente en su
// portal y que ve Experiencia Solar en la ficha: si fueran dos, tarde o temprano
// mostrarían cosas distintas del mismo trámite y el equipo no podría responder
// por lo que el cliente tiene delante.

export type UteTimelineEntry = {
  key: string;
  label: string;
  description: string;
  status: "completed" | "current" | "pending";
  completedAt: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  // Los hitos se guardan como fecha-sólo (medianoche UTC): se formatea en UTC
  // para mostrar el día tal como se cargó, sin que UTC−3 lo retroceda uno.
  return new Date(iso).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function UteTimeline({ items, compacto = false }: { items: UteTimelineEntry[]; compacto?: boolean }) {
  // Solo se marca "Último avance" mientras el trámite no esté terminado: si están
  // todos cumplidos, señalar el último no dice nada.
  const lastDoneIndex = items.reduce((acc, it, idx) => (it.completedAt ? idx : acc), -1);
  const allDone = items.length > 0 && items.every((it) => it.completedAt);
  const lastAdvanceIndex = allDone ? -1 : lastDoneIndex;

  return (
    <ol className="relative">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        // Modelo binario: hito con fecha = cumplido; sin fecha = pendiente.
        const done = item.status === "completed";
        return (
          <li key={item.key} className={`relative pl-8 ${compacto ? "pb-3" : "pb-5"} last:pb-0`}>
            {!isLast && (
              <span
                aria-hidden="true"
                className={`absolute bottom-0 left-[10px] top-5 w-0.5 ${
                  done ? "bg-emerald-500/40" : "bg-[var(--color-border)]"
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={
                done
                  ? "absolute left-1 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-emerald-500"
                  : "absolute left-1.5 top-2 h-[14px] w-[14px] rounded-full border border-[var(--color-border)] bg-[var(--color-bg-app)]"
              }
            >
              {done && <Check className="h-3 w-3 text-white" />}
            </span>
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p
                  className={
                    done
                      ? "text-sm font-medium text-[var(--color-text-primary)]"
                      : "text-sm text-[var(--color-text-muted)]"
                  }
                >
                  {item.label}
                  {i === lastAdvanceIndex && (
                    <span className="ml-2 align-middle rounded-full border border-[var(--color-border)] bg-[var(--color-bg-app)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
                      Último avance
                    </span>
                  )}
                </p>
                {item.completedAt && (
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                    {fmtDate(item.completedAt)}
                  </span>
                )}
              </div>
              {!compacto && (
                <p className={`mt-0.5 text-[11px] text-[var(--color-text-muted)] ${done ? "" : "italic"}`}>
                  {item.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

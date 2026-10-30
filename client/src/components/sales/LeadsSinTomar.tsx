import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, Inbox } from "lucide-react";
import toast from "react-hot-toast";

import { getLeadsSinTomar, tomarLead } from "../../api/leads.api";
import { usePermission } from "../../hooks/usePermission";

// Color propio de los leads sin tomar (no lo usa ninguna etapa): la franja de
// arriba de Ventas y las tarjetas del tablero.
export const SIN_TOMAR = { border: "#a855f7", fondo: "rgba(168,85,247,0.10)", texto: "#c084fc" };

function errorDe(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function hace(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

/** Tomar un lead sin vendedor. Invalida todo lo de Ventas que muestra el vendedor. */
export function useTomarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tomarLead(id),
    onSuccess: () => toast.success("Lead tomado: ya es tuyo"),
    onError: (err) => toast.error(errorDe(err) ?? "No se pudo tomar el lead"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["leads-sin-tomar"] });
      qc.invalidateQueries({ queryKey: ["lead-groups"] });
      qc.invalidateQueries({ queryKey: ["leads-flat"] });
      qc.invalidateQueries({ queryKey: ["lead-detail"] });
    },
  });
}

/**
 * Franja de arriba de Ventas: los leads que entraron sin vendedor, el que más
 * espera primero. La ve todo Ventas; "Tomar" solo quien tiene VENTAS:TOMAR_LEAD.
 * Sin leads sin tomar no se muestra.
 */
export function LeadsSinTomar({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const puedeTomar = usePermission("VENTAS", "TOMAR_LEAD");
  const { data = [] } = useQuery({ queryKey: ["leads-sin-tomar"], queryFn: getLeadsSinTomar, refetchInterval: 30_000 });
  const tomar = useTomarLead();
  if (data.length === 0) return null;

  return (
    <section className="rounded-xl border p-3" style={{ borderColor: SIN_TOMAR.border, background: SIN_TOMAR.fondo }}>
      <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: SIN_TOMAR.texto }}>
        <Inbox size={15} /> {data.length === 1 ? "1 lead sin tomar" : `${data.length} leads sin tomar`}
        <span className="font-normal text-[var(--color-text-muted)]">· el primero que lo toma se lo queda</span>
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {data.map((l) => (
          <div
            key={l.id}
            className="w-64 shrink-0 rounded-lg border bg-[var(--color-bg-card)] p-2.5"
            style={{ borderColor: SIN_TOMAR.border }}
          >
            <button type="button" onClick={() => onOpenLead(l.id)} className="block w-full text-left">
              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{l.clientName}</p>
              <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                {l.origen} · {hace(l.createdAt)}
              </p>
              {l.notes && <p className="mt-1 line-clamp-2 text-[11px] text-[var(--color-text-secondary)]">{l.notes}</p>}
            </button>
            {puedeTomar && (
              <button
                type="button"
                onClick={() => tomar.mutate(l.id)}
                disabled={tomar.isPending}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: SIN_TOMAR.border }}
              >
                <Hand size={13} /> Tomar
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

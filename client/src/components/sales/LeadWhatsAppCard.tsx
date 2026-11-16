import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, MessageCircle } from "lucide-react";

import { getWhatsAppDeLead, urlArchivoVentas } from "../../api/whatsapp.api";
import { ListaMensajes } from "../whatsapp/BandejaWhatsApp";

function haceCuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

/**
 * WhatsApp en el panel del lead: lo último que se habló por el número del asesor
 * y, si el cliente escribió y nadie le contestó, la alerta. El botón lleva a la
 * bandeja de Ventas con su conversación abierta. Sin número (ni propio ni, para
 * el admin, el del asesor del lead), no se muestra.
 */
export function LeadWhatsAppCard({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["whatsapp-lead", leadId],
    queryFn: () => getWhatsAppDeLead(leadId),
    refetchInterval: 30000,
  });
  if (!data?.hayNumero) return null;

  function abrir(telefono: string) {
    const q = new URLSearchParams({ tel: telefono });
    if (data?.asesorId) q.set("asesor", data.asesorId);
    navigate(`/ventas/whatsapp?${q.toString()}`);
  }

  return (
    <section className="mb-5 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </h3>
        {data.telefono && (
          <button
            type="button"
            onClick={() => abrir(data.sinContestar?.telefono ?? data.telefono!)}
            className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          >
            <MessageCircle className="h-3 w-3" />
            {data.mensajes.length > 0 ? "Abrir conversación" : "Escribirle"}
          </button>
        )}
      </div>

      {data.sinContestar && (
        <div className="flex gap-2 rounded-md bg-[var(--color-danger-bg)] p-2.5 text-[12px] text-[var(--color-danger-text)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Escribió {haceCuanto(data.sinContestar.desde)} y nadie le contestó</p>
            <p className="truncate opacity-90">«{data.sinContestar.texto}»</p>
          </div>
        </div>
      )}

      {!data.telefono ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">El lead no tiene un celular cargado.</p>
      ) : data.mensajes.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">Todavía no hay mensajes con este lead por WhatsApp.</p>
      ) : (
        <div className="wa-web wa-fondo rounded-md px-3 py-2">
          <ListaMensajes mensajes={data.mensajes} chica urlArchivo={(id) => urlArchivoVentas(id, data.asesorId)} />
        </div>
      )}
    </section>
  );
}

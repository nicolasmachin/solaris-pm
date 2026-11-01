import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, MessageCircle } from "lucide-react";

import { getWhatsAppDeProyecto } from "../../../api/whatsapp.api";
import { Burbuja } from "../../../components/whatsapp/BandejaWhatsApp";

function haceCuanto(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} día${d === 1 ? "" : "s"}`;
}

/** La consulta de WhatsApp de la ficha; la comparten la tarjeta y la alerta del encabezado. */
export function useWhatsAppDeProyecto(projectId: string | undefined) {
  return useQuery({
    queryKey: ["whatsapp-proyecto", projectId],
    queryFn: () => getWhatsAppDeProyecto(projectId!),
    enabled: !!projectId,
    refetchInterval: 30000,
  });
}

/** Lleva a la bandeja de Experiencia Solar con la conversación del cliente abierta. */
export function useAbrirWhatsApp() {
  const navigate = useNavigate();
  return (telefono: string) => navigate(`/clientes/whatsapp?tel=${encodeURIComponent(telefono)}`);
}

/**
 * WhatsApp en la ficha del cliente: lo último que se habló por el número general
 * y, si el cliente escribió y nadie le contestó, la alerta. El botón lleva a la
 * bandeja con su conversación abierta.
 */
export function ClienteWhatsAppCard({ projectId }: { projectId: string }) {
  const { data } = useWhatsAppDeProyecto(projectId);
  const abrir = useAbrirWhatsApp();
  if (!data) return null;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-primary)]">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </h3>
        {data.hayNumero && data.telefono && (
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

      {!data.hayNumero ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">Todavía no hay un número de WhatsApp conectado.</p>
      ) : !data.telefono ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">No tiene un celular cargado en la ficha.</p>
      ) : data.mensajes.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-muted)]">Todavía no hay mensajes con este cliente por WhatsApp.</p>
      ) : (
        <div className="space-y-1.5">
          {data.mensajes.map((m) => (
            <Burbuja key={m.id} m={m} chica />
          ))}
        </div>
      )}
    </div>
  );
}

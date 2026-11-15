import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { bandejaVentas } from "./whatsappVentas";

const API = bandejaVentas(null);

/**
 * Franja de Ventas: el WhatsApp del asesor. Si algún cliente escribió y no se le
 * contestó, en ámbar con quiénes. Sin número propio no se muestra, salvo al
 * admin si hay asesores con número.
 */
export function WhatsAppParaVentas() {
  const { data } = useQuery({ queryKey: [API.clave, "bandeja"], queryFn: API.getBandeja, refetchInterval: 30_000 });
  if (!data || (!data.numero && !data.asesores?.length)) return null;
  const esperan = data.conversaciones.filter((c) => c.sinContestar);

  return (
    <Link
      to="/ventas/whatsapp"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-[13px] hover:opacity-90 ${
        esperan.length
          ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]"
      }`}
    >
      <MessageCircle size={15} />
      {!data.numero ? (
        <span>WhatsApp: las bandejas de los asesores</span>
      ) : esperan.length ? (
        <>
          <span className="font-semibold">
            WhatsApp: {esperan.length === 1 ? "1 persona espera respuesta" : `${esperan.length} personas esperan respuesta`}
          </span>
          <span className="text-[var(--color-text-muted)]">
            · {esperan.map((c) => c.cliente?.nombre ?? `+${c.telefono}`).slice(0, 3).join(", ")}
          </span>
        </>
      ) : (
        <span>
          WhatsApp: {data.conversaciones.length === 1 ? "1 conversación" : `${data.conversaciones.length} conversaciones`}
        </span>
      )}
      <span className="ml-auto text-[12px] text-[var(--color-accent)]">Ver y contestar →</span>
    </Link>
  );
}

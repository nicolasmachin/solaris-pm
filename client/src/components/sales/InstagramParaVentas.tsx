import { useQuery } from "@tanstack/react-query";
import { AtSign } from "lucide-react";
import { Link } from "react-router-dom";

import { getInstagramConversaciones } from "../../api/marketing.api";
import { porContestar, quedan } from "../marketing/BandejaInstagram";

/**
 * Franja de Ventas: las conversaciones de Instagram de potenciales clientes
 * (las que derivó el asistente, con lead o con celular). Si alguien espera
 * respuesta, en ámbar y con cuánto le queda a la ventana de Instagram. Sin
 * ninguna, no se muestra.
 */
export function InstagramParaVentas() {
  const { data = [] } = useQuery({
    queryKey: ["instagram-conversaciones", "ventas"],
    queryFn: () => getInstagramConversaciones("ventas"),
    refetchInterval: 30_000,
  });
  if (data.length === 0) return null;
  const esperan = data.filter(porContestar).sort((a, b) => (a.ventanaHasta ?? "").localeCompare(b.ventanaHasta ?? ""));

  return (
    <Link
      to="/ventas/instagram"
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-[13px] hover:opacity-90 ${
        esperan.length
          ? "border-amber-500/60 bg-amber-500/10 text-amber-300"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]"
      }`}
    >
      <AtSign size={15} />
      {esperan.length ? (
        <>
          <span className="font-semibold">
            Instagram: {esperan.length === 1 ? "1 persona espera respuesta" : `${esperan.length} personas esperan respuesta`}
          </span>
          <span className="text-[var(--color-text-muted)]">
            · {esperan.map((c) => c.nombre ?? (c.usuario ? `@${c.usuario}` : "sin nombre")).slice(0, 3).join(", ")}
            {quedan(esperan[0].ventanaHasta) && ` · a la primera le ${quedan(esperan[0].ventanaHasta)} para contestarle`}
          </span>
        </>
      ) : (
        <span>
          Instagram: {data.length === 1 ? "1 conversación" : `${data.length} conversaciones`} con potenciales clientes
        </span>
      )}
      <span className="ml-auto text-[12px] text-[var(--color-accent)]">Ver y contestar →</span>
    </Link>
  );
}

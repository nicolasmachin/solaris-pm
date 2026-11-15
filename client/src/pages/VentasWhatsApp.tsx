import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { getBandejaVentas } from "../api/whatsapp.api";
import { BandejaWhatsApp } from "../components/whatsapp/BandejaWhatsApp";
import { bandejaVentas } from "../components/sales/whatsappVentas";

// Ventas → WhatsApp: las conversaciones del número del asesor, que ve y usa solo
// él. El admin puede elegir cualquier asesor y usar su número.
// Desde el panel del lead se llega con ?tel=598… (y ?asesor= si es el admin).
export function VentasWhatsApp() {
  const [params, setParams] = useSearchParams();
  const asesor = params.get("asesor");
  const api = useMemo(() => bandejaVentas(asesor), [asesor]);
  // La misma consulta que la bandeja (se comparte): de acá salen los asesores.
  const { data } = useQuery({ queryKey: [api.clave, "bandeja"], queryFn: api.getBandeja, refetchInterval: 5000 });
  const asesores = data?.asesores ?? [];

  function elegir(id: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) next.set("asesor", id);
      else next.delete("asesor");
      next.delete("tel");
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to="/ventas" className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Volver a Ventas">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-[var(--color-text-primary)]">
          <MessageCircle className="h-5 w-5 text-[var(--color-accent)]" /> WhatsApp
        </h1>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          {asesor ? "El número de un asesor: lo que se mande sale desde su WhatsApp." : "Las conversaciones de tu número de Ventas."}
        </p>
        {asesores.length > 0 && (
          <select
            className="ml-auto rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-[13px] text-[var(--color-text-primary)]"
            value={asesor ?? ""}
            onChange={(e) => elegir(e.target.value)}
          >
            <option value="">Mi número</option>
            {asesores.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} · {a.telefono}
              </option>
            ))}
          </select>
        )}
      </div>
      <BandejaWhatsApp
        key={asesor ?? "propia"}
        api={api}
        telefonoInicial={params.get("tel")}
        sinNumero={
          asesor
            ? "Ese asesor no tiene un número de WhatsApp conectado."
            : asesores.length > 0
              ? "No tenés un número de WhatsApp de Ventas a tu nombre. Elegí arriba un asesor para ver su bandeja."
              : "No tenés un número de WhatsApp de Ventas a tu nombre. Se conecta desde Administración → WhatsApp, con uso «Ventas» y vos como responsable."
        }
      />
    </div>
  );
}

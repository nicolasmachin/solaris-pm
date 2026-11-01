import { useState } from "react";
import { AtSign, Megaphone, MessageCircle } from "lucide-react";

import { BandejaInstagram } from "../components/marketing/BandejaInstagram";
import { Automatizaciones, Consultas, Contactos, EstadoAsistente } from "../components/marketing/InstagramPanel";
import { usePermission } from "../hooks/usePermission";

// Marketing. Por ahora, Instagram: la bandeja de privados (contestar a mano,
// tomar la conversación, crear el lead), las automatizaciones del asistente,
// los contactos y las consultas por día. Ver docs/manual/20-marketing.md.

type Vista = "conversaciones" | "automatizaciones" | "contactos" | "consultas";

function Instagram() {
  const puedeEditar = usePermission("MARKETING", "EDIT");
  const [vista, setVista] = useState<Vista>("conversaciones");
  return (
    <div className="space-y-2">
      <EstadoAsistente />
      <div className="flex flex-wrap gap-1 text-[12px]">
        {(
          [
            ["conversaciones", "Conversaciones"],
            ["automatizaciones", "Automatizaciones"],
            ["contactos", "Contactos"],
            ["consultas", "Consultas por día"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setVista(k)}
            className={`rounded-md px-2.5 py-1 ${
              vista === k
                ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {vista === "conversaciones" && <BandejaInstagram />}
      {vista === "automatizaciones" && <Automatizaciones puedeEditar={puedeEditar} />}
      {vista === "contactos" && <Contactos />}
      {vista === "consultas" && <Consultas />}
    </div>
  );
}

export function Marketing() {
  const [canal, setCanal] = useState<"instagram" | "whatsapp">("instagram");
  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-[var(--color-text-primary)]">
          <Megaphone className="h-5 w-5 text-[var(--color-accent)]" /> Marketing
        </h1>
        <div className="flex gap-1 text-[13px]">
          <button
            type="button"
            onClick={() => setCanal("instagram")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 ${
              canal === "instagram"
                ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
            }`}
          >
            <AtSign size={14} /> Instagram
          </button>
          <button
            type="button"
            disabled
            title="Próximamente: los WhatsApp que llegan por los anuncios"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-2.5 py-1 text-[var(--color-text-muted)] opacity-60"
          >
            <MessageCircle size={14} /> WhatsApp <span className="text-[10px]">(próximamente)</span>
          </button>
        </div>
      </div>
      {canal === "instagram" && <Instagram />}
    </div>
  );
}

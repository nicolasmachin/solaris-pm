import { ArrowLeft, AtSign } from "lucide-react";
import { Link } from "react-router-dom";

import { BandejaInstagram } from "../components/marketing/BandejaInstagram";

// Ventas → Instagram: las conversaciones de potenciales clientes que pasó el
// asistente (derivadas, con lead o con celular), para contestarlas desde acá
// sin usar Instagram. Decisión de Nicolás del 1-nov-2026.

export function VentasInstagram() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link to="/ventas" className="rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Volver a Ventas">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-[var(--color-text-primary)]">
          <AtSign className="h-5 w-5 text-[var(--color-accent)]" /> Instagram
        </h1>
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Las personas que el asistente pasó a Ventas. Instagram deja contestarles hasta 24 horas después de su último mensaje.
        </p>
      </div>
      <BandejaInstagram de="ventas" />
    </div>
  );
}

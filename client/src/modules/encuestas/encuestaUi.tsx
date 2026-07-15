import { useState } from "react";
import { Star } from "lucide-react";

import { ESTADO_LABEL, type SurveyEstado, type SurveyTipo, TIPO_LABEL } from "../../api/encuestas.api";

const ESTADO_CLASS: Record<SurveyEstado, string> = {
  PENDIENTE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  RESPONDIDA: "bg-green-500/15 text-green-300 border-green-500/30",
};

const TIPO_CLASS: Record<SurveyTipo, string> = {
  OBRA: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  HABILITACION: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  ANIVERSARIO: "bg-teal-500/15 text-teal-300 border-teal-500/30",
};

export function EstadoBadge({ estado }: { estado: SurveyEstado }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ESTADO_CLASS[estado]}`}>
      {ESTADO_LABEL[estado]}
    </span>
  );
}

export function TipoBadge({ tipo, edicion }: { tipo: SurveyTipo; edicion?: number }) {
  const label = tipo === "ANIVERSARIO" && edicion && edicion > 0 ? `Aniversario · año ${edicion}` : TIPO_LABEL[tipo];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIPO_CLASS[tipo]}`}>
      {label}
    </span>
  );
}

// Estrellas de solo lectura para mostrar una nota (1-5). Nota baja (<=3) en rojo.
export function NotaStars({ nota }: { nota: number | null }) {
  if (nota == null) return <span className="text-[12px] text-[var(--color-text-muted)]">—</span>;
  const baja = nota <= 3;
  return (
    <span className="inline-flex items-center gap-0.5" title={`${nota}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={
            n <= nota
              ? baja
                ? "fill-red-400 text-red-400"
                : "fill-amber-400 text-amber-400"
              : "text-[var(--color-border)]"
          }
        />
      ))}
    </span>
  );
}

// Estrellas interactivas (portal): el cliente elige la nota.
export function StarRatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            size={30}
            className={n <= shown ? "fill-amber-400 text-amber-400" : "text-[var(--color-border)]"}
          />
        </button>
      ))}
    </div>
  );
}

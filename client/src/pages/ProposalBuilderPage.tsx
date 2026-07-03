import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getLead } from "../api/leads.api";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";

// Secciones del form (columna izquierda). Cada una es ancla de scroll
// (id="seccion-*") para la navegación desde la lista de faltantes (1.10).
const FORM_SECTIONS = [
  { id: "cliente", label: "Cliente" },
  { id: "tecnicos", label: "Datos técnicos del sistema" },
  { id: "cotizacion", label: "Cotización base (Variante A)" },
  { id: "items", label: "Ítems adicionales (Variante B)" },
  { id: "financiacion", label: "Financiación" },
  { id: "notas", label: "Notas del asesor" },
];

const H2 = "mb-3 text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]";
const PLACEHOLDER =
  "rounded-lg border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]";

// Constructor de propuestas v2. Página dedicada por lead: form izquierda +
// preview PDF en vivo derecha. Esqueleto de Fase F/1.6; las secciones, el
// autosave, el preview y la publicación llegan en los commits siguientes.
export function ProposalBuilderPage() {
  const { leadId = "" } = useParams();
  const navigate = useNavigate();

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: () => getLead(leadId),
    enabled: Boolean(leadId),
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (isError || !lead) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-text-muted)]">No se encontró el lead.</p>
        <Button variant="secondary" onClick={() => navigate("/ventas")}>
          Volver a Ventas
        </Button>
      </div>
    );
  }

  return (
    <div className="-m-6">
      {/* Sub-header sticky (bajo el header global de 52px) */}
      <div className="sticky top-[52px] z-20 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/95 px-6 py-2.5 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate("/ventas")}
            className="whitespace-nowrap text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            ← Volver al lead
          </button>
          <span className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            Propuesta · {lead.clientName}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[var(--color-text-muted)]">Autosave —</span>
          <Button size="sm" disabled>
            Publicar
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-6 px-6 py-6">
        {/* Form (izquierda, flujo normal: scrollea con la página) */}
        <div className="min-w-0 flex-1 space-y-8">
          {FORM_SECTIONS.map((s) => (
            <section key={s.id} id={`seccion-${s.id}`} className="scroll-mt-28">
              <h2 className={H2}>{s.label}</h2>
              <div className={PLACEHOLDER}>Próximamente</div>
            </section>
          ))}
          <section id="seccion-versiones" className="scroll-mt-28">
            <h2 className={H2}>Versiones publicadas</h2>
            <div className={PLACEHOLDER}>Próximamente</div>
          </section>
        </div>

        {/* Preview (derecha, sticky bajo el sub-header) */}
        <div
          className="sticky top-[104px] hidden w-[45%] shrink-0 lg:block"
          style={{ height: "calc(100vh - 148px)" }}
        >
          <div className="flex h-full items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            <p className="text-sm text-[var(--color-text-muted)]">Cargando preview…</p>
          </div>
        </div>
      </div>
    </div>
  );
}

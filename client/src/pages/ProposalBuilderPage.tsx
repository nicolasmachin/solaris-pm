import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getLead } from "../api/leads.api";
import { proposalsV2BuilderApi } from "../api/proposals-v2-builder.api";
import { AutosaveIndicator } from "../components/proposals-v2/AutosaveIndicator";
import { Button } from "../components/ui/Button";
import { Spinner } from "../components/ui/Spinner";
import { useDraftAutosave } from "../hooks/useDraftAutosave";
import { useProposalDefaults } from "../hooks/useProposalDefaults";
import { buildInitialDraftData, mergeDraft } from "../lib/proposalDraft";
import type { ProposalDraftData } from "../types/proposals-v2";

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

export function ProposalBuilderPage() {
  const { leadId = "" } = useParams();
  const navigate = useNavigate();

  const leadQuery = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: () => getLead(leadId),
    enabled: Boolean(leadId),
  });
  const defaultsQuery = useProposalDefaults();
  const draftQuery = useQuery({
    queryKey: ["proposal-draft", leadId],
    queryFn: () => proposalsV2BuilderApi.getDraft(leadId),
    enabled: Boolean(leadId),
  });

  // Estado del form. Se inicializa una sola vez cuando lead + defaults + draft
  // están cargados (draft guardado mergeado sobre la base de defaults+lead).
  const [data, setData] = useState<ProposalDraftData | null>(null);
  const [draftExisted, setDraftExisted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (leadQuery.isLoading || defaultsQuery.isLoading || draftQuery.isLoading) return;
    const lead = leadQuery.data;
    const defaults = defaultsQuery.data;
    if (!lead || !defaults?.data) return;
    const base = buildInitialDraftData(defaults.data, lead);
    setData(mergeDraft(base, draftQuery.data?.data));
    setDraftExisted(Boolean(draftQuery.data));
    initialized.current = true;
  }, [
    leadQuery.data,
    leadQuery.isLoading,
    defaultsQuery.data,
    defaultsQuery.isLoading,
    draftQuery.data,
    draftQuery.isLoading,
  ]);

  const autosave = useDraftAutosave({ leadId, data, enabled: data !== null, draftExisted });

  if (leadQuery.isLoading || defaultsQuery.isLoading || draftQuery.isLoading || !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-text-muted)]">No se encontró el lead.</p>
        <Button variant="secondary" onClick={() => navigate("/ventas")}>
          Volver a Ventas
        </Button>
      </div>
    );
  }

  const lead = leadQuery.data;

  return (
    <div className="-m-6">
      {/* Sub-header sticky */}
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
          <AutosaveIndicator
            status={autosave.status}
            lastSavedAt={autosave.lastSavedAt}
            onRetry={autosave.retryNow}
          />
          <Button size="sm" disabled>
            Publicar
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-6 px-6 py-6">
        {/* Form (izquierda) */}
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

        {/* Preview (derecha, sticky) */}
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

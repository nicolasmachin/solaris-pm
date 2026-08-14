import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Bug } from "lucide-react";

import { getLead } from "../../api/leads.api";
import { proposalsV2BuilderApi } from "../../api/proposals-v2-builder.api";
import { draftEquals, validateDraft } from "../../lib/proposalDraft";
import type { ProposalVariante } from "../../types/proposals-v2";
import { useDraftAutosave } from "../../hooks/useDraftAutosave";
import { useDraftPreview } from "../../hooks/useDraftPreview";
import { useProposalDefaults } from "../../hooks/useProposalDefaults";
import { useViabilityIndicators } from "../../hooks/useViabilityIndicators";
import { usePermission } from "../../hooks/usePermission";
import type { ProposalDraftData } from "../../types/proposals-v2";
import { Button } from "../ui/Button";
import { LargeModal } from "../ui/LargeModal";
import { Spinner } from "../ui/Spinner";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { CalculatorDebugDrawer } from "./CalculatorDebugDrawer";
import { ProposalForm } from "./ProposalForm";
import { ProposalPreview } from "./ProposalPreview";
import { PublishButton } from "./PublishButton";
import { PublishModal } from "./PublishModal";
import { ViabilityIndicators } from "./ViabilityIndicators";

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// Constructor de propuestas v2 como modal grande (rework post-Fase G). La lista de
// versiones ya NO vive acá: se ve en la sección de propuestas del panel del lead.
export function ProposalBuilderModal({
  leadId,
  onClose,
  variante = "RESIDENCIAL",
}: {
  leadId: string;
  onClose: () => void;
  // Qué cotizador abrió el usuario. Residencial y B2B son dos botones distintos
  // con borradores distintos, así que la variante viaja en todas las llamadas.
  variante?: ProposalVariante;
}) {
  const esEmpresa = variante === "EMPRESA";
  const leadQuery = useQuery({
    queryKey: ["lead-detail", leadId],
    queryFn: () => getLead(leadId),
    enabled: Boolean(leadId),
  });
  const defaultsQuery = useProposalDefaults();
  // El borrador se pide con init: si no existe lo crea el servidor con la
  // precarga, y siempre vuelve con el `data` completo. Por eso acá ya no hay
  // que armar la base ni mergear.
  const draftQuery = useQuery({
    queryKey: ["proposal-draft", leadId, variante],
    queryFn: () => proposalsV2BuilderApi.initDraft(leadId, variante),
    enabled: Boolean(leadId),
  });

  const [data, setData] = useState<ProposalDraftData | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (draftQuery.isLoading || !draftQuery.data) return;
    setData(draftQuery.data.data as ProposalDraftData);
    initialized.current = true;
  }, [draftQuery.data, draftQuery.isLoading]);

  // El borrador ya existe en la base apenas se abre el cotizador, así que el
  // autosave nunca tiene que crearlo y el preview está disponible de entrada.
  const autosave = useDraftAutosave({
    leadId,
    data,
    enabled: data !== null,
    draftExisted: true,
    variante,
  });
  const preview = useDraftPreview({
    leadId,
    savedTick: autosave.savedTick,
    enabled: data !== null,
    variante,
  });

  const versionsQuery = useQuery({
    queryKey: ["proposal-versions", leadId, true],
    queryFn: () => proposalsV2BuilderApi.listVersions(leadId, true),
    enabled: Boolean(leadId),
  });
  const nextVersion = versionsQuery.data?.length
    ? Math.max(...versionsQuery.data.map((v) => v.versionNumber)) + 1
    : 1;

  const validation = useMemo(() => (data ? validateDraft(data) : { ok: false, missing: [] }), [data]);
  const errors = useMemo(
    () => Object.fromEntries(validation.missing.map((m) => [m.path, "Requerido"])),
    [validation],
  );
  const autosaveBlocked = autosave.status === "error" || autosave.status === "error-final";

  // ─── Publicación ───────────────────────────────────────────────────────────
  const qc = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const latestPublished = useMemo(
    () =>
      (versionsQuery.data ?? [])
        .filter((v) => v.status === "PUBLISHED")
        .sort((a, b) => b.versionNumber - a.versionNumber)[0],
    [versionsQuery.data],
  );
  const latestVersionQuery = useQuery({
    queryKey: ["proposal-version", latestPublished?.id],
    queryFn: () => proposalsV2BuilderApi.getVersion(latestPublished!.id),
    enabled: publishOpen && Boolean(latestPublished),
  });
  const hasChanges =
    !latestVersionQuery.data || !(data && draftEquals(data, latestVersionQuery.data.snapshot.data));

  const publishMut = useMutation({
    mutationFn: () => proposalsV2BuilderApi.publishVersion(leadId, variante),
    onSuccess: () => {
      toast.success(`Versión V${nextVersion} publicada`);
      qc.invalidateQueries({ queryKey: ["proposal-versions", leadId] });
      // Refresca la lista unificada del panel del lead (rework modal).
      qc.invalidateQueries({ queryKey: ["lead-proposals", leadId] });
      setPublishOpen(false);
      setPublishError(null);
    },
    onError: (e) => setPublishError(errMsg(e) ?? "No se pudo publicar la versión."),
  });

  function openPublish() {
    setPublishError(null);
    setPublishOpen(true);
  }

  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  // Drawer de debug de calculadora (gate declarativo VENTAS:DEBUG_CALCULADORA).
  const canDebug = usePermission("VENTAS", "DEBUG_CALCULADORA");
  const [debugOpen, setDebugOpen] = useState(false);

  // Indicadores de viabilidad (ahorro % + espacio) en el sub-header.
  const viability = useViabilityIndicators({
    leadId,
    savedTick: autosave.savedTick,
    enabled: Boolean(leadId),
    autosaveError: autosaveBlocked,
    variante,
  });

  const loading = leadQuery.isLoading || defaultsQuery.isLoading || draftQuery.isLoading || !data;
  const lead = leadQuery.data;

  return (
    <LargeModal open onClose={onClose} ariaLabel="Constructor de propuesta">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      ) : leadQuery.isError || !lead || !data ? (
        <div className="space-y-3 p-8">
          <p className="text-sm text-[var(--color-text-muted)]">No se encontró el lead.</p>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      ) : (
        <div>
          {/* Sub-header sticky (dentro del modal) */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/95 px-6 py-2.5 backdrop-blur">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <span className="min-w-0 truncate">Propuesta · {lead.clientName}</span>
              {esEmpresa ? (
                <span className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-300">
                  B2B
                </span>
              ) : null}
            </span>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <AutosaveIndicator
                status={autosave.status}
                lastSavedAt={autosave.lastSavedAt}
                onRetry={autosave.retryNow}
              />
              <ViabilityIndicators data={viability.data} stale={viability.stale} />
              <Button size="sm" variant="secondary" className="md:hidden" onClick={() => setMobilePreviewOpen(true)}>
                Ver preview
              </Button>
              {canDebug ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDebugOpen(true)}
                  aria-label="Debug"
                  title="Debug"
                >
                  <Bug size={16} className="sm:mr-1.5" />
                  <span className="hidden sm:inline">Debug</span>
                </Button>
              ) : null}
              <PublishButton
                label={`Publicar V${nextVersion}`}
                missing={validation.missing}
                blocked={!validation.ok || autosaveBlocked}
                blockedReason={autosaveBlocked ? "Esperá a que se guarde el borrador (hay un error de guardado)." : undefined}
                onPublish={openPublish}
              />
            </div>
          </div>

          <div className="flex items-start gap-6 px-6 py-6">
            <div className="min-w-0 flex-1">
              <ProposalForm
                data={data}
                onChange={setData}
                defaults={defaultsQuery.data?.data ?? {}}
                errors={errors}
                leadId={leadId}
                savedTick={autosave.savedTick}
              />
            </div>
            <div
              className="sticky top-14 hidden shrink-0 md:block md:w-[38%] xl:w-[45%]"
              style={{ height: "calc(94vh - 150px)" }}
            >
              <ProposalPreview blobUrl={preview.blobUrl} status={preview.status} errorMsg={preview.errorMsg} />
            </div>
          </div>

          {mobilePreviewOpen ? (
            <div className="fixed inset-0 z-[55] flex flex-col bg-[var(--color-bg-app)] md:hidden">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">Preview</span>
                <button
                  onClick={() => setMobilePreviewOpen(false)}
                  className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  Cerrar
                </button>
              </div>
              <div className="min-h-0 flex-1 p-3">
                <ProposalPreview blobUrl={preview.blobUrl} status={preview.status} errorMsg={preview.errorMsg} />
              </div>
            </div>
          ) : null}

          <PublishModal
            open={publishOpen}
            versionLabel={`V${nextVersion}`}
            hasChanges={hasChanges}
            publishing={publishMut.isPending}
            error={publishError}
            onConfirm={() => publishMut.mutate()}
            onClose={() => setPublishOpen(false)}
          />

          {canDebug ? (
            <CalculatorDebugDrawer
              open={debugOpen}
              onClose={() => setDebugOpen(false)}
              leadId={leadId}
              variante={variante}
              leadName={lead.clientName}
              savedTick={autosave.savedTick}
              autosaveError={autosaveBlocked}
            />
          ) : null}
        </div>
      )}
    </LargeModal>
  );
}

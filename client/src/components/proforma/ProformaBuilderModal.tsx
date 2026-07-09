import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { proformaApi } from "../../api/proforma.api";
import { buildInitialProformaData, mergeProformaDraft, validateProforma } from "../../lib/proformaDraft";
import { useProformaAutosave } from "../../hooks/useProformaAutosave";
import { useProformaPreview } from "../../hooks/useProformaPreview";
import type { ProformaData } from "../../types/proforma";
import { LargeModal } from "../ui/LargeModal";
import { Spinner } from "../ui/Spinner";
import { AutosaveIndicator } from "../proposals-v2/AutosaveIndicator";
import { PublishButton } from "../proposals-v2/PublishButton";
import { PublishModal } from "../proposals-v2/PublishModal";
import { ProformaForm } from "./ProformaForm";
import { ProformaPreview } from "./ProformaPreview";

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// Generador de proforma BBVA como modal grande (mismo layout que el de contrato:
// form izquierda + preview PDF en vivo a la derecha).
export function ProformaBuilderModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const contextQuery = useQuery({
    queryKey: ["proforma-context", projectId],
    queryFn: () => proformaApi.getContext(projectId),
    enabled: Boolean(projectId),
  });
  const draftQuery = useQuery({
    queryKey: ["proforma-draft", projectId],
    queryFn: () => proformaApi.getDraft(projectId),
    enabled: Boolean(projectId),
  });

  const [data, setData] = useState<ProformaData | null>(null);
  const [draftExisted, setDraftExisted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (contextQuery.isLoading || draftQuery.isLoading) return;
    const base = buildInitialProformaData(contextQuery.data);
    setData(mergeProformaDraft(base, draftQuery.data?.data));
    setDraftExisted(Boolean(draftQuery.data));
    initialized.current = true;
  }, [contextQuery.data, contextQuery.isLoading, draftQuery.data, draftQuery.isLoading]);

  const autosave = useProformaAutosave({ projectId, data, enabled: data !== null, draftExisted });
  const preview = useProformaPreview({
    projectId,
    savedTick: autosave.savedTick,
    enabled: data !== null && (draftExisted || autosave.savedTick > 0),
  });

  const versionsQuery = useQuery({
    queryKey: ["proforma-versions", projectId, true],
    queryFn: () => proformaApi.listVersions(projectId, true),
    enabled: Boolean(projectId),
  });
  const nextVersion = versionsQuery.data?.length
    ? Math.max(...versionsQuery.data.map((v) => v.versionNumber)) + 1
    : 1;

  const validation = useMemo(() => (data ? validateProforma(data) : { ok: false, missing: [] }), [data]);
  const errors = useMemo(
    () => Object.fromEntries(validation.missing.map((m) => [m.path, "Requerido"])),
    [validation],
  );
  const autosaveBlocked = autosave.status === "error" || autosave.status === "error-final";

  const qc = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);

  const publishMut = useMutation({
    mutationFn: () => proformaApi.publishVersion(projectId),
    onSuccess: () => {
      toast.success(`Proforma V${nextVersion} generada`);
      qc.invalidateQueries({ queryKey: ["proforma-versions", projectId] });
      setPublishOpen(false);
      setPublishError(null);
    },
    onError: (e) => setPublishError(errMsg(e) ?? "No se pudo generar la proforma."),
  });

  const loading = contextQuery.isLoading || draftQuery.isLoading || !data;

  return (
    <LargeModal open onClose={onClose} ariaLabel="Generador de proforma">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      ) : !data ? (
        <div className="p-8 text-sm text-[var(--color-text-muted)]">No se pudo cargar la proforma.</div>
      ) : (
        <div>
          {/* Sub-header sticky */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/95 px-6 py-2.5 backdrop-blur">
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
              Proforma BBVA · {data.cliente.nombre || "sin nombre"}
            </span>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <AutosaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} onRetry={autosave.retryNow} />
              <button
                className="text-xs text-[var(--color-accent)] hover:underline md:hidden"
                onClick={() => setMobilePreviewOpen(true)}
              >
                Ver preview
              </button>
              <PublishButton
                label={`Generar V${nextVersion}`}
                missing={validation.missing}
                blocked={!validation.ok || autosaveBlocked}
                blockedReason={autosaveBlocked ? "Esperá a que se guarde el borrador (hay un error de guardado)." : undefined}
                onPublish={() => {
                  setPublishError(null);
                  setPublishOpen(true);
                }}
              />
            </div>
          </div>

          <div className="flex items-start gap-6 px-6 py-6">
            <div className="min-w-0 flex-1">
              <ProformaForm data={data} onChange={setData} errors={errors} />
            </div>
            <div
              className="sticky top-14 hidden shrink-0 md:block md:w-[40%] xl:w-[46%]"
              style={{ height: "calc(94vh - 150px)" }}
            >
              <ProformaPreview blobUrl={preview.blobUrl} status={preview.status} errorMsg={preview.errorMsg} />
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
                <ProformaPreview blobUrl={preview.blobUrl} status={preview.status} errorMsg={preview.errorMsg} />
              </div>
            </div>
          ) : null}

          <PublishModal
            open={publishOpen}
            versionLabel={`V${nextVersion}`}
            hasChanges
            publishing={publishMut.isPending}
            error={publishError}
            onConfirm={() => publishMut.mutate()}
            onClose={() => setPublishOpen(false)}
          />
        </div>
      )}
    </LargeModal>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { contractApi } from "../../api/contract.api";
import { buildInitialContractData, mergeContractDraft, validateContract } from "../../lib/contractDraft";
import { useContractAutosave } from "../../hooks/useContractAutosave";
import { useContractPreview } from "../../hooks/useContractPreview";
import type { ContractData } from "../../types/contract";
import { LargeModal } from "../ui/LargeModal";
import { Spinner } from "../ui/Spinner";
import { AutosaveIndicator } from "../proposals-v2/AutosaveIndicator";
import { PublishButton } from "../proposals-v2/PublishButton";
import { PublishModal } from "../proposals-v2/PublishModal";
import { ContractForm } from "./ContractForm";
import { ContractPreview } from "./ContractPreview";

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// Generador de contrato como modal grande (mismo layout que el de propuestas:
// form izquierda + preview PDF en vivo a la derecha).
export function ContractBuilderModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const contextQuery = useQuery({
    queryKey: ["contract-context", projectId],
    queryFn: () => contractApi.getContext(projectId),
    enabled: Boolean(projectId),
  });
  const draftQuery = useQuery({
    queryKey: ["contract-draft", projectId],
    queryFn: () => contractApi.getDraft(projectId),
    enabled: Boolean(projectId),
  });

  const [data, setData] = useState<ContractData | null>(null);
  const [draftExisted, setDraftExisted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (contextQuery.isLoading || draftQuery.isLoading) return;
    const base = buildInitialContractData(contextQuery.data);
    setData(mergeContractDraft(base, draftQuery.data?.data));
    setDraftExisted(Boolean(draftQuery.data));
    initialized.current = true;
  }, [contextQuery.data, contextQuery.isLoading, draftQuery.data, draftQuery.isLoading]);

  const autosave = useContractAutosave({ projectId, data, enabled: data !== null, draftExisted });
  const preview = useContractPreview({
    projectId,
    savedTick: autosave.savedTick,
    enabled: data !== null && (draftExisted || autosave.savedTick > 0),
  });

  const versionsQuery = useQuery({
    queryKey: ["contract-versions", projectId, true],
    queryFn: () => contractApi.listVersions(projectId, true),
    enabled: Boolean(projectId),
  });
  const nextVersion = versionsQuery.data?.length
    ? Math.max(...versionsQuery.data.map((v) => v.versionNumber)) + 1
    : 1;

  const validation = useMemo(() => (data ? validateContract(data) : { ok: false, missing: [] }), [data]);
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
    mutationFn: () => contractApi.publishVersion(projectId),
    onSuccess: () => {
      toast.success(`Contrato V${nextVersion} generado`);
      qc.invalidateQueries({ queryKey: ["contract-versions", projectId] });
      setPublishOpen(false);
      setPublishError(null);
    },
    onError: (e) => setPublishError(errMsg(e) ?? "No se pudo generar el contrato."),
  });

  const loading = contextQuery.isLoading || draftQuery.isLoading || !data;

  return (
    <LargeModal open onClose={onClose} ariaLabel="Generador de contrato">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      ) : !data ? (
        <div className="p-8 text-sm text-[var(--color-text-muted)]">No se pudo cargar el contrato.</div>
      ) : (
        <div>
          {/* Sub-header sticky */}
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/95 px-6 py-2.5 backdrop-blur">
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
              Contrato · {data.cliente.nombre || "sin nombre"}
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
              <ContractForm data={data} onChange={setData} errors={errors} />
            </div>
            <div
              className="sticky top-14 hidden shrink-0 md:block md:w-[40%] xl:w-[46%]"
              style={{ height: "calc(94vh - 150px)" }}
            >
              <ContractPreview blobUrl={preview.blobUrl} status={preview.status} errorMsg={preview.errorMsg} />
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
                <ContractPreview blobUrl={preview.blobUrl} status={preview.status} errorMsg={preview.errorMsg} />
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

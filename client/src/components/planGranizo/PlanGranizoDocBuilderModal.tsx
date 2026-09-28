import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { planGranizoDocApi, type PlanGranizoDocData } from "../../api/planGranizo.api";
import { useDocumentoAutosave, useDocumentoPreview } from "../../hooks/useDocumentoAutosave";
import { AutosaveIndicator } from "../proposals-v2/AutosaveIndicator";
import { NumberField, TextField } from "../proposals-v2/fields";
import { PublishButton } from "../proposals-v2/PublishButton";
import { PublishModal } from "../proposals-v2/PublishModal";
import { ProformaPreview } from "../proforma/ProformaPreview";
import { LargeModal } from "../ui/LargeModal";
import { Spinner } from "../ui/Spinner";
import { buildInitialDocData, mergeDocDraft, redondear, validateDoc } from "./documento";
import { errMsg, fmtUsd } from "./estado";

const H2 = "text-sm font-bold uppercase tracking-wide text-[var(--color-text-primary)]";
const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2";
const LABEL = "mb-1 block text-xs font-medium text-[var(--color-text-secondary)]";
const INPUT =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

// Generador del documento del Plan de Protección contra Granizo: las
// condiciones generales con el Anexo A (solicitud de adhesión) completado con
// los datos del proyecto, todo editable. Mismo layout que el de la proforma:
// formulario a la izquierda y vista previa del PDF en vivo a la derecha.
export function PlanGranizoDocBuilderModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const contextQuery = useQuery({
    queryKey: ["plan-granizo-doc-context", projectId],
    queryFn: () => planGranizoDocApi.getContext(projectId),
  });
  const draftQuery = useQuery({
    queryKey: ["plan-granizo-doc-draft", projectId],
    queryFn: () => planGranizoDocApi.getDraft(projectId),
  });

  const [data, setData] = useState<PlanGranizoDocData | null>(null);
  const [draftExisted, setDraftExisted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || contextQuery.isLoading || draftQuery.isLoading) return;
    setData(mergeDocDraft(buildInitialDocData(contextQuery.data), draftQuery.data?.data));
    setDraftExisted(Boolean(draftQuery.data));
    initialized.current = true;
  }, [contextQuery.data, contextQuery.isLoading, draftQuery.data, draftQuery.isLoading]);

  const autosave = useDocumentoAutosave({
    data,
    enabled: data !== null,
    draftExisted,
    save: (d) => planGranizoDocApi.putDraft(projectId, d),
  });
  const preview = useDocumentoPreview({
    savedTick: autosave.savedTick,
    enabled: data !== null && (draftExisted || autosave.savedTick > 0),
    fetchBlob: () => planGranizoDocApi.getDraftPreviewBlob(projectId),
  });

  const versionsQuery = useQuery({
    queryKey: ["plan-granizo-doc-versions", projectId, true],
    queryFn: () => planGranizoDocApi.listVersions(projectId, true),
  });
  const nextVersion = versionsQuery.data?.length ? Math.max(...versionsQuery.data.map((v) => v.versionNumber)) + 1 : 1;

  const validation = useMemo(() => (data ? validateDoc(data) : { ok: false, missing: [] }), [data]);
  const errors = useMemo(() => Object.fromEntries(validation.missing.map((m) => [m.path, "Requerido"])), [validation]);
  const autosaveBlocked = autosave.status === "error" || autosave.status === "error-final";

  const qc = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const publishMut = useMutation({
    mutationFn: () => planGranizoDocApi.publishVersion(projectId),
    onSuccess: () => {
      toast.success(`Condiciones V${nextVersion} generadas`);
      qc.invalidateQueries({ queryKey: ["plan-granizo-doc-versions", projectId] });
      setPublishOpen(false);
      setPublishError(null);
    },
    onError: (e) => setPublishError(errMsg(e, "No se pudo generar el documento.")),
  });

  // Cambiar paneles o precio recalcula la anualidad.
  const setPlan = (p: Partial<PlanGranizoDocData["plan"]>) =>
    setData((d) => {
      if (!d) return d;
      const plan = { ...d.plan, ...p };
      if (p.cantidadPaneles !== undefined || p.precioPorPanelUsd !== undefined) {
        plan.anualidadUsd = redondear(plan.cantidadPaneles * plan.precioPorPanelUsd);
      }
      return { ...d, plan };
    });
  const setCliente = (p: Partial<PlanGranizoDocData["cliente"]>) => setData((d) => (d ? { ...d, cliente: { ...d.cliente, ...p } } : d));
  const setEmpresa = (p: Partial<PlanGranizoDocData["empresa"]>) => setData((d) => (d ? { ...d, empresa: { ...d.empresa, ...p } } : d));

  const loading = contextQuery.isLoading || draftQuery.isLoading || !data;
  const ampliacion = contextQuery.data?.esAmpliacionDe;

  return (
    <LargeModal open onClose={onClose} ariaLabel="Condiciones del plan de granizo">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      ) : !data ? null : (
        <div>
          <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-app)]/95 px-6 py-2.5 backdrop-blur">
            <span className="min-w-0 truncate text-sm font-semibold text-[var(--color-text-primary)]">
              Plan de Protección contra Granizo · {data.cliente.nombre || "sin nombre"}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <AutosaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} onRetry={autosave.retryNow} />
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
            <div className="min-w-0 flex-1 space-y-8">
              {ampliacion ? (
                <p className="rounded-md bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning-text)]">
                  Esta obra es una ampliación de {ampliacion.clientName}: sus paneles se suman al plan de esa instalación. Normalmente no
                  hace falta un documento aparte.
                </p>
              ) : null}

              <section className="space-y-3">
                <h2 className={H2}>Anexo A · Cliente</h2>
                <div className={GRID}>
                  <TextField label="Cliente (nombre o razón social)" value={data.cliente.nombre} onChange={(v) => setCliente({ nombre: v })} error={errors["cliente.nombre"]} />
                  <TextField label="C.I. / RUT" value={data.cliente.documento} onChange={(v) => setCliente({ documento: v })} error={errors["cliente.documento"]} />
                  <div className="sm:col-span-2">
                    <TextField label="Dirección de la instalación" value={data.cliente.direccion} onChange={(v) => setCliente({ direccion: v })} error={errors["cliente.direccion"]} />
                  </div>
                  <TextField label="Teléfono" value={data.cliente.telefono} onChange={(v) => setCliente({ telefono: v })} />
                  <TextField label="Correo" value={data.cliente.email} onChange={(v) => setCliente({ email: v })} />
                </div>
              </section>

              <section className="space-y-3">
                <h2 className={H2}>Anexo A · Instalación y anualidad</h2>
                <div className={GRID}>
                  <label className="block">
                    <span className={LABEL}>Instalación nueva o existente</span>
                    <select
                      className={INPUT}
                      value={data.plan.instalacion}
                      onChange={(e) => {
                        const instalacion = e.target.value as "NUEVA" | "EXISTENTE";
                        setPlan({ instalacion, fotosAdjuntas: instalacion === "EXISTENTE" ? (data.plan.fotosAdjuntas ?? false) : null });
                      }}
                    >
                      <option value="NUEVA">Nueva (se adhiere con la obra, sin carencia)</option>
                      <option value="EXISTENTE">Existente (30 días de carencia)</option>
                    </select>
                  </label>
                  <TextField
                    label="Número de serie del inversor"
                    value={data.plan.inversorSerie}
                    onChange={(v) => setPlan({ inversorSerie: v })}
                    hint="Si todavía no se sabe, queda la línea en blanco para completar a mano."
                  />
                  <NumberField label="Cantidad de paneles" value={data.plan.cantidadPaneles} onChange={(v) => setPlan({ cantidadPaneles: v })} min={1} error={errors["plan.cantidadPaneles"]} />
                  <NumberField label="Precio por panel por año (USD, IVA incl.)" value={data.plan.precioPorPanelUsd} onChange={(v) => setPlan({ precioPorPanelUsd: v })} min={0} step={0.5} error={errors["plan.precioPorPanelUsd"]} />
                  {data.plan.instalacion === "EXISTENTE" ? (
                    <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                      <input type="checkbox" checked={data.plan.fotosAdjuntas ?? false} onChange={(e) => setPlan({ fotosAdjuntas: e.target.checked })} />
                      Se adjuntan las fotos actuales de los paneles
                    </label>
                  ) : null}
                  <div className="self-end text-sm text-[var(--color-text-secondary)]">
                    Anualidad: <strong className="text-[var(--color-text-primary)]">{fmtUsd(data.plan.anualidadUsd)}</strong>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className={H2}>Datos de Voltia (sección 1)</h2>
                <div className={GRID}>
                  <TextField label="Razón social" value={data.empresa.razonSocial} onChange={(v) => setEmpresa({ razonSocial: v })} error={errors["empresa.razonSocial"]} />
                  <TextField label="RUT" value={data.empresa.rut} onChange={(v) => setEmpresa({ rut: v })} error={errors["empresa.rut"]} />
                  <div className="sm:col-span-2">
                    <TextField label="Domicilio fiscal" value={data.empresa.domicilio} onChange={(v) => setEmpresa({ domicilio: v })} error={errors["empresa.domicilio"]} />
                  </div>
                  <label className="block">
                    <span className={LABEL}>Fecha de emisión</span>
                    <input type="date" className={INPUT} value={data.fecha} onChange={(e) => setData({ ...data, fecha: e.target.value })} />
                  </label>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  El texto de las condiciones es fijo: es el aprobado. Para cambiarlo hay que pedirlo (queda registrado qué versión del
                  texto firmó cada cliente).
                </p>
              </section>
            </div>

            <div className="sticky top-14 hidden shrink-0 md:block md:w-[40%] xl:w-[46%]" style={{ height: "calc(94vh - 150px)" }}>
              <ProformaPreview blobUrl={preview.blobUrl} status={preview.status} errorMsg={preview.errorMsg} />
            </div>
          </div>

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

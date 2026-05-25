import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  createUnifilarVersion,
  getUnifilarPreviewSvg,
  type UnifilarFormInput,
} from "../../../api/unifilar.api";
import {
  emptyForm,
  FormSection,
  getApiErr,
  inp,
  lbl,
  Num,
  NumF,
  NumGrid,
  TIPO_PROT_DC_OPTIONS,
  TIPO_RED_OPTIONS,
} from "./shared";
import { CalibreInput } from "../../ui/CalibreInput";
import {
  CALIBRES_DIFERENCIAL_AC,
  CALIBRES_PROTECCION_DC,
  CALIBRES_TERMICA_AC,
} from "../../ui/calibres";

export function UnifilarFormModal({
  projectId,
  initialForm,
  onClose,
  onSuccess,
}: {
  projectId: string;
  initialForm: UnifilarFormInput | null;
  onClose: () => void;
  onSuccess: (created: { id: string; versionNumber: number }) => void;
}) {
  const [form, setForm] = useState<UnifilarFormInput>(initialForm ?? emptyForm());
  const [error, setError] = useState<string | null>(null);

  const dcSugerida = useMemo(
    () => Math.round((form.cantidadPaneles * form.potenciaPanelW) / 100) / 10,
    [form.cantidadPaneles, form.potenciaPanelW],
  );

  const [debouncedForm, setDebouncedForm] = useState(form);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedForm(form), 300);
    return () => clearTimeout(t);
  }, [form]);

  const previewQ = useQuery({
    queryKey: ["unifilar-preview", projectId, debouncedForm],
    queryFn: () => getUnifilarPreviewSvg(projectId, debouncedForm),
    staleTime: 0,
    placeholderData: (prev) => prev,
  });

  const createMut = useMutation({
    mutationFn: () => createUnifilarVersion(projectId, form),
    onSuccess: (created) => {
      onSuccess(created);
    },
    onError: (e) => setError(getApiErr(e) ?? "Error al crear versión"),
  });

  function setF<K extends keyof UnifilarFormInput>(k: K, v: UnifilarFormInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    createMut.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full max-w-[1400px] max-h-[92vh] rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Nueva versión de unifilar
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[420px_1fr] gap-0">
          <form
            onSubmit={submit}
            className="overflow-auto px-4 py-3 space-y-3 border-r border-[var(--color-border)]"
          >
            <div>
              <label className={lbl}>Etiqueta (opcional)</label>
              <input
                className={inp}
                value={form.label ?? ""}
                onChange={(e) => setF("label", e.target.value)}
                placeholder="Ej: v1 borrador"
                maxLength={80}
              />
            </div>

            <FormSection title="Datos eléctricos">
              <div>
                <label className={lbl}>Tipo de red *</label>
                <div className="space-y-1">
                  {TIPO_RED_OPTIONS.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="tipoRed"
                        checked={form.tipoRed === o.value}
                        onChange={() => setF("tipoRed", o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              <NumGrid>
                <Num label="Cantidad de paneles" value={form.cantidadPaneles} min={1} max={200}
                  onChange={(v) => setF("cantidadPaneles", v)} />
                <Num label="Potencia panel (W)" value={form.potenciaPanelW} min={100} max={800}
                  onChange={(v) => setF("potenciaPanelW", v)} />
                <Num label="Strings" value={form.cantidadStrings} min={1} max={8}
                  onChange={(v) => setF("cantidadStrings", v)} />
                <NumF label="Potencia contratada (kW)" value={form.potenciaContratadaKw}
                  onChange={(v) => setF("potenciaContratadaKw", v)} />
              </NumGrid>
              <div>
                <label className={lbl}>Modelo de panel (opcional)</label>
                <input className={inp} value={form.modeloPanel ?? ""}
                  onChange={(e) => setF("modeloPanel", e.target.value)}
                  placeholder="Ej: JA Solar JAM72S30 580W" maxLength={100} />
              </div>
            </FormSection>

            <FormSection title="Inversor">
              <div>
                <label className={lbl}>Modelo *</label>
                <input className={inp} value={form.modeloInversor}
                  onChange={(e) => setF("modeloInversor", e.target.value)}
                  required maxLength={100} />
              </div>
              <NumGrid>
                <NumF label={`Potencia (kW) — sugerido: ${dcSugerida}`}
                  value={form.potenciaInversorKw}
                  onChange={(v) => setF("potenciaInversorKw", v)} />
              </NumGrid>
            </FormSection>

            <FormSection title="Protección DC">
              <div>
                <label className={lbl}>Tipo *</label>
                <div className="space-y-1">
                  {TIPO_PROT_DC_OPTIONS.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="tipoProteccionDc"
                        checked={form.tipoProteccionDc === o.value}
                        onChange={() => setF("tipoProteccionDc", o.value)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Calibre</label>
                <CalibreInput
                  value={form.calibreProteccionDc}
                  onChange={(v) => setF("calibreProteccionDc", v ?? "25A 2P")}
                  predefined={CALIBRES_PROTECCION_DC}
                  ariaLabel="Calibre protección DC"
                />
              </div>
            </FormSection>

            <FormSection title="Protección AC">
              <p className="text-[10px] italic text-[var(--color-text-muted)]">
                Si dejás los campos en automático, el sistema elige el calibre
                según potencia del inversor y tipo de red. Sobrescribí si
                necesitás un valor específico.
              </p>
              <NumGrid>
                <div>
                  <label className={lbl}>Térmica AC</label>
                  <CalibreInput
                    value={form.termicaAcCalibre ?? null}
                    onChange={(v) => setF("termicaAcCalibre", v)}
                    predefined={CALIBRES_TERMICA_AC}
                    emptyOptionLabel="Automático (según potencia y red)"
                    placeholder="Automático"
                    ariaLabel="Calibre térmica AC"
                  />
                </div>
                <div>
                  <label className={lbl}>Diferencial AC</label>
                  <CalibreInput
                    value={form.diferencialAcCalibre ?? null}
                    onChange={(v) => setF("diferencialAcCalibre", v)}
                    predefined={CALIBRES_DIFERENCIAL_AC}
                    emptyOptionLabel="Automático (según potencia y red)"
                    placeholder="Automático"
                    ariaLabel="Calibre diferencial AC"
                  />
                </div>
              </NumGrid>
            </FormSection>

            <FormSection title="Medidor de monitoreo">
              <div>
                <label className={lbl}>Modelo (opcional)</label>
                <input className={inp} value={form.modeloMedidorMonitoreo ?? ""}
                  onChange={(e) => setF("modeloMedidorMonitoreo", e.target.value)}
                  placeholder="Ej: Eastron SDM230" maxLength={100} />
              </div>
            </FormSection>

            <FormSection title="Longitudes de cables">
              <NumGrid>
                <Num label="DC paneles → tablero (m)" value={form.largoDcPanelesM} min={1} max={200}
                  onChange={(v) => setF("largoDcPanelesM", v)} />
                <Num label="AC inversor → ICP IMG (m)" value={form.largoAcInversorIcpM} min={1} max={200}
                  onChange={(v) => setF("largoAcInversorIcpM", v)} />
                <Num label="AC ICP → tablero casa (m)" value={form.largoAcIcpTableroM} min={1} max={200}
                  onChange={(v) => setF("largoAcIcpTableroM", v)} />
              </NumGrid>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={form.largoDcEsLargo}
                  onChange={(e) => setF("largoDcEsLargo", e.target.checked)} />
                Tramo DC largo (subir a 6mm² por caída de tensión)
              </label>
            </FormSection>

            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-[var(--color-bg-card)] pb-1">
              <button type="button" onClick={onClose}
                className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]">
                Cancelar
              </button>
              <button type="submit" disabled={createMut.isPending}
                className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50">
                {createMut.isPending ? "Creando…" : "Crear versión"}
              </button>
            </div>
          </form>

          <div className="overflow-auto bg-white p-3">
            {previewQ.isLoading && !previewQ.data ? (
              <p className="text-xs text-gray-500">Generando preview…</p>
            ) : previewQ.error ? (
              <p className="text-xs text-red-500">No se pudo generar el preview</p>
            ) : (
              <div
                className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: previewQ.data ?? "" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

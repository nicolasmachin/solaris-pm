import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Download, FileText, Plus, Trash2, X } from "lucide-react";
import {
  createUnifilarVersion,
  deleteUnifilarVersion,
  getUnifilarPreviewSvg,
  getUnifilarVersion,
  getUnifilarVersions,
  unifilarPdfUrl,
  unifilarSvgUrl,
  type TipoProteccionDC,
  type TipoRed,
  type UnifilarFormInput,
  type UnifilarVersionListItem,
} from "../../api/unifilar.api";

function klass(...p: (string | false | undefined)[]) {
  return p.filter(Boolean).join(" ");
}
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

/** Descarga un endpoint protegido por JWT enviando el Bearer en headers. */
async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("voltia-token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

const inp =
  "w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";
const lbl = "block text-[10px] font-mono text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider";

const TIPO_RED_OPTIONS: { value: TipoRed; label: string }[] = [
  { value: "MONO_230", label: "Monofásica 230V" },
  { value: "TRI_230_SN", label: "Trifásica 230V (sin N)" },
  { value: "TRI_400_CN", label: "Trifásica 400V (con N)" },
];

const TIPO_PROT_DC_OPTIONS: { value: TipoProteccionDC; label: string }[] = [
  { value: "TERMOMAGNETICO", label: "Termomagnético" },
  { value: "FUSIBLE", label: "Fusible" },
];

function emptyForm(): UnifilarFormInput {
  return {
    label: "",
    tipoRed: "MONO_230",
    cantidadPaneles: 10,
    potenciaPanelW: 580,
    modeloPanel: "",
    cantidadStrings: 2,
    potenciaContratadaKw: 7.0,
    modeloInversor: "Growatt MIN 6000 TL-X",
    potenciaInversorKw: 6.0,
    tipoProteccionDc: "TERMOMAGNETICO",
    calibreProteccionDc: "25A 2P",
    modeloMedidorMonitoreo: "",
    largoDcPanelesM: 15,
    largoDcEsLargo: false,
    largoAcInversorIcpM: 10,
    largoAcIcpTableroM: 10,
  };
}

function fromVersionAsForm(v: {
  label: string | null;
  tipoRed: TipoRed;
  cantidadPaneles: number;
  potenciaPanelW: number;
  modeloPanel: string | null;
  cantidadStrings: number;
  potenciaContratadaKw: number;
  modeloInversor: string;
  potenciaInversorKw: number;
  tipoProteccionDc: TipoProteccionDC;
  calibreProteccionDc: string;
  modeloMedidorMonitoreo: string | null;
  largoDcPanelesM: number;
  largoDcEsLargo: boolean;
  largoAcInversorIcpM: number;
  largoAcIcpTableroM: number;
}): UnifilarFormInput {
  return {
    label: v.label ?? "",
    tipoRed: v.tipoRed,
    cantidadPaneles: v.cantidadPaneles,
    potenciaPanelW: v.potenciaPanelW,
    modeloPanel: v.modeloPanel ?? "",
    cantidadStrings: v.cantidadStrings,
    potenciaContratadaKw: v.potenciaContratadaKw,
    modeloInversor: v.modeloInversor,
    potenciaInversorKw: v.potenciaInversorKw,
    tipoProteccionDc: v.tipoProteccionDc,
    calibreProteccionDc: v.calibreProteccionDc,
    modeloMedidorMonitoreo: v.modeloMedidorMonitoreo ?? "",
    largoDcPanelesM: v.largoDcPanelesM,
    largoDcEsLargo: v.largoDcEsLargo,
    largoAcInversorIcpM: v.largoAcInversorIcpM,
    largoAcIcpTableroM: v.largoAcIcpTableroM,
  };
}

export function UnifilarStep({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [duplicateFrom, setDuplicateFrom] = useState<UnifilarFormInput | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);

  const versionsQ = useQuery({
    queryKey: ["unifilar-versions", projectId],
    queryFn: () => getUnifilarVersions(projectId),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteUnifilarVersion(id),
    onSuccess: () => {
      toast.success("Versión eliminada");
      qc.invalidateQueries({ queryKey: ["unifilar-versions", projectId] });
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo eliminar"),
  });

  function openCreate() {
    setDuplicateFrom(null);
    setDialogOpen(true);
  }

  async function openDuplicate(versionId: string) {
    try {
      const v = await getUnifilarVersion(versionId);
      const form = fromVersionAsForm(v);
      form.label = `${v.label ?? `v${v.versionNumber}`} (copia)`;
      setDuplicateFrom(form);
      setDialogOpen(true);
    } catch {
      toast.error("No se pudo cargar la versión a duplicar");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          Plano unifilar
        </p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90"
        >
          <Plus className="w-3 h-3" /> Nueva versión
        </button>
      </div>

      {versionsQ.isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : !versionsQ.data || versionsQ.data.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Sin versiones todavía. Tocá "Nueva versión" para generar el primer unifilar.
        </p>
      ) : (
        <UnifilarVersionList
          versions={versionsQ.data}
          onPreview={setPreviewVersionId}
          onDuplicate={openDuplicate}
          onDelete={(id) => {
            if (confirm("¿Eliminar esta versión? Esta acción no se puede deshacer.")) {
              deleteMut.mutate(id);
            }
          }}
        />
      )}

      {dialogOpen && (
        <UnifilarFormDialog
          projectId={projectId}
          initialForm={duplicateFrom}
          onClose={() => {
            setDialogOpen(false);
            setDuplicateFrom(null);
          }}
          onSuccess={(created) => {
            setDialogOpen(false);
            setDuplicateFrom(null);
            qc.invalidateQueries({ queryKey: ["unifilar-versions", projectId] });
            setPreviewVersionId(created.id);
          }}
        />
      )}

      {previewVersionId && (
        <UnifilarPreviewModal
          versionId={previewVersionId}
          onClose={() => setPreviewVersionId(null)}
        />
      )}
    </div>
  );
}

// ─── Lista de versiones ───────────────────────────────────────────────────

function UnifilarVersionList({
  versions,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  versions: UnifilarVersionListItem[];
  onPreview: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">
          <tr className="text-left text-[10px] uppercase tracking-wider font-mono">
            <th className="px-2 py-1.5 w-12">#</th>
            <th className="px-2 py-1.5">Etiqueta</th>
            <th className="px-2 py-1.5">Red</th>
            <th className="px-2 py-1.5">Inv (kW)</th>
            <th className="px-2 py-1.5">Paneles</th>
            <th className="px-2 py-1.5">Creada</th>
            <th className="px-2 py-1.5 w-px">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {versions.map((v) => (
            <tr key={v.id} className="hover:bg-[var(--color-bg-card-hover)]">
              <td className="px-2 py-1.5 font-mono">v{v.versionNumber}</td>
              <td className="px-2 py-1.5 text-[var(--color-text-primary)]">
                {v.label || <span className="text-[var(--color-text-muted)] italic">—</span>}
              </td>
              <td className="px-2 py-1.5 font-mono text-[10px]">{v.tipoRed}</td>
              <td className="px-2 py-1.5 tabular-nums">{v.potenciaInversorKw}</td>
              <td className="px-2 py-1.5 tabular-nums">{v.cantidadPaneles}</td>
              <td className="px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">
                {new Date(v.createdAt).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "2-digit" })}
              </td>
              <td className="px-2 py-1.5 text-right">
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => onPreview(v.id)}
                    className="px-2 py-0.5 rounded text-[10px] border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
                  >
                    Ver
                  </button>
                  <button
                    onClick={() =>
                      downloadWithAuth(unifilarSvgUrl(v.id), `unifilar_v${v.versionNumber}.svg`)
                        .catch(() => toast.error("No se pudo descargar SVG"))
                    }
                    className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                    title="Descargar SVG"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() =>
                      downloadWithAuth(unifilarPdfUrl(v.id), `unifilar_v${v.versionNumber}.pdf`)
                        .catch(() => toast.error("No se pudo descargar PDF"))
                    }
                    className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                    title="Descargar PDF"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDuplicate(v.id)}
                    className="px-2 py-0.5 rounded text-[10px] border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
                    title="Duplicar como versión nueva"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => onDelete(v.id)}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Dialog: crear versión con form + preview en vivo ───────────────────────

function UnifilarFormDialog({
  projectId,
  initialForm,
  onClose,
  onSuccess,
}: {
  projectId: string;
  initialForm: UnifilarFormInput | null;
  onClose: () => void;
  onSuccess: (created: { id: string }) => void;
}) {
  const [form, setForm] = useState<UnifilarFormInput>(initialForm ?? emptyForm());
  const [error, setError] = useState<string | null>(null);

  // Sugerencia: potenciaInversorKw ≈ potencia DC (paneles × W / 1000) (regla 4.7).
  const dcSugerida = useMemo(
    () => Math.round((form.cantidadPaneles * form.potenciaPanelW) / 100) / 10,
    [form.cantidadPaneles, form.potenciaPanelW],
  );

  // Debounced preview
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
      toast.success(`Versión v${created.versionNumber} creada`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
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
          {/* Form */}
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
                <input className={inp} value={form.calibreProteccionDc}
                  onChange={(e) => setF("calibreProteccionDc", e.target.value)}
                  maxLength={50} />
              </div>
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

          {/* Preview */}
          <div className="overflow-auto bg-white p-3">
            {previewQ.isLoading && !previewQ.data ? (
              <p className="text-xs text-gray-500">Generando preview…</p>
            ) : previewQ.error ? (
              <p className="text-xs text-red-500">No se pudo generar el preview</p>
            ) : (
              <div
                className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-w-full"
                // SVG es generado por nuestro backend, seguro de renderizar
                dangerouslySetInnerHTML={{ __html: previewQ.data ?? "" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de preview de una versión ya guardada ────────────────────────────

function UnifilarPreviewModal({ versionId, onClose }: { versionId: string; onClose: () => void }) {
  const svgQ = useQuery({
    queryKey: ["unifilar-svg-preview", versionId],
    queryFn: async () => {
      const url = unifilarSvgUrl(versionId);
      const token = localStorage.getItem("voltia-token");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-xl bg-white border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-card)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Vista del unifilar
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                downloadWithAuth(unifilarSvgUrl(versionId), `unifilar.svg`).catch(() =>
                  toast.error("No se pudo descargar SVG"),
                )
              }
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Download className="w-3 h-3" /> SVG
            </button>
            <button
              onClick={() =>
                downloadWithAuth(unifilarPdfUrl(versionId), `unifilar.pdf`).catch(() =>
                  toast.error("No se pudo descargar PDF"),
                )
              }
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              <FileText className="w-3 h-3" /> PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {svgQ.isLoading ? (
            <p className="text-xs text-gray-500">Cargando…</p>
          ) : svgQ.error ? (
            <p className="text-xs text-red-500">No se pudo cargar el plano</p>
          ) : (
            <div
              className="w-full [&>svg]:w-full [&>svg]:h-auto [&>svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svgQ.data ?? "" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────────────────

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className={klass(lbl, "text-[var(--color-text-secondary)]")}>{title}</legend>
      <div className="space-y-2">{children}</div>
    </fieldset>
  );
}

function NumGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

function Num({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input
        type="number"
        className={inp}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value)))))}
      />
    </div>
  );
}

function NumF({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input
        type="number"
        step="0.1"
        className={inp}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
      />
    </div>
  );
}

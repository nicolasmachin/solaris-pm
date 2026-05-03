import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowDown, ArrowUp, Sparkles, Trash2, Upload, X } from "lucide-react";
import {
  createPreIngenieriaVersion,
  uploadPreIngenieriaFoto,
  type PreIngenieriaFormInput,
} from "../../../api/preingenieria.api";
import {
  getUnifilarVersion,
  getUnifilarVersions,
  type UnifilarVersionListItem,
} from "../../../api/unifilar.api";
import {
  applyUnifilarPrefill,
  emptyForm,
  FormSection,
  getApiErr,
  inp,
  klass,
  lbl,
  TIPO_TECHO_OPTIONS,
} from "./shared";

interface ProjectDefaults {
  clientName: string;
  clientAddress: string | null;
  locationCity: string | null;
  locationProvince: string | null;
  notificationPhone: string | null;
}

export function PreIngenieriaFormModal({
  projectId,
  defaults,
  onClose,
  onSuccess,
}: {
  projectId: string;
  defaults: ProjectDefaults;
  onClose: () => void;
  onSuccess: (created: { id: string; versionNumber: number }) => void;
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState<PreIngenieriaFormInput>(() => {
    const base = emptyForm(defaults.clientName);
    base.snapshotDireccion = defaults.clientAddress ?? "";
    base.snapshotCiudad = [defaults.locationCity, defaults.locationProvince]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join(", ");
    base.snapshotCelular = defaults.notificationPhone ?? "";
    return base;
  });
  const [error, setError] = useState<string | null>(null);
  // fileId → File previewUrl (para mostrar thumbnail). Local sólo, no se persiste.
  const [fotoPreviews, setFotoPreviews] = useState<Record<string, string>>({});
  // fileId → filename (para mostrar el nombre original al usuario)
  const [fotoNames, setFotoNames] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Versiones de unifilar para el botón "Pre-rellenar"
  const unifilarVersionsQ = useQuery({
    queryKey: ["unifilar-versions", projectId],
    queryFn: () => getUnifilarVersions(projectId),
  });
  const unifilarVersions: UnifilarVersionListItem[] = unifilarVersionsQ.data ?? [];
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  function setF<K extends keyof PreIngenieriaFormInput>(k: K, v: PreIngenieriaFormInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setFotoEtiqueta(fileId: string, etiqueta: string) {
    setForm((f) => ({
      ...f,
      fotosEtiquetas: { ...(f.fotosEtiquetas ?? {}), [fileId]: etiqueta },
    }));
  }

  async function handlePrefill(versionId: string) {
    try {
      const v = await getUnifilarVersion(versionId);
      setForm((f) => applyUnifilarPrefill(f, v));
      setShowVersionPicker(false);
      toast.success(`Pre-rellenado desde unifilar v${v.versionNumber}`);
    } catch {
      toast.error("No se pudo cargar la versión seleccionada");
    }
  }

  function tryQuickPrefill() {
    if (unifilarVersions.length === 0) {
      toast("No hay versiones de unifilar para este proyecto");
      return;
    }
    if (unifilarVersions.length === 1) {
      void handlePrefill(unifilarVersions[0].id);
      return;
    }
    setShowVersionPicker(true);
  }

  const uploadMut = useMutation({
    mutationFn: (file: File) => uploadPreIngenieriaFoto(projectId, file),
    onSuccess: (res, file) => {
      const previewUrl = URL.createObjectURL(file);
      setFotoPreviews((p) => ({ ...p, [res.fileId]: previewUrl }));
      setFotoNames((n) => ({ ...n, [res.fileId]: res.filename }));
      setForm((f) => ({ ...f, fotosOrden: [...f.fotosOrden, res.fileId] }));
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo subir la foto"),
  });

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => uploadMut.mutate(file));
  }

  function moveFoto(fileId: string, dir: -1 | 1) {
    setForm((f) => {
      const idx = f.fotosOrden.indexOf(fileId);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= f.fotosOrden.length) return f;
      const arr = [...f.fotosOrden];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return { ...f, fotosOrden: arr };
    });
  }

  function removeFoto(fileId: string) {
    setForm((f) => ({
      ...f,
      fotosOrden: f.fotosOrden.filter((id) => id !== fileId),
      fotosEtiquetas: Object.fromEntries(
        Object.entries(f.fotosEtiquetas ?? {}).filter(([k]) => k !== fileId),
      ),
    }));
    setFotoPreviews((p) => {
      const { [fileId]: _, ...rest } = p;
      if (p[fileId]) URL.revokeObjectURL(p[fileId]);
      return rest;
    });
  }

  // Limpiar object URLs al desmontar
  useEffect(() => {
    return () => {
      Object.values(fotoPreviews).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createMut = useMutation({
    mutationFn: () => createPreIngenieriaVersion(projectId, form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["preingenieria-versions", projectId] });
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
      toast.success(`Pre-ingeniería v${res.versionNumber} generada`);
      onSuccess({ id: res.id, versionNumber: res.versionNumber });
    },
    onError: (e) => setError(getApiErr(e) ?? "No se pudo generar el PDF"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.snapshotNombre.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }
    createMut.mutate();
  }

  const fotosUploading = uploadMut.isPending;
  const totalFotos = form.fotosOrden.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 shrink-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Nueva pre-ingeniería
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-auto px-4 py-3 space-y-4 flex-1">
          {/* Identificación */}
          <FormSection title="Identificación">
            <div>
              <label className={lbl}>Etiqueta (opcional)</label>
              <input
                className={inp}
                value={form.label ?? ""}
                onChange={(e) => setF("label", e.target.value)}
                placeholder='Ej: "v1 borrador", "Para cliente"'
                maxLength={80}
              />
            </div>
          </FormSection>

          {/* Cliente */}
          <FormSection title="Datos del cliente (pre-rellenado, editable)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Nombre *</label>
                <input className={inp} value={form.snapshotNombre} onChange={(e) => setF("snapshotNombre", e.target.value)} required maxLength={150} />
              </div>
              <div>
                <label className={lbl}>Celular</label>
                <input className={inp} value={form.snapshotCelular ?? ""} onChange={(e) => setF("snapshotCelular", e.target.value)} maxLength={50} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Dirección</label>
                <input className={inp} value={form.snapshotDireccion ?? ""} onChange={(e) => setF("snapshotDireccion", e.target.value)} maxLength={200} />
              </div>
              <div>
                <label className={lbl}>Ciudad</label>
                <input className={inp} value={form.snapshotCiudad ?? ""} onChange={(e) => setF("snapshotCiudad", e.target.value)} maxLength={100} />
              </div>
              <div>
                <label className={lbl}>Fecha prevista (texto libre)</label>
                <input className={inp} value={form.snapshotFechaPrevista ?? ""} onChange={(e) => setF("snapshotFechaPrevista", e.target.value)} placeholder='Ej: "3era semana abril"' maxLength={80} />
              </div>
            </div>
          </FormSection>

          {/* Sitio */}
          <FormSection title="Datos del sitio">
            <div>
              <label className={lbl}>Tipo de techo</label>
              <div className="flex flex-wrap gap-2">
                {TIPO_TECHO_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-[var(--color-border)] cursor-pointer">
                    <input
                      type="radio"
                      name="tipoTecho"
                      checked={form.tipoTecho === o.value}
                      onChange={() => setF("tipoTecho", o.value)}
                    />
                    {o.label}
                  </label>
                ))}
                {form.tipoTecho && (
                  <button
                    type="button"
                    onClick={() => {
                      setF("tipoTecho", null);
                      setF("tipoTechoOtro", "");
                    }}
                    className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] underline"
                  >
                    Limpiar
                  </button>
                )}
              </div>
              {form.tipoTecho === "OTRO" && (
                <input
                  className={klass(inp, "mt-2")}
                  placeholder="Describir tipo de techo"
                  value={form.tipoTechoOtro ?? ""}
                  onChange={(e) => setF("tipoTechoOtro", e.target.value)}
                  maxLength={100}
                />
              )}
            </div>
            <div>
              <label className={lbl}>Info techo (multi-línea)</label>
              <textarea
                className={klass(inp, "min-h-[60px]")}
                value={form.infoTecho ?? ""}
                onChange={(e) => setF("infoTecho", e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
            <div>
              <label className={lbl}>Altura techo</label>
              <input
                className={inp}
                value={form.alturaTecho ?? ""}
                onChange={(e) => setF("alturaTecho", e.target.value)}
                placeholder='Ej: "1 piso", "5 pisos"'
                maxLength={50}
              />
            </div>
          </FormSection>

          {/* Eléctricos */}
          <FormSection title="Datos eléctricos">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-[var(--color-text-muted)]">Texto libre — soporta multi-instalación.</p>
              {unifilarVersions.length > 0 && (
                <button
                  type="button"
                  onClick={tryQuickPrefill}
                  className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-2 py-1 text-[10px] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
                >
                  <Sparkles className="w-3 h-3" /> Pre-rellenar desde unifilar
                </button>
              )}
            </div>
            {showVersionPicker && (
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-2">
                <p className="text-[11px] text-[var(--color-text-muted)] mb-1">Elegí qué versión usar:</p>
                <div className="space-y-1 max-h-32 overflow-auto">
                  {unifilarVersions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handlePrefill(v.id)}
                      className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-[var(--color-bg-card-hover)]"
                    >
                      v{v.versionNumber} {v.label ? `· ${v.label}` : ""} · {v.tipoRed}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Cantidad paneles</label>
                <input className={inp} value={form.cantidadPaneles ?? ""} onChange={(e) => setF("cantidadPaneles", e.target.value)} maxLength={100} />
              </div>
              <div>
                <label className={lbl}>Potencia paneles</label>
                <input className={inp} value={form.potenciaPaneles ?? ""} onChange={(e) => setF("potenciaPaneles", e.target.value)} placeholder="ej: 580W" maxLength={50} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Inversor</label>
                <input className={inp} value={form.inversor ?? ""} onChange={(e) => setF("inversor", e.target.value)} placeholder="ej: Growatt de 6kW" maxLength={150} />
              </div>
              <div>
                <label className={lbl}>Strings/Líneas DC</label>
                <input className={inp} value={form.stringsLineasDc ?? ""} onChange={(e) => setF("stringsLineasDc", e.target.value)} maxLength={50} />
              </div>
              <div>
                <label className={lbl}>Cable AC</label>
                <input className={inp} value={form.cableAc ?? ""} onChange={(e) => setF("cableAc", e.target.value)} placeholder="ej: Superplastico 2x6mm2" maxLength={100} />
              </div>
              <div>
                <label className={lbl}>Térmica AC</label>
                <input className={inp} value={form.termicaAc ?? ""} onChange={(e) => setF("termicaAc", e.target.value)} placeholder="ej: 32 A" maxLength={50} />
              </div>
              <div>
                <label className={lbl}>Diferencial AC</label>
                <input className={inp} value={form.diferencialAc ?? ""} onChange={(e) => setF("diferencialAc", e.target.value)} placeholder="ej: 40 A, 300mA" maxLength={50} />
              </div>
              <div>
                <label className={lbl}>Largo cables AC (mts)</label>
                <input className={inp} value={form.largoCablesAcMts ?? ""} onChange={(e) => setF("largoCablesAcMts", e.target.value)} placeholder="ej: 10 mts" maxLength={20} />
              </div>
              <div>
                <label className={lbl}>Largo cables DC (mts)</label>
                <input className={inp} value={form.largoCablesDcMts ?? ""} onChange={(e) => setF("largoCablesDcMts", e.target.value)} placeholder="ej: 15 mts" maxLength={20} />
              </div>
            </div>
          </FormSection>

          {/* Tipo de red */}
          <FormSection title="Tipo de red (multi-select)">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.redMonofasica} onChange={(e) => setF("redMonofasica", e.target.checked)} />
              Monofásica
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.redTrifasica230SN} onChange={(e) => setF("redTrifasica230SN", e.target.checked)} />
              Trifásica 230 (sin neutro)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.redTrifasica400CN} onChange={(e) => setF("redTrifasica400CN", e.target.checked)} />
              Trifásica 400 (con neutro)
            </label>
          </FormSection>

          {/* Notas */}
          <FormSection title="Notas adicionales (opcional)">
            <textarea
              className={klass(inp, "min-h-[80px]")}
              value={form.notasAdicionales ?? ""}
              onChange={(e) => setF("notasAdicionales", e.target.value)}
              rows={4}
              maxLength={2000}
            />
          </FormSection>

          {/* Fotos */}
          <FormSection title={`Fotos del sitio (${totalFotos})`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={fotosUploading}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
            >
              <Upload className="w-3 h-3" /> {fotosUploading ? "Subiendo…" : "Subir fotos"}
            </button>
            {totalFotos > 0 && (
              <ul className="space-y-2 mt-2">
                {form.fotosOrden.map((fileId, idx) => (
                  <li
                    key={fileId}
                    className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-2"
                  >
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-8 text-center">
                      {idx + 1}
                    </span>
                    {fotoPreviews[fileId] && (
                      <img
                        src={fotoPreviews[fileId]}
                        alt=""
                        className="w-12 h-12 object-cover rounded shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                        {fotoNames[fileId] ?? fileId}
                      </p>
                      <input
                        className={klass(inp, "py-1")}
                        placeholder="Etiqueta opcional"
                        value={form.fotosEtiquetas?.[fileId] ?? ""}
                        onChange={(e) => setFotoEtiqueta(fileId, e.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveFoto(fileId, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30"
                        title="Subir"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFoto(fileId, 1)}
                        disabled={idx === totalFotos - 1}
                        className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30"
                        title="Bajar"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFoto(fileId)}
                      className="p-1 rounded hover:bg-red-500/20 text-red-400 shrink-0"
                      title="Quitar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormSection>

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-[var(--color-bg-card)] pb-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMut.isPending || fotosUploading}
              className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {createMut.isPending ? "Generando…" : "Generar PDF y guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

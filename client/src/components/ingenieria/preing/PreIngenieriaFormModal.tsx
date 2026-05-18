import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileText,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  createPreIngenieriaVersion,
  extractMinutaFields,
  uploadPreIngenieriaFoto,
  type ExtractedMinutaFields,
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

// Parser de potenciaPaneles cuando viene como texto (extracción de minuta IA).
// Mirror de server/src/services/efp.snapshots.types.ts::parsePotenciaPanelesW.
// "570 W" → 570 · "5 kW" → 5000 · "590" → 590 · "abc" → null.
function parsePotenciaPanelesWClient(raw: string): number | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  const match = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(kw|w)?/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = match[2];
  return unit === "kw" ? Math.round(value * 1000) : Math.round(value);
}

function countFilledExtracted(f: ExtractedMinutaFields): number {
  let n = 0;
  for (const k of [
    "tipoTecho",
    "tipoTechoOtro",
    "infoTecho",
    "alturaTecho",
    "cantidadPaneles",
    "potenciaPaneles",
    "inversor",
    "stringsLineasDc",
    "cableAc",
    "termicaAc",
    "diferencialAc",
    "largoCablesAcMts",
    "largoCablesDcMts",
    "notasAdicionales",
  ] as const) {
    if (f[k] !== null && f[k] !== "") n++;
  }
  if (f.redMonofasica) n++;
  if (f.redTrifasica230SN) n++;
  if (f.redTrifasica400CN) n++;
  return n;
}

function AiBadge({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span
      title="Sugerido por IA según la minuta"
      className="inline-flex items-center gap-0.5 ml-1 align-middle text-[var(--color-accent)]"
    >
      <Sparkles className="w-3 h-3" />
    </span>
  );
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

  // ── Estado de la minuta IA ────────────────────────────────────────────
  // aiFields: nombres de los campos que la IA pre-rellenó. Cuando el user
  // edita un campo se elimina del set (queda como input "manual").
  const [aiFields, setAiFields] = useState<Set<keyof PreIngenieriaFormInput>>(new Set());
  const [minutaFilename, setMinutaFilename] = useState<string | null>(null);
  const [minutaModel, setMinutaModel] = useState<string | null>(null);
  const minutaInputRef = useRef<HTMLInputElement | null>(null);

  // Versiones de unifilar para el botón "Pre-rellenar"
  const unifilarVersionsQ = useQuery({
    queryKey: ["unifilar-versions", projectId],
    queryFn: () => getUnifilarVersions(projectId),
  });
  const unifilarVersions: UnifilarVersionListItem[] = unifilarVersionsQ.data ?? [];
  const [showVersionPicker, setShowVersionPicker] = useState(false);

  function setF<K extends keyof PreIngenieriaFormInput>(k: K, v: PreIngenieriaFormInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    // Si el user edita un campo marcado como sugerido por IA, sacarle el badge.
    setAiFields((prev) => {
      if (!prev.has(k)) return prev;
      const next = new Set(prev);
      next.delete(k);
      return next;
    });
  }

  // Aplica los campos extraídos por la IA al form. Sólo escribe los que
  // vinieron con valor (no null) y los marca como "sugeridos".
  function applyExtractedFields(fields: ExtractedMinutaFields, modelUsed: string, fileId: string) {
    const aiKeys = new Set<keyof PreIngenieriaFormInput>();
    setForm((f) => {
      const next: PreIngenieriaFormInput = {
        ...f,
        minutaFileId: fileId,
        minutaModelUsed: modelUsed,
      };
      const keys: (keyof ExtractedMinutaFields)[] = [
        "tipoTecho",
        "tipoTechoOtro",
        "infoTecho",
        "alturaTecho",
        "cantidadPaneles",
        "potenciaPaneles",
        "inversor",
        "stringsLineasDc",
        "cableAc",
        "termicaAc",
        "diferencialAc",
        "largoCablesAcMts",
        "largoCablesDcMts",
        "notasAdicionales",
      ];
      for (const k of keys) {
        const value = fields[k];
        if (value === null || value === undefined || value === "") continue;
        // potenciaPaneles: la IA devuelve string ("580W", "5 kW"). El form
        // ahora es number — parseamos detectando unidad kW.
        if (k === "potenciaPaneles" && typeof value === "string") {
          const parsed = parsePotenciaPanelesWClient(value);
          if (parsed !== null) {
            next.potenciaPaneles = parsed;
            aiKeys.add(k);
          }
          continue;
        }
        // TS: cada key es válida en PreIngenieriaFormInput (subset común).
        (next as unknown as Record<string, unknown>)[k] = value;
        aiKeys.add(k);
      }
      // Booleans de red — siempre los aplicamos (true/false son válidos).
      next.redMonofasica = fields.redMonofasica;
      next.redTrifasica230SN = fields.redTrifasica230SN;
      next.redTrifasica400CN = fields.redTrifasica400CN;
      if (fields.redMonofasica) aiKeys.add("redMonofasica");
      if (fields.redTrifasica230SN) aiKeys.add("redTrifasica230SN");
      if (fields.redTrifasica400CN) aiKeys.add("redTrifasica400CN");
      return next;
    });
    setAiFields(aiKeys);
  }

  const extractMut = useMutation({
    mutationFn: (file: File) => extractMinutaFields(projectId, file),
    onSuccess: (res) => {
      applyExtractedFields(res.extractedFields, res.metadata.modelUsed, res.minutaFileId);
      setMinutaModel(res.metadata.modelUsed);
      const filledCount = countFilledExtracted(res.extractedFields);
      toast.success(
        `Minuta procesada · ${filledCount} campos sugeridos. Revisalos antes de guardar.`,
      );
    },
    onError: (err) => {
      const msg = getApiErr(err) ?? "No se pudo procesar la minuta";
      toast.error(msg);
      setMinutaFilename(null);
    },
  });

  function handleMinutaFile(file: File | null) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("La minuta debe ser un PDF");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("La minuta no puede pesar más de 20 MB");
      return;
    }
    if (aiFields.size > 0) {
      const ok = window.confirm(
        "Esto va a sobreescribir los campos sugeridos por IA actuales. ¿Continuar?",
      );
      if (!ok) return;
    }
    setMinutaFilename(file.name);
    extractMut.mutate(file);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
          {/* ── Sección de extracción IA desde minuta ── */}
          <input
            ref={minutaInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              handleMinutaFile(f);
              if (minutaInputRef.current) minutaInputRef.current.value = "";
            }}
          />
          {extractMut.isPending ? (
            <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <div>
                <p className="font-medium">Procesando minuta…</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  Puede tardar 5-15 segundos.
                </p>
              </div>
            </div>
          ) : aiFields.size > 0 && minutaFilename ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-emerald-300 truncate">
                  Minuta procesada ({minutaFilename})
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {aiFields.size} campos sugeridos · revisalos antes de guardar (los marcados con
                  <Sparkles className="inline w-3 h-3 mx-0.5" />
                  son sugerencias).
                </p>
              </div>
              <button
                type="button"
                onClick={() => minutaInputRef.current?.click()}
                className="shrink-0 text-[10px] text-[var(--color-text-secondary)] underline hover:text-[var(--color-text-primary)]"
              >
                Cambiar minuta
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">
                    ¿Tenés la minuta del relevamiento?
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    Subila en PDF y la IA pre-rellena los campos del formulario. Vos revisás y
                    editás antes de generar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => minutaInputRef.current?.click()}
                  className="shrink-0 inline-flex items-center gap-1 rounded border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-3 py-1.5 text-[11px] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
                >
                  <Upload className="w-3 h-3" /> Subir minuta PDF
                </button>
              </div>
              {minutaModel && (
                <p className="text-[9px] font-mono text-[var(--color-text-muted)] mt-1">
                  Última extracción: {minutaModel}
                </p>
              )}
            </div>
          )}

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
              <label className={lbl}>Tipo de techo<AiBadge active={aiFields.has("tipoTecho")} /></label>
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
              <label className={lbl}>Info techo (multi-línea)<AiBadge active={aiFields.has("infoTecho")} /></label>
              <textarea
                className={klass(inp, "min-h-[60px]")}
                value={form.infoTecho ?? ""}
                onChange={(e) => setF("infoTecho", e.target.value)}
                rows={3}
                maxLength={2000}
              />
            </div>
            <div>
              <label className={lbl}>Altura techo<AiBadge active={aiFields.has("alturaTecho")} /></label>
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
                <label className={lbl}>Cantidad paneles<AiBadge active={aiFields.has("cantidadPaneles")} /></label>
                <input className={inp} value={form.cantidadPaneles ?? ""} onChange={(e) => setF("cantidadPaneles", e.target.value)} maxLength={100} placeholder="ej: 9" />
              </div>
              <div>
                <label className={lbl}>
                  Potencia paneles (W)
                  <AiBadge active={aiFields.has("potenciaPaneles")} />
                </label>
                <input
                  className={inp}
                  type="number"
                  min={1}
                  step={1}
                  value={form.potenciaPaneles ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "") {
                      setF("potenciaPaneles", null);
                      return;
                    }
                    const n = parseInt(raw, 10);
                    setF("potenciaPaneles", Number.isFinite(n) && n > 0 ? n : null);
                  }}
                  placeholder="ej: 580"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                  Watts por panel (entero positivo)
                </p>
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>Inversor<AiBadge active={aiFields.has("inversor")} /></label>
                <input className={inp} value={form.inversor ?? ""} onChange={(e) => setF("inversor", e.target.value)} placeholder="ej: Growatt de 6kW" maxLength={150} />
              </div>
              <div>
                <label className={lbl}>Strings/Líneas DC<AiBadge active={aiFields.has("stringsLineasDc")} /></label>
                <input className={inp} value={form.stringsLineasDc ?? ""} onChange={(e) => setF("stringsLineasDc", e.target.value)} maxLength={50} />
              </div>
              <div>
                <label className={lbl}>Cable AC<AiBadge active={aiFields.has("cableAc")} /></label>
                <input className={inp} value={form.cableAc ?? ""} onChange={(e) => setF("cableAc", e.target.value)} placeholder="ej: Superplastico 2x6mm2" maxLength={100} />
              </div>
              <div>
                <label className={lbl}>Térmica AC<AiBadge active={aiFields.has("termicaAc")} /></label>
                <input className={inp} value={form.termicaAc ?? ""} onChange={(e) => setF("termicaAc", e.target.value)} placeholder="ej: 32 A" maxLength={50} />
              </div>
              <div>
                <label className={lbl}>Diferencial AC<AiBadge active={aiFields.has("diferencialAc")} /></label>
                <input className={inp} value={form.diferencialAc ?? ""} onChange={(e) => setF("diferencialAc", e.target.value)} placeholder="ej: 40 A, 300mA" maxLength={50} />
              </div>
              <div>
                <label className={lbl}>Largo cables AC (mts)<AiBadge active={aiFields.has("largoCablesAcMts")} /></label>
                <input className={inp} value={form.largoCablesAcMts ?? ""} onChange={(e) => setF("largoCablesAcMts", e.target.value)} placeholder="ej: 10 mts" maxLength={20} />
              </div>
              <div>
                <label className={lbl}>Largo cables DC (mts)<AiBadge active={aiFields.has("largoCablesDcMts")} /></label>
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

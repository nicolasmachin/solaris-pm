import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { FileDown, Loader2, Maximize2, Plus, Trash2, X } from "lucide-react";
import {
  emitirGabinete,
  patchGabinete,
  previewGabinete,
  type GabineteDetalle,
  type GabineteForm,
} from "../../../api/gabinete.api";

// Constructor del gabinete: formulario a la izquierda, lámina a la derecha.
//
// El preview es el SVG que devuelve el server —el mismo código que dibuja el
// PDF—, pedido con debounce mientras se escribe. Se genera en el server a
// propósito: si el dibujo se reimplementara en el cliente, el preview y el
// entregable se despegarían a la primera corrección de geometría.

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1";

function NumField({
  label,
  value,
  onChange,
  step = 0.5,
  suffix = "cm",
  placeholder,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step?: number;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={lbl}>
        {label} <span className="normal-case tracking-normal">({suffix})</span>
      </label>
      <input
        type="number"
        step={step}
        min={0}
        className={inp}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input className={inp} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-1">
        {title}
      </p>
      {children}
    </div>
  );
}

export function GabineteBuilder({
  gabinete,
  projectId,
  onClose,
}: {
  gabinete: GabineteDetalle;
  projectId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<GabineteForm>(() => ({ ...gabinete }));
  const [hojas, setHojas] = useState<string[] | null>(null);
  // Ver la lámina en grande sin tener que descargar el PDF.
  const [ampliada, setAmpliada] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(true);

  function set<K extends keyof GabineteForm>(k: K, v: GabineteForm[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  // Preview con debounce: 450 ms sin tipear y se redibuja.
  const lastRequest = useRef(0);
  useEffect(() => {
    const t = setTimeout(async () => {
      const ticket = ++lastRequest.current;
      setLoadingPreview(true);
      try {
        const out = await previewGabinete({ ...form, projectId });
        // Descartar respuestas viejas que llegan fuera de orden.
        if (ticket === lastRequest.current) {
          setHojas(out);
          setPreviewError(false);
        }
      } catch {
        if (ticket === lastRequest.current) setPreviewError(true);
      } finally {
        if (ticket === lastRequest.current) setLoadingPreview(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [form, projectId]);

  const saveMut = useMutation({
    mutationFn: () => patchGabinete(gabinete.id, form),
    onSuccess: () => {
      toast.success("Gabinete guardado");
      qc.invalidateQueries({ queryKey: ["gabinetes", projectId] });
      qc.invalidateQueries({ queryKey: ["gabinete", gabinete.id] });
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  const emitMut = useMutation({
    // Guardar antes de emitir: la lámina tiene que salir con lo que está en
    // pantalla, no con lo último guardado.
    mutationFn: async () => {
      await patchGabinete(gabinete.id, form);
      return emitirGabinete(gabinete.id);
    },
    onSuccess: (v) => {
      toast.success(`Lámina v${v.versionNumber} emitida`);
      qc.invalidateQueries({ queryKey: ["gabinetes", projectId] });
      qc.invalidateQueries({ queryKey: ["gabinete", gabinete.id] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
    },
    onError: () => toast.error("No se pudo emitir la lámina"),
  });

  const specsExtra = form.specsExtra ?? [];
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify({ ...gabinete } as GabineteForm),
    [form, gabinete],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,1fr)_1.9fr] gap-5">
      {/* ── Formulario ── */}
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        <Section title="Identificación">
          <TextField label="Nombre del gabinete" value={form.nombre} onChange={(v) => set("nombre", v)} />
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Cantidad a fabricar"
              suffix="un"
              step={1}
              value={form.cantidad}
              onChange={(v) => set("cantidad", v ?? 1)}
            />
          </div>
        </Section>

        <p className="text-[11px] text-[var(--color-text-muted)] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
          Todo se fabrica en <strong>chapa plegada</strong> y se pide <strong>sin herrajes y sin
          perforar</strong>: la tapa va suelta, y los agujeros de amure los hacés en obra. Todas las
          medidas vienen con un valor por defecto y salen impresas en la lámina; ninguna queda sin
          definir.
        </p>

        <Section title="Medidas exteriores">
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Ancho" value={form.anchoCm} onChange={(v) => set("anchoCm", v ?? 0)} />
            <NumField label="Alto" value={form.altoCm} onChange={(v) => set("altoCm", v ?? 0)} />
            <NumField label="Profundidad" value={form.profundidadCm} onChange={(v) => set("profundidadCm", v ?? 0)} />
          </div>
        </Section>

        <Section title="Construcción">
          <div className="flex flex-wrap gap-4">
            <Check label="Fondo abierto (sin placa)" checked={form.fondoAbierto} onChange={(v) => set("fondoAbierto", v)} />
            <Check label="Pestaña de amure" checked={form.pestanaAmure} onChange={(v) => set("pestanaAmure", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {form.pestanaAmure && (
              <NumField
                label="Ancho de pestaña"
                value={form.pestanaAnchoCm}
                onChange={(v) => set("pestanaAnchoCm", v ?? 0)}
              />
            )}

          </div>
        </Section>

        <Section title="Armado del cuerpo">
          <TextField label="Armado" value={form.union} onChange={(v) => set("union", v)} placeholder="Dos piezas en L atornilladas" />
          <TextField
            label="Fijación / tornillos"
            value={form.tornillos}
            onChange={(v) => set("tornillos", v)}
            placeholder="Tornillo punta mecha tipo T1"
          />
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Solape de unión entre piezas"
              value={form.solapeUnionCm}
              onChange={(v) => set("solapeUnionCm", v ?? 0)}
            />
            <NumField
              label="Paso de tornillos"
              value={form.pasoTornillosCm}
              onChange={(v) => set("pasoTornillosCm", v ?? 0)}
            />
          </div>
        </Section>

        <Section title="Chapa y terminación">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Material" value={form.material} onChange={(v) => set("material", v)} />
            <NumField label="Espesor de chapa" suffix="mm" step={0.1} value={form.espesorMm} onChange={(v) => set("espesorMm", v ?? 0)} />
            <TextField label="Acabado" value={form.acabado} onChange={(v) => set("acabado", v)} />
          </div>
        </Section>

        <Section title="Notas y extras">
          <NumField label="Tolerancia general" suffix="mm" step={0.5} value={form.toleranciaMm} onChange={(v) => set("toleranciaMm", v ?? 0)} />
          <div>
            <label className={lbl}>Notas al fabricante</label>
            <textarea
              className={`${inp} resize-none`}
              rows={3}
              value={form.notas ?? ""}
              onChange={(e) => set("notas", e.target.value)}
              placeholder="Una nota por renglón. Se imprimen en el recuadro NOTAS de la lámina."
            />
          </div>

          {/* Especificaciones extra: lo que el fabricante pida y todavía no
              tenga campo propio. Evita tener que tocar la app por cada dato
              nuevo que aparece en una conversación con el taller. */}
          <div className="space-y-2">
            <label className={lbl}>Especificaciones adicionales</label>
            {specsExtra.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inp}
                  placeholder="Etiqueta"
                  value={s.etiqueta}
                  onChange={(e) => {
                    const next = [...specsExtra];
                    next[i] = { ...next[i], etiqueta: e.target.value };
                    set("specsExtra", next);
                  }}
                />
                <input
                  className={inp}
                  placeholder="Valor"
                  value={s.valor}
                  onChange={(e) => {
                    const next = [...specsExtra];
                    next[i] = { ...next[i], valor: e.target.value };
                    set("specsExtra", next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => set("specsExtra", specsExtra.filter((_, j) => j !== i))}
                  className="shrink-0 p-2 rounded hover:bg-red-500/15 text-red-400"
                  title="Quitar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set("specsExtra", [...specsExtra, { etiqueta: "", valor: "" }])}
              className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar especificación
            </button>
          </div>
        </Section>
      </div>

      {/* ── Lámina ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
            Lámina para el fabricante
            {loadingPreview && <Loader2 className="inline w-3 h-3 ml-2 animate-spin" />}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmpliada(true)}
              disabled={!hojas}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50 inline-flex items-center gap-1.5"
              title="Ver la lámina en grande"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Ampliar
            </button>
            <button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !dirty}
              className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
            >
              {saveMut.isPending ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
            </button>
            <button
              type="button"
              onClick={() => emitMut.mutate()}
              disabled={emitMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-gray-900 text-xs font-semibold hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
            >
              <FileDown className="w-3.5 h-3.5" />
              {emitMut.isPending ? "Emitiendo…" : "Emitir lámina (PDF)"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-white p-2 overflow-auto max-h-[78vh] space-y-3">
          {previewError ? (
            <p className="p-8 text-center text-sm text-red-500">No se pudo generar la vista previa.</p>
          ) : hojas ? (
            hojas.map((hoja, i) => (
              <div key={i}>
                {/* La lámina es de una hoja; el rótulo solo aparece si alguna
                    vez vuelve a tener más de una. */}
                {hojas.length > 1 && (
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-1 px-1">
                    Hoja {i + 1} de {hojas.length}
                  </p>
                )}
                {/* El SVG lo genera nuestro propio backend a partir de datos
                    validados con Zod; no hay HTML de terceros acá. */}
                <div className="[&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: hoja }} />
              </div>
            ))
          ) : (
            <p className="p-8 text-center text-sm text-[var(--color-text-muted)]">Generando vista previa…</p>
          )}
        </div>

        <button type="button" onClick={onClose} className="text-xs text-[var(--color-text-muted)] hover:underline">
          ← Volver a la lista de gabinetes
        </button>
      </div>

      {/* Lámina ampliada: ocupa casi toda la pantalla, para revisarla sin
          descargar el PDF. Escape o click afuera la cierran. */}
      {ampliada && hojas && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAmpliada(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setAmpliada(false);
          }}
          role="dialog"
          aria-label="Lámina del gabinete"
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          <div className="relative bg-white rounded-lg shadow-2xl max-h-[95vh] w-full max-w-[min(900px,95vw)] overflow-auto">
            <button
              type="button"
              onClick={() => setAmpliada(false)}
              aria-label="Cerrar"
              className="sticky top-2 left-full mr-2 z-10 rounded-full bg-white/90 border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-3 -mt-8">
              {hojas.map((h, i) => (
                <div key={i} className="[&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: h }} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

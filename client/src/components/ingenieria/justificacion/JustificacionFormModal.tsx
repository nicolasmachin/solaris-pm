import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import {
  crearJustificacion,
  getTextosAutomaticos,
  redactarConIa,
  type CargaJustificacion,
  type DatosJustificacion,
  type JustificacionEstado,
  type TextosJustificacion,
} from "../../../api/justificacionPotencia.api";
import { LargeModal } from "../../ui/LargeModal";
import { getApiErr, inp, klass, lbl } from "../preing/shared";
import {
  balance,
  CARGAS_SUGERIDAS,
  cargaDesdeSugerida,
  cargaLibre,
  cargaUnificacion,
  fmt,
  kwhMes,
  MOTIVOS,
} from "./catalogo";

const TEXTOS_VACIOS: TextosJustificacion = { objeto: "", antecedentes: "", justificacion: "", conclusion: "" };

const SECCIONES_TEXTO: { key: keyof TextosJustificacion; titulo: string }[] = [
  { key: "objeto", titulo: "Objeto del informe" },
  { key: "antecedentes", titulo: "Antecedentes" },
  { key: "justificacion", titulo: "Justificación del sistema fotovoltaico" },
  { key: "conclusion", titulo: "Conclusión" },
];

function datosIniciales(estado: JustificacionEstado): DatosJustificacion {
  const ctx = estado.contexto;
  const prev = estado.ultimaVersionDatos;
  if (prev) {
    // Se arranca de la última versión, pero con los datos del cliente al día.
    return { ...prev, cliente: { ...prev.cliente, ...soloLlenos(ctx.cliente, prev.cliente) } };
  }
  return {
    tipoSolicitud: "NUEVA",
    cliente: ctx.cliente,
    firmante: ctx.firmante,
    potenciaSolicitadaKw: ctx.potenciaSolicitadaKw ?? 0,
    potenciaUteKw: null,
    consumoAnualActualKwh: null,
    productividadKwhKw: 1450,
    motivoAntecedente: "NUEVAS_CARGAS",
    cargas: [],
    textos: TEXTOS_VACIOS,
  };
}

/** Lo que el proyectista tocó en la versión anterior no se pisa con vacíos. */
function soloLlenos<T extends Record<string, unknown>>(nuevo: T, viejo: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(nuevo) as (keyof T)[]) {
    const v = nuevo[k];
    if (typeof v === "string" ? v.trim() !== "" && !String(viejo[k] ?? "").trim() : false) out[k] = v;
  }
  return out;
}

export function JustificacionFormModal({
  projectId,
  estado,
  onClose,
}: {
  projectId: string;
  estado: JustificacionEstado;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [datos, setDatos] = useState<DatosJustificacion>(() => datosIniciales(estado));
  const [textosConIa, setTextosConIa] = useState(false);
  // Los textos de la versión anterior traen sus números: si cambian las cargas o
  // la potencia, quedarían viejos en el PDF. Se avisa hasta que se rehacen.
  const [textosHeredados, setTextosHeredados] = useState(
    () => !!estado.ultimaVersionDatos && SECCIONES_TEXTO.some((s) => estado.ultimaVersionDatos!.textos[s.key]?.trim()),
  );
  const b = useMemo(() => balance(datos), [datos]);

  const set = <K extends keyof DatosJustificacion>(k: K, v: DatosJustificacion[K]) => setDatos((d) => ({ ...d, [k]: v }));
  const setCarga = (id: string, patch: Partial<CargaJustificacion>) =>
    setDatos((d) => ({ ...d, cargas: d.cargas.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const quitarCarga = (id: string) => setDatos((d) => ({ ...d, cargas: d.cargas.filter((c) => c.id !== id) }));
  const agregarCarga = (c: CargaJustificacion) => setDatos((d) => ({ ...d, cargas: [...d.cargas, c] }));
  const conceptosUsados = new Set(datos.cargas.map((c) => c.concepto));

  const textosLlenos = SECCIONES_TEXTO.some((s) => datos.textos[s.key].trim());

  function validar(): string | null {
    if (!(datos.potenciaSolicitadaKw > 0)) return "Falta la potencia de generación solicitada.";
    if (datos.cargas.length === 0) return "Agregá al menos una carga proyectada.";
    if (datos.cargas.some((c) => !c.concepto.trim())) return "Hay cargas sin concepto.";
    // Una fila en 0 kWh en el informe a UTE no suma y se ve como un descuido.
    const vacia = datos.cargas.find((c) => !(kwhMes(c) > 0));
    if (vacia) return `"${vacia.concepto}" da 0 kWh/mes: completale los valores o quitala.`;
    if (!datos.cliente.nombre.trim()) return "Falta el nombre del cliente.";
    if (!datos.firmante.nombre.trim()) return "Falta el ingeniero responsable.";
    return null;
  }

  const autoMut = useMutation({
    mutationFn: () => getTextosAutomaticos(projectId, datos),
    onSuccess: (t) => {
      set("textos", t);
      setTextosConIa(false);
      setTextosHeredados(false);
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudieron armar los textos"),
  });
  const iaMut = useMutation({
    mutationFn: () => redactarConIa(projectId, datos),
    onSuccess: (t) => {
      set("textos", t);
      setTextosConIa(true);
      setTextosHeredados(false);
      toast.success("Textos redactados. Revisalos antes de generar.");
    },
    onError: (e) => toast.error(getApiErr(e) ?? "La IA no pudo redactar los textos"),
  });
  const crearMut = useMutation({
    mutationFn: () => crearJustificacion(projectId, datos, textosConIa),
    onSuccess: (r) => {
      toast.success(`Informe v${r.versionNumber} generado. Quedó en Documentos del proyecto.`);
      qc.invalidateQueries({ queryKey: ["justificacion-potencia", projectId] });
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["ingenieria-workspace", projectId] });
      onClose();
    },
    onError: (e) => toast.error(getApiErr(e) ?? "No se pudo generar el informe"),
  });

  function pedirTextos(tipo: "auto" | "ia") {
    const err = validar();
    if (err) return toast.error(err);
    if (textosLlenos && !confirm("Esto reemplaza los textos que ya están escritos. ¿Seguir?")) return;
    // La IA también lee lo escrito: no se vacía antes de mandarlo.
    if (tipo === "auto") autoMut.mutate();
    else iaMut.mutate();
  }

  function generar() {
    const err = validar();
    if (err) return toast.error(err);
    crearMut.mutate();
  }

  const ocupado = autoMut.isPending || iaMut.isPending || crearMut.isPending;

  return (
    <LargeModal open onClose={onClose} size="wide" ariaLabel="Justificación de potencia ante UTE">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <header>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Justificación de potencia ante UTE</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Para cuando UTE contesta que el balance anual de la cuenta da para menos potencia que la pedida. Se proyecta el
            consumo que viene y se compara con lo que va a generar la planta en un año.
          </p>
        </header>

        {/* 1. Qué contestó UTE */}
        <Seccion titulo="1. La consulta a UTE">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={lbl}>Tipo de solicitud</label>
              <select
                className={inp}
                value={datos.tipoSolicitud}
                onChange={(e) => set("tipoSolicitud", e.target.value as DatosJustificacion["tipoSolicitud"])}
              >
                <option value="NUEVA">Microgeneración nueva</option>
                <option value="AMPLIACION">Ampliación</option>
              </select>
            </div>
            <NumField label="Potencia pedida (kW)" value={datos.potenciaSolicitadaKw} onChange={(v) => set("potenciaSolicitadaKw", v ?? 0)} />
            <NumField label="UTE dice que da (kW)" value={datos.potenciaUteKw} onChange={(v) => set("potenciaUteKw", v)} placeholder="opcional" />
            <NumField
              label="Consumo último año (kWh)"
              value={datos.consumoAnualActualKwh}
              onChange={(v) => set("consumoAnualActualKwh", v)}
              placeholder={
                b.consumoEstimadoDesdeUte ? `≈ ${fmt(b.consumoActual)} según UTE` : "vacío si es cuenta nueva"
              }
            />
          </div>
        </Seccion>

        {/* 2. Situación */}
        <Seccion titulo="2. Por qué el consumo actual no sirve para dimensionar">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MOTIVOS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => set("motivoAntecedente", m.value)}
                className={klass(
                  "rounded border px-3 py-2 text-left",
                  datos.motivoAntecedente === m.value
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]",
                )}
              >
                <p className="text-xs font-medium text-[var(--color-text-primary)]">{m.label}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{m.ayuda}</p>
              </button>
            ))}
          </div>
        </Seccion>

        {/* 3. Cargas */}
        <Seccion titulo="3. Cargas proyectadas">
          <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
            Tocá una sugerencia para sumarla con valores típicos y ajustalos. Cada carga se estima desglosada (kW × horas por
            día × días por mes × cantidad) o con un total mensual.
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CARGAS_SUGERIDAS.map((s) => (
              <button
                key={s.key}
                type="button"
                disabled={conceptosUsados.has(s.concepto)}
                onClick={() => agregarCarga(cargaDesdeSugerida(s))}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-40"
              >
                <Plus className="h-3 w-3" /> {s.concepto}
              </button>
            ))}
            <button
              type="button"
              onClick={() => agregarCarga(cargaLibre())}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-accent)] px-2.5 py-1 text-[11px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Plus className="h-3 w-3" /> Otra carga
            </button>
            <button
              type="button"
              onClick={() => agregarCarga(cargaUnificacion())}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-accent)] px-2.5 py-1 text-[11px] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
            >
              <Plus className="h-3 w-3" /> Cuenta UTE que se unifica
            </button>
          </div>

          {datos.cargas.length === 0 ? (
            <p className="rounded border border-dashed border-[var(--color-border)] p-4 text-center text-xs text-[var(--color-text-muted)]">
              Todavía no hay cargas.
            </p>
          ) : (
            <ul className="space-y-2">
              {datos.cargas.map((c) => (
                <CargaRow key={c.id} carga={c} onChange={(p) => setCarga(c.id, p)} onRemove={() => quitarCarga(c.id)} />
              ))}
            </ul>
          )}
        </Seccion>

        {/* 4. Balance */}
        <Seccion titulo="4. Balance anual de energía">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dato
              label={b.consumoEstimadoDesdeUte ? "Consumo actual (según UTE)" : "Consumo actual"}
              valor={b.consumoActual > 0 ? `${fmt(b.consumoActual)} kWh/año` : "Cuenta nueva"}
            />
            <Dato label="Nuevas cargas" valor={`${fmt(b.incrementoMensual)} kWh/mes`} />
            <Dato label="Consumo anual proyectado" valor={`${fmt(b.consumoProyectado)} kWh`} />
            <Dato label={`Generación de ${fmt(datos.potenciaSolicitadaKw, 2)} kW`} valor={`${fmt(b.generacion)} kWh/año`} />
            <NumField
              label="kWh por kW al año"
              value={datos.productividadKwhKw}
              onChange={(v) => set("productividadKwhKw", v ?? 1450)}
            />
          </div>
          {datos.cargas.length > 0 && datos.potenciaSolicitadaKw > 0 && (
            <div
              className={klass(
                "mt-3 flex items-start gap-2 rounded border px-3 py-2 text-xs",
                b.cumple ? "border-green-500/40 bg-green-500/10" : "border-amber-500/40 bg-amber-500/10",
              )}
            >
              {b.cumple ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <p className="text-[var(--color-text-primary)]">
                {b.cumple
                  ? `Da el balance: la planta genera menos de lo que se va a consumir. El consumo proyectado justifica hasta ${fmt(b.potenciaJustificada, 2)} kW.`
                  : `No da el balance: con este consumo se justifican hasta ${fmt(b.potenciaJustificada, 2)} kW. Sumá cargas o el informe va a concluir en esa potencia.`}
              </p>
            </div>
          )}
        </Seccion>

        {/* 5. Encabezado */}
        <Seccion titulo="5. Datos del encabezado">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField label="Cliente" value={datos.cliente.nombre} onChange={(v) => set("cliente", { ...datos.cliente, nombre: v })} />
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <TextField
                label={datos.cliente.esEmpresa ? "RUT" : "C.I."}
                value={datos.cliente.documento}
                onChange={(v) => set("cliente", { ...datos.cliente, documento: v })}
              />
              <label className="mb-1.5 flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)]">
                <input
                  type="checkbox"
                  checked={datos.cliente.esEmpresa}
                  onChange={(e) => set("cliente", { ...datos.cliente, esEmpresa: e.target.checked })}
                />
                Empresa
              </label>
            </div>
            <TextField label="Cuenta UTE" value={datos.cliente.cuentaUte} onChange={(v) => set("cliente", { ...datos.cliente, cuentaUte: v })} />
            <TextField label="Ubicación" value={datos.cliente.ubicacion} onChange={(v) => set("cliente", { ...datos.cliente, ubicacion: v })} />
            <TextField label="Ingeniero responsable" value={datos.firmante.nombre} onChange={(v) => set("firmante", { ...datos.firmante, nombre: v })} />
            <TextField label="C.I. del ingeniero" value={datos.firmante.ci} onChange={(v) => set("firmante", { ...datos.firmante, ci: v })} />
          </div>
        </Seccion>

        {/* 6. Textos */}
        <Seccion titulo="6. Textos del informe">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => pedirTextos("auto")}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
            >
              {autoMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Completar con
              texto automático
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => pedirTextos("ia")}
              className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
            >
              {iaMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Redactar con IA
            </button>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Lo que quede vacío se completa solo con el texto automático al generar.
            </p>
          </div>
          {textosHeredados && (
            <div className="mb-3 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-[var(--color-text-primary)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>
                Estos textos vienen de la versión anterior. Si cambiaste cargas, consumos o la potencia, sus números
                quedaron viejos: volvé a completarlos (automático o IA) o corregilos a mano.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {SECCIONES_TEXTO.map((s) => (
              <div key={s.key}>
                <label className={lbl}>{s.titulo}</label>
                <AutoTextarea
                  value={datos.textos[s.key]}
                  placeholder="Vacío = texto automático"
                  onChange={(v) => set("textos", { ...datos.textos, [s.key]: v })}
                />
              </div>
            ))}
          </div>
        </Seccion>

        <footer className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-app)] px-4 py-3 sm:-mx-6 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs hover:bg-[var(--color-bg-card-hover)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={generar}
            className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {crearMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />} Generar informe PDF
          </button>
        </footer>
      </div>
    </LargeModal>
  );
}

// ─── Piezas ─────────────────────────────────────────────────────────────────

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <h3 className="mb-3 text-xs font-semibold text-[var(--color-text-primary)]">{titulo}</h3>
      {children}
    </section>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5">
      <p className={lbl}>{label}</p>
      <p className="font-mono text-xs text-[var(--color-text-primary)]">{valor}</p>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={lbl}>{label}</label>
      <input className={inp} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * "1.600" → 1600 (miles con punto), "2,5" → 2.5, y también "2.5" → 2.5: el
 * punto es de miles solo si lo siguen exactamente tres dígitos.
 */
function parseNum(t: string): number | null {
  const s = t.trim().replace(/\s/g, "");
  if (s === "") return null;
  const normal = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(s)
      ? s.replace(/\./g, "")
      : s;
  const n = Number(normal);
  return Number.isFinite(n) ? n : null;
}

/** Acepta coma o punto decimal; guarda número o null. */
function NumInput({
  value,
  onChange,
  placeholder,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  const [txt, setTxt] = useState(value == null ? "" : String(value).replace(".", ","));
  useEffect(() => {
    if (parseNum(txt) !== (value ?? null)) setTxt(value == null ? "" : String(value).replace(".", ","));
    // Solo se resincroniza cuando el valor cambia desde afuera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      className={inp}
      inputMode="decimal"
      placeholder={placeholder}
      value={txt}
      onChange={(e) => {
        const t = e.target.value;
        setTxt(t);
        if (t.trim() === "") return onChange(null);
        const n = parseNum(t);
        if (n !== null) onChange(n);
      }}
    />
  );
}

function NumField(props: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={lbl}>{props.label}</label>
      <NumInput value={props.value} onChange={props.onChange} placeholder={props.placeholder} />
    </div>
  );
}

function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      className={klass(inp, "min-h-[72px] resize-y leading-relaxed")}
      rows={Math.min(10, Math.max(3, Math.ceil(value.length / 110) + value.split("\n").length - 1))}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CargaRow({
  carga: c,
  onChange,
  onRemove,
}: {
  carga: CargaJustificacion;
  onChange: (p: Partial<CargaJustificacion>) => void;
  onRemove: () => void;
}) {
  const esUnif = c.tipo === "UNIFICACION";
  return (
    <li className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className={inp}
              value={c.concepto}
              placeholder={esUnif ? "Ej.: Unificación de cuenta UTE" : "Ej.: Bomba de calor para piscina"}
              onChange={(e) => onChange({ concepto: e.target.value })}
            />
            {!esUnif && (
              <div className="flex rounded border border-[var(--color-border)] text-[11px]">
                {(["DESGLOSE", "DIRECTO"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onChange({ modo: m })}
                    className={klass(
                      "px-2 py-1",
                      c.modo === m ? "bg-[var(--color-accent)] font-semibold text-black" : "text-[var(--color-text-secondary)]",
                    )}
                  >
                    {m === "DESGLOSE" ? "Desglosada" : "Total mensual"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {esUnif ? (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={lbl}>Cuenta UTE</label>
                <input className={inp} value={c.cuentaUte ?? ""} onChange={(e) => onChange({ cuentaUte: e.target.value })} />
              </div>
              <NumField label="Pot. contratada (kW)" value={c.potenciaContratadaKw} onChange={(v) => onChange({ potenciaContratadaKw: v })} />
              <NumField label="Consumo (kWh/mes)" value={c.kwhMes} onChange={(v) => onChange({ kwhMes: v })} />
            </div>
          ) : c.modo === "DIRECTO" ? (
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Consumo (kWh/mes)" value={c.kwhMes} onChange={(v) => onChange({ kwhMes: v })} />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <NumField label="Potencia (kW)" value={c.potenciaKw} onChange={(v) => onChange({ potenciaKw: v })} />
              <NumField label="Horas/día" value={c.horasDia} onChange={(v) => onChange({ horasDia: v })} />
              <NumField label="Días/mes" value={c.diasMes} onChange={(v) => onChange({ diasMes: v })} />
              <NumField label="Cantidad" value={c.cantidad} onChange={(v) => onChange({ cantidad: v })} />
            </div>
          )}

          <input
            className={inp}
            value={c.detalle ?? ""}
            placeholder="Detalle opcional para el informe (ej.: cinco cabañas para alquiler con climatización y heladera)"
            onChange={(e) => onChange({ detalle: e.target.value })}
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="font-mono text-xs text-[var(--color-text-primary)]">{fmt(kwhMes(c))} kWh/mes</p>
          <button type="button" onClick={onRemove} className="rounded p-1 text-red-400 hover:bg-red-500/20" title="Quitar">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

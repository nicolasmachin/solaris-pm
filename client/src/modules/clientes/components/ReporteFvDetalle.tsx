import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, FileText, Plus, RefreshCw, Send, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { usePermission } from "../../../hooks/usePermission";
import { useAuthBlobUrl } from "../../../hooks/useAuthBlobUrl";
import { LargeModal } from "../../../components/ui/LargeModal";
import { Spinner } from "../../../components/ui/Spinner";
import {
  emitirReporte,
  enviarReporte,
  getDetalleGenerador,
  guardarConfig,
  guardarLectura,
  recalcularGenerador,
  reporteFvPdfUrl,
  type DestinatarioDto,
  type DetalleGenerador,
  type GuardarConfigInput,
} from "../../../api/reportesFv.api";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";
const num = `${inp} text-right tabular-nums`;

const MESES_CORTO = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];
/** "jun 2026" a partir de un periodo "YYYY-MM". */
function mesLabel(periodo: string): string {
  const [a, m] = periodo.split("-");
  return `${MESES_CORTO[Number(m) - 1] ?? m} ${a}`;
}

type Tab = "config" | "lectura" | "pdf";

interface Props {
  projectId: string;
  periodo: string;
  onClose: () => void;
}

export function ReporteFvDetalle({ projectId, periodo, onClose }: Props) {
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const canSend = usePermission("EXPERIENCIA_CLIENTES", "COMPLETE");
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("config");

  const { data: detalle, isLoading } = useQuery({
    queryKey: ["reportes-fv", "detalle", projectId],
    queryFn: () => getDetalleGenerador(projectId),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["reportes-fv", "detalle", projectId] });
    qc.invalidateQueries({ queryKey: ["reportes-fv", "panel"] });
  };

  return (
    <LargeModal open onClose={onClose} size="wide" ariaLabel="Detalle del reporte fotovoltaico">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">
            {detalle?.clientName ?? "Generador"}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">Reporte fotovoltaico · {periodo}</p>
        </div>
      </div>

      {isLoading || !detalle ? (
        <div className="flex-1 p-8">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-[var(--color-border)] px-5">
            {([
              ["config", "Configuración"],
              ["lectura", "Lectura del mes"],
              ["pdf", "Reporte / PDF"],
            ] as [Tab, string][]).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                  tab === t
                    ? "border-[var(--color-accent)] font-medium text-[var(--color-text-primary)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto p-5">
            {tab === "config" && (
              <ConfigTab detalle={detalle} canEdit={canEdit} onSaved={invalidar} />
            )}
            {tab === "lectura" && (
              <LecturaTab
                detalle={detalle}
                periodo={periodo}
                canEdit={canEdit}
                onSaved={invalidar}
              />
            )}
            {tab === "pdf" && (
              <PdfTab
                detalle={detalle}
                periodo={periodo}
                canCreate={canCreate}
                canSend={canSend}
                onEmitido={invalidar}
              />
            )}
          </div>
        </>
      )}
    </LargeModal>
  );
}

// ─── Configuración ────────────────────────────────────────────────────────────

function ConfigTab({
  detalle,
  canEdit,
  onSaved,
}: {
  detalle: DetalleGenerador;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const c = detalle.config;
  const [form, setForm] = useState<GuardarConfigInput>(() => ({
    habilitado: c?.habilitado ?? true,
    tipoCliente: c?.tipoCliente ?? "residencial",
    tarifaContratada: c?.tarifaContratada ?? null,
    origenDatos: c?.origenDatos ?? "GROWATT",
    potenciaContratadaKw: c?.potenciaContratadaKw ?? null,
    pctPunta: c?.pctPunta != null ? c.pctPunta * 100 : null,
    pctLlano: c?.pctLlano != null ? c.pctLlano * 100 : null,
    pctValle: c?.pctValle != null ? c.pctValle * 100 : null,
    inversionUsd: c?.inversionUsd ?? null,
    potenciaInstaladaKwp: c?.potenciaInstaladaKwp ?? null,
    mesInicio: c?.mesInicio ?? null,
    growattPlantId: c?.growattPlantId ?? null,
    notasFijas: c?.notasFijas ?? null,
    diaCorteMedidor: c?.diaCorteMedidor ?? null,
  }));
  const [destinatarios, setDestinatarios] = useState<DestinatarioDto[]>(c?.destinatarios ?? []);

  const guardar = useMutation({
    mutationFn: () =>
      guardarConfig(detalle.projectId, {
        ...form,
        destinatarios,
      }),
    onSuccess: () => {
      toast.success(detalle.dadoDeAlta ? "Configuración guardada" : "Generador dado de alta");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo guardar"),
  });

  const set = <K extends keyof GuardarConfigInput>(k: K, v: GuardarConfigInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const numeroOrNull = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  const efectivo = c?.efectivo;

  return (
    <div className="max-w-3xl space-y-5">
      {!detalle.dadoDeAlta && (
        <div className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          Este generador todavía <strong>no está dado de alta</strong> en la herramienta de reportes.
          Completá la potencia contratada y el reparto por franja horaria para darlo de alta. El resto
          hereda del proyecto.
        </div>
      )}

      {efectivo && (efectivo.bloqueosCalculo.length > 0 || efectivo.advertencias.length > 0) && (
        <div className="space-y-1.5">
          {efectivo.bloqueosCalculo.map((b) => (
            <div key={b} className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {b}
            </div>
          ))}
          {efectivo.advertencias.map((a) => (
            <div key={a} className="flex items-start gap-2 text-sm text-amber-400">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {a}
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={form.habilitado ?? true}
            disabled={!canEdit}
            onChange={(e) => set("habilitado", e.target.checked)}
          />
          Recibe reporte (habilitado)
        </label>

        <div>
          <label className={lbl}>Origen de datos</label>
          <select
            className={inp}
            value={form.origenDatos}
            disabled={!canEdit}
            onChange={(e) => set("origenDatos", e.target.value as "GROWATT" | "MANUAL")}
          >
            <option value="GROWATT">Growatt (automático)</option>
            <option value="MANUAL">Manual (otra marca)</option>
          </select>
        </div>

        <div>
          <label className={lbl}>Tipo de cliente</label>
          <select
            className={inp}
            value={form.tipoCliente}
            disabled={!canEdit}
            onChange={(e) => set("tipoCliente", e.target.value as "residencial" | "empresa")}
          >
            <option value="residencial">Residencial</option>
            <option value="empresa">Empresa</option>
          </select>
        </div>

        {form.tipoCliente === "empresa" && (
          <div>
            <label className={lbl}>Tarifa contratada</label>
            <select
              className={inp}
              value={form.tarifaContratada ?? ""}
              disabled={!canEdit}
              onChange={(e) => set("tarifaContratada", (e.target.value || null) as any)}
            >
              <option value="">— elegir —</option>
              <option value="simple">Simple</option>
              <option value="doble">Doble horario</option>
              <option value="triple">Triple horario</option>
              <option value="zafral">Zafral</option>
            </select>
          </div>
        )}

        <div>
          <label className={lbl}>Potencia contratada UTE (kW)</label>
          <input
            type="number"
            step="0.1"
            className={num}
            value={form.potenciaContratadaKw ?? ""}
            disabled={!canEdit}
            onChange={(e) => set("potenciaContratadaKw", numeroOrNull(e.target.value))}
          />
        </div>

        <div>
          <label className={lbl}>Growatt plant ID</label>
          <input
            className={inp}
            value={form.growattPlantId ?? ""}
            disabled={!canEdit}
            placeholder="(opcional)"
            onChange={(e) => set("growattPlantId", e.target.value || null)}
          />
        </div>
      </div>

      {/* Reparto de franjas */}
      <div>
        <div className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          Reparto de consumo por franja (%) — debe sumar 100
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["pctPunta", "pctLlano", "pctValle"] as const).map((k, i) => (
            <div key={k}>
              <label className={lbl}>{["Punta", "Llano", "Valle"][i]}</label>
              <input
                type="number"
                step="1"
                className={num}
                value={form[k] ?? ""}
                disabled={!canEdit}
                onChange={(e) => set(k, numeroOrNull(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Overrides opcionales */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={lbl}>Inversión USD {c && form.inversionUsd == null ? "(hereda)" : ""}</label>
          <input
            type="number"
            className={num}
            value={form.inversionUsd ?? ""}
            disabled={!canEdit}
            placeholder={detalle.proyecto.budgetUsd != null ? String(detalle.proyecto.budgetUsd) : "—"}
            onChange={(e) => set("inversionUsd", numeroOrNull(e.target.value))}
          />
        </div>
        <div>
          <label className={lbl}>Potencia instalada kWp {c && form.potenciaInstaladaKwp == null ? "(hereda)" : ""}</label>
          <input
            type="number"
            step="0.01"
            className={num}
            value={form.potenciaInstaladaKwp ?? ""}
            disabled={!canEdit}
            placeholder={detalle.proyecto.capacityKwp != null ? String(detalle.proyecto.capacityKwp) : "—"}
            onChange={(e) => set("potenciaInstaladaKwp", numeroOrNull(e.target.value))}
          />
        </div>
        <div>
          <label className={lbl}>Mes de inicio {c && form.mesInicio == null ? "(hereda)" : ""}</label>
          <input
            className={inp}
            value={form.mesInicio ?? ""}
            disabled={!canEdit}
            placeholder={detalle.proyecto.mesInicioSugerido ?? "YYYY-MM"}
            onChange={(e) => set("mesInicio", e.target.value || null)}
          />
        </div>
        <div>
          <label className={lbl}>Día de corte del medidor</label>
          <input
            className={inp}
            type="number"
            min={1}
            max={31}
            value={form.diaCorteMedidor ?? ""}
            disabled={!canEdit}
            placeholder="Mes calendario"
            onChange={(e) => set("diaCorteMedidor", numeroOrNull(e.target.value))}
          />
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Vacío = mes calendario (1 al último). Con día de corte, el reporte cubre el ciclo de facturación de UTE.
          </p>
        </div>
      </div>

      {/* Destinatarios */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Destinatarios del reporte
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setDestinatarios((d) => [...d, { email: "", nombre: null, esCopia: false }])}
              className="flex items-center gap-1 text-xs text-[var(--color-accent)]"
            >
              <Plus size={12} /> Agregar
            </button>
          )}
        </div>
        {destinatarios.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Sin destinatarios propios: se usa el mail del proyecto ({detalle.proyecto.clientEmail ?? "no cargado"}).
          </p>
        )}
        <div className="space-y-1.5">
          {destinatarios.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={`${inp} flex-1`}
                value={d.email}
                disabled={!canEdit}
                placeholder="email@ejemplo.com"
                onChange={(e) =>
                  setDestinatarios((ds) => ds.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))
                }
              />
              <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <input
                  type="checkbox"
                  checked={d.esCopia}
                  disabled={!canEdit}
                  onChange={(e) =>
                    setDestinatarios((ds) => ds.map((x, j) => (j === i ? { ...x, esCopia: e.target.checked } : x)))
                  }
                />
                CC
              </label>
              {canEdit && (
                <button
                  type="button"
                  aria-label="Quitar"
                  onClick={() => setDestinatarios((ds) => ds.filter((_, j) => j !== i))}
                  className="text-[var(--color-text-muted)] hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <div className="border-t border-[var(--color-border)] pt-4">
          <button
            type="button"
            disabled={guardar.isPending}
            onClick={() => guardar.mutate()}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {guardar.isPending ? "Guardando…" : detalle.dadoDeAlta ? "Guardar cambios" : "Dar de alta"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Lectura del mes ──────────────────────────────────────────────────────────

function LecturaTab({
  detalle,
  periodo,
  canEdit,
  onSaved,
}: {
  detalle: DetalleGenerador;
  periodo: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  // La lectura del periodo no viene en el detalle; se edita directo y el panel
  // se refresca. Se cargan los 3 campos; vacío = null.
  const [gen, setGen] = useState("");
  const [cons, setCons] = useState("");
  const [exp, setExp] = useState("");
  const [nota, setNota] = useState("");

  const guardar = useMutation({
    mutationFn: () =>
      guardarLectura(detalle.projectId, periodo, {
        generacionKwh: gen.trim() === "" ? undefined : Number(gen),
        consumoKwh: cons.trim() === "" ? undefined : Number(cons),
        exportacionKwh: exp.trim() === "" ? undefined : Number(exp),
        nota: nota.trim() === "" ? undefined : nota,
      }),
    onSuccess: () => {
      toast.success("Lectura guardada y serie recalculada");
      onSaved();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo guardar"),
  });

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Cargá los valores del mes <strong>{periodo}</strong> tomados del portal del inversor o de la
        factura. Se guardan como <strong>dato manual</strong> (la ingesta automática no los pisa). Dejá
        un campo vacío para no modificarlo.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lbl}>Generación (kWh)</label>
          <input type="number" step="0.1" className={num} value={gen} disabled={!canEdit} onChange={(e) => setGen(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Consumo (kWh)</label>
          <input type="number" step="0.1" className={num} value={cons} disabled={!canEdit} onChange={(e) => setCons(e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Exportación (kWh)</label>
          <input type="number" step="0.1" className={num} value={exp} disabled={!canEdit} onChange={(e) => setExp(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={lbl}>Nota (opcional)</label>
        <input className={inp} value={nota} disabled={!canEdit} onChange={(e) => setNota(e.target.value)} />
      </div>

      {canEdit && (
        <button
          type="button"
          disabled={guardar.isPending || (gen === "" && cons === "" && exp === "" && nota === "")}
          onClick={() => guardar.mutate()}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {guardar.isPending ? "Guardando…" : "Guardar lectura"}
        </button>
      )}
    </div>
  );
}

// ─── PDF / emisión ────────────────────────────────────────────────────────────

function PdfTab({
  detalle,
  periodo,
  canCreate,
  canSend,
  onEmitido,
}: {
  detalle: DetalleGenerador;
  periodo: string;
  canCreate: boolean;
  canSend: boolean;
  onEmitido: () => void;
}) {
  const qc = useQueryClient();
  const emisionPeriodo = detalle.emisiones.filter((e) => e.periodo === periodo);
  const vigente = emisionPeriodo[0] ?? null; // ya vienen ordenadas desc por version
  const [previewId, setPreviewId] = useState<string | null>(vigente?.id ?? null);

  // Historial: la última versión de cada mes con reporte (todas las emisiones
  // vienen ordenadas por periodo desc, version desc, así que la primera de cada
  // periodo es la vigente).
  const historial = useMemo(() => {
    const vistos = new Set<string>();
    return detalle.emisiones.filter((e) => {
      if (vistos.has(e.periodo)) return false;
      vistos.add(e.periodo);
      return true;
    });
  }, [detalle.emisiones]);

  useEffect(() => {
    setPreviewId(vigente?.id ?? null);
  }, [vigente?.id]);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["reportes-fv", "detalle", detalle.projectId] });
    qc.invalidateQueries({ queryKey: ["reportes-fv", "panel"] });
  };

  const emitir = useMutation({
    mutationFn: () => emitirReporte(detalle.projectId, periodo),
    onSuccess: (r) => {
      toast.success(`Reporte generado (v${r.version})`);
      refrescar();
      setPreviewId(r.emisionId);
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo generar el reporte"),
  });

  const enviar = useMutation({
    mutationFn: (dryRun: boolean) => enviarReporte(vigente!.id, dryRun),
    onSuccess: (r) => {
      if (r.estado === "ENVIADO") toast.success(`Enviado a ${r.destinatarios.join(", ")}`);
      else if (r.estado === "DRY_RUN") toast.success(`Prueba OK — se enviaría a ${r.destinatarios.join(", ")}`);
      else if (r.estado === "OMITIDO") toast.error(`No se envió: ${r.motivo}`);
      else toast.error(`Falló el envío: ${r.motivo}`);
      refrescar();
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? "No se pudo enviar"),
  });

  // El hook usa apiClient (relative url); reporteFvPdfUrl da la absoluta con
  // baseURL — le quito el baseURL para el hook.
  const relativeUrl = previewId ? `/api/reportes-fv/emisiones/${previewId}/pdf` : null;
  const { blobUrl, loading } = useAuthBlobUrl(relativeUrl);

  const bloqueado = (detalle.config?.efectivo.bloqueosCalculo.length ?? 0) > 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canCreate && (
          <button
            type="button"
            disabled={emitir.isPending || bloqueado}
            onClick={() => emitir.mutate()}
            title={bloqueado ? "Resolvé los bloqueos de configuración primero" : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <RefreshCw size={14} />
            {emitir.isPending ? "Generando…" : vigente ? "Regenerar PDF" : "Generar PDF"}
          </button>
        )}
        {previewId && (
          <a
            href={reporteFvPdfUrl(previewId) + "?download=1"}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
          >
            <Download size={14} /> Descargar
          </a>
        )}
        {vigente && (
          <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <FileText size={13} /> v{vigente.version} · {vigente.estado}
            {vigente.enviado && <Check size={13} className="text-emerald-400" />}
          </span>
        )}
      </div>

      {/* Envío al cliente */}
      {canSend && vigente && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Enviar al cliente</span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {detalle.config?.efectivo.destinatariosEfectivos.map((d) => d.email).join(", ") || "sin destinatario"}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={enviar.isPending}
              onClick={() => enviar.mutate(true)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)]"
            >
              Prueba (dry-run)
            </button>
            <button
              type="button"
              disabled={enviar.isPending || vigente.enviado}
              onClick={() => {
                const dest =
                  detalle.config?.efectivo.destinatariosEfectivos.map((d) => d.email).join(", ") ?? "";
                if (window.confirm(`¿Enviar el reporte de ${periodo} a ${dest}? Esta acción manda el email.`)) {
                  enviar.mutate(false);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send size={14} /> {vigente.enviado ? "Ya enviado" : "Enviar"}
            </button>
          </div>
        </div>
      )}

      {bloqueado && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          No se puede generar el reporte hasta resolver los bloqueos en la pestaña Configuración.
        </div>
      )}

      {/* Historial: todos los reportes del cliente, cualquier mes, descargables */}
      {historial.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="border-b border-[var(--color-border)] px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
            Historial de reportes ({historial.length})
          </div>
          <div className="max-h-40 divide-y divide-[var(--color-border)] overflow-auto">
            {historial.map((e) => (
              <div
                key={e.id}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm ${
                  e.id === previewId ? "bg-[var(--color-accent)]/5" : ""
                }`}
              >
                <span className="w-20 font-medium capitalize text-[var(--color-text-primary)]">
                  {mesLabel(e.periodo)}
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  v{e.version} · {e.estado.toLowerCase()}
                </span>
                {e.enviado && (
                  <span title="Enviado al cliente">
                    <Check size={12} className="text-emerald-400" />
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  {e.tienePdf ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewId(e.id)}
                        className="rounded px-2 py-0.5 text-xs text-[var(--color-accent)] hover:underline"
                      >
                        Ver
                      </button>
                      <a
                        href={reporteFvPdfUrl(e.id) + "?download=1"}
                        title="Descargar PDF"
                        className="rounded p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      >
                        <Download size={13} />
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">sin PDF</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#525659]">
        {!previewId ? (
          <div className="flex h-full items-center justify-center text-sm text-white/70">
            Todavía no hay un PDF generado para {periodo}.
          </div>
        ) : loading || !blobUrl ? (
          <div className="flex h-full items-center justify-center text-sm text-white/70">Cargando PDF…</div>
        ) : (
          <iframe src={blobUrl} title="Reporte fotovoltaico" className="h-full w-full border-0" />
        )}
      </div>
    </div>
  );
}

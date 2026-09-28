import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Camera, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import { planGranizoApi, type DanioPlan, type PlanGranizo } from "../../api/planGranizo.api";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { ArchivoThumb } from "./ArchivoThumb";
import { MensajesPlanModal } from "./MensajesPlanModal";
import { ESTADO_DANIO_LABEL, errMsg, fmtFecha, fmtUsd, hoyIso } from "./estado";
import { usePlanMutation } from "./usePlanMutation";

const INPUT =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";
const LABEL = "mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

// Daños por granizo del plan: aviso → inspección → reposición (o "no se
// repone", citando la causal de las condiciones). Cada uno muestra el plazo que
// corre (guía interna: inspección ≤ 10 días hábiles del aviso, reposición ≤ 30
// días de la inspección, 60 si el evento es masivo).
export function DaniosSection({ plan, canEdit, canDelete }: { plan: PlanGranizo; canEdit: boolean; canDelete: boolean }) {
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState({ fechaEvento: hoyIso(), fechaAviso: hoyIso(), descripcion: "", paneles: "", masivo: false });

  const crear = usePlanMutation(async () => {
    const r = await planGranizoApi.crearDanio(plan.id, {
      fechaEvento: form.fechaEvento,
      fechaAviso: form.fechaAviso,
      descripcion: form.descripcion,
      panelesAfectados: form.paneles ? Number(form.paneles) : null,
      eventoMasivo: form.masivo,
    });
    return r.poliza;
  }, "Daño registrado");

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Daños por granizo</h3>
        {canEdit && !nuevo ? (
          <Button size="sm" variant="secondary" onClick={() => setNuevo(true)}>
            Registrar daño
          </Button>
        ) : null}
      </div>

      {nuevo ? (
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Registralo el mismo día que avisa el cliente y respondele ese mismo día hábil.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Campo label="Fecha del granizo">
              <input type="date" className={INPUT} value={form.fechaEvento} max={hoyIso()} onChange={(e) => setForm({ ...form, fechaEvento: e.target.value })} />
            </Campo>
            <Campo label="Fecha en que avisó">
              <input type="date" className={INPUT} value={form.fechaAviso} onChange={(e) => setForm({ ...form, fechaAviso: e.target.value })} />
            </Campo>
            <Campo label="Paneles que ve dañados">
              <input type="number" min={0} className={INPUT} value={form.paneles} onChange={(e) => setForm({ ...form, paneles: e.target.value })} />
            </Campo>
          </div>
          <Campo label="Qué contó (datos del Anexo B)">
            <textarea rows={3} className={INPUT} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <input type="checkbox" checked={form.masivo} onChange={(e) => setForm({ ...form, masivo: e.target.checked })} />
            La tormenta pegó en muchas obras (evento masivo: el plazo de reposición pasa a 60 días)
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setNuevo(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              loading={crear.isPending}
              disabled={form.descripcion.trim().length < 3}
              onClick={() =>
                crear.mutate(undefined, {
                  onSuccess: () => {
                    setNuevo(false);
                    setForm({ fechaEvento: hoyIso(), fechaAviso: hoyIso(), descripcion: "", paneles: "", masivo: false });
                  },
                })
              }
            >
              Registrar
            </Button>
          </div>
        </div>
      ) : null}

      {plan.siniestros.length === 0 && !nuevo ? (
        <p className="text-xs text-[var(--color-text-muted)]">Sin daños registrados.</p>
      ) : (
        plan.siniestros.map((d) => <DanioCard key={d.id} plan={plan} d={d} canEdit={canEdit} canDelete={canDelete} />)
      )}
    </section>
  );
}

function PlazoLinea({ d }: { d: DanioPlan }) {
  const p = d.plazos.pendiente;
  if (!p) return null;
  const plazo = p.etapa === "INSPECCION" ? d.plazos.inspeccion : d.plazos.reposicion;
  if (!plazo) return null;
  const dias = plazo.diasRestantes ?? 0;
  const unidad = plazo.unidad === "habiles" ? "días hábiles" : "días";
  return (
    <p className={`text-xs font-medium ${p.vencido ? "text-[var(--color-danger-text)]" : "text-[var(--color-text-secondary)]"}`}>
      {p.etapa === "INSPECCION" ? "Inspeccionar" : "Reponer"} antes del {fmtFecha(plazo.limite)} ·{" "}
      {p.vencido ? `vencido hace ${Math.abs(dias)} ${unidad}` : `quedan ${dias} ${unidad}`}
    </p>
  );
}

type Accion = null | "inspeccion" | "repuesto" | "rechazo";

function DanioCard({ plan, d, canEdit, canDelete }: { plan: PlanGranizo; d: DanioPlan; canEdit: boolean; canDelete: boolean }) {
  const [accion, setAccion] = useState<Accion>(null);
  const [f, setF] = useState({
    fechaInspeccion: d.fechaInspeccion ?? hoyIso(),
    evaluacionNota: d.evaluacionNota ?? "",
    fechaReposicion: d.fechaReposicion ?? hoyIso(),
    panelesRepuestos: String(d.panelesRepuestos ?? d.panelesAfectados ?? ""),
    costo: d.costoRealUsd != null ? String(d.costoRealUsd) : "",
    costoDetalle: d.costoDetalle ?? "",
    motivoCodigo: d.motivoRechazoCodigo ?? "",
    motivoNota: d.motivoRechazo ?? "",
  });
  const [borrar, setBorrar] = useState(false);
  const [mensaje, setMensaje] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const motivos = useQuery({ queryKey: ["plan-granizo-motivos"], queryFn: planGranizoApi.motivosRechazo, staleTime: Infinity, enabled: accion === "rechazo" });
  const actualizar = usePlanMutation((body: Record<string, unknown>) => planGranizoApi.actualizarDanio(d.id, body));
  const borrarMut = usePlanMutation(() => planGranizoApi.borrarDanio(d.id), "Daño eliminado");
  const fotos = usePlanMutation(async (files: File[]) => {
    await planGranizoApi.subirFotosDanio(d.id, files);
    return planGranizoApi.get(plan.id);
  }, "Fotos subidas");
  const borrarFoto = usePlanMutation(async (fileId: string) => {
    await planGranizoApi.borrarFotoDanio(d.id, fileId);
    return planGranizoApi.get(plan.id);
  });

  const cambiar = (body: Record<string, unknown>, ok: string) =>
    actualizar.mutate(body, { onSuccess: () => { setAccion(null); toast.success(ok); } });

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">Granizo del {fmtFecha(d.fechaEvento)}</span>
          <span className="rounded-full bg-[var(--color-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
            {ESTADO_DANIO_LABEL[d.estado]}
          </span>
          {d.eventoMasivo ? (
            <span className="rounded-full bg-[var(--color-info-bg)] px-2 py-0.5 text-[11px] text-[var(--color-info-text)]">Evento masivo</span>
          ) : null}
        </div>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Avisó el {fmtFecha(d.fechaAviso)}
          {d.panelesAfectados != null ? ` · ${d.panelesAfectados} paneles` : ""}
        </span>
      </div>

      {!d.cubiertoAlEvento ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger-text)]">
          <AlertTriangle size={13} /> Ese día el plan no tenía cobertura (sin firma, sin pago, en carencia o suspendido).
        </p>
      ) : null}
      {d.plazos.avisoFueraDePlazo ? (
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-warning-text)]">
          <AlertTriangle size={13} /> Aviso fuera de plazo: {d.plazos.diasHabilesHastaAviso} días hábiles después del granizo (el plazo es 10).
        </p>
      ) : null}
      <PlazoLinea d={d} />

      <p className="whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">{d.descripcion}</p>
      {d.fechaInspeccion ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Inspección {fmtFecha(d.fechaInspeccion)}
          {d.evaluacionNota ? ` — ${d.evaluacionNota}` : ""}
        </p>
      ) : null}
      {d.estado === "REPUESTO" ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          Repuesto el {fmtFecha(d.fechaReposicion)} · {d.panelesRepuestos} paneles · costo {fmtUsd(d.costoRealUsd)}
          {d.costoDetalle ? ` (${d.costoDetalle})` : ""}
        </p>
      ) : null}
      {d.estado === "RECHAZADO" ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No se repone: {d.motivoRechazoLabel}
          {d.motivoRechazo ? ` — ${d.motivoRechazo}` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {d.fotos.map((foto) => (
          <ArchivoThumb key={foto.id} archivo={foto} onDelete={canDelete ? () => borrarFoto.mutate(foto.id) : undefined} />
        ))}
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
            >
              <Camera size={16} /> {fotos.isPending ? "Subiendo…" : "Fotos"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) fotos.mutate(files);
              }}
            />
          </>
        ) : null}
      </div>

      {mensaje ? <MensajesPlanModal plan={plan} danio={d} onClose={() => setMensaje(false)} /> : null}
      {canEdit && accion === null ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="ghost" onClick={() => setMensaje(true)}>Mensaje al cliente</Button>
          {d.estado === "REPORTADO" ? (
            <Button size="sm" variant="secondary" onClick={() => setAccion("inspeccion")}>Marcar inspeccionado</Button>
          ) : null}
          {d.estado === "EVALUADO" ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setAccion("repuesto")}>Marcar repuesto</Button>
              <Button size="sm" variant="ghost" onClick={() => cambiar({ estado: "REPORTADO" }, "Volvió a avisado")}>Volver a avisado</Button>
            </>
          ) : null}
          {d.estado === "REPORTADO" || d.estado === "EVALUADO" ? (
            <Button size="sm" variant="ghost" onClick={() => setAccion("rechazo")}>No se repone</Button>
          ) : null}
          {d.estado === "REPUESTO" ? (
            <Button size="sm" variant="ghost" onClick={() => cambiar({ estado: "EVALUADO" }, "Volvió a inspeccionado")}>
              Volver a inspeccionado
            </Button>
          ) : null}
          {d.estado === "RECHAZADO" ? (
            <Button size="sm" variant="ghost" onClick={() => cambiar({ estado: "REPORTADO" }, "Daño reabierto")}>Reabrir</Button>
          ) : null}
          {canDelete ? (
            <button type="button" title="Eliminar daño" className="ml-auto p-1 text-[var(--color-danger-text)]" onClick={() => setBorrar(true)}>
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      {accion === "inspeccion" ? (
        <div className="grid grid-cols-1 gap-2 rounded-md bg-[var(--color-bg-card)] p-3 sm:grid-cols-3">
          <Campo label="Fecha de inspección">
            <input type="date" className={INPUT} value={f.fechaInspeccion} onChange={(e) => setF({ ...f, fechaInspeccion: e.target.value })} />
          </Campo>
          <div className="sm:col-span-2">
            <Campo label="Qué se vio (paneles dañados, confirmación de granizo)">
              <input className={INPUT} value={f.evaluacionNota} onChange={(e) => setF({ ...f, evaluacionNota: e.target.value })} />
            </Campo>
          </div>
          <Acciones
            pending={actualizar.isPending}
            onCancel={() => setAccion(null)}
            onOk={() => cambiar({ estado: "EVALUADO", fechaInspeccion: f.fechaInspeccion, evaluacionNota: f.evaluacionNota || null }, "Marcado inspeccionado")}
          />
        </div>
      ) : null}

      {accion === "repuesto" ? (
        <div className="grid grid-cols-1 gap-2 rounded-md bg-[var(--color-bg-card)] p-3 sm:grid-cols-3">
          <Campo label="Fecha de reposición">
            <input type="date" className={INPUT} value={f.fechaReposicion} onChange={(e) => setF({ ...f, fechaReposicion: e.target.value })} />
          </Campo>
          <Campo label="Paneles repuestos">
            <input type="number" min={1} className={INPUT} value={f.panelesRepuestos} onChange={(e) => setF({ ...f, panelesRepuestos: e.target.value })} />
          </Campo>
          <Campo label="Costo real (USD)">
            <input type="number" min={0} className={INPUT} value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} />
          </Campo>
          <div className="sm:col-span-3">
            <Campo label="Detalle del costo (paneles, mano de obra, traslado)">
              <input className={INPUT} value={f.costoDetalle} onChange={(e) => setF({ ...f, costoDetalle: e.target.value })} />
            </Campo>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] sm:col-span-3">
            El costo se registra como gasto del plan en Finanzas. Cada panel se repone una vez por anualidad.
          </p>
          <Acciones
            pending={actualizar.isPending}
            onCancel={() => setAccion(null)}
            onOk={() =>
              cambiar(
                {
                  estado: "REPUESTO",
                  fechaReposicion: f.fechaReposicion,
                  panelesRepuestos: Number(f.panelesRepuestos) || null,
                  costoRealUsd: f.costo === "" ? null : Number(f.costo),
                  costoDetalle: f.costoDetalle || null,
                },
                "Marcado repuesto",
              )
            }
          />
        </div>
      ) : null}

      {accion === "rechazo" ? (
        <div className="grid grid-cols-1 gap-2 rounded-md bg-[var(--color-bg-card)] p-3">
          <Campo label="Por qué no se repone (se le dice al cliente citando la sección)">
            <select className={INPUT} value={f.motivoCodigo} onChange={(e) => setF({ ...f, motivoCodigo: e.target.value })}>
              <option value="">Elegí la causal…</option>
              {(motivos.data ?? []).map((m) => (
                <option key={m.codigo} value={m.codigo}>{m.label}</option>
              ))}
            </select>
          </Campo>
          <Campo label="Nota">
            <input className={INPUT} value={f.motivoNota} onChange={(e) => setF({ ...f, motivoNota: e.target.value })} />
          </Campo>
          <Acciones
            pending={actualizar.isPending}
            disabled={!f.motivoCodigo}
            onCancel={() => setAccion(null)}
            onOk={() => cambiar({ estado: "RECHAZADO", motivoRechazoCodigo: f.motivoCodigo, motivoRechazo: f.motivoNota || null }, "Marcado: no se repone")}
          />
        </div>
      ) : null}

      <ConfirmDialog
        open={borrar}
        title="Eliminar daño"
        description="Se borra el daño, sus fotos y, si estaba repuesto, el gasto en Finanzas."
        confirmLabel="Eliminar"
        destructive
        loading={borrarMut.isPending}
        onConfirm={() => borrarMut.mutate(undefined, { onSuccess: () => setBorrar(false), onError: (e) => toast.error(errMsg(e, "No se pudo eliminar")) })}
        onClose={() => setBorrar(false)}
      />
    </div>
  );
}

function Acciones({ pending, disabled, onCancel, onOk }: { pending: boolean; disabled?: boolean; onCancel: () => void; onOk: () => void }) {
  return (
    <div className="flex justify-end gap-2 sm:col-span-3">
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
      <Button size="sm" loading={pending} disabled={disabled} onClick={onOk}>Guardar</Button>
    </div>
  );
}

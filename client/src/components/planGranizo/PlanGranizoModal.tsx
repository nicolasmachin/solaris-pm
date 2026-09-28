import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Camera, CheckCircle2, Circle, FileText, Link as LinkIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";

import { planGranizoApi, type AnualidadPlan, type PlanGranizo } from "../../api/planGranizo.api";
import { usePermission } from "../../hooks/usePermission";
import { Button } from "../ui/Button";
import { LargeModal } from "../ui/LargeModal";
import { Spinner } from "../ui/Spinner";
import { ArchivoThumb } from "./ArchivoThumb";
import { DaniosSection } from "./DaniosSection";
import { MensajesPlanModal } from "./MensajesPlanModal";
import { EstadoPlanChip } from "./EstadoPlanChip";
import { COBRO_LABEL, ESTADO_PLAN_AYUDA, fmtFecha, fmtUsd, hoyIso, NOMBRE_ALERTA } from "./estado";
import { usePlanMutation } from "./usePlanMutation";

const INPUT =
  "rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";
const CARD = "space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4";

// Todo el plan de un cliente: activación (Anexo A firmado, fotos de inicio,
// número de serie del inversor), anualidades y sus cobros, ampliaciones, daños
// por granizo y baja.
export function PlanGranizoModal({ polizaId, onClose }: { polizaId: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ["plan-granizo", polizaId], queryFn: () => planGranizoApi.get(polizaId) });
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const canDelete = usePermission("EXPERIENCIA_CLIENTES", "DELETE");
  const canFinanzas = usePermission("FINANZAS", "EDIT");
  const canCobrar = canEdit || canFinanzas;
  const plan = q.data;

  return (
    <LargeModal open onClose={onClose} size="wide" ariaLabel="Plan de Protección contra Granizo">
      {!plan ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-5 p-6">
          <Encabezado plan={plan} />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Activacion plan={plan} canEdit={canEdit} canDelete={canDelete} />
              <Ampliaciones plan={plan} canEdit={canEdit} canCobrar={canCobrar} />
              <Baja plan={plan} canEdit={canEdit} />
            </div>
            <div className="space-y-5">
              <Anualidades plan={plan} canEdit={canEdit} canCobrar={canCobrar} />
              <div className={CARD}>
                <DaniosSection plan={plan} canEdit={canEdit} canDelete={canDelete} />
              </div>
            </div>
          </div>
        </div>
      )}
    </LargeModal>
  );
}

function Encabezado({ plan }: { plan: PlanGranizo }) {
  const e = plan.estado;
  const [mensajes, setMensajes] = useState(false);
  return (
    <div className="space-y-2 pr-8">
      {mensajes ? <MensajesPlanModal plan={plan} onClose={() => setMensajes(false)} /> : null}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Plan de Protección contra Granizo</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          to={`/clientes/${plan.projectId}`}
          className={`font-display text-2xl font-bold hover:underline ${e.alerta ? NOMBRE_ALERTA : "text-[var(--color-text-primary)]"}`}
        >
          {plan.project.clientName}
        </Link>
        <EstadoPlanChip estado={e.estado} />
        {e.coberturaActiva ? (
          <span className="text-[11px] font-medium text-[var(--color-state-done-text)]">Cubre hoy</span>
        ) : (
          <span className="text-[11px] font-medium text-[var(--color-text-muted)]">No cubre hoy</span>
        )}
        <Button size="sm" variant={e.alerta ? "primary" : "secondary"} className="ml-auto" onClick={() => setMensajes(true)}>
          Mensajes al cliente
        </Button>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">{ESTADO_PLAN_AYUDA[e.estado]}</p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[var(--color-text-secondary)]">
        <span>
          <strong className="text-[var(--color-text-primary)]">{plan.cantidadPaneles}</strong> paneles
        </span>
        <span>
          Anualidad <strong className="text-[var(--color-text-primary)]">{fmtUsd(plan.montoAnualUsd)}</strong>
        </span>
        <span>{plan.sinCarencia ? "Adhesión con la obra (sin carencia)" : "Instalación existente (30 días de carencia)"}</span>
        {e.coberturaDesde ? <span>Cubre desde {fmtFecha(e.coberturaDesde)}</span> : null}
        {e.vencimiento ? <span>Vence {fmtFecha(e.vencimiento)}</span> : null}
        {e.proximoCobro ? (
          <span>
            Próximo cobro {fmtUsd(e.proximoCobro.montoUsd)} · {fmtFecha(e.proximoCobro.fecha)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-state-done-text)]" />
      ) : (
        <Circle size={16} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Activacion({ plan, canEdit, canDelete }: { plan: PlanGranizo; canEdit: boolean; canDelete: boolean }) {
  const [fechaFirma, setFechaFirma] = useState(hoyIso());
  const [serie, setSerie] = useState(plan.inversorSerie ?? "");
  const [paneles, setPaneles] = useState(String(plan.cantidadPaneles));
  const [aplicar, setAplicar] = useState(true);
  const anexoRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<HTMLInputElement>(null);

  const anexo = usePlanMutation((file: File) => planGranizoApi.subirAnexo(plan.id, fechaFirma, file), "Anexo A cargado");
  const quitarAnexo = usePlanMutation(() => planGranizoApi.quitarAnexo(plan.id), "Anexo A quitado");
  const fotos = usePlanMutation((files: File[]) => planGranizoApi.subirFotosInicio(plan.id, files), "Fotos de inicio subidas");
  const borrarFoto = usePlanMutation((fileId: string) => planGranizoApi.borrarFotoInicio(plan.id, fileId));
  const editar = usePlanMutation(
    (body: { cantidadPaneles?: number; inversorSerie?: string | null; aplicarAPendientes?: boolean }) => planGranizoApi.editar(plan.id, body),
    "Plan actualizado",
  );
  const primera = plan.periodos[0];

  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Activación</h3>
      <p className="text-[11px] text-[var(--color-text-muted)]">El plan cubre recién con el Anexo A firmado y la primera anualidad paga.</p>

      <Check ok={Boolean(plan.anexo.firmadoEn)}>
        {plan.anexo.firmadoEn ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>Anexo A firmado el {fmtFecha(plan.anexo.firmadoEn)}</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
              onClick={() => plan.anexo.url && planGranizoApi.abrirArchivo(plan.anexo.url).catch(() => toast.error("No se pudo abrir"))}
            >
              <FileText size={12} /> Ver
            </button>
            {canEdit ? (
              <button type="button" className="text-xs text-[var(--color-text-muted)] hover:underline" onClick={() => quitarAnexo.mutate(undefined)}>
                Quitar
              </button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-1.5">
            <span>Falta el Anexo A firmado (alcanza una foto de la hoja firmada)</span>
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                <input type="date" className={INPUT} value={fechaFirma} onChange={(e) => setFechaFirma(e.target.value)} title="Fecha de firma" />
                <Button size="sm" variant="secondary" loading={anexo.isPending} onClick={() => anexoRef.current?.click()}>
                  Subir Anexo A firmado
                </Button>
                <input
                  ref={anexoRef}
                  type="file"
                  accept="application/pdf,image/*,.heic,.heif"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) anexo.mutate(f);
                  }}
                />
              </div>
            ) : null}
          </div>
        )}
      </Check>

      <Check ok={primera?.cobro.estado === "PAGADO"}>
        {primera?.cobro.estado === "PAGADO"
          ? `Primera anualidad cobrada el ${fmtFecha(primera.cobro.fechaPago)}`
          : plan.periodos.length === 0
            ? "La primera anualidad se genera con la puesta en marcha"
            : "Falta cobrar la primera anualidad (se marca en Anualidades)"}
      </Check>

      {!plan.sinCarencia ? (
        <Check ok={plan.fotosInicio.length > 0}>
          <div className="space-y-2">
            <span>Fotos de inicio de los paneles ({plan.fotosInicio.length}). Son la única prueba si después aparece un daño previo.</span>
            <div className="flex flex-wrap gap-2">
              {plan.fotosInicio.map((f) => (
                <ArchivoThumb key={f.id} archivo={f} onDelete={canDelete ? () => borrarFoto.mutate(f.id) : undefined} />
              ))}
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => fotosRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] hover:border-[var(--color-accent)]"
                  >
                    <Camera size={16} /> {fotos.isPending ? "Subiendo…" : "Subir"}
                  </button>
                  <input
                    ref={fotosRef}
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
          </div>
        </Check>
      ) : null}

      <div className="grid grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">Número de serie del inversor</span>
          <div className="flex gap-2">
            <input className={`${INPUT} w-full`} value={serie} disabled={!canEdit} onChange={(e) => setSerie(e.target.value)} />
            {canEdit && serie !== (plan.inversorSerie ?? "") ? (
              <Button size="sm" variant="secondary" onClick={() => editar.mutate({ inversorSerie: serie || null })}>
                Guardar
              </Button>
            ) : null}
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]">
            Paneles (siempre todos) · {plan.cantidadPanelesFuente === "MANUAL" ? "cargados a mano" : `según ${plan.cantidadPanelesFuente === "UNIFILAR" ? "el unifilar" : "la propuesta"}`}
          </span>
          <div className="flex gap-2">
            <input type="number" min={1} className={`${INPUT} w-24`} value={paneles} disabled={!canEdit} onChange={(e) => setPaneles(e.target.value)} />
            {canEdit && Number(paneles) !== plan.cantidadPaneles && Number(paneles) > 0 ? (
              <Button size="sm" variant="secondary" onClick={() => editar.mutate({ cantidadPaneles: Number(paneles), aplicarAPendientes: aplicar })}>
                Guardar
              </Button>
            ) : null}
          </div>
          {canEdit && Number(paneles) !== plan.cantidadPaneles ? (
            <label className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <input type="checkbox" checked={aplicar} onChange={(e) => setAplicar(e.target.checked)} />
              Recalcular también las anualidades que falta cobrar
            </label>
          ) : null}
        </label>
      </div>
    </section>
  );
}

function Anualidades({ plan, canEdit, canCobrar }: { plan: PlanGranizo; canEdit: boolean; canCobrar: boolean }) {
  const [fechaInicio, setFechaInicio] = useState(hoyIso());
  const activar = usePlanMutation(() => planGranizoApi.activar(plan.id, fechaInicio), "Plan en marcha");
  const renovar = usePlanMutation(() => planGranizoApi.renovar(plan.id), "Anualidad siguiente generada");

  return (
    <section className={CARD}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Anualidades</h3>
        {canEdit && plan.estadoBase === "ACTIVA" && plan.periodos.length > 0 ? (
          <Button size="sm" variant="ghost" loading={renovar.isPending} onClick={() => renovar.mutate(undefined)}>
            Generar la siguiente
          </Button>
        ) : null}
      </div>
      {plan.estadoBase === "PENDIENTE_INICIO" ? (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-muted)]">
            Arranca solo cuando se registra la puesta en marcha. Si ya está en marcha, cargá la fecha:
          </p>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <input type="date" className={INPUT} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              <Button size="sm" variant="secondary" loading={activar.isPending} onClick={() => activar.mutate(undefined)}>
                Poner en marcha
              </Button>
            </div>
          ) : null}
        </div>
      ) : plan.periodos.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">Sin anualidades.</p>
      ) : (
        <div className="space-y-2">
          {plan.periodos.map((a) => (
            <AnualidadFila key={a.id} a={a} canEdit={canEdit} canCobrar={canCobrar} actual={plan.estado.periodoActualId === a.id} />
          ))}
        </div>
      )}
      <p className="text-[11px] text-[var(--color-text-muted)]">
        La anualidad siguiente se genera sola 30 días antes del vencimiento, al precio vigente. Los cobros aparecen en Finanzas y no suman al saldo de
        la obra.
      </p>
    </section>
  );
}

function AnualidadFila({ a, canEdit, canCobrar, actual }: { a: AnualidadPlan; canEdit: boolean; canCobrar: boolean; actual: boolean }) {
  const [fecha, setFecha] = useState(hoyIso());
  const [abierto, setAbierto] = useState(false);
  const cobrar = usePlanMutation(() => planGranizoApi.marcarCobro(a.id, "PAGADO", fecha), "Anualidad cobrada");
  const deshacer = usePlanMutation(() => planGranizoApi.marcarCobro(a.id, "PREVISTO"), "Anualidad vuelta a cobrar");
  const regenerar = usePlanMutation(() => planGranizoApi.regenerarCobro(a.id), "Cobro regenerado en Finanzas");

  return (
    <div className={`rounded-md border px-3 py-2 ${actual ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"} bg-[var(--color-bg-app)]`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-[var(--color-text-primary)]">
          <strong>Anualidad {a.numero}</strong>{" "}
          <span className="text-[var(--color-text-secondary)]">
            {a.inicioProvisorio ? "· arranca al pago + 30 días" : `· ${fmtFecha(a.desde)} → ${fmtFecha(a.hasta)}`}
          </span>
          <div className="text-[11px] text-[var(--color-text-muted)]">
            {a.cantidadPaneles} paneles × {fmtUsd(a.precioPorPanelUsd)} = {fmtUsd(a.montoUsd)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              a.cobro.estado === "PAGADO"
                ? "bg-[var(--color-state-done-bg)] text-[var(--color-state-done-text)]"
                : "bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]"
            }`}
          >
            {a.cobro.estado === "PAGADO" ? `Cobrada ${fmtFecha(a.cobro.fechaPago)}` : `${COBRO_LABEL[a.cobro.estado]} · vence ${fmtFecha(a.cobro.vence)}`}
          </span>
          {canCobrar && a.cobro.estado === "PREVISTO" && !abierto ? (
            <Button size="sm" variant="secondary" onClick={() => setAbierto(true)}>
              Marcar cobrada
            </Button>
          ) : null}
          {canCobrar && a.cobro.estado === "PAGADO" ? (
            <button type="button" className="text-[var(--color-text-muted)] hover:underline" onClick={() => deshacer.mutate(undefined)}>
              Deshacer
            </button>
          ) : null}
          {canEdit && a.cobro.estado === "SIN_COBRO" ? (
            <Button size="sm" variant="ghost" loading={regenerar.isPending} onClick={() => regenerar.mutate(undefined)}>
              Regenerar cobro
            </Button>
          ) : null}
        </div>
      </div>
      {abierto ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary)]">Fecha real del pago:</span>
          <input type="date" className={INPUT} value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Button size="sm" loading={cobrar.isPending} onClick={() => cobrar.mutate(undefined, { onSuccess: () => setAbierto(false) })}>
            Confirmar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAbierto(false)}>
            Cancelar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Ampliaciones({ plan, canEdit, canCobrar }: { plan: PlanGranizo; canEdit: boolean; canCobrar: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const pendientes = useQuery({
    queryKey: ["plan-granizo", plan.id, "ampliaciones-pendientes"],
    queryFn: () => planGranizoApi.ampliacionesPendientes(plan.id),
    enabled: canEdit,
  });
  const [sel, setSel] = useState<{ projectId: string; paneles: string; desde: string } | null>(null);
  const agregar = usePlanMutation(
    () => planGranizoApi.agregarAmpliacion(plan.id, { projectId: sel!.projectId, paneles: Number(sel!.paneles), desde: sel!.desde }),
    "Ampliación sumada al plan",
  );
  const cobrar = usePlanMutation((id: string) => planGranizoApi.marcarCobroAmpliacion(id, "PAGADO", hoyIso()), "Cobro de la ampliación registrado");

  const hayPendientes = (pendientes.data?.length ?? 0) > 0;
  if (plan.ampliaciones.length === 0 && !hayPendientes) return null;

  return (
    <section className={CARD}>
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Ampliaciones</h3>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Los paneles nuevos se suman desde su puesta en marcha y se cobra la parte proporcional hasta la próxima anualidad.
      </p>
      {plan.ampliaciones.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--color-bg-app)] px-3 py-2 text-sm">
          <span>
            <LinkIcon size={12} className="mr-1 inline" />
            {a.paneles} paneles desde {fmtFecha(a.desde)}
            {a.meses > 0 ? ` · ${a.meses} ${a.meses === 1 ? "mes" : "meses"} = ${fmtUsd(a.montoUsd)}` : " · entran en la primera anualidad"}
          </span>
          {a.meses > 0 ? (
            a.cobro.estado === "PAGADO" ? (
              <span className="text-xs text-[var(--color-state-done-text)]">Cobrada {fmtFecha(a.cobro.fechaPago)}</span>
            ) : canCobrar ? (
              <Button size="sm" variant="secondary" loading={cobrar.isPending} onClick={() => cobrar.mutate(a.id)}>
                Marcar cobrada hoy
              </Button>
            ) : (
              <span className="text-xs text-[var(--color-warning-text)]">A cobrar</span>
            )
          ) : null}
        </div>
      ))}
      {canEdit && hayPendientes ? (
        abierto && sel ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block text-[var(--color-text-secondary)]">Ampliación</span>
              <select className={INPUT} value={sel.projectId} onChange={(e) => {
                const p = pendientes.data!.find((x) => x.projectId === e.target.value)!;
                setSel({ projectId: p.projectId, paneles: String(p.panelesSugeridos ?? ""), desde: p.puestaEnMarcha ?? hoyIso() });
              }}>
                {pendientes.data!.map((p) => (
                  <option key={p.projectId} value={p.projectId}>{p.code}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-[var(--color-text-secondary)]">Paneles nuevos</span>
              <input type="number" min={1} className={`${INPUT} w-24`} value={sel.paneles} onChange={(e) => setSel({ ...sel, paneles: e.target.value })} />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-[var(--color-text-secondary)]">Puesta en marcha</span>
              <input type="date" className={INPUT} value={sel.desde} onChange={(e) => setSel({ ...sel, desde: e.target.value })} />
            </label>
            <Button size="sm" loading={agregar.isPending} disabled={!(Number(sel.paneles) > 0)} onClick={() => agregar.mutate(undefined, { onSuccess: () => setAbierto(false) })}>
              Sumar al plan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const p = pendientes.data![0]!;
              setSel({ projectId: p.projectId, paneles: String(p.panelesSugeridos ?? ""), desde: p.puestaEnMarcha ?? hoyIso() });
              setAbierto(true);
            }}
          >
            Sumar ampliación ({pendientes.data!.length} sin sumar)
          </Button>
        )
      ) : null}
    </section>
  );
}

function Baja({ plan, canEdit }: { plan: PlanGranizo; canEdit: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [anular, setAnular] = useState(true);
  const cancelar = usePlanMutation(() => planGranizoApi.cancelar(plan.id, motivo, anular), "Plan dado de baja");
  const reactivar = usePlanMutation(() => planGranizoApi.reactivar(plan.id), "Plan reactivado");
  if (!canEdit) return null;

  if (plan.estadoBase === "CANCELADA") {
    return (
      <section className={CARD}>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Dado de baja el {fmtFecha(plan.canceladaEn)}: {plan.motivoCancelacion}
        </p>
        <Button size="sm" variant="secondary" loading={reactivar.isPending} onClick={() => reactivar.mutate(undefined)}>
          Reactivar el plan
        </Button>
      </section>
    );
  }
  return (
    <section className={CARD}>
      {!abierto ? (
        <button type="button" className="text-xs text-[var(--color-danger-text)] hover:underline" onClick={() => setAbierto(true)}>
          Dar de baja el plan
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-secondary)]">
            La anualidad en curso no se reintegra y el plan cubre hasta el fin del período que ya pagó.
          </p>
          <input className={`${INPUT} w-full`} placeholder="Motivo (lo pidió por escrito, no renueva…)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            <input type="checkbox" checked={anular} onChange={(e) => setAnular(e.target.checked)} />
            Anular en Finanzas los cobros que todavía no se hicieron
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" loading={cancelar.isPending} disabled={motivo.trim().length < 3} onClick={() => cancelar.mutate(undefined)}>
              Dar de baja
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </section>
  );
}

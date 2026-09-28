import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudHail } from "lucide-react";
import { Link } from "react-router-dom";

import { planGranizoApi, type PlanDeProyecto } from "../../api/planGranizo.api";
import { usePermission } from "../../hooks/usePermission";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { EstadoPlanChip } from "./EstadoPlanChip";
import { fmtFecha, fmtUsd, hoyIso } from "./estado";
import { PlanGranizoDocSection } from "./PlanGranizoDocSection";
import { MensajesPlanModal } from "./MensajesPlanModal";
import { PlanGranizoModal } from "./PlanGranizoModal";
import { usePlanMutation } from "./usePlanMutation";

const INPUT =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";
const LABEL = "mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]";

// Tarjeta del Plan de Protección contra Granizo en la ficha del cliente
// (Experiencia Solar): estado, lo que falta para activarlo, alta y el
// generador de las condiciones con el Anexo A.
export function PlanGranizoCard({ projectId }: { projectId: string }) {
  const q = useQuery({ queryKey: ["plan-granizo-proyecto", projectId], queryFn: () => planGranizoApi.deProyecto(projectId) });
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const [abierto, setAbierto] = useState(false);
  const [alta, setAlta] = useState(false);
  const [mensajes, setMensajes] = useState(false);

  const d = q.data;
  const plan = d?.poliza ?? null;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-primary)]">
          <CloudHail size={15} /> Plan de Protección contra Granizo
        </h3>
        {plan ? <EstadoPlanChip estado={plan.estado.estado} /> : null}
      </div>

      {!d ? (
        <Spinner size={16} />
      ) : d.esAmpliacionDe && !plan ? (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Es una ampliación de{" "}
          <Link to={`/clientes/${d.esAmpliacionDe.projectId}`} className="text-[var(--color-accent)] hover:underline">
            {d.esAmpliacionDe.clientName}
          </Link>
          : sus paneles se suman al plan de esa instalación.
        </p>
      ) : plan ? (
        <>
          {d.esAmpliacionDe ? (
            <p className="text-[11px] text-[var(--color-text-muted)]">Plan de la obra original ({d.esAmpliacionDe.clientName}).</p>
          ) : null}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[var(--color-text-secondary)]">
            <span>{plan.cantidadPaneles} paneles · {fmtUsd(plan.montoAnualUsd)}/año</span>
            <span>{plan.estado.vencimiento ? `Vence ${fmtFecha(plan.estado.vencimiento)}` : "Sin vencimiento aún"}</span>
            {plan.estado.proximoCobro ? (
              <span className="col-span-2">
                Próximo cobro {fmtUsd(plan.estado.proximoCobro.montoUsd)} · {fmtFecha(plan.estado.proximoCobro.fecha)}
              </span>
            ) : null}
          </div>
          {plan.estado.faltaFirma || plan.estado.faltaPago || (!plan.sinCarencia && plan.fotosInicio.length === 0) ? (
            <ul className="space-y-0.5 text-[12px] text-[var(--color-warning-text)]">
              {plan.estado.faltaFirma ? <li>• Falta el Anexo A firmado</li> : null}
              {plan.estado.faltaPago ? <li>• Falta cobrar la primera anualidad</li> : null}
              {!plan.sinCarencia && plan.fotosInicio.length === 0 ? <li>• Faltan las fotos de inicio de los paneles</li> : null}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAbierto(true)}>
              Abrir el plan
            </Button>
            {plan.estado.alerta ? (
              <Button size="sm" variant="danger" onClick={() => setMensajes(true)}>
                Avisar al cliente
              </Button>
            ) : null}
          </div>
          {mensajes ? <MensajesPlanModal plan={plan} onClose={() => setMensajes(false)} /> : null}
        </>
      ) : alta ? (
        <AltaPlan projectId={projectId} d={d} onDone={() => setAlta(false)} />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-muted)]">No tiene el plan.</p>
          {canCreate ? (
            <Button size="sm" variant="secondary" onClick={() => setAlta(true)}>
              Dar de alta el plan
            </Button>
          ) : null}
        </div>
      )}

      {d && !(d.esAmpliacionDe && !plan) ? (
        <div className="border-t border-[var(--color-border)] pt-3">
          <PlanGranizoDocSection projectId={projectId} canGenerate={canEdit} />
        </div>
      ) : null}

      {abierto && plan ? <PlanGranizoModal polizaId={plan.id} onClose={() => setAbierto(false)} /> : null}
    </div>
  );
}

function AltaPlan({ projectId, d, onDone }: { projectId: string; d: PlanDeProyecto; onDone: () => void }) {
  const s = d.sugerencias;
  const [f, setF] = useState({
    instalacion: (s.puestaEnMarcha ? "EXISTENTE" : "NUEVA") as "NUEVA" | "EXISTENTE",
    paneles: s.cantidadPaneles ? String(s.cantidadPaneles) : "",
    inicio: s.puestaEnMarcha ?? "",
    serie: "",
    yaPago: false,
    fechaPago: hoyIso(),
  });
  const crear = usePlanMutation(
    () =>
      planGranizoApi.crear({
        projectId,
        cantidadPaneles: Number(f.paneles),
        sinCarencia: f.instalacion === "NUEVA",
        fechaInicio: f.instalacion === "NUEVA" ? f.inicio || null : undefined,
        inversorSerie: f.serie || null,
        primerCobroPagadoEl: f.yaPago ? f.fechaPago : null,
      }),
    "Plan dado de alta",
  );
  const monto = Number(f.paneles) * s.precioPorPanelUsd;

  return (
    <div className="space-y-3 rounded-md bg-[var(--color-bg-card)] p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={LABEL}>Instalación</span>
          <select className={INPUT} value={f.instalacion} onChange={(e) => setF({ ...f, instalacion: e.target.value as "NUEVA" | "EXISTENTE" })}>
            <option value="NUEVA">Nueva: se adhiere con la obra (sin carencia, arranca con la puesta en marcha)</option>
            <option value="EXISTENTE">Existente: ya estaba instalada (cubre 30 días después del primer pago)</option>
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>
            Paneles (todos){s.fuente !== "MANUAL" ? ` · según ${s.fuente === "UNIFILAR" ? "el unifilar" : "la propuesta"}` : ""}
          </span>
          <input type="number" min={1} className={INPUT} value={f.paneles} onChange={(e) => setF({ ...f, paneles: e.target.value })} />
        </label>
        <label className="block">
          <span className={LABEL}>Número de serie del inversor</span>
          <input className={INPUT} value={f.serie} onChange={(e) => setF({ ...f, serie: e.target.value })} />
        </label>
        {f.instalacion === "NUEVA" ? (
          <label className="block">
            <span className={LABEL}>Puesta en marcha (vacío = todavía no)</span>
            <input type="date" className={INPUT} value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} />
          </label>
        ) : null}
        <label className="flex items-center gap-2 self-end text-xs text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={f.yaPago} onChange={(e) => setF({ ...f, yaPago: e.target.checked })} />
          Ya pagó la primera anualidad
        </label>
        {f.yaPago ? (
          <label className="block">
            <span className={LABEL}>Fecha del pago</span>
            <input type="date" className={INPUT} value={f.fechaPago} onChange={(e) => setF({ ...f, fechaPago: e.target.value })} />
          </label>
        ) : null}
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {Number(f.paneles) > 0 ? `${f.paneles} paneles × ${fmtUsd(s.precioPorPanelUsd)} = ${fmtUsd(monto)} por año.` : "Cargá la cantidad de paneles."}{" "}
        Después falta subir el Anexo A firmado{f.instalacion === "EXISTENTE" ? " y las fotos de inicio" : ""}.
      </p>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button size="sm" loading={crear.isPending} disabled={!(Number(f.paneles) > 0)} onClick={() => crear.mutate(undefined, { onSuccess: onDone })}>
          Dar de alta
        </Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Mail, MapPin, Phone, User, Wrench, Zap } from "lucide-react";

import { getChecks, type ClienteRecorrido } from "../../../api/clientes.api";
import { EnlacesModulos } from "../../../components/layout/EnlacesModulos";
import { Spinner } from "../../../components/ui/Spinner";
import { usePermission } from "../../../hooks/usePermission";
import { ClienteInteractionForm } from "../components/ClienteInteractionForm";
import { ClienteTimeline } from "../components/ClienteTimeline";
import { ClienteTramiteUteCard } from "../components/ClienteTramiteUteCard";
import { EditableCell } from "../components/EditableCell";
import { RecorridoChecks } from "../components/RecorridoChecks";
import { RecorridoPipeline } from "../components/RecorridoPipeline";
import { ESTADO_LABELS } from "../constants";
import { useClienteFicha } from "../hooks/useClienteFicha";
import { useUpdateCliente } from "../hooks/useUpdateCliente";

// La ficha del cliente es UNA pantalla, no cuatro pestañas.
//
// Antes había Resumen / Pasos / Interacciones / Historial: para saber cómo venía
// un cliente había que recorrer las cuatro y recordar lo de la anterior. Ahora:
//
//   - Arriba, el **pipeline del recorrido** (E1/E2/E3), leído igual que el
//     pipeline del proyecto. Se clickea una etapa y abajo aparecen sus pasos.
//   - Abajo a la izquierda, **los pasos de la etapa elegida**.
//   - A la derecha, **el historial completo**, lo más nuevo arriba, con el
//     registro de contacto pegado arriba de todo.
//
// Los datos del cliente pasan a una tarjeta plegable: se consultan de a ratos,
// no son el trabajo.

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ClienteFichaPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const updateCliente = useUpdateCliente();
  const [etapaSel, setEtapaSel] = useState<ClienteRecorrido | null>(null);

  function saveField(patch: Parameters<typeof updateCliente.mutateAsync>[0]["patch"]) {
    return updateCliente.mutateAsync({ projectId: projectId as string, patch }).then(() => undefined);
  }

  const { data: ficha, isLoading, isError } = useClienteFicha(projectId);
  const { data: checks } = useQuery({
    queryKey: ["cliente-checks", projectId],
    queryFn: () => getChecks(projectId as string),
    enabled: Boolean(projectId),
  });

  // Al abrir, se posa en la etapa donde está el cliente: es lo que se viene a
  // mirar. Después manda lo que elija la persona.
  const etapaActual = ficha?.etapa?.recorrido.codigo ?? null;
  useEffect(() => {
    if (etapaSel === null && etapaActual) setEtapaSel(etapaActual);
  }, [etapaActual, etapaSel]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError || !ficha) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate("/clientes")}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <p className="text-sm text-[var(--color-danger-text)]">No se encontró el cliente.</p>
      </div>
    );
  }

  const etapa = etapaSel ?? etapaActual ?? "E1";

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate("/clientes")}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </button>

      {/* Header: identidad + las dos señales que definen si hay que hacer algo hoy. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">{ficha.nombre}</h1>
            <span className="inline-flex items-center rounded bg-[var(--color-border)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
              <EditableCell
                value={ficha.estado}
                type="text"
                options={(Object.keys(ESTADO_LABELS) as Array<keyof typeof ESTADO_LABELS>).map((e) => ({
                  value: e,
                  label: ESTADO_LABELS[e],
                }))}
                canEdit={canEdit}
                ariaLabel="estado"
                render={(v) => ESTADO_LABELS[(v ?? ficha.estado) as keyof typeof ESTADO_LABELS]}
                onSave={(v) => saveField({ estado: (v ?? ficha.estado) as typeof ficha.estado })}
              />
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                ficha.fueraDeCadencia
                  ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
                  : "bg-[var(--color-bg-card)] text-[var(--color-text-muted)]"
              }`}
              title={
                ficha.fueraDeCadencia
                  ? "Supera los días sin contacto definidos para su etapa"
                  : "Días desde el último contacto registrado"
              }
            >
              <Phone className="h-3 w-3" />
              {ficha.diasSinContacto === null
                ? "Sin contacto registrado"
                : ficha.diasSinContacto === 0
                  ? "Contactado hoy"
                  : `${ficha.diasSinContacto} d sin contacto`}
            </span>
            {ficha.avisoHabilitacionPendiente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-danger-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger-text)]">
                ⚠ Avisar que puede encender
              </span>
            )}
          </div>
          {/* Todos los datos del cliente acá arriba, chicos: estaban plegados al
              fondo de la pantalla, que es donde nadie los busca. El orden es el
              del uso —cómo contactarlo, dónde está, qué le instalamos, cuándo—,
              no el del modelo de datos. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-text-muted)]">
            {ficha.mail && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <a href={`mailto:${ficha.mail}`} className="hover:text-[var(--color-text-primary)]">
                  {ficha.mail}
                </a>
              </span>
            )}
            {ficha.telefono && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <a href={`tel:${ficha.telefono}`} className="hover:text-[var(--color-text-primary)]">
                  {ficha.telefono}
                </a>
              </span>
            )}
            {(ficha.direccion || ficha.departamento) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {[ficha.direccion, ficha.departamento].filter(Boolean).join(", ")}
              </span>
            )}
            {ficha.asesor && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 shrink-0" /> {ficha.asesor.nombre}
              </span>
            )}
            {ficha.potenciaKwp != null && (
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 shrink-0" /> {ficha.potenciaKwp} kWp
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              Venta {fmtDate(ficha.fechaVenta)} · Entrega{" "}
              <EditableCell
                value={ficha.fechaEntrega}
                type="date"
                canEdit={canEdit}
                ariaLabel="fecha de entrega"
                render={(v) => (v ? fmtDate(v) : "—")}
                onSave={(v) => saveField({ fechaEntrega: v })}
              />
              {ficha.fechaHabilitacion && <> · Habilitación {fmtDate(ficha.fechaHabilitacion)}</>}
            </span>
            {ficha.mantenimiento && (
              <span className="inline-flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                Mantenimiento{" "}
                {ficha.mantenimiento.diasRestantes === 0
                  ? "hoy"
                  : `en ${ficha.mantenimiento.diasRestantes} d`}
              </span>
            )}
          </div>
        </div>
        <EnlacesModulos
          actual="experiencia"
          projectId={projectId ?? null}
          leadId={ficha.leadId}
          uteProcessId={ficha.uteProcessId}
          className="shrink-0 justify-end"
        />
      </div>

      {/* Dos columnas a la par: a la izquierda lo que hay que hacer, a la derecha
          lo que pasó. Mitad y mitad — las dos son el trabajo, no una principal y
          una barra lateral.

          El pipeline va DENTRO de la columna izquierda, no cruzado arriba: así el
          historial empieza a la misma altura que el recorrido y no queda empujado
          media pantalla hacia abajo. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {/* El mapa de dónde está el cliente y qué falta. */}
          <RecorridoPipeline
            checks={checks ?? []}
            etapaActual={etapaActual}
            seleccionada={etapa}
            onSelect={setEtapaSel}
          />

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-4">
            {checks ? (
              <RecorridoChecks
                projectId={projectId ?? ""}
                ficha={ficha}
                recorrido={etapa}
                checks={checks}
              />
            ) : (
              <div className="flex justify-center py-6">
                <Spinner size={18} />
              </div>
            )}
          </div>

          <ClienteTramiteUteCard projectId={projectId ?? ""} tramiteUte={ficha.tramiteUte} />

        </div>

        {/* Historial: todo lo que pasó, lo más nuevo arriba. */}
        <div className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Novedades</h3>
            <span className="text-[11px] text-[var(--color-text-muted)]">lo más nuevo arriba</span>
          </div>
          {canCreate && projectId && <ClienteInteractionForm projectId={projectId} />}
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <ClienteTimeline projectId={projectId ?? ""} />
          </div>
        </div>
      </div>
    </div>
  );
}

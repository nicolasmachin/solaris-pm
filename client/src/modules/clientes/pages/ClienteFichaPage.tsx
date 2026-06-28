import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone, User } from "lucide-react";

import { Spinner } from "../../../components/ui/Spinner";
import { usePermission } from "../../../hooks/usePermission";
import { ClienteInteractionForm } from "../components/ClienteInteractionForm";
import { ClienteInteractionList } from "../components/ClienteInteractionList";
import { ClienteTramiteUteCard } from "../components/ClienteTramiteUteCard";
import { EditableCell } from "../components/EditableCell";
import { EtapaChip } from "../components/EtapaChip";
import { ESTADO_LABELS } from "../constants";
import { useClienteFicha } from "../hooks/useClienteFicha";
import { useUpdateCliente } from "../hooks/useUpdateCliente";

type Tab = "resumen" | "interacciones";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DataItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

export function ClienteFichaPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("resumen");
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");
  const updateCliente = useUpdateCliente();
  function saveField(patch: Parameters<typeof updateCliente.mutateAsync>[0]["patch"]) {
    return updateCliente.mutateAsync({ projectId: projectId as string, patch }).then(() => undefined);
  }

  const { data: ficha, isLoading, isError } = useClienteFicha(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (isError || !ficha) {
    return (
      <div className="space-y-4 p-6">
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

  return (
    <div className="space-y-5 p-6">
      <button
        onClick={() => navigate("/clientes")}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">{ficha.nombre}</h1>
            <span className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] bg-[var(--color-border)]">
              {ESTADO_LABELS[ficha.estado]}
            </span>
            {ficha.etapa && <EtapaChip etapa={ficha.etapa} />}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-muted)]">
            {ficha.mail && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {ficha.mail}
              </span>
            )}
            {ficha.telefono && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {ficha.telefono}
              </span>
            )}
            {ficha.departamento && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {ficha.departamento}
              </span>
            )}
            {ficha.asesor && (
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {ficha.asesor.nombre}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate(ficha.proyectoUrl)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          <ExternalLink className="h-4 w-4" /> Ir al proyecto
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {([
          ["resumen", "Resumen"],
          ["interacciones", "Interacciones"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === key
                ? "border-[var(--color-accent)] font-semibold text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {label}
            {key === "interacciones" && ficha.interacciones.length > 0 && (
              <span className="ml-1.5 text-[var(--color-text-muted)]">({ficha.interacciones.length})</span>
            )}
          </button>
        ))}
      </div>

      {tab === "resumen" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Datos del cliente</h3>
            <dl className="grid grid-cols-2 gap-3">
              <DataItem
                label="Potencia"
                value={ficha.potenciaKwp != null ? `${ficha.potenciaKwp} kWp` : "—"}
              />
              <DataItem
                label="Fecha de entrega"
                value={
                  <EditableCell
                    value={ficha.fechaEntrega}
                    type="date"
                    canEdit={canEdit}
                    ariaLabel="fecha de entrega"
                    render={(v) => (v ? fmtDate(v) : <span className="text-[var(--color-text-muted)]">—</span>)}
                    onSave={(v) => saveField({ fechaEntrega: v })}
                  />
                }
              />
              <DataItem
                label="Mail"
                value={
                  <EditableCell
                    value={ficha.mail}
                    type="email"
                    canEdit={canEdit}
                    ariaLabel="mail"
                    onSave={(v) => saveField({ mail: v })}
                  />
                }
              />
              <DataItem
                label="Teléfono"
                value={
                  <EditableCell
                    value={ficha.telefono}
                    type="tel"
                    canEdit={canEdit}
                    ariaLabel="teléfono"
                    onSave={(v) => saveField({ telefono: v })}
                  />
                }
              />
              <DataItem label="Departamento" value={ficha.departamento ?? "—"} />
              <DataItem label="Dirección" value={ficha.direccion ?? "—"} />
              <DataItem label="Asesor" value={ficha.asesor?.nombre ?? "—"} />
              <DataItem
                label="Etapa"
                value={
                  ficha.etapa
                    ? `${ficha.etapa.recorrido.nombreLargo} · ${ficha.etapa.pipeline.label}`
                    : "—"
                }
              />
            </dl>
          </div>
          <ClienteTramiteUteCard tramiteUte={ficha.tramiteUte} />
        </div>
      ) : (
        <div className="space-y-4">
          {canCreate && projectId && <ClienteInteractionForm projectId={projectId} />}
          <ClienteInteractionList interacciones={ficha.interacciones} projectId={projectId ?? ""} />
        </div>
      )}
    </div>
  );
}

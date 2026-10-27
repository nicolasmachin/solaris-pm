import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { getDownloadUrl } from "../../api/files.api";
import { proformaApi } from "../../api/proforma.api";
import { getProject, patchProject } from "../../api/projects.api";
import { PlanPagosModal } from "../finance/PlanPagosModal";
import { ProformaBuilderModal } from "../proforma/ProformaBuilderModal";
import { ProformaVersionsList } from "../proforma/ProformaVersionsList";

type Modalidad = "FINANCIACION_BANCARIA" | "DIRECTO_50_50" | "OTRO";

const OPCIONES: Array<{ valor: Modalidad; titulo: string; pide: string }> = [
  { valor: "FINANCIACION_BANCARIA", titulo: "Financiación bancaria", pide: "Pide la proforma (generada o subida)" },
  { valor: "DIRECTO_50_50", titulo: "Pago directo", pide: "Pide el plan de pagos" },
  { valor: "OTRO", titulo: "Otro", pide: "Pide explicar qué se acordó" },
];

/**
 * El panel de la subetapa "Modalidad de pago definida": se elige cómo paga el
 * cliente y ahí mismo se hace lo que esa elección exige.
 *
 * Las tres opciones no son informativas: cada una prende un ítem obligatorio del
 * checklist que **no se puede tildar sin el documento** (la proforma, el plan de
 * pagos, la explicación). Y sin elegir ninguna, la subetapa no cierra. Antes esto
 * quedaba en tierra de nadie —la herramienta del plan vivía sólo en Finanzas, el
 * asesor no la veía— y el proyecto llegaba a Experiencia Solar sin que nadie
 * supiera qué cobrar.
 */
export function ModalidadPagoPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [proformaOpen, setProformaOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [nota, setNota] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
  });

  const modalidad: Modalidad | null = project?.modalidadPago ?? null;
  const notaGuardada: string = project?.modalidadPagoNota ?? "";
  const notaActual = nota ?? notaGuardada;

  const guardar = useMutation({
    mutationFn: (patch: { modalidadPago?: Modalidad; modalidadPagoNota?: string }) =>
      patchProject(projectId, patch),
    onSuccess: () => {
      // El checklist cambia con la modalidad (aparecen y desaparecen ítems) y los
      // ítems con evidencia se marcan solos, así que hay que refrescar las dos.
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["stages", projectId] });
    },
    onError: () => toast.error("No se pudo guardar"),
  });

  // Proformas subidas a mano y las que vienen del lead: valen igual que una
  // generada para cerrar el Onboarding con financiación.
  const inputSubida = useRef<HTMLInputElement>(null);
  const { data: subidas = [] } = useQuery({
    queryKey: ["proforma-subidas", projectId],
    queryFn: () => proformaApi.listSubidas(projectId),
    enabled: modalidad === "FINANCIACION_BANCARIA",
  });
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["proforma-subidas", projectId] });
    qc.invalidateQueries({ queryKey: ["stages", projectId] });
    qc.invalidateQueries({ queryKey: ["project", projectId] });
  };
  const subir = useMutation({
    mutationFn: (f: File) => proformaApi.subir(projectId, f),
    onSuccess: () => {
      toast.success("Proforma subida");
      refrescar();
    },
    onError: () => toast.error("No se pudo subir la proforma (tiene que ser PDF, JPG o PNG)"),
  });
  const borrar = useMutation({
    mutationFn: (fileId: string) => proformaApi.borrarSubida(projectId, fileId),
    onSuccess: refrescar,
    onError: () => toast.error("No se pudo borrar"),
  });

  if (!project) return null;

  return (
    <div className="mb-3 rounded-lg border border-[var(--color-border)] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        ¿Cómo paga el cliente?
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {OPCIONES.map((op) => {
          const elegida = modalidad === op.valor;
          return (
            <button
              key={op.valor}
              type="button"
              onClick={() => guardar.mutate({ modalidadPago: op.valor })}
              disabled={guardar.isPending}
              aria-pressed={elegida}
              className={`rounded-lg border px-2 py-2 text-left transition disabled:opacity-50 ${
                elegida
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
              }`}
            >
              <div className="text-xs font-semibold text-[var(--color-text-primary)]">{op.titulo}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-[var(--color-text-muted)]">{op.pide}</div>
            </button>
          );
        })}
      </div>

      {!modalidad && (
        <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          Elegí una para seguir. La subetapa no se puede completar sin esto.
        </p>
      )}

      {modalidad === "FINANCIACION_BANCARIA" && (
        <>
          <button
            onClick={() => setProformaOpen(true)}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
          >
            🏦 Generar proforma BBVA
          </button>
          <button
            onClick={() => inputSubida.current?.click()}
            disabled={subir.isPending}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
          >
            {subir.isPending ? "Subiendo…" : "📎 Subir proforma hecha por fuera (PDF o foto)"}
          </button>
          <input
            ref={inputSubida}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) subir.mutate(f);
              e.target.value = "";
            }}
          />
          {subidas.length > 0 && (
            <ul className="mb-2 space-y-1">
              {subidas.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-[11px]"
                >
                  <a
                    href={getDownloadUrl(a.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 truncate text-[var(--color-text-primary)] hover:underline"
                  >
                    {a.filename}
                  </a>
                  <span className="shrink-0 text-[var(--color-text-muted)]">
                    {a.origen === "lead" ? "del lead" : "subida"}
                  </span>
                  {a.origen === "proyecto" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Borrar la proforma "${a.filename}"?`)) borrar.mutate(a.id);
                      }}
                      className="shrink-0 text-[var(--color-text-muted)] hover:text-red-400"
                      aria-label={`Borrar ${a.filename}`}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <ProformaVersionsList projectId={projectId} />
          {proformaOpen && (
            <ProformaBuilderModal projectId={projectId} onClose={() => setProformaOpen(false)} />
          )}
        </>
      )}

      {modalidad === "DIRECTO_50_50" && (
        <>
          <button
            onClick={() => setPlanOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-black hover:opacity-90"
          >
            💵 Crear o editar el plan de pagos
          </button>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Son los cobros previstos del proyecto: con esto Experiencia Solar sabe qué cobrar y cuándo.
          </p>
          {planOpen && (
            <PlanPagosModal
              projectId={projectId}
              projectName={project.clientName}
              onClose={() => {
                setPlanOpen(false);
                qc.invalidateQueries({ queryKey: ["stages", projectId] });
              }}
            />
          )}
        </>
      )}

      {modalidad === "OTRO" && (
        <>
          <label
            htmlFor="modalidad-nota"
            className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
          >
            ¿Qué se acordó?
          </label>
          <textarea
            id="modalidad-nota"
            value={notaActual}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => {
              if (notaActual !== notaGuardada) guardar.mutate({ modalidadPagoNota: notaActual });
            }}
            rows={3}
            placeholder="Un canje, un pago adelantado, una condición negociada…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2.5 py-2 text-xs text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Sin esto, dentro de seis meses nadie va a saber qué se acordó con este cliente.
          </p>
        </>
      )}
    </div>
  );
}

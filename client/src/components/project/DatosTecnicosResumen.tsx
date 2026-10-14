import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { patchProject } from "../../api/projects.api";
import type { Project, TipoMontaje } from "../../types/api.types";
import {
  TIPO_MONTAJE_OPTIONS,
  fasesDeSistemas,
  getPhaseTypeShortLabel,
  totalPanelesDeSistemas,
} from "./SolarSystemFields";

/**
 * Lo que Operaciones mira para agendar —cuántos paneles, mono o tri, cómo se
 * monta— arriba de todo en Datos técnicos, con lo que dijo la propuesta y lo
 * que relevó la pre-ingeniería al lado para ver si coinciden.
 *
 * La Pre-Ingeniería no cierra mientras haya `faltantes` (el servidor lo exige);
 * acá se muestran para que se vea qué corregir antes de intentarlo.
 */
export function DatosTecnicosResumen({ project }: { project: Project }) {
  const qc = useQueryClient();
  const systems = project.solarSystems ?? [];
  const dt = project.datosTecnicos;
  const paneles = totalPanelesDeSistemas(systems);
  const fases = fasesDeSistemas(systems);

  const montajeMut = useMutation({
    mutationFn: (tipoMontaje: TipoMontaje | null) => patchProject(project.id, { tipoMontaje }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Montaje guardado");
    },
    onError: () => toast.error("No se pudo guardar el montaje"),
  });

  const pre = dt?.preIngenieria ?? null;
  const prop = dt?.propuesta ?? null;
  const panelesOk = pre?.cantidadPaneles == null || paneles == null || pre.cantidadPaneles === paneles;
  const kwOk = pre?.inversorKw == null || dt?.totalInversorKw == null || Math.abs(pre.inversorKw - dt.totalInversorKw) <= 0.05;
  const faseOk = !dt || !pre || pre.red.length === 0 || dt.fases.every((f) => pre.red.includes(f));

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Dato label="Paneles" value={paneles != null ? String(paneles) : "Sin cargar"} muted={paneles == null} />
        <Dato label="Fase" value={fases ?? "Sin cargar"} muted={!fases} />
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">Montaje</p>
          <select
            value={project.tipoMontaje ?? ""}
            disabled={montajeMut.isPending}
            onChange={(e) => montajeMut.mutate((e.target.value || null) as TipoMontaje | null)}
            className="mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-base font-semibold text-[var(--color-text-primary)]"
          >
            <option value="">Sin definir</option>
            {TIPO_MONTAJE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} title={o.hint}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-xs text-[var(--color-text-secondary)]">
        {prop ? (
          <p>
            <span className="text-[var(--color-text-muted)]">Propuesta v{prop.versionNumber}:</span>{" "}
            {[
              prop.cantidadPaneles != null ? `${prop.cantidadPaneles} paneles` : null,
              prop.potenciaInversorKw != null ? `inversor ${prop.potenciaInversorKw} kW` : null,
              prop.tipoMontaje ? `montaje "${prop.tipoMontaje}"` : "sin montaje indicado",
            ].filter(Boolean).join(" · ")}
          </p>
        ) : (
          <p className="text-[var(--color-text-muted)]">Sin propuesta publicada vinculada.</p>
        )}
        {pre ? (
          <p>
            <span className="text-[var(--color-text-muted)]">Pre-ingeniería v{pre.versionNumber}:</span>{" "}
            <Cruce ok={panelesOk}>{pre.cantidadPanelesTexto ? `${pre.cantidadPanelesTexto} paneles` : "paneles sin indicar"}</Cruce>
            {" · "}
            <Cruce ok={kwOk}>{pre.inversor ? `inversor "${pre.inversor}"` : "inversor sin indicar"}</Cruce>
            {pre.red.length > 0 ? (
              <>
                {" · "}
                <Cruce ok={faseOk}>red {pre.red.map((f) => getPhaseTypeShortLabel(f)).join(" + ")}</Cruce>
              </>
            ) : null}
          </p>
        ) : (
          <p className="text-[var(--color-text-muted)]">Todavía no hay documento de pre-ingeniería para comparar.</p>
        )}
      </div>

      {dt && dt.faltantes.length > 0 ? (
        <div className="mt-3 rounded-md border border-[var(--color-warning-text)]/40 bg-[var(--color-warning-text)]/10 px-3 py-2 text-xs text-[var(--color-text-primary)]">
          <p className="font-semibold">Para cerrar la Pre-Ingeniería falta:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {dt.faltantes.map((f) => <li key={f.codigo}>{f.mensaje}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Dato({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${muted ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}`}>{value}</p>
    </div>
  );
}

function Cruce({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={ok ? "" : "font-semibold text-[var(--color-warning-text)]"} title={ok ? undefined : "No coincide con Datos técnicos"}>
      {ok ? "" : "⚠ "}{children}
    </span>
  );
}

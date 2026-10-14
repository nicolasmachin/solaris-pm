import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getDatosTecnicos } from "../../api/projects.api";
import type { PhaseType } from "../../types/api.types";
import { getPhaseTypeShortLabel } from "./SolarSystemFields";

/**
 * Lo que Operaciones mira para agendar —cuántos paneles, mono o tri, el techo y
 * si van coplanares o inclinados—, tomado del formulario de pre-ingeniería y
 * validado contra el unifilar. Va en la ficha del proyecto y en el espacio de
 * Ingeniería.
 *
 * La Pre-Ingeniería no cierra mientras haya `faltantes` (el servidor lo exige);
 * acá se muestran para que se vea qué corregir antes de intentarlo.
 */
export function DatosTecnicosResumen({ projectId, linkIngenieria = false }: { projectId: string; linkIngenieria?: boolean }) {
  const { data: dt } = useQuery({
    queryKey: ["datos-tecnicos", projectId],
    queryFn: () => getDatosTecnicos(projectId),
  });
  if (!dt) return null;

  const pre = dt.preIngenieria;
  const uni = dt.unifilar;
  const prop = dt.propuesta;
  const fases = (red: PhaseType[]) => red.map((f) => getPhaseTypeShortLabel(f)).join(" + ");
  const panelesOk = !pre || !uni || pre.cantidadPaneles == null || pre.cantidadPaneles === uni.cantidadPaneles;
  const kwOk = !pre || !uni || pre.inversorKw == null || Math.abs(pre.inversorKw - uni.inversorKw) <= 0.05;
  const faseOk = !pre || !uni || pre.red.length === 0 || uni.red.every((f) => pre.red.includes(f));
  const inclinacion = pre?.inclinacion === "COPLANAR" ? "Coplanar" : pre?.inclinacion === "INCLINADO" ? "Inclinado" : null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Dato label="Paneles" value={pre?.cantidadPaneles != null ? String(pre.cantidadPaneles) : null} />
          <Dato label="Red" value={pre && pre.red.length > 0 ? fases(pre.red) : null} />
          <Dato label="Techo" value={pre?.techo ?? null} />
          <Dato label="Paneles" sub="coplanar / inclinado" value={inclinacion} />
        </div>
        {linkIngenieria ? (
          <Link
            to={`/ingenieria/proyecto/${projectId}`}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Abrir Ingeniería →
          </Link>
        ) : null}
      </div>

      <div className="mt-3 space-y-1 text-xs text-[var(--color-text-secondary)]">
        <p>
          <span className="text-[var(--color-text-muted)]">
            {pre ? `Pre-ingeniería v${pre.versionNumber}:` : "Pre-ingeniería:"}
          </span>{" "}
          {pre
            ? [pre.inversor ? `inversor "${pre.inversor}"` : "inversor sin indicar", pre.potenciaPanelW ? `paneles de ${pre.potenciaPanelW} W` : null]
                .filter(Boolean).join(" · ")
            : "todavía no se hizo."}
        </p>
        <p>
          <span className="text-[var(--color-text-muted)]">
            {uni && uni.versiones.length === 1 ? `Unifilar v${uni.versiones[0].versionNumber}:` : "Unifilar:"}
          </span>{" "}
          {uni ? (
            <>
              <Cruce ok={panelesOk}>{uni.cantidadPaneles} paneles</Cruce>
              {" · "}
              <Cruce ok={kwOk}>inversor {uni.inversorKw} kW</Cruce>
              {" · "}
              <Cruce ok={faseOk}>red {fases(uni.red)}</Cruce>
            </>
          ) : (
            "todavía no se hizo."
          )}
        </p>
        {prop ? (
          <p className="text-[var(--color-text-muted)]">
            Propuesta v{prop.versionNumber} (referencia):{" "}
            {[
              prop.cantidadPaneles != null ? `${prop.cantidadPaneles} paneles` : null,
              prop.potenciaInversorKw != null ? `inversor ${prop.potenciaInversorKw} kW` : null,
              prop.tipoMontaje ? `montaje "${prop.tipoMontaje}"` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      {dt.faltantes.length > 0 ? (
        <div className="mt-3 rounded-md border border-[var(--color-warning-text)]/40 bg-[var(--color-warning-text)]/10 px-3 py-2 text-xs text-[var(--color-text-primary)]">
          <p className="font-semibold">Para cerrar la Pre-Ingeniería falta:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {dt.faltantes.map((f, i) => <li key={`${f.codigo}-${i}`}>{f.mensaje}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Dato({ label, sub, value }: { label: string; sub?: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}{sub ? <span className="normal-case tracking-normal"> · {sub}</span> : null}
      </p>
      <p className={`mt-1 text-xl font-semibold ${value ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}`}>
        {value ?? "Sin definir"}
      </p>
    </div>
  );
}

function Cruce({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <span className={ok ? "" : "font-semibold text-[var(--color-warning-text)]"} title={ok ? undefined : "No coincide con la pre-ingeniería"}>
      {ok ? "" : "⚠ "}{children}
    </span>
  );
}

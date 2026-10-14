import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getDatosTecnicos } from "../../api/projects.api";
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
  const red = pre && pre.red.length > 0 ? pre.red.map((f) => getPhaseTypeShortLabel(f)).join(" + ") : null;
  const inclinacion = pre?.inclinacion === "COPLANAR" ? "Coplanar" : pre?.inclinacion === "INCLINADO" ? "Inclinado" : null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Dato label="Paneles" value={pre?.cantidadPaneles != null ? String(pre.cantidadPaneles) : null} />
          <Dato label="Red" value={red} />
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

      {/* Solo si algo falta o no coincide: pre-ingeniería, unifilar y sistema. */}
      {dt.faltantes.length > 0 ? (
        <div className="mt-3 rounded-md border border-[var(--color-warning-text)]/40 bg-[var(--color-warning-text)]/10 px-3 py-2 text-xs text-[var(--color-text-primary)]">
          <p className="font-semibold">⚠ Para cerrar la Pre-Ingeniería falta:</p>
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

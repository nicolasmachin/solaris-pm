import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Zap } from "lucide-react";
import { getIngenieriaWorkspace } from "../api/ingenieria.api";
import { UnifilarStep } from "../components/project/UnifilarStep";

/**
 * Página de la herramienta Unifilar dentro del módulo Ingeniería.
 * Reusa el componente `UnifilarStep` que originalmente vivía en StageDrawer.
 */
export function IngenieriaUnifilar() {
  const { id } = useParams<{ id: string }>();
  const { data } = useQuery({
    queryKey: ["ingenieria-workspace", id],
    queryFn: () => getIngenieriaWorkspace(id!),
    enabled: !!id,
  });

  if (!id) return null;

  return (
    <div className="space-y-4">
      <header>
        <Link
          to={`/ingenieria/proyecto/${id}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al workspace
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Zap className="w-5 h-5 text-[var(--color-accent)]" />
          Generador de unifilar
        </h1>
        {data?.project && (
          <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">
            {data.project.code} · {data.project.cliente} · {data.project.potenciaKwp} kWp
          </p>
        )}
      </header>

      <UnifilarStep projectId={id} />
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { FileText, PlayCircle, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { listSecciones } from "../../api/capacitacion.api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { AvanceBarra, Miniatura } from "./capacitacionUi";

// Portada del módulo: una tarjeta por área, con lo que hay adentro y cuánto
// lleva visto la persona. Solo se listan las áreas que su rol puede ver.
export function CapacitacionHome() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["capacitacion", "secciones"], queryFn: listSecciones });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={28} />
      </div>
    );
  }

  const secciones = data?.secciones ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Capacitación</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Videos y documentos de cada área para aprender a usar la app y trabajar mejor.
          </p>
        </div>
        {data?.puedeGestionar && (
          <Button variant="secondary" size="sm" onClick={() => navigate("/capacitacion/gestion")}>
            <span className="flex items-center gap-1.5">
              <Settings size={14} /> Gestionar
            </span>
          </Button>
        )}
      </div>

      {secciones.length === 0 ? (
        <EmptyState
          title="Todavía no hay capacitaciones para tu rol"
          description="Cuando se publique material de tu área lo vas a ver acá."
          icon="🎓"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {secciones.map((s) => (
            <Link
              key={s.id}
              to={`/capacitacion/${s.id}`}
              className="group flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 transition-colors hover:border-[var(--color-accent)]"
            >
              <Miniatura thumbnailUrl={s.thumbnailUrl} mediaToken={data?.mediaToken} />
              <div className="flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-base font-semibold text-[var(--color-text-primary)]">
                    {s.nombre}
                  </h2>
                  {!s.activa && (
                    <span className="rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                      Oculta
                    </span>
                  )}
                </div>
                {s.descripcion && (
                  <p className="line-clamp-2 text-xs text-[var(--color-text-muted)]">{s.descripcion}</p>
                )}
                <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <PlayCircle size={12} /> {s.totalVideos} {s.totalVideos === 1 ? "video" : "videos"}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText size={12} /> {s.totalDocumentos}{" "}
                    {s.totalDocumentos === 1 ? "documento" : "documentos"}
                  </span>
                </div>
              </div>
              <AvanceBarra vistos={s.videosVistos} total={s.totalVideos} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

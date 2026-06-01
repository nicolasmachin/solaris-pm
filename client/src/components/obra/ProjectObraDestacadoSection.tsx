import { Camera } from "lucide-react";

import { ProjectObraSection } from "./ProjectObraSection";

interface Props {
  projectId: string;
}

// Bloque destacado de "Obra del proyecto" (sección de primer nivel de la
// página del proyecto, debajo de Tareas): header con título + ícono y, dentro,
// la galería de fotos + checklist (ProjectObraSection).
export function ProjectObraDestacadoSection({ projectId }: Props) {
  return (
    <section className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
          <Camera size={18} />
        </span>
        <div>
          <h2 className="font-display text-base font-bold text-[var(--color-text-primary)]">
            Obra del proyecto
          </h2>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Fotos de obra y checklist de referencia.
          </p>
        </div>
      </div>

      <ProjectObraSection projectId={projectId} />
    </section>
  );
}

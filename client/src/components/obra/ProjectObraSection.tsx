import { ObraPhotoGallery } from "./ObraPhotoGallery";
import { ObraChecklist } from "./ObraChecklist";

interface Props {
  projectId: string;
}

// Sección "Obra" del proyecto: galería de fotos arriba + checklist de
// referencia abajo. Se renderiza dentro del tab "Obra" de ProjectDetail.
export function ProjectObraSection({ projectId }: Props) {
  return (
    <div className="space-y-4">
      <ObraPhotoGallery projectId={projectId} />
      <ObraChecklist projectId={projectId} />
    </div>
  );
}

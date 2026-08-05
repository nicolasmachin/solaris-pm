import { ObraPhotoGallery } from "./ObraPhotoGallery";
import { ObraChecklist } from "./ObraChecklist";
import { ProjectVideosSection } from "../videos/ProjectVideosSection";

interface Props {
  projectId: string;
}

// Sección "Obra" del proyecto: galería de fotos, videos y checklist
// de referencia. Se renderiza dentro del tab "Obra" de ProjectDetail.
//
// Los videos van acá, junto a las fotos, porque es donde el operario ya entra a
// cargar la evidencia de la obra; no tiene sentido mandarlo a otra pantalla.
export function ProjectObraSection({ projectId }: Props) {
  return (
    <div className="space-y-4">
      <ObraPhotoGallery projectId={projectId} />
      <ProjectVideosSection projectId={projectId} />
      <ObraChecklist projectId={projectId} />
    </div>
  );
}

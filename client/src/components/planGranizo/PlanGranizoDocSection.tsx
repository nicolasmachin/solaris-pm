import { useState } from "react";
import { FileSignature } from "lucide-react";

import { Button } from "../ui/Button";
import { PlanGranizoDocBuilderModal } from "./PlanGranizoDocBuilderModal";
import { PlanGranizoDocVersionsList } from "./PlanGranizoDocVersionsList";

// Botón del generador de condiciones + Anexo A y sus versiones. Se usa en la
// ficha de Experiencia Solar y en la etapa de Onboarding del proyecto.
export function PlanGranizoDocSection({ projectId, canGenerate }: { projectId: string; canGenerate: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {canGenerate ? (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <FileSignature size={14} className="mr-1.5 inline" />
          Condiciones y Anexo A
        </Button>
      ) : null}
      <PlanGranizoDocVersionsList projectId={projectId} />
      {open ? <PlanGranizoDocBuilderModal projectId={projectId} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

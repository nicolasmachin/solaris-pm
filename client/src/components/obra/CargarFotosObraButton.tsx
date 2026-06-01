import { useNavigate } from "react-router-dom";
import { Camera } from "lucide-react";

import { Button } from "../ui/Button";

interface Props {
  projectId: string;
  // block = grande, ancho completo (drawer / columna del header).
  // inline = compacto.
  variant?: "block" | "inline";
  className?: string;
}

// Acceso directo al tab "Obra" del proyecto (galería de fotos + checklist).
// Mismo color amarillo de marca que "Guardar notas" (Button variant primary).
// Navega con ?focus=obra; ProjectDetail scrollea al bloque destacado de Obra.
// Si ya estás en /projects/:id, solo cambia el search param (no remonta) y el
// effect dispara el scroll.
export function CargarFotosObraButton({ projectId, variant = "block", className = "" }: Props) {
  const navigate = useNavigate();

  return (
    <Button
      variant="primary"
      size={variant === "block" ? "md" : "sm"}
      onClick={() => navigate(`/projects/${projectId}?focus=obra`)}
      className={`${variant === "block" ? "w-full justify-center" : ""} ${className}`}
    >
      <Camera size={variant === "block" ? 16 : 14} />
      Cargar fotos de obra
    </Button>
  );
}

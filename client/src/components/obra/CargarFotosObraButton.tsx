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
// Navega con ?tab=obra; ProjectDetail abre el tab y hace scroll a la sección.
export function CargarFotosObraButton({ projectId, variant = "block", className = "" }: Props) {
  const navigate = useNavigate();

  return (
    <Button
      variant="primary"
      size={variant === "block" ? "md" : "sm"}
      onClick={() => navigate(`/projects/${projectId}?tab=obra`)}
      className={`${variant === "block" ? "w-full justify-center" : ""} ${className}`}
    >
      <Camera size={variant === "block" ? 16 : 14} />
      Cargar fotos de obra
    </Button>
  );
}

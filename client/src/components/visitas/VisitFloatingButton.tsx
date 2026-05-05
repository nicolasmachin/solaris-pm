import { useNavigate } from "react-router-dom";
import { Mic } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { usePermission } from "../../hooks/usePermission";

/**
 * Botón flotante para cargar una entrada de visita técnica desde cualquier
 * pantalla. Visible para usuarios con `OPERACIONES.EDIT` (operario, admin).
 *
 * Posición: arriba del `AIFloatingButton` cuando ambos están visibles
 * (ADMIN). El operario solo ve este botón.
 */
export function VisitFloatingButton() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canCreateVisitas = usePermission("OPERACIONES", "EDIT");

  if (!user || !canCreateVisitas) return null;

  // Si user es ADMIN, también está el AIFloatingButton en bottom-6 — me corro
  // arriba para no encimarme.
  const positionClass = user.role === "ADMIN" ? "bottom-24" : "bottom-6";

  return (
    <button
      onClick={() => navigate("/visita-rapida")}
      aria-label="Cargar entrada de visita técnica"
      title="Cargar visita técnica"
      className={`fixed ${positionClass} right-6 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-accent)] text-black shadow-lg hover:opacity-90 transition-opacity`}
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}

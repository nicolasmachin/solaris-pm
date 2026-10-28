import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Eye, Link2, Send, UserPlus } from "lucide-react";

import type { ClienteFicha } from "../../../api/clientes.api";
import { usePermission } from "../../../hooks/usePermission";
import { usePortalPreviewStore } from "../../../store/portalPreview.store";
import { CrearUsuarioModal } from "./CrearUsuarioModal";
import { ReenviarAccesoModal } from "./ReenviarAccesoModal";

const boton =
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors";
const botonNormal = `${boton} border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]`;
const botonDestacado = `${boton} border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/20`;

// El acceso del cliente al portal, a mano en la cabecera de la ficha: crear el
// usuario, reenviar el acceso, copiar el enlace y ver su pantalla. Son las
// mismas acciones del listado de Generadores; estaban solo ahí (y crear/reenviar
// también en el paso de la E1), y desde la ficha no se llegaba.
export function AccesoPortalAcciones({ ficha }: { ficha: ClienteFicha }) {
  const navigate = useNavigate();
  const canCreate = usePermission("EXPERIENCIA_CLIENTES", "CREATE");
  const activarPreview = usePortalPreviewStore((s) => s.activar);
  const [modal, setModal] = useState<"crear" | "reenviar" | null>(null);
  const canEdit = usePermission("EXPERIENCIA_CLIENTES", "EDIT");

  async function copiarEnlace() {
    const url = `${window.location.origin}/portal`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace del portal copiado");
    } catch {
      window.prompt("Copiá el enlace:", url);
    }
  }

  return (
    <div aria-label="Acceso al portal del cliente" className="flex flex-wrap items-center justify-end gap-1">
      {ficha.hasPortalUser ? (
        <>
          <button
            type="button"
            className={botonNormal}
            title="Ver la pantalla como la ve el cliente (sólo lectura)"
            onClick={() => {
              activarPreview({ projectId: ficha.projectId, clientName: ficha.nombre });
              navigate(`/portal/${ficha.projectId}`);
            }}
          >
            <Eye className="h-3.5 w-3.5 shrink-0" /> Ver como el cliente
          </button>
          {canCreate && (
            <button
              type="button"
              className={botonNormal}
              title="Reenviar el acceso: resetea la contraseña y arma el mensaje para copiar"
              onClick={() => setModal("reenviar")}
            >
              <Send className="h-3.5 w-3.5 shrink-0" /> Reenviar acceso
            </button>
          )}
        </>
      ) : canCreate ? (
        <button
          type="button"
          className={botonDestacado}
          title="El cliente todavía no tiene acceso al portal: crear el usuario"
          onClick={() => setModal("crear")}
        >
          <UserPlus className="h-3.5 w-3.5 shrink-0" /> Crear acceso al portal
        </button>
      ) : (
        <span className="text-[11px] text-[var(--color-text-muted)]">Sin acceso al portal</span>
      )}
      <button type="button" className={botonNormal} title="Copiar el enlace del portal de Voltia" onClick={copiarEnlace}>
        <Link2 className="h-3.5 w-3.5 shrink-0" /> Copiar enlace del portal
      </button>

      {modal === "crear" && <CrearUsuarioModal cliente={ficha} onClose={() => setModal(null)} />}
      {modal === "reenviar" && <ReenviarAccesoModal cliente={ficha} onClose={() => setModal(null)} />}
    </div>
  );
}

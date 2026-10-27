import { useState } from "react";
import { matchPath, useLocation, useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { useAuthStore } from "../../store/auth.store";
import type { ContextoAsistente } from "../../api/asistente.api";
import { AsistentePanel, type EntradaChat } from "./AsistentePanel";

/** Pantallas donde hay un proyecto abierto: el asistente lo toma como "este cliente". */
const RUTAS_PROYECTO = [
  "/projects/:projectId",
  "/clientes/:projectId",
  "/ingenieria/proyecto/:projectId",
  "/ingenieria/proyecto/:projectId/*",
  "/proyecto/:projectId/*",
];

function useContextoPantalla(): ContextoAsistente {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const leadId = pathname.startsWith("/ventas") ? params.get("lead") : null;
  for (const ruta of RUTAS_PROYECTO) {
    const m = matchPath(ruta, pathname);
    if (m?.params.projectId) return { leadId, projectId: m.params.projectId };
  }
  return { leadId, projectId: null };
}

/**
 * Botón flotante del asistente del equipo. Va por encima de los modales
 * (z-50: el panel del lead es uno) para que se pueda abrir con un lead abierto,
 * que es justo cuando más sirve; debajo del popup de traspasos (z-60), que es
 * obligatorio. Lo ven todos los usuarios internos.
 * La conversación vive acá (no en el panel) para que cerrar y volver a abrir
 * el panel no la borre.
 */
export function AsistenteBoton() {
  const { user } = useAuthStore();
  const [abierto, setAbierto] = useState(false);
  const [entradas, setEntradas] = useState<EntradaChat[]>([]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const contexto = useContextoPantalla();

  if (!user || user.role === "CLIENT") return null;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        aria-label="Abrir el asistente"
        title="Asistente Voltia"
        className="fixed bottom-20 right-6 z-[55] flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition-colors hover:bg-violet-700 md:bottom-6"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      {abierto && (
        <AsistentePanel
          entradas={entradas}
          setEntradas={setEntradas}
          conversacionId={conversacionId}
          setConversacionId={setConversacionId}
          contexto={contexto}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  );
}

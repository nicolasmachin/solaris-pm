import { useCallback, useEffect, useRef } from "react";

import { useBunnyPlayer } from "./useBunnyPlayer";

// Cada cuánto se manda la posición del video mientras se mira. Suficiente para
// no perder el punto y sin llenar la red de pedidos.
const GUARDADO_CADA_MS = 15_000;

type Opciones = {
  videoId: string | undefined;
  /** Manda el progreso al backend (el de Capacitación o el del portal). */
  enviar: (body: { videoId: string; segundos: number; completado?: boolean }) => void;
  /** Al terminar el video, ya guardado como visto. */
  onFin?: (videoId: string) => void;
};

/**
 * Guarda el avance del video que se está reproduciendo: cada 15 s mientras
 * avanza, al terminar (como visto) y al salir de la pantalla. Lo usan el
 * reproductor de Capacitación y el de "Videos" del portal.
 *
 * Devuelve `guardar(completado?)` para el botón "Marcar como visto".
 */
export function useProgresoVideo(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  { videoId, enviar, onFin }: Opciones,
) {
  // Posición del video vivo fuera de React: el evento llega ~4 veces por
  // segundo y no tiene que repintar nada.
  const posicion = useRef(0);
  const ultimoGuardado = useRef(0);
  // Última posición efectivamente guardada: si el video está pausado no se
  // vuelve a mandar nada. Sin esto, abrir un video y no mirarlo dejaba a la
  // persona registrada con 0 segundos en el seguimiento.
  const posicionGuardada = useRef(-1);
  const videoIdRef = useRef<string | undefined>(videoId);
  videoIdRef.current = videoId;
  const enviarRef = useRef(enviar);
  enviarRef.current = enviar;

  const guardar = useCallback((completado?: boolean) => {
    const id = videoIdRef.current;
    if (!id) return;
    const segundos = Math.floor(posicion.current);
    // Sin avance real y sin marcar a mano, no hay nada que guardar.
    if (completado === undefined && segundos <= posicionGuardada.current) return;
    enviarRef.current({ videoId: id, segundos, completado });
    posicionGuardada.current = segundos;
    ultimoGuardado.current = Date.now();
  }, []);

  useBunnyPlayer(iframeRef, {
    videoKey: videoId,
    onTiempo: (segundos) => {
      posicion.current = segundos;
      if (Date.now() - ultimoGuardado.current >= GUARDADO_CADA_MS) guardar();
    },
    onFin: () => {
      guardar(true);
      if (videoIdRef.current) onFin?.(videoIdRef.current);
    },
  });

  // Al cambiar de video, arrancar la cuenta de cero.
  useEffect(() => {
    posicion.current = 0;
    posicionGuardada.current = 0;
    ultimoGuardado.current = Date.now();
  }, [videoId]);

  // Al salir de la pantalla (o cerrar la pestaña), guardar lo último visto.
  useEffect(() => {
    function alSalir() {
      if (posicion.current > 0) guardar();
    }
    window.addEventListener("pagehide", alSalir);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      alSalir();
    };
  }, [guardar]);

  return { guardar };
}

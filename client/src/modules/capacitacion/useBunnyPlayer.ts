import { useEffect, useRef } from "react";

// El reproductor de Bunny habla el protocolo player.js por postMessage. Con eso
// se sabe por dónde va el video y cuándo termina, sin cargar ninguna librería.
//
// Si Bunny dejara de emitir estos eventos, el módulo sigue andando: el progreso
// no se guarda solo, pero el botón "Marcar como visto" siempre está.

const BUNNY_ORIGIN = "https://iframe.mediadelivery.net";
const CONTEXT = "player.js";
const VERSION = "0.0.4";

type Opciones = {
  onTiempo?: (segundos: number, duracion: number) => void;
  onFin?: () => void;
};

export function useBunnyPlayer(
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  { onTiempo, onFin }: Opciones,
) {
  // Refs para no re-suscribirse cada vez que el componente rerenderiza.
  const onTiempoRef = useRef(onTiempo);
  const onFinRef = useRef(onFin);
  onTiempoRef.current = onTiempo;
  onFinRef.current = onFin;

  useEffect(() => {
    function suscribir() {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      for (const evento of ["ready", "timeupdate", "ended"]) {
        win.postMessage(
          JSON.stringify({ context: CONTEXT, version: VERSION, method: "addEventListener", value: evento }),
          BUNNY_ORIGIN,
        );
      }
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== BUNNY_ORIGIN) return;
      let data: { context?: string; event?: string; value?: { seconds?: number; duration?: number } };
      try {
        data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (data?.context !== CONTEXT) return;
      if (data.event === "ready") {
        // El iframe avisa que quedó listo: recién ahí registra los listeners.
        suscribir();
        return;
      }
      if (data.event === "timeupdate" && typeof data.value?.seconds === "number") {
        onTiempoRef.current?.(data.value.seconds, data.value.duration ?? 0);
        return;
      }
      if (data.event === "ended") onFinRef.current?.();
    }

    window.addEventListener("message", onMessage);
    // Además del "ready", se intenta suscribir al toque: si el iframe ya estaba
    // cargado (cambio de video sin recargar) ese evento no vuelve a llegar.
    const t = window.setTimeout(suscribir, 800);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(t);
    };
  }, [iframeRef]);
}

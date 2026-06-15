import { useEffect } from "react";

// Bloquea el scroll del body mientras `locked` es true y lo restaura al soltar.
// Usa position:fixed + top negativo (no solo overflow:hidden) porque en iOS
// Safari overflow:hidden NO bloquea el scroll; y restaura la posición exacta al
// cerrar (sin el "salto al tope" típico de iOS).
export function useLockBodyScroll(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    const { body } = document;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      // Restaurar la posición de scroll original (clave en iOS).
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}

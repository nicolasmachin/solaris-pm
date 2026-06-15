import { useEffect, useState } from "react";

// Móvil = ancho < 768px (pivote `md` de Tailwind, ya usado en todo el repo).
const QUERY = "(max-width: 767px)";

// Hook para la lógica que depende del viewport (no para presentación pura: eso
// va con clases `md:`). SSR-safe via guard de `typeof window`.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    // Sincroniza por si cambió entre el render inicial y el efecto.
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

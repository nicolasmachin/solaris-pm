import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";

// Recuadro para firmar con el dedo, el lápiz o el mouse. Trazo negro sobre
// fondo blanco (así sale igual en la constancia, con tema claro u oscuro).
// `touch-action: none` evita que el dedo desplace la página mientras firma.
// Se dibuja al tamaño real de la pantalla × devicePixelRatio para que no salga
// borrosa en celulares.

export type FirmaPadHandle = {
  /** PNG en base64 (data URL), o null si todavía no hay firma suficiente. */
  exportar: () => string | null;
  borrar: () => void;
};

// Menos que esto es un toque o un punto, no una firma.
const LARGO_MINIMO_PX = 60;

export const FirmaPad = forwardRef<FirmaPadHandle, { onCambio?: (hayFirma: boolean) => void; alto?: number }>(
  function FirmaPad({ onCambio, alto = 180 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dibujando = useRef(false);
    const ultimo = useRef<{ x: number; y: number } | null>(null);
    const largo = useRef(0);
    const [hayFirma, setHayFirma] = useState(false);
    const [tocado, setTocado] = useState(false);

    const preparar = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const { width } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(alto * dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, alto);
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      largo.current = 0;
      setHayFirma(false);
      setTocado(false);
    }, [alto]);

    // Se prepara al montar y cada vez que cambia el ancho (el modal termina de
    // abrirse, se gira el celular) mientras no haya nada dibujado.
    useEffect(() => {
      preparar();
      const canvas = canvasRef.current;
      if (!canvas || typeof ResizeObserver === "undefined") return;
      let ancho = canvas.getBoundingClientRect().width;
      const ro = new ResizeObserver(() => {
        const nuevo = canvas.getBoundingClientRect().width;
        if (Math.abs(nuevo - ancho) > 1 && largo.current === 0) preparar();
        ancho = nuevo;
      });
      ro.observe(canvas);
      return () => ro.disconnect();
    }, [preparar]);

    useEffect(() => onCambio?.(hayFirma), [hayFirma, onCambio]);

    function punto(e: React.PointerEvent<HTMLCanvasElement>) {
      const r = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      dibujando.current = true;
      ultimo.current = punto(e);
      setTocado(true);
    }

    function mover(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!dibujando.current || !ultimo.current) return;
      e.preventDefault();
      const p = punto(e);
      const ctx = e.currentTarget.getContext("2d")!;
      ctx.beginPath();
      ctx.moveTo(ultimo.current.x, ultimo.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      largo.current += Math.hypot(p.x - ultimo.current.x, p.y - ultimo.current.y);
      ultimo.current = p;
      if (!hayFirma && largo.current >= LARGO_MINIMO_PX) setHayFirma(true);
    }

    function terminar() {
      dibujando.current = false;
      ultimo.current = null;
    }

    useImperativeHandle(ref, () => ({
      exportar: () => (largo.current >= LARGO_MINIMO_PX ? canvasRef.current?.toDataURL("image/png") ?? null : null),
      borrar: preparar,
    }));

    return (
      <div>
        <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-white">
          <canvas
            ref={canvasRef}
            style={{ height: alto, touchAction: "none" }}
            className="block w-full cursor-crosshair"
            onPointerDown={empezar}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
            onPointerLeave={terminar}
          />
          {!tocado && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
              Firmá acá con el dedo
            </span>
          )}
          <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-dashed border-gray-300" />
        </div>
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={preparar}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <Eraser size={12} /> Borrar
          </button>
        </div>
      </div>
    );
  },
);

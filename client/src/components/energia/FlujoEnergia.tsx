import { useQuery } from "@tanstack/react-query";
import { Home, Sun, UtilityPole, Zap } from "lucide-react";

import type { FuentesEnergia, PuntoCurva } from "../../api/energiaFv.api";

// Flujo de energía "ahora", como la pantalla principal de la aplicación de
// Growatt: cuánto sale de los paneles, cuánto consume la casa y cuánto entra o
// sale de la red de UTE, con flechas animadas en el sentido del flujo.
//
// El dato es el último tramo de 5 minutos de la curva del día (la misma
// consulta que usa la pestaña Hora, así no se pide dos veces a Growatt). No es
// un dato en vivo: se aclara la hora del tramo, y si es viejo se dice.

/** Debajo de esto la línea se muestra quieta: es ruido de medición. */
const UMBRAL_W = 30;
/** Más viejo que esto, el dato ya no es "ahora". */
const VIEJO_MIN = 20;

const ESTILO = `
@keyframes flujo-energia { to { stroke-dashoffset: -24; } }
.flujo-linea { stroke-dasharray: 6 6; animation: flujo-energia linear infinite; }
@media (prefers-reduced-motion: reduce) { .flujo-linea { animation: none; } }
`;

function hoyUy(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
function minutosAhoraUy(): number {
  const d = new Date(Date.now() - 3 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const kw = (w: number) =>
  `${(w / 1000).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;
const kwh = (n: number | null) =>
  n == null ? "—" : `${n.toLocaleString("es-UY", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`;

/** Más potencia, flecha más rápida (entre 0,6 y 2,4 segundos por vuelta). */
function duracion(w: number) {
  return `${Math.max(0.6, 2.4 - (w / 1000) * 0.35).toFixed(2)}s`;
}

function Linea({ d, w, color, invertida = false }: { d: string; w: number; color: string; invertida?: boolean }) {
  const activa = w >= UMBRAL_W;
  return (
    <>
      <path d={d} stroke="var(--color-border)" strokeWidth={4} strokeLinecap="round" fill="none" />
      {activa && (
        <path
          d={d}
          className="flujo-linea"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
          style={{ animationDuration: duracion(w), animationDirection: invertida ? "reverse" : "normal" }}
        />
      )}
    </>
  );
}

function Nodo({
  x,
  y,
  color,
  activo,
  children,
}: {
  x: number;
  y: number;
  color: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={28}
        fill="var(--color-bg-app)"
        stroke={activo ? color : "var(--color-border)"}
        strokeWidth={2.5}
      />
      <g color={activo ? color : "var(--color-text-muted)"}>{children}</g>
    </g>
  );
}

export function FlujoEnergia({ fuentes, claveCache }: { fuentes: FuentesEnergia; claveCache: string }) {
  const hoy = hoyUy();
  const { data: curva } = useQuery({
    queryKey: ["energia", claveCache, "curva", hoy],
    queryFn: () => fuentes.curva(hoy),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  if (!curva || !curva.disponible || curva.puntos.length === 0) return null;

  const p: PuntoCurva = curva.puntos[curva.puntos.length - 1];
  const conMedicion = curva.origenMedicion !== null;
  const atraso = minutosAhoraUy() - (minutos(p.h) + 5);
  const viejo = atraso > VIEJO_MIN;

  const gen = p.gen ?? 0;
  const consumo = conMedicion ? p.consumo ?? 0 : null;
  const aRed = conMedicion ? p.aRed ?? 0 : 0;
  const deRed = conMedicion ? p.deRed ?? 0 : 0;
  const vende = aRed >= UMBRAL_W && aRed >= deRed;
  const compra = !vende && deRed >= UMBRAL_W;
  const red = vende ? aRed : compra ? deRed : 0;

  // Lienzo de 360 × 230: paneles arriba, inversor al centro, UTE a la izquierda
  // y la casa a la derecha.
  const C = { x: 180, y: 135 };
  return (
    <div className="border-b border-[var(--color-border)] px-4 pb-3 pt-3 lg:flex lg:w-[38%] lg:shrink-0 lg:flex-col lg:justify-center lg:border-b-0 lg:border-r">
      <style>{ESTILO}</style>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
        <span className="font-mono uppercase tracking-wider">{viejo ? "Último dato" : "Ahora"}</span>
        <span>
          {viejo ? `de las ${p.h} · el inversor no mandó datos después` : `a las ${p.h}`}
        </span>
      </div>

      <svg viewBox="0 0 360 230" className="mx-auto block w-full max-w-[400px]" role="img" aria-label="Flujo de energía de la planta">
        <title>
          {`Paneles ${kw(gen)}` +
            (consumo != null ? `, casa ${kw(consumo)}` : "") +
            (vende ? `, vendiendo a UTE ${kw(red)}` : compra ? `, comprando a UTE ${kw(red)}` : "")}
        </title>

        {/* Líneas: paneles → inversor, inversor → casa, inversor ↔ UTE */}
        <Linea d={`M ${C.x} 78 L ${C.x} ${C.y - 16}`} w={gen} color="var(--en-gen)" />
        <Linea d={`M ${C.x + 16} ${C.y} L 274 ${C.y}`} w={consumo ?? 0} color="var(--en-cons)" />
        <Linea
          d={`M ${C.x - 16} ${C.y} L 86 ${C.y}`}
          w={red}
          color={vende ? "var(--en-exp)" : "var(--en-imp)"}
          invertida={compra}
        />

        {/* Inversor */}
        <circle cx={C.x} cy={C.y} r={16} fill="var(--color-bg-card)" stroke="var(--color-border)" strokeWidth={2} />
        <Zap x={C.x - 9} y={C.y - 9} width={18} height={18} color="var(--color-text-muted)" />

        {/* Paneles */}
        <Nodo x={C.x} y={50} color="var(--en-gen)" activo={gen >= UMBRAL_W}>
          <Sun x={C.x - 13} y={37} width={26} height={26} />
        </Nodo>
        <text x={C.x + 40} y={44} fontSize={11} fill="var(--color-text-muted)">
          Paneles solares
        </text>
        <text x={C.x + 40} y={62} fontSize={16} fontWeight={700} fill="var(--color-text-primary)">
          {kw(gen)}
        </text>

        {/* UTE */}
        <Nodo x={58} y={C.y} color={vende ? "var(--en-exp)" : "var(--en-imp)"} activo={vende || compra}>
          <UtilityPole x={45} y={C.y - 13} width={26} height={26} />
        </Nodo>
        <text x={58} y={C.y + 48} fontSize={11} textAnchor="middle" fill="var(--color-text-muted)">
          {!conMedicion ? "Red de UTE" : vende ? "Vendiendo a UTE" : compra ? "Comprando a UTE" : "Red de UTE"}
        </text>
        <text x={58} y={C.y + 66} fontSize={16} fontWeight={700} textAnchor="middle" fill="var(--color-text-primary)">
          {conMedicion ? kw(red) : "—"}
        </text>

        {/* Casa */}
        <Nodo x={302} y={C.y} color="var(--en-cons)" activo={(consumo ?? 0) >= UMBRAL_W}>
          <Home x={289} y={C.y - 13} width={26} height={26} />
        </Nodo>
        <text x={302} y={C.y + 48} fontSize={11} textAnchor="middle" fill="var(--color-text-muted)">
          Consumo
        </text>
        <text x={302} y={C.y + 66} fontSize={16} fontWeight={700} textAnchor="middle" fill="var(--color-text-primary)">
          {consumo != null ? kw(consumo) : "—"}
        </text>
      </svg>

      <p className="mt-1 text-center text-[11px] text-[var(--color-text-muted)]">
        Hoy: {kwh(curva.resumen.generacionKwh)} producidos
        {conMedicion && curva.resumen.consumoKwh != null && ` · ${kwh(curva.resumen.consumoKwh)} consumidos`}
      </p>
      {!conMedicion && (
        <p className="mt-1 text-center text-[11px] text-[var(--color-text-muted)]">
          Esta planta no mide el consumo: solo se ve lo que producen los paneles.
        </p>
      )}
    </div>
  );
}

import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { X, Triangle, Download, Copy, Save } from 'lucide-react';
import { saveTriangleCalculation } from '../../api/triangle.api';

type Mode = 'L-angle' | 'L-height' | 'height-angle';
type Unit = 'mm' | 'cm' | 'm';

interface ComputedTriangle {
  L: number;
  height: number;
  angle: number;
  backLeg: number;
  totalMaterial: number;
}

const MODE_LABEL: Record<Mode, string> = {
  'L-angle': 'Lado L + ángulo',
  'L-height': 'Lado L + altura',
  'height-angle': 'Altura + ángulo',
};

const UNIT_LABEL: Record<Unit, string> = {
  mm: 'Milímetros (mm)',
  cm: 'Centímetros (cm)',
  m: 'Metros (m)',
};

function compute(mode: Mode, values: { L?: number; height?: number; angle?: number }): ComputedTriangle | null {
  let L: number;
  let height: number;
  let angle: number;

  if (mode === 'L-angle') {
    if (!values.L || !values.angle) return null;
    L = values.L;
    angle = values.angle;
    if (angle <= 0 || angle >= 180) return null;
    height = L * Math.sin((angle * Math.PI) / 180);
  } else if (mode === 'L-height') {
    if (!values.L || !values.height) return null;
    L = values.L;
    height = values.height;
    if (height <= 0 || height >= L) return null;
    angle = (Math.asin(height / L) * 180) / Math.PI;
  } else {
    if (!values.height || !values.angle) return null;
    angle = values.angle;
    height = values.height;
    if (angle <= 0 || angle >= 180) return null;
    L = height / Math.sin((angle * Math.PI) / 180);
  }

  const backLeg = 2 * L * Math.sin(((angle / 2) * Math.PI) / 180);
  const totalMaterial = L * 2 + backLeg;
  return { L, height, angle, backLeg, totalMaterial };
}

function formatNumber(n: number, decimals: number = 2): string {
  return n.toLocaleString('es-UY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// SVG renderizado a escala. Devuelve el JSX y el string serializado.
function TriangleSvg({ result, unit, svgRef }: { result: ComputedTriangle; unit: Unit; svgRef: React.RefObject<SVGSVGElement | null> }) {
  // Padding asimétrico: más espacio a la derecha para el label del lado posterior,
  // más espacio abajo para la cota de la base.
  const PAD_L = 80;
  const PAD_R = 160;
  const PAD_T = 80;
  const PAD_B = 110;
  const VIEW_W = 820;
  const VIEW_H = 500;

  const angleRad = (result.angle * Math.PI) / 180;
  const triW = result.L; // base
  const triH = result.height;
  const Cx = result.L * Math.cos(angleRad);

  // Escala que entra en el viewBox dejando padding
  const usableW = VIEW_W - PAD_L - PAD_R;
  const usableH = VIEW_H - PAD_T - PAD_B;
  const scale = Math.min(usableW / triW, usableH / triH);

  // Vértices (origen abajo-izquierda invertido en Y)
  const aX = PAD_L;
  const aY = VIEW_H - PAD_B;
  const bX = PAD_L + triW * scale;
  const bY = aY;
  const cX = PAD_L + Cx * scale;
  const cY = aY - triH * scale;

  const polygonPoints = `${aX},${aY} ${bX},${bY} ${cX},${cY}`;

  // Arco del ángulo en A
  const arcR = 36;
  const arcEndX = aX + arcR * Math.cos(angleRad);
  const arcEndY = aY - arcR * Math.sin(angleRad);

  // Etiqueta del lado posterior BC: perpendicular a BC, hacia el lado opuesto a A.
  // Offset generoso + textAnchor="start" para que el label nazca afuera de BC y
  // crezca hacia la derecha sin cruzar la línea.
  const midBCX = (bX + cX) / 2;
  const midBCY = (bY + cY) / 2;
  const bcdx = cX - bX;
  const bcdy = cY - bY;
  const bcLen = Math.sqrt(bcdx * bcdx + bcdy * bcdy) || 1;
  let nbX = bcdy / bcLen;
  let nbY = -bcdx / bcLen;
  if (nbX * (aX - midBCX) + nbY * (aY - midBCY) > 0) {
    nbX = -nbX;
    nbY = -nbY;
  }
  // Si la perpendicular apunta hacia la izquierda (caso obtuso/raro), forzamos
  // que el label vaya a la derecha ajustando dirección y anchor.
  const labelGoesRight = nbX >= 0;
  const blOffset = 18;
  const blLabelX = midBCX + nbX * blOffset;
  const blLabelY = midBCY + nbY * blOffset + 4; // baseline shift

  // Etiqueta del lado AC (inclinado): perpendicular a AC, hacia el lado opuesto a B
  const midACX = (aX + cX) / 2;
  const midACY = (aY + cY) / 2;
  const acdx = cX - aX;
  const acdy = cY - aY;
  const acLen = Math.sqrt(acdx * acdx + acdy * acdy) || 1;
  let nLX = acdy / acLen;
  let nLY = -acdx / acLen;
  if (nLX * (bX - midACX) + nLY * (bY - midACY) > 0) {
    nLX = -nLX;
    nLY = -nLY;
  }
  const lOffset = 24;
  const lLabelX = midACX + nLX * lOffset;
  const lLabelY = midACY + nLY * lOffset;

  // Etiqueta de altura: posicionada al costado de la línea punteada, en el medio
  // del lado opuesto a B respecto del eje vertical x = cX (para no chocar con BC)
  const heightLabelOnLeft = cX > (aX + bX) / 2; // si C está a la derecha del centro, el label va a la izquierda de la dotted
  const heightLabelX = heightLabelOnLeft ? cX - 8 : cX + 8;
  const heightLabelAnchor = heightLabelOnLeft ? "end" : "start";
  const heightLabelY = (cY + aY) / 2 + 4;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      overflow="visible"
      className="w-full h-full bg-white rounded-md"
      style={{ maxHeight: 500 }}
    >
      <defs>
        <marker id="arrowL" markerWidth={7} markerHeight={7} refX={5} refY={3.5} orient="auto">
          <path d="M5,0 L0,3.5 L5,7 Z" fill="#1e3a8a" />
        </marker>
        <marker id="arrowR" markerWidth={7} markerHeight={7} refX={1} refY={3.5} orient="auto">
          <path d="M0,0 L5,3.5 L0,7 Z" fill="#1e3a8a" />
        </marker>
      </defs>

      {/* Triángulo */}
      <polygon
        points={polygonPoints}
        fill="rgba(59, 130, 246, 0.08)"
        stroke="#1e3a8a"
        strokeWidth={2}
      />

      {/* Línea punteada de altura */}
      <line x1={cX} y1={cY} x2={cX} y2={aY} stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 3" />

      {/* Cota inferior (base) */}
      <line x1={aX} y1={aY + 24} x2={bX} y2={aY + 24} stroke="#1e3a8a" strokeWidth={1} markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
      <text x={(aX + bX) / 2} y={aY + 44} textAnchor="middle" fontSize={13} fontFamily="system-ui, sans-serif" fill="#1e3a8a" fontWeight={500}>
        Base L = {formatNumber(result.L)} {unit}
      </text>

      {/* Etiqueta altura (al costado de la línea punteada) */}
      <text x={heightLabelX} y={heightLabelY} textAnchor={heightLabelAnchor} fontSize={13} fontFamily="system-ui, sans-serif" fill="#dc2626" fontWeight={500}>
        h = {formatNumber(result.height)} {unit}
      </text>

      {/* Etiqueta lado inclinado AC = L */}
      <text x={lLabelX} y={lLabelY} textAnchor="middle" fontSize={13} fontFamily="system-ui, sans-serif" fill="#1e3a8a" fontWeight={500}>
        L = {formatNumber(result.L)} {unit}
      </text>

      {/* Etiqueta lado posterior BC (afuera del triángulo) */}
      <text x={blLabelX} y={blLabelY} textAnchor={labelGoesRight ? 'start' : 'end'} fontSize={13} fontFamily="system-ui, sans-serif" fill="#dc2626" fontWeight={500}>
        {formatNumber(result.backLeg)} {unit}
      </text>

      {/* Arco del ángulo en A */}
      <path
        d={`M ${aX + arcR},${aY} A ${arcR},${arcR} 0 0 0 ${arcEndX},${arcEndY}`}
        fill="none"
        stroke="#dc2626"
        strokeWidth={1.5}
      />
      <text x={aX + arcR + 10} y={aY - 10} fontSize={12} fontFamily="system-ui, sans-serif" fill="#dc2626" fontWeight={500}>
        θ = {formatNumber(result.angle, 1)}°
      </text>

      {/* Vértices */}
      <circle cx={aX} cy={aY} r={4} fill="#1e3a8a" />
      <circle cx={bX} cy={bY} r={4} fill="#1e3a8a" />
      <circle cx={cX} cy={cY} r={4} fill="#1e3a8a" />
    </svg>
  );
}

// Convierte un SVGSVGElement a JPG dataURL usando canvas.
async function svgToJpg(svg: SVGSVGElement, width: number = 1230, height: number = 750): Promise<string> {
  const xml = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo crear contexto canvas'));
        return;
      }
      // fondo blanco para evitar transparencia en JPG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function svgToString(svg: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svg);
}

export function TriangleCalculatorModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('L-angle');
  const [unit, setUnit] = useState<Unit>('mm');
  const [valL, setValL] = useState<string>('1000');
  const [valH, setValH] = useState<string>('300');
  const [valA, setValA] = useState<string>('30');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const result = useMemo(() => {
    const values: { L?: number; height?: number; angle?: number } = {};
    if (mode !== 'height-angle') values.L = Number.parseFloat(valL);
    if (mode !== 'L-angle') values.height = Number.parseFloat(valH);
    if (mode !== 'L-height') values.angle = Number.parseFloat(valA);
    return compute(mode, values);
  }, [mode, valL, valH, valA]);

  function downloadSvg() {
    if (!svgRef.current) return;
    const xml = svgToString(svgRef.current);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `triangulo-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyMeasurements() {
    if (!result) return;
    const text = [
      `Triángulo isósceles (lado L = base = inclinado)`,
      `Lado L: ${formatNumber(result.L)} ${unit}`,
      `Altura: ${formatNumber(result.height)} ${unit}`,
      `Lado posterior: ${formatNumber(result.backLeg)} ${unit}`,
      `Ángulo: ${formatNumber(result.angle, 1)}°`,
      `Material total: ${formatNumber(result.totalMaterial)} ${unit}`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(
      () => toast.success('Medidas copiadas al portapapeles'),
      () => toast.error('No se pudo copiar al portapapeles'),
    );
  }

  async function handleSave() {
    if (savingRef.current) return; // anti doble-click sincrónico
    if (!result || !svgRef.current) {
      toast.error('Calculá primero el triángulo');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const svgString = svgToString(svgRef.current);
      const jpgBase64 = await svgToJpg(svgRef.current);
      await saveTriangleCalculation(projectId, {
        mode,
        unit,
        values: {
          ...(mode !== 'height-angle' ? { L: Number.parseFloat(valL) } : {}),
          ...(mode !== 'L-angle' ? { height: Number.parseFloat(valH) } : {}),
          ...(mode !== 'L-height' ? { angle: Number.parseFloat(valA) } : {}),
        },
        result,
        svgString,
        jpgBase64,
      });
      toast.success('Cálculo guardado en Documentos del proyecto');
      qc.invalidateQueries({ queryKey: ['project-documents', projectId] });
      qc.invalidateQueries({ queryKey: ['ingenieria-workspace', projectId] });
      onClose();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Error al guardar el cálculo');
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Triangle className="h-4 w-4 text-[var(--color-accent)]" />
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              Calculadora de triángulos de aluminio
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Info */}
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
            <strong>Triángulo isósceles:</strong> la base inferior y el lado superior inclinado tienen la misma longitud <code className="text-[var(--color-accent)]">L</code>. El lado vertical posterior es la pieza corta.
          </div>

          {/* Selectores */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                Modo de cálculo
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as Mode)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              >
                {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
                  <option key={m} value={m}>{MODE_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                Unidad
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              >
                {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                  <option key={u} value={u}>{UNIT_LABEL[u]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Inputs dinámicos */}
          <div className="grid grid-cols-2 gap-3">
            {mode !== 'height-angle' && (
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Lado L ({unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={valL}
                  onChange={(e) => setValL(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
            )}
            {mode !== 'L-angle' && (
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Altura ({unit})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={valH}
                  onChange={(e) => setValH(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
            )}
            {mode !== 'L-height' && (
              <div>
                <label className="mb-1 block text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
                  Ángulo (°)
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="180"
                  value={valA}
                  onChange={(e) => setValA(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Resultados */}
          {result ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Lado L (base e inclinado)</p>
                  <p className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">{formatNumber(result.L)} {unit}</p>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Altura vertical</p>
                  <p className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">{formatNumber(result.height)} {unit}</p>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Ángulo</p>
                  <p className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">{formatNumber(result.angle, 1)}°</p>
                </div>
              </div>

              {/* SVG */}
              <div className="rounded-md border border-[var(--color-border)] overflow-hidden">
                <TriangleSvg result={result} unit={unit} svgRef={svgRef} />
              </div>

              {/* Material total */}
              <div className="rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-4 py-3">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">Material total de aluminio</p>
                <p className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
                  {formatNumber(result.totalMaterial)} {unit}
                  <span className="ml-2 text-[11px] font-normal text-[var(--color-text-muted)]">
                    (L + L + posterior = {formatNumber(result.L)} + {formatNumber(result.L)} + {formatNumber(result.backLeg)})
                  </span>
                </p>
              </div>
            </>
          ) : (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-600 dark:text-amber-400">
              Ingresá valores válidos para calcular el triángulo.
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={downloadSvg}
            disabled={!result}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Descargar SVG
          </button>
          <button
            type="button"
            onClick={copyMeasurements}
            disabled={!result}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)] disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar medidas
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!result || saving}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-bg-app)] hover:opacity-90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" /> {saving ? 'Guardando…' : 'Guardar en el proyecto'}
          </button>
        </div>
      </div>
    </div>
  );
}

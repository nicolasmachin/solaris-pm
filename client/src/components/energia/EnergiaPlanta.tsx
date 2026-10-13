import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight, RefreshCw, Sun, Table2 } from "lucide-react";

import type { BarraEnergia, CurvaDia, FuentesEnergia, PuntoCurva, ResumenEnergia } from "../../api/energiaFv.api";
import { Spinner } from "../ui/Spinner";

// Vista de energía de una planta, como la de la aplicación de Growatt: Hora
// (curva del día), Día (barras del mes), Mes (barras del año) y Año. Una sola
// pieza para la ficha del cliente y, más adelante, el portal de Voltia: cambia
// solo de dónde saca los datos (`fuentes`).
//
// Colores: producción ámbar y consumo azul, como en el portal; exportado verde
// agua e importado naranja. Validados con el chequeo de daltonismo y contraste
// (paleta de referencia, pasos claros y oscuros sobre el fondo de Voltia PM).
// Nunca van solos: hay leyenda, tooltip con nombres y la vista de tabla.

type Pestania = "hora" | "dia" | "mes" | "anio";
type Serie = "gen" | "consumo" | "aRed" | "deRed";

const SERIES: Record<Serie, { nombre: string; color: string }> = {
  gen: { nombre: "Producción solar", color: "var(--en-gen)" },
  consumo: { nombre: "Consumo", color: "var(--en-cons)" },
  aRed: { nombre: "Exportado a la red", color: "var(--en-exp)" },
  deRed: { nombre: "Importado de la red", color: "var(--en-imp)" },
};

const ESTILO = `
.energia-viz { --en-gen:#c98500; --en-cons:#3987e5; --en-exp:#199e70; --en-imp:#d95926; }
:root.light .energia-viz { --en-gen:#eda100; --en-cons:#2a78d6; --en-exp:#1baf7a; --en-imp:#eb6834; }
`;

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const kwh = (n: number | null | undefined, dec = 1) =>
  n == null ? "—" : `${n.toLocaleString("es-UY", { minimumFractionDigits: dec, maximumFractionDigits: dec })} kWh`;
const kw = (w: number | null | undefined) =>
  w == null ? "—" : `${(w / 1000).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;

/** Hoy en Uruguay, "YYYY-MM-DD". */
function hoyUy(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
function sumarDias(d: string, n: number) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function sumarMeses(periodo: string, n: number) {
  const [a, m] = periodo.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}
function fechaLarga(d: string) {
  const [a, m, dd] = d.split("-").map(Number);
  return `${dd} de ${MESES[m - 1]} de ${a}`;
}
function haceCuanto(iso: string | null) {
  if (!iso) return null;
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : null;
}
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function EnergiaPlanta({
  fuentes,
  claveCache,
  puedeActualizar = true,
}: {
  fuentes: FuentesEnergia;
  claveCache: string;
  /** El botón "Actualizar" pide a Growatt al momento: en el portal no va. */
  puedeActualizar?: boolean;
}) {
  const hoy = hoyUy();
  const [pestania, setPestania] = useState<Pestania>("hora");
  const [dia, setDia] = useState(hoy);
  const [periodo, setPeriodo] = useState(hoy.slice(0, 7));
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [ocultas, setOcultas] = useState<Set<Serie>>(new Set());
  const [verTabla, setVerTabla] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const qc = useQueryClient();

  const curvaQ = useQuery({
    queryKey: ["energia", claveCache, "curva", dia],
    queryFn: () => fuentes.curva(dia),
    enabled: pestania === "hora",
    staleTime: dia === hoy ? 5 * 60_000 : Infinity,
    retry: 1,
  });
  const diasQ = useQuery({
    queryKey: ["energia", claveCache, "dias", periodo],
    queryFn: () => fuentes.dias(periodo),
    enabled: pestania === "dia",
  });
  const mesesQ = useQuery({
    queryKey: ["energia", claveCache, "meses", anio],
    queryFn: () => fuentes.meses(anio),
    enabled: pestania === "mes",
  });
  const aniosQ = useQuery({
    queryKey: ["energia", claveCache, "anios"],
    queryFn: () => fuentes.anios(),
    enabled: pestania === "anio",
  });

  async function actualizarHoy() {
    setRefrescando(true);
    try {
      const fresca = await fuentes.curva(dia, true);
      qc.setQueryData(["energia", claveCache, "curva", dia], fresca);
    } catch {
      toast.error("Growatt no respondió. Probá de nuevo en un minuto.");
    } finally {
      setRefrescando(false);
    }
  }

  // En una planta Huawei la pestaña Hora todavía no tiene datos: se abre en Día
  // (una sola vez, si nadie eligió otra pestaña).
  const yaEligio = useRef(false);
  useEffect(() => {
    if (!yaEligio.current && curvaQ.data?.marca === "HUAWEI" && !curvaQ.data.disponible) {
      yaEligio.current = true;
      setPestania("dia");
    }
  }, [curvaQ.data]);

  const activa = { hora: curvaQ, dia: diasQ, mes: mesesQ, anio: aniosQ }[pestania];
  const resumen: ResumenEnergia | null =
    pestania === "hora" ? curvaQ.data?.resumen ?? null : (activa.data as { resumen?: ResumenEnergia } | undefined)?.resumen ?? null;

  function toggle(s: Serie) {
    setOcultas((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  }

  // Navegación: ‹ etiqueta ›
  const nav = {
    hora: {
      etiqueta: dia === hoy ? `Hoy · ${fechaLarga(dia)}` : fechaLarga(dia),
      prev: () => setDia(sumarDias(dia, -1)),
      next: dia < hoy ? () => setDia(sumarDias(dia, 1)) : null,
    },
    dia: {
      etiqueta: `${MESES[Number(periodo.slice(5, 7)) - 1]} de ${periodo.slice(0, 4)}`,
      prev: () => setPeriodo(sumarMeses(periodo, -1)),
      next: periodo < hoy.slice(0, 7) ? () => setPeriodo(sumarMeses(periodo, 1)) : null,
    },
    mes: {
      etiqueta: String(anio),
      prev: () => setAnio(anio - 1),
      next: anio < Number(hoy.slice(0, 4)) ? () => setAnio(anio + 1) : null,
    },
    anio: { etiqueta: "Todos los años", prev: null, next: null },
  }[pestania];

  // Series que aplican a cada pestaña (el importado no va en las barras, como
  // en la aplicación de Growatt; sí está en el resumen y en la tabla).
  const seriesPestania: Serie[] = pestania === "hora" ? ["gen", "consumo", "aRed", "deRed"] : ["gen", "consumo", "aRed"];

  const curva = curvaQ.data;
  const sinCurva = pestania === "hora" && curva && !curva.disponible;
  const cobertura = resumen?.cobertura;
  const sinConsumo =
    (pestania === "hora" && curva?.disponible && curva.puntos.length > 0 && curva.origenMedicion === null) ||
    (pestania !== "hora" && resumen?.generacionKwh != null && cobertura?.conConsumo === 0);
  const consumoParcial =
    pestania !== "hora" && cobertura && cobertura.conConsumo > 0 && cobertura.conConsumo < cobertura.conProduccion;

  return (
    <section className="energia-viz rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <style>{ESTILO}</style>

      {/* Encabezado: título, pestañas */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Generación y consumo</h3>
        </div>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-[var(--color-border)] text-[12px]" role="tablist">
          {(
            [
              ["hora", "Hora"],
              ["dia", "Día"],
              ["mes", "Mes"],
              ["anio", "Año"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={pestania === k}
              onClick={() => {
                yaEligio.current = true;
                setPestania(k);
              }}
              className={
                pestania === k
                  ? "bg-[var(--color-accent)] px-3.5 py-1.5 font-semibold text-gray-900"
                  : "px-3.5 py-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)]"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Navegador de fechas */}
      <div className="flex items-center justify-center gap-3 px-4 pt-3">
        <BotonNav onClick={nav.prev} etiqueta="Anterior">
          <ChevronLeft className="h-4 w-4" />
        </BotonNav>
        <span className="min-w-[200px] text-center text-[13px] font-medium text-[var(--color-text-primary)]">
          {nav.etiqueta.charAt(0).toUpperCase() + nav.etiqueta.slice(1)}
        </span>
        <BotonNav onClick={nav.next} etiqueta="Siguiente">
          <ChevronRight className="h-4 w-4" />
        </BotonNav>
      </div>
      <div className="flex min-h-[18px] items-center justify-center gap-2 px-4 pt-1 text-[11px] text-[var(--color-text-muted)]">
        {pestania === "hora" && curva?.disponible && dia === hoy && puedeActualizar && (
          <>
            <span>Datos de Growatt {haceCuanto(curva.actualizadoEn) ?? ""}</span>
            <button
              type="button"
              onClick={actualizarHoy}
              disabled={refrescando}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[var(--color-accent)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${refrescando ? "animate-spin" : ""}`} /> Actualizar
            </button>
          </>
        )}
        {pestania === "hora" && dia !== hoy && (
          <button type="button" onClick={() => setDia(hoy)} className="text-[var(--color-accent)] hover:underline">
            Ir a hoy
          </button>
        )}
      </div>

      {/* Gráfico */}
      <div className="px-2 pb-1 pt-2 sm:px-4">
        {activa.isLoading ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-[12px] text-[var(--color-text-muted)]">
            <Spinner size={20} />
            {pestania === "hora" ? "Pidiendo la curva del día a Growatt (unos segundos)…" : "Cargando…"}
          </div>
        ) : activa.isError ? (
          <Vacio texto="No se pudieron traer los datos. Growatt a veces limita las consultas: probá de nuevo en un minuto." />
        ) : sinCurva ? (
          <Vacio texto={curva?.motivo ?? "No hay curva para esta planta."} />
        ) : pestania === "hora" ? (
          curva && curva.puntos.length > 0 ? (
            <GraficoHora puntos={curva.puntos} ocultas={ocultas} conMedicion={curva.origenMedicion !== null} />
          ) : (
            <Vacio texto="Growatt no tiene datos de este día." />
          )
        ) : (
          <GraficoBarras
            pestania={pestania}
            barras={(activa.data as { barras?: BarraEnergia[] } | undefined)?.barras ?? []}
            periodo={periodo}
            anio={anio}
            diasDelMes={(diasQ.data as { diasDelMes?: number } | undefined)?.diasDelMes ?? 31}
            ocultas={ocultas}
          />
        )}
      </div>

      {/* Leyenda (también apaga y prende series) */}
      {!sinCurva && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 pb-2">
          {seriesPestania.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={!ocultas.has(s)}
              className={`inline-flex items-center gap-1.5 text-[12px] ${ocultas.has(s) ? "opacity-40" : ""} text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`}
              title={ocultas.has(s) ? "Mostrar" : "Ocultar"}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[s].color }} />
              {SERIES[s].nombre}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setVerTabla((v) => !v)}
            className="ml-2 inline-flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <Table2 className="h-3.5 w-3.5" /> {verTabla ? "Ocultar tabla" : "Ver tabla"}
          </button>
        </div>
      )}

      {sinConsumo && (
        <p className="px-4 pb-2 text-center text-[11px] text-[var(--color-text-muted)]">
          Esta planta no mide el consumo (no tiene medidor, o el medidor no le llega al inversor): se muestra solo la producción.
        </p>
      )}
      {consumoParcial && cobertura && (
        <p className="px-4 pb-2 text-center text-[11px] text-[var(--color-text-muted)]">
          El consumo está medido en {cobertura.conConsumo} de {cobertura.conProduccion} {pestania === "dia" ? "días" : "meses"}: los
          totales de consumo no se muestran para no darlos de menos.
        </p>
      )}
      {pestania === "hora" && curva?.origenMedicion === "MEDIDOR" && (
        <p className="px-4 pb-2 text-center text-[11px] text-[var(--color-text-muted)]">
          El consumo y lo exportado se calculan con el medidor de la planta: los totales son exactos, la curva es aproximada.
        </p>
      )}

      {verTabla && !sinCurva && (
        <TablaDatos pestania={pestania} curva={curva} barras={(activa.data as { barras?: BarraEnergia[] } | undefined)?.barras ?? []} />
      )}

      {/* Resumen, como el de la aplicación de Growatt */}
      {resumen && resumen.generacionKwh != null && !sinCurva && <ResumenBarras r={resumen} parcial={!!consumoParcial} />}
    </section>
  );
}

function BotonNav({ onClick, etiqueta, children }: { onClick: (() => void) | null; etiqueta: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick ?? undefined}
      disabled={!onClick}
      aria-label={etiqueta}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center px-6 text-center text-[12px] text-[var(--color-text-muted)]">{texto}</div>
  );
}

// ─── Hora ─────────────────────────────────────────────────────────────────────

/** Promedio móvil centrado de 3 tramos (15 min), solo para dibujar: el dato de
 *  5 minutos es muy picudo (sobre todo el que sale del medidor aparte) y la
 *  aplicación de Growatt también lo suaviza. El tooltip muestra el valor real. */
function suavizar(vals: (number | null)[]): (number | null)[] {
  return vals.map((v, i) => {
    if (v === null) return null;
    const ventana = [vals[i - 1], v, vals[i + 1]].filter((x): x is number => x !== null && x !== undefined);
    return ventana.reduce((a, b) => a + b, 0) / ventana.length;
  });
}

function GraficoHora({ puntos, ocultas, conMedicion }: { puntos: PuntoCurva[]; ocultas: Set<Serie>; conMedicion: boolean }) {
  const { datos, dominio, ticks } = useMemo(() => {
    const suaves = Object.fromEntries(
      (["gen", "consumo", "aRed", "deRed"] as const).map((k) => [k, suavizar(puntos.map((p) => p[k]))]),
    ) as Record<Serie, (number | null)[]>;
    const datos = puntos.map((p, i) => ({
      ...p,
      m: minutos(p.h),
      gen_s: suaves.gen[i],
      consumo_s: suaves.consumo[i],
      aRed_s: suaves.aRed[i],
      deRed_s: suaves.deRed[i],
    }));
    // Solo las horas con datos (una planta sin consumo medido no tiene nada de
    // noche), redondeadas a la hora, con un mínimo de 8 horas de ancho.
    let desde = Math.floor((datos[0]?.m ?? 360) / 60) * 60;
    let hasta = Math.min(1440, Math.ceil(((datos[datos.length - 1]?.m ?? 1080) + 5) / 60) * 60);
    if (hasta - desde < 480) {
      desde = Math.max(0, desde - 120);
      hasta = Math.min(1440, desde + 480);
    }
    const paso = hasta - desde > 720 ? 180 : 120;
    const ticks: number[] = [];
    for (let t = Math.ceil(desde / paso) * paso; t <= hasta; t += paso) ticks.push(t);
    return { datos, dominio: [desde, hasta] as [number, number], ticks };
  }, [puntos]);
  const ver = (s: Serie) => !ocultas.has(s) && (s === "gen" || conMedicion);
  return (
    <>
    <p className="pl-2 text-[11px] text-[var(--color-text-muted)]">kW</p>
    <ResponsiveContainer width="100%" height={270}>
      <ComposedChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="energiaGen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--en-gen)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--en-gen)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="m"
          type="number"
          domain={dominio}
          ticks={ticks}
          allowDataOverflow
          tickFormatter={(m: number) => hhmm(m === 1440 ? 1439 : m).replace("23:59", "24:00")}
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(w: number) => `${(w / 1000).toLocaleString("es-UY", { maximumFractionDigits: 1 })}`}
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<TooltipHora conMedicion={conMedicion} />} cursor={{ stroke: "var(--color-text-muted)", strokeDasharray: "3 3" }} />
        {ver("gen") && (
          <Area type="monotoneX" dataKey="gen_s" stroke="var(--en-gen)" strokeWidth={2} fill="url(#energiaGen)" isAnimationActive={false} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-bg-card)" }} connectNulls />
        )}
        {ver("aRed") && (
          <Line type="monotoneX" dataKey="aRed_s" stroke="var(--en-exp)" strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-bg-card)" }} isAnimationActive={false} connectNulls />
        )}
        {ver("deRed") && (
          <Line type="monotoneX" dataKey="deRed_s" stroke="var(--en-imp)" strokeWidth={1.5} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-bg-card)" }} isAnimationActive={false} connectNulls />
        )}
        {ver("consumo") && (
          <Line type="monotoneX" dataKey="consumo_s" stroke="var(--en-cons)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-bg-card)" }} isAnimationActive={false} connectNulls />
        )}
      </ComposedChart>
    </ResponsiveContainer>
    </>
  );
}

function TooltipHora({ active, payload, conMedicion }: { active?: boolean; payload?: { payload: PuntoCurva & { m: number } }[]; conMedicion: boolean }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const filas: [Serie, number | null][] = [
    ["gen", p.gen],
    ...(conMedicion
      ? ([
          ["aRed", p.aRed],
          ["deRed", p.deRed],
          ["consumo", p.consumo],
        ] as [Serie, number | null][])
      : []),
  ];
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[12px] shadow-xl">
      <p className="mb-1 font-semibold text-[var(--color-text-primary)]">{p.h}</p>
      {filas.map(([s, v]) => (
        <p key={s} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES[s].color }} />
          {SERIES[s].nombre}: <span className="ml-auto pl-3 font-semibold tabular-nums text-[var(--color-text-primary)]">{kw(v)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Día / Mes / Año ──────────────────────────────────────────────────────────

function GraficoBarras({
  pestania,
  barras,
  periodo,
  anio,
  diasDelMes,
  ocultas,
}: {
  pestania: "dia" | "mes" | "anio";
  barras: BarraEnergia[];
  periodo: string;
  anio: number;
  diasDelMes: number;
  ocultas: Set<Serie>;
}) {
  // Todas las posiciones del período, aunque no tengan dato: un día sin barra se
  // tiene que ver como hueco, no desaparecer.
  const datos = useMemo(() => {
    const porClave = new Map(barras.map((b) => [b.clave, b]));
    const claves =
      pestania === "dia"
        ? Array.from({ length: diasDelMes }, (_, i) => `${periodo}-${String(i + 1).padStart(2, "0")}`)
        : pestania === "mes"
          ? Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, "0")}`)
          : barras.map((b) => b.clave);
    return claves.map((k) => {
      const b = porClave.get(k);
      return {
        clave: k,
        etiqueta: pestania === "dia" ? String(Number(k.slice(8, 10))) : pestania === "mes" ? MESES_CORTOS[Number(k.slice(5, 7)) - 1] : k,
        gen: b?.generacionKwh ?? null,
        consumo: b?.consumoKwh ?? null,
        aRed: b?.exportacionKwh ?? null,
        deRed: b?.importacionKwh ?? null,
      };
    });
  }, [barras, pestania, periodo, anio, diasDelMes]);

  if (!barras.some((b) => b.generacionKwh != null)) {
    return <Vacio texto="Todavía no hay datos guardados para este período." />;
  }

  return (
    <>
    <p className="pl-2 text-[11px] text-[var(--color-text-muted)]">kWh</p>
    <ResponsiveContainer width="100%" height={270}>
      <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: -8 }} barGap={2} barCategoryGap={pestania === "dia" ? "18%" : "28%"}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="etiqueta"
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
          interval={pestania === "dia" ? 1 : 0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v: number) => v.toLocaleString("es-UY", { maximumFractionDigits: 0 })}
        />
        <Tooltip content={<TooltipBarras pestania={pestania} />} cursor={{ fill: "var(--color-bg-card-hover)", opacity: 0.5 }} />
        {!ocultas.has("gen") && <Bar dataKey="gen" fill="var(--en-gen)" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
        {!ocultas.has("consumo") && <Bar dataKey="consumo" fill="var(--en-cons)" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
        {!ocultas.has("aRed") && <Bar dataKey="aRed" fill="var(--en-exp)" radius={[4, 4, 0, 0]} isAnimationActive={false} />}
      </BarChart>
    </ResponsiveContainer>
    </>
  );
}

function TooltipBarras({
  active,
  payload,
  pestania,
}: {
  active?: boolean;
  payload?: { payload: { clave: string; gen: number | null; consumo: number | null; aRed: number | null; deRed: number | null } }[];
  pestania: "dia" | "mes" | "anio";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const titulo =
    pestania === "dia" ? fechaLarga(p.clave) : pestania === "mes" ? `${MESES[Number(p.clave.slice(5, 7)) - 1]} de ${p.clave.slice(0, 4)}` : p.clave;
  const filas: [Serie, number | null][] = [
    ["gen", p.gen],
    ["consumo", p.consumo],
    ["aRed", p.aRed],
    ["deRed", p.deRed],
  ];
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[12px] shadow-xl">
      <p className="mb-1 font-semibold text-[var(--color-text-primary)]">{titulo}</p>
      {p.gen == null ? (
        <p className="text-[var(--color-text-muted)]">Sin datos</p>
      ) : (
        filas.map(([s, v]) => (
          <p key={s} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES[s].color }} />
            {SERIES[s].nombre}: <span className="ml-auto pl-3 font-semibold tabular-nums text-[var(--color-text-primary)]">{kwh(v)}</span>
          </p>
        ))
      )}
    </div>
  );
}

// ─── Tabla ────────────────────────────────────────────────────────────────────

function TablaDatos({ pestania, curva, barras }: { pestania: Pestania; curva: CurvaDia | undefined; barras: BarraEnergia[] }) {
  const filas =
    pestania === "hora"
      ? (curva?.puntos ?? [])
          .filter((p) => minutos(p.h) % 30 === 0)
          .map((p) => ({ k: p.h, gen: kw(p.gen), cons: kw(p.consumo), exp: kw(p.aRed), imp: kw(p.deRed) }))
      : barras.map((b) => ({
          k: pestania === "dia" ? b.clave.slice(8, 10) : pestania === "mes" ? MESES_CORTOS[Number(b.clave.slice(5, 7)) - 1] : b.clave,
          gen: kwh(b.generacionKwh),
          cons: kwh(b.consumoKwh),
          exp: kwh(b.exportacionKwh),
          imp: kwh(b.importacionKwh),
        }));
  return (
    <div className="mx-4 mb-3 max-h-64 overflow-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-[12px] tabular-nums">
        <thead className="sticky top-0 bg-[var(--color-bg-card)] text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-1.5 text-left font-medium">{pestania === "hora" ? "Hora (cada 30 min)" : pestania === "dia" ? "Día" : pestania === "mes" ? "Mes" : "Año"}</th>
            <th className="px-3 py-1.5 text-right font-medium">Producción</th>
            <th className="px-3 py-1.5 text-right font-medium">Consumo</th>
            <th className="px-3 py-1.5 text-right font-medium">Exportado</th>
            <th className="px-3 py-1.5 text-right font-medium">Importado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-primary)]">
          {filas.map((f) => (
            <tr key={f.k}>
              <td className="px-3 py-1">{f.k}</td>
              <td className="px-3 py-1 text-right">{f.gen}</td>
              <td className="px-3 py-1 text-right">{f.cons}</td>
              <td className="px-3 py-1 text-right">{f.exp}</td>
              <td className="px-3 py-1 text-right">{f.imp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Resumen ──────────────────────────────────────────────────────────────────

function ResumenBarras({ r, parcial }: { r: ResumenEnergia; parcial: boolean }) {
  const gen = r.generacionKwh ?? 0;
  const auto = r.autoconsumoKwh;
  const exp = r.exportacionKwh;
  const cons = r.consumoKwh;
  const imp = r.importacionKwh;
  return (
    <div className="grid gap-4 border-t border-[var(--color-border)] px-4 py-4 sm:grid-cols-2">
      <BarraPartida
        titulo="Producción del sistema"
        total={gen}
        partes={
          auto != null && exp != null
            ? [
                { nombre: "Autoconsumo", valor: auto, color: "var(--en-gen)" },
                { nombre: "Exportado a la red", valor: exp, color: "var(--en-exp)" },
              ]
            : null
        }
      />
      <BarraPartida
        titulo="Consumo"
        sinDato={parcial ? "Falta medir algunos días: ver arriba." : "No se mide en esta planta."}
        total={cons}
        partes={
          cons != null && auto != null && imp != null
            ? [
                { nombre: "Autoconsumo", valor: auto, color: "var(--en-gen)" },
                { nombre: "Importado de la red", valor: imp, color: "var(--en-imp)" },
              ]
            : null
        }
      />
    </div>
  );
}

function BarraPartida({
  titulo,
  total,
  partes,
  sinDato = "No se mide en esta planta.",
}: {
  titulo: string;
  sinDato?: string;
  total: number | null;
  partes: { nombre: string; valor: number; color: string }[] | null;
}) {
  const suma = partes ? partes.reduce((a, p) => a + p.valor, 0) : 0;
  return (
    <div>
      <p className="mb-1.5 flex items-baseline justify-between text-[12px] text-[var(--color-text-secondary)]">
        <span>{titulo}</span>
        <span className="text-[15px] font-semibold tabular-nums text-[var(--color-text-primary)]">{kwh(total)}</span>
      </p>
      {partes && suma > 0 ? (
        <>
          <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
            {partes.map((p) => (
              <div key={p.nombre} style={{ width: `${(p.valor / suma) * 100}%`, background: p.color }} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
            {partes.map((p, i) => (
              <span key={p.nombre} className={i === partes.length - 1 ? "text-right" : ""}>
                <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: p.color }} />
                {p.nombre} <span className="tabular-nums text-[var(--color-text-secondary)]">{Math.round((p.valor / suma) * 100)}% · {kwh(p.valor)}</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[11px] text-[var(--color-text-muted)]">{total == null ? sinDato : total === 0 ? "Todavía no hubo producción." : "Sin datos de cómo se reparte."}</p>
      )}
    </div>
  );
}

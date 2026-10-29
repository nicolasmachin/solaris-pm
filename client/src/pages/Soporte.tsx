import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Eye,
  Gauge,
  LifeBuoy,
  MessageSquare,
  Moon,
  PlugZap,
  RefreshCw,
  Send,
  SunDim,
  TrendingDown,
  Wifi,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  avisarClienteSoporte,
  cerrarCasoSoporte,
  correrRendimiento,
  correrVigia,
  getMensajeCliente,
  getSoporteCasos,
  getSoporteTablero,
  descartarIncidencia,
  revisarIncidencia,
  type SoporteCaso,
  type SoporteCasoTipo,
  type SoporteGrupo,
  type SoportePlanta,
  type SoporteProblema,
} from "../api/soporte.api";
import { Spinner } from "../components/ui/Spinner";
import { usePermission } from "../hooks/usePermission";

// Mesa de Soporte: la revisión automática mira la cartera cada media hora con sol y abre
// casos; acá se ven, se avisa al cliente (siempre lo decide una persona) y se
// cierran. Abajo, todas las plantas con su lectura de ahora.

const errorDe = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

const TIPO: Record<SoporteCasoTipo, { texto: string; clase: string }> = {
  SIN_GENERACION: { texto: "No genera", clase: "bg-red-500/15 text-red-400" },
  FALLA_INVERSOR: { texto: "Falla del inversor", clase: "bg-red-500/15 text-red-400" },
  SIN_COMUNICACION: { texto: "No comunica", clase: "bg-amber-500/15 text-amber-300" },
  BAJO_RENDIMIENTO: { texto: "Genera menos", clase: "bg-amber-500/15 text-amber-300" },
};

function hace(iso: string | null): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** El peor de los últimos días contra lo normal (para ordenar). */
const peorDia = (p: SoportePlanta) => (p.dias && p.dias.length ? Math.min(...p.dias.map((d) => d.vs)) : 9);
const colorVs = (v: number) => (v < 0.6 ? "text-red-400" : v < 0.85 ? "text-amber-300" : "text-emerald-400");

export function Soporte() {
  const qc = useQueryClient();
  const puedeEditar = usePermission("SOPORTE", "EDIT");
  const [verCerrados, setVerCerrados] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["soporte-tablero"],
    queryFn: getSoporteTablero,
    refetchInterval: 60_000,
  });
  const cerradosQ = useQuery({
    queryKey: ["soporte-cerrados"],
    queryFn: async () => {
      const [r, d] = await Promise.all([getSoporteCasos("RESUELTO"), getSoporteCasos("DESCARTADO")]);
      return [...r, ...d].sort((a, b) => (b.resueltoEn ?? "").localeCompare(a.resueltoEn ?? "")).slice(0, 50);
    },
    enabled: verCerrados,
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["soporte-tablero"] });
    qc.invalidateQueries({ queryKey: ["soporte-cerrados"] });
  };
  const vigia = useMutation({
    mutationFn: correrVigia,
    onSuccess: (r) => {
      toast.success(`Revisadas ${r.plantas} plantas: ${r.casosNuevos} casos nuevos, ${r.casosCerrados} cerrados`);
      invalidar();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo revisar"),
  });
  const rendimiento = useMutation({
    mutationFn: correrRendimiento,
    onSuccess: (r) => {
      toast.success(`Rendimiento: ${r.abiertos} casos nuevos, ${r.cerrados} cerrados`);
      invalidar();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo revisar el rendimiento"),
  });

  if (isLoading || !data) return <Spinner />;

  const enLinea = data.plantas.filter((p) => p.enLinea).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[var(--color-text-primary)]">
            <LifeBuoy className="h-6 w-6 text-[var(--color-accent)]" /> Soporte
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Mesa de monitoreo de plantas. Última lectura {hace(data.ultimaLectura)}
            {data.vigiaAutomatico ? " · se revisa sola cada media hora con sol" : " · revisión automática apagada en este entorno"}
            {data.mediana != null && ` · la cartera está generando al ${Math.round(data.mediana * 100)} % de su potencia`}
          </p>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => vigia.mutate()}
              disabled={vigia.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${vigia.isPending ? "animate-spin" : ""}`} /> Revisar ahora
            </button>
            <button
              type="button"
              onClick={() => rendimiento.mutate()}
              disabled={rendimiento.isPending}
              title="Compara los últimos días de cada planta con lo normal para ella"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60"
            >
              <Zap className="h-4 w-4" /> Revisar rendimiento
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato titulo="Plantas con problema" valor={String(new Set(data.problemas.map((p) => p.projectId ?? p.cliente)).size)} alerta={data.problemas.length > 0} />
        <Dato
          titulo={data.haySol ? "Plantas en línea" : "Plantas en línea (de noche)"}
          valor={data.haySol ? `${enLinea} de ${data.plantas.length}` : "sin sol"}
        />
        <Dato titulo="Reclamos abiertos" valor={String(data.reclamosAbiertos)} link="/mis-tareas/tickets" />
        <Dato titulo="Monitoreo diario (detalle)" valor={String(data.incidenciasMonitoreo)} link="/clientes/monitoreo" />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[var(--color-text-primary)]">Problemas</h2>
          <button type="button" onClick={() => setVerCerrados((v) => !v)} className="text-xs text-[var(--color-accent)] hover:underline">
            {verCerrados ? "Ocultar casos cerrados" : "Ver casos cerrados"}
          </button>
        </div>
        {data.problemas.length === 0 ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 text-sm text-[var(--color-text-muted)]">
            <CheckCircle2 className="mr-1.5 inline h-4 w-4 text-emerald-400" />
            No hay problemas abiertos: todas las plantas que se pueden ver están andando.
          </p>
        ) : (
          <Problemas problemas={data.problemas} casos={data.casos} puedeEditar={puedeEditar} onCambio={invalidar} />
        )}
        {verCerrados &&
          (cerradosQ.isLoading ? (
            <Spinner />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {(cerradosQ.data ?? []).map((c) => (
                <TarjetaCaso key={c.id} c={c} puedeEditar={false} onCambio={invalidar} />
              ))}
            </div>
          ))}
      </section>

      <TablaPlantas plantas={data.plantas} haySol={data.haySol} />
    </div>
  );
}

function Dato({ titulo, valor, alerta, link }: { titulo: string; valor: string; alerta?: boolean; link?: string }) {
  const cuerpo = (
    <>
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">{titulo}</p>
      <p className={`mt-0.5 font-display text-xl font-bold ${alerta ? "text-red-400" : "text-[var(--color-text-primary)]"}`}>{valor}</p>
    </>
  );
  const clase = "rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3";
  return link ? (
    <Link to={link} className={`${clase} hover:bg-[var(--color-bg-card-hover)]`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

function TarjetaCaso({ c, puedeEditar, onCambio }: { c: SoporteCaso; puedeEditar: boolean; onCambio: () => void }) {
  const t = TIPO[c.tipo];
  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${t.clase}`}>{t.texto}</span>
        <Link to={`/clientes/${c.projectId}`} className="font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)]">
          {c.cliente}
        </Link>
        <span className="ml-auto text-[11px] text-[var(--color-text-muted)]">
          {c.estado === "ABIERTO" ? `desde ${fechaHora(c.detectadoEn)}` : `${c.estado === "RESUELTO" ? "resuelto" : "descartado"} ${fechaHora(c.resueltoEn!)}`}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">{c.titulo}</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{c.detalle}</p>
      <AccionesCaso c={c} puedeEditar={puedeEditar} onCambio={onCambio} />
    </article>
  );
}

/** Aviso al cliente, cierre y estado del aviso de un caso de Soporte. */
function AccionesCaso({ c, puedeEditar, onCambio }: { c: SoporteCaso; puedeEditar: boolean; onCambio: () => void }) {
  const [avisando, setAvisando] = useState(false);
  const [cerrando, setCerrando] = useState<null | "RESUELTO" | "DESCARTADO">(null);
  const [motivo, setMotivo] = useState("");

  const cerrar = useMutation({
    mutationFn: () => cerrarCasoSoporte(c.id, cerrando!, motivo),
    onSuccess: () => {
      toast.success("Caso cerrado");
      setCerrando(null);
      onCambio();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo cerrar"),
  });

  return (
    <>
      {c.motivoCierre && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Cierre{c.resueltoPor ? ` (${c.resueltoPor})` : " (automático)"}: {c.motivoCierre}
        </p>
      )}
      {c.clienteAvisadoEn ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-emerald-400">
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Cliente avisado {fechaHora(c.clienteAvisadoEn)}
          {c.clienteAvisadoPor ? ` por ${c.clienteAvisadoPor}` : ""}: “{c.mensajeCliente}”
        </p>
      ) : (
        c.estado === "ABIERTO" && (
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Todavía no se le avisó al cliente{c.conPortal ? "." : " (no tiene usuario del portal: avisarle por WhatsApp)."}
          </p>
        )
      )}

      {puedeEditar && c.estado === "ABIERTO" && !cerrando && (
        <div className="mt-3 flex flex-wrap gap-2">
          {c.conPortal && (
            <button
              type="button"
              onClick={() => setAvisando(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-gray-900 hover:opacity-90"
            >
              <MessageSquare className="h-4 w-4" /> {c.clienteAvisadoEn ? "Avisar de nuevo" : "Avisar al cliente"}
            </button>
          )}
          <button type="button" onClick={() => setCerrando("RESUELTO")} className={botonChico}>
            <CheckCircle2 className="h-4 w-4" /> Resuelto
          </button>
          <button type="button" onClick={() => setCerrando("DESCARTADO")} className={botonChico}>
            <X className="h-4 w-4" /> Descartar
          </button>
        </div>
      )}
      {cerrando && (
        <div className="mt-3 space-y-2">
          <input
            autoFocus
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={cerrando === "RESUELTO" ? "Qué era y qué se hizo (ej.: llave saltada, la subió el cliente)" : "Por qué no es un problema"}
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => cerrar.mutate()} disabled={cerrar.isPending} className={botonChico}>
              Confirmar
            </button>
            <button type="button" onClick={() => setCerrando(null)} className={botonChico}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {avisando && <AvisarCliente caso={c} onClose={() => setAvisando(false)} onListo={onCambio} />}
    </>
  );
}

const botonChico =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-60";

function AvisarCliente({ caso, onClose, onListo }: { caso: SoporteCaso; onClose: () => void; onListo: () => void }) {
  const [texto, setTexto] = useState<string | null>(null);
  const sugerido = useQuery({ queryKey: ["soporte-mensaje", caso.id], queryFn: () => getMensajeCliente(caso.id) });
  const valor = texto ?? sugerido.data ?? "";
  const enviar = useMutation({
    mutationFn: () => avisarClienteSoporte(caso.id, valor),
    onSuccess: () => {
      toast.success("Aviso enviado al cliente");
      onListo();
      onClose();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo avisar"),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-[var(--color-text-primary)]">Avisar a {caso.cliente}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Le llega a su portal y, si activó los avisos, al celular. Revisá el texto antes de mandarlo.
        </p>
        {sugerido.isLoading ? (
          <Spinner />
        ) : (
          <textarea
            value={valor}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            maxLength={1000}
            className="mt-3 w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          />
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className={botonChico}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => enviar.mutate()}
            disabled={enviar.isPending || valor.trim().length < 10}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-gray-900 disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Mandar aviso
          </button>
        </div>
      </div>
    </div>
  );
}

function TablaPlantas({ plantas, haySol }: { plantas: SoportePlanta[]; haySol: boolean }) {
  const [q, setQ] = useState("");
  const filas = useMemo(() => {
    const peso = (p: SoportePlanta) => (p.caso ? 0 : haySol && !p.enLinea ? 1 : peorDia(p) < 0.6 ? 2 : 3);
    return plantas
      .filter((p) => p.cliente.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => peso(a) - peso(b) || peorDia(a) - peorDia(b));
  }, [plantas, q, haySol]);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="font-semibold text-[var(--color-text-primary)]">Plantas ahora</h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente…"
          className="w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1 text-sm text-[var(--color-text-primary)]"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <th className="px-4 py-2">Cliente</th>
              <th className="px-2 py-2">Estado</th>
              <th className="px-2 py-2 text-right">Ahora</th>
              <th className="px-2 py-2 text-right" title="Cuánto generó cada uno de los últimos días con sol, comparada con lo normal para ella (con el resto de la cartera como referencia del clima)">
                Últimos días vs. lo normal
              </th>
              <th className="px-2 py-2 text-right">Hoy</th>
              <th className="px-4 py-2">Generó por última vez</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <tr key={p.projectId} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2">
                  <Link to={`/clientes/${p.projectId}`} className="text-[var(--color-text-primary)] hover:text-[var(--color-accent)]">
                    {p.cliente}
                  </Link>
                  {p.kwp != null && <span className="ml-1.5 text-[11px] text-[var(--color-text-muted)]">{p.kwp} kWp</span>}
                  {p.marca === "HUAWEI" && (
                    <span className="ml-1.5 rounded bg-[var(--color-bg-app)] px-1 text-[10px] text-[var(--color-text-muted)]" title="En Huawei, 'Ahora' es el promedio de la última media hora">
                      Huawei
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">
                  {p.pausa ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400" title="Mientras tanto la revisión no le abre casos">
                      {p.pausa.motivo === "OBRA" ? "En obra" : "Silenciada"} hasta el {p.pausa.hasta.slice(8, 10)}/{p.pausa.hasta.slice(5, 7)}
                    </span>
                  ) : p.caso ? (
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${TIPO[p.caso.tipo].clase}`}>
                      <AlertTriangle className="h-3 w-3" /> {TIPO[p.caso.tipo].texto}
                    </span>
                  ) : !haySol ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]" title="De noche Growatt da a casi todas por desconectadas: no quiere decir nada">
                      <Moon className="h-3 w-3" /> Sin sol
                    </span>
                  ) : p.enLinea ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <Wifi className="h-3 w-3" /> En línea
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <WifiOff className="h-3 w-3" /> Desconectada
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-primary)]">
                  {p.potenciaW != null && p.potenciaW >= 0 ? `${(p.potenciaW / 1000).toLocaleString("es-UY", { maximumFractionDigits: 2 })} kW` : "—"}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {!p.dias || p.dias.length === 0 ? (
                    <span className="text-[11px] text-[var(--color-text-muted)]">sin historia</span>
                  ) : (
                    <span className="inline-flex gap-2">
                      {p.dias.map((d) => (
                        <span key={d.dia} className={colorVs(d.vs)} title={`${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}: ${d.kwh.toFixed(1)} kWh`}>
                          {Math.round(d.vs * 100)}%
                        </span>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                  {p.energiaHoyKwh != null ? `${p.energiaHoyKwh.toLocaleString("es-UY", { maximumFractionDigits: 1 })} kWh` : "—"}
                </td>
                <td className="px-4 py-2 text-xs text-[var(--color-text-muted)]">{hace(p.ultimaGeneracionEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-[var(--color-text-muted)]">
        "Últimos días vs. lo normal": lo que generó cada uno de los últimos 3 días con sol, comparado con lo que genera siempre
        esa planta respecto del resto de la cartera. El clima se cancela (si está nublado baja todo el mundo) y la orientación y
        las sombras también (cada planta contra sí misma). 100 % es normal; en rojo, menos del 60 %.
      </p>
    </section>
  );
}

// ─── Problemas agrupados ────────────────────────────────────────────────────

const GRUPOS: Record<SoporteGrupo, { titulo: string; queEs: string; icono: LucideIcon; color: string; borde: string }> = {
  FALLA: {
    titulo: "Falla del inversor",
    queEs: "El inversor informa un código de falla. Cada tarjeta dice qué significa y qué hacer.",
    icono: Zap,
    color: "text-red-400",
    borde: "border-red-500/40",
  },
  NO_GENERA: {
    titulo: "No genera",
    queEs: "Comunica pero no genera con sol: la llave, el lado de los paneles o el inversor apagado.",
    icono: Ban,
    color: "text-red-400",
    borde: "border-red-500/40",
  },
  NO_COMUNICA: {
    titulo: "No comunica",
    queEs: "Dejó de mandar datos. Suele ser el wifi o el datalogger; no quiere decir que no genere.",
    icono: WifiOff,
    color: "text-amber-300",
    borde: "border-amber-500/40",
  },
  GENERA_MENOS: {
    titulo: "Genera menos de lo normal",
    queEs: "Genera, pero bastante menos que lo normal para ella en esta época, comparada con el resto de la cartera.",
    icono: TrendingDown,
    color: "text-amber-300",
    borde: "border-amber-500/40",
  },
  MEDIDOR: {
    titulo: "Medidor mal conectado",
    queEs: "Exporta más de lo que genera: los transformadores del medidor están dados vuelta o en otra fase.",
    icono: Gauge,
    color: "text-amber-300",
    borde: "border-amber-500/40",
  },
  NO_EXPORTA: {
    titulo: "No exporta",
    queEs: "Genera pero no le vende nada a UTE: suele ser la inyección limitada en el inversor.",
    icono: PlugZap,
    color: "text-amber-300",
    borde: "border-amber-500/40",
  },
  SIN_DATOS: {
    titulo: "Sin datos de la plataforma",
    queEs: "Growatt o Huawei no contestan sobre esta planta hace días. Es un problema nuestro, no del cliente.",
    icono: SunDim,
    color: "text-[var(--color-text-muted)]",
    borde: "border-[var(--color-border)]",
  },
};
const ORDEN_GRUPOS: SoporteGrupo[] = ["FALLA", "NO_GENERA", "NO_COMUNICA", "GENERA_MENOS", "MEDIDOR", "NO_EXPORTA", "SIN_DATOS"];

function diasDesde(desde: string): number {
  const d = desde.length === 10 ? new Date(`${desde}T12:00:00`) : new Date(desde);
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}
const ddmm = (desde: string) => `${desde.slice(8, 10)}/${desde.slice(5, 7)}`;

function Problemas({
  problemas,
  casos,
  puedeEditar,
  onCambio,
}: {
  problemas: SoporteProblema[];
  casos: SoporteCaso[];
  puedeEditar: boolean;
  onCambio: () => void;
}) {
  const caso = new Map(casos.map((c) => [c.id, c]));
  const grupos = ORDEN_GRUPOS.map((g) => ({ g, items: problemas.filter((p) => p.grupo === g) })).filter((x) => x.items.length);
  return (
    <div className="space-y-5">
      {/* Resumen: un bloque por tipo de problema, con la cantidad en grande */}
      <div className="flex flex-wrap gap-2">
        {grupos.map(({ g, items }) => {
          const G = GRUPOS[g];
          const Icono = G.icono;
          return (
            <a
              key={g}
              href={`#grupo-${g}`}
              className={`flex items-center gap-2 rounded-xl border ${G.borde} bg-[var(--color-bg-card)] px-3 py-2 hover:bg-[var(--color-bg-card-hover)]`}
            >
              <Icono className={`h-5 w-5 ${G.color}`} />
              <span className={`font-display text-2xl font-bold ${G.color}`}>{items.length}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">{G.titulo}</span>
            </a>
          );
        })}
      </div>

      {grupos.map(({ g, items }) => {
        const G = GRUPOS[g];
        const Icono = G.icono;
        return (
          <div key={g} id={`grupo-${g}`} className="scroll-mt-20 space-y-2">
            <div className="flex items-baseline gap-2">
              <Icono className={`h-4 w-4 self-center ${G.color}`} />
              <h3 className={`font-semibold ${G.color}`}>
                {G.titulo} · {items.length}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">{G.queEs}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items
                .sort((a, b) => diasDesde(b.desde) - diasDesde(a.desde))
                .map((p) => (
                  <TarjetaProblema key={p.clave} p={p} borde={G.borde} caso={caso.get(p.id)} puedeEditar={puedeEditar} onCambio={onCambio} />
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TarjetaProblema({
  p,
  borde,
  caso,
  puedeEditar,
  onCambio,
}: {
  p: SoporteProblema;
  borde: string;
  caso: SoporteCaso | undefined;
  puedeEditar: boolean;
  onCambio: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const dias = diasDesde(p.desde);
  return (
    <article className={`flex flex-col rounded-xl border ${borde} bg-[var(--color-bg-card)] p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {p.projectId ? (
            <Link to={`/clientes/${p.projectId}`} className="block truncate text-lg font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)]">
              {p.cliente}
            </Link>
          ) : (
            <p className="truncate text-lg font-semibold text-[var(--color-text-primary)]">{p.cliente}</p>
          )}
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {p.kwp != null && `${p.kwp} kWp · `}
            {p.origen === "SOPORTE" ? "revisión automática" : "monitoreo diario"}
            {p.origen === "SOPORTE" && p.monitoreoDesde && ` · también el monitoreo diario, desde el ${ddmm(p.monitoreoDesde)}`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-bold leading-none text-[var(--color-text-primary)]">{dias === 0 ? "hoy" : dias}</p>
          {dias > 0 && <p className="text-[10px] text-[var(--color-text-muted)]">{dias === 1 ? "día" : "días"}</p>}
        </div>
      </div>

      {p.pausa && (
        <p className="mt-2 inline-flex w-fit rounded-md bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400">
          {p.pausa.motivo === "OBRA" ? "En obra" : "Silenciada"} hasta el {ddmm(p.pausa.hasta)}
        </p>
      )}

      {p.dias && p.dias.length > 0 && (
        <div className="mt-3 flex items-end gap-2">
          {p.dias.map((d) => (
            <div key={d.dia} className="flex-1 text-center" title={`${d.kwh.toFixed(1)} kWh`}>
              <div className="mx-auto flex h-10 w-full items-end rounded bg-[var(--color-bg-app)]">
                <div
                  className={`w-full rounded ${d.vs < 0.6 ? "bg-red-500/70" : d.vs < 0.85 ? "bg-amber-400/70" : "bg-emerald-500/70"}`}
                  style={{ height: `${Math.max(4, Math.min(100, d.vs * 100))}%` }}
                />
              </div>
              <p className={`mt-0.5 text-[11px] ${colorVs(d.vs)}`}>{Math.round(d.vs * 100)}%</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{ddmm(d.dia)}</p>
            </div>
          ))}
        </div>
      )}

      {p.titulo && <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">{p.titulo}</p>}
      <p className={`${p.titulo ? "mt-1" : "mt-3"} text-sm text-[var(--color-text-secondary)] ${abierto ? "" : "line-clamp-3"}`}>{p.detalle}</p>
      {p.detalle.length > 160 && (
        <button type="button" onClick={() => setAbierto((v) => !v)} className="mt-0.5 w-fit text-xs text-[var(--color-accent)] hover:underline">
          {abierto ? "ver menos" : "ver más"}
        </button>
      )}

      <div className="mt-auto pt-1">
        {caso ? (
          <AccionesCaso c={caso} puedeEditar={puedeEditar} onCambio={onCambio} />
        ) : (
          <AccionesIncidencia p={p} puedeEditar={puedeEditar} onCambio={onCambio} />
        )}
      </div>
    </article>
  );
}

/** Incidencias del monitoreo diario: las mismas acciones que en Experiencia Solar → Monitoreo. */
function AccionesIncidencia({ p, puedeEditar, onCambio }: { p: SoporteProblema; puedeEditar: boolean; onCambio: () => void }) {
  const [descartando, setDescartando] = useState(false);
  const [nota, setNota] = useState("");
  const revisar = useMutation({
    mutationFn: () => revisarIncidencia(p.id),
    onSuccess: () => {
      toast.success("Marcada como vista");
      onCambio();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo marcar"),
  });
  const descartar = useMutation({
    mutationFn: () => descartarIncidencia(p.id, nota),
    onSuccess: () => {
      toast.success("Descartada");
      onCambio();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo descartar"),
  });
  return (
    <div className="mt-3 space-y-2">
      {p.revisada && <p className="text-xs text-[var(--color-text-muted)]">Ya la vio alguien (sigue abierta hasta que se resuelva).</p>}
      {puedeEditar && !descartando && (
        <div className="flex flex-wrap gap-2">
          {!p.revisada && (
            <button type="button" onClick={() => revisar.mutate()} disabled={revisar.isPending} className={botonChico}>
              <Eye className="h-4 w-4" /> Ya la vi
            </button>
          )}
          <button type="button" onClick={() => setDescartando(true)} className={botonChico}>
            <X className="h-4 w-4" /> Descartar
          </button>
          <Link to="/clientes/monitoreo" className={botonChico}>
            Ver en Monitoreo
          </Link>
        </div>
      )}
      {descartando && (
        <div className="space-y-2">
          <input
            autoFocus
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Por qué no es un problema"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => descartar.mutate()} disabled={descartar.isPending || nota.trim().length < 3} className={botonChico}>
              Confirmar
            </button>
            <button type="button" onClick={() => setDescartando(false)} className={botonChico}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

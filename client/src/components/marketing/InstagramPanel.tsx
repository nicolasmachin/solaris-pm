import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Search, Zap } from "lucide-react";
import toast from "react-hot-toast";

import {
  editarAutomatizacion,
  getAutomatizaciones,
  getConsultasInstagram,
  getContactosInstagram,
  getInstagramEstado,
  type MarketingAutomatizacion,
} from "../../api/marketing.api";
import { Button } from "../ui/Button";

// Marketing → Instagram: lo que no es la bandeja. El estado del asistente, las
// automatizaciones (el "ManyChat con IA": cada una con su flujo escrito en
// palabras, y bien a la vista cuáles están prendidas), la base de contactos y
// las consultas por día. Ver docs/manual/20-marketing.md.

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

function errorDe(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function EstadoAsistente() {
  const { data } = useQuery({ queryKey: ["instagram-estado"], queryFn: getInstagramEstado, refetchInterval: 60_000 });
  if (!data) return null;
  const modo =
    data.modo === "envio"
      ? { texto: "El asistente está contestando", clase: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" }
      : data.modo === "sombra"
        ? {
            texto: "El asistente está en sombra: arma las respuestas pero no las manda (se ven en gris en cada conversación)",
            clase: "border-sky-500/30 bg-sky-500/10 text-sky-200",
          }
        : { texto: "El asistente está apagado: no contesta nada", clase: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-[12px] ${modo.clase}`}>
      <span className="font-medium">{modo.texto}</span>
      <span className="opacity-80">
        Gasto del mes: US$ {data.gasto.usd.toFixed(2)} de {data.gasto.topeUsd}
      </span>
      <span className="opacity-80">
        Deriva a {data.derivarA} ({data.derivarWhatsapp})
      </span>
      {!data.conectado && <span className="font-medium">Falta la conexión con indicadores (el token de Meta)</span>}
    </div>
  );
}

const DISPARADOR: Record<MarketingAutomatizacion["disparador"], string> = {
  privado: "Cuando alguien escribe por privado",
  comentario: "Cuando alguien comenta",
  seguimiento: "Al día siguiente del speech, si no contestó",
  texto: "Texto común",
};

function Automatizacion({ a, puedeEditar }: { a: MarketingAutomatizacion; puedeEditar: boolean }) {
  const qc = useQueryClient();
  const [abierta, setAbierta] = useState(false);
  const [editando, setEditando] = useState(false);
  const [flujo, setFlujo] = useState(a.flujo);
  const [palabras, setPalabras] = useState(a.palabras.join(", "));
  const [link, setLink] = useState(a.link);
  const cambiar = useMutation({
    mutationFn: (cambio: Parameters<typeof editarAutomatizacion>[1]) => editarAutomatizacion(a.id, cambio),
    onSuccess: (_r, cambio) => {
      toast.success(cambio.activa === undefined ? "Guardado" : cambio.activa ? "Prendida" : "Apagada");
      setEditando(false);
      qc.invalidateQueries({ queryKey: ["marketing-automatizaciones"] });
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo guardar"),
  });
  const esTexto = a.disparador === "texto";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {!esTexto && (
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                  a.activa ? "bg-emerald-500/20 text-emerald-300" : "bg-zinc-500/20 text-zinc-400"
                }`}
              >
                {a.activa ? "PRENDIDA" : "APAGADA"}
              </span>
            )}
            <p className="font-medium text-[var(--color-text-primary)]">{a.nombre}</p>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
            {DISPARADOR[a.disparador]}
            {a.palabras.length > 0 && <> con la palabra {a.palabras.map((p) => `«${p.toUpperCase()}»`).join(", ")}</>}
            {a.link && (
              <>
                {" "}
                · manda{" "}
                <a href={a.link} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] hover:underline">
                  {a.link}
                </a>
              </>
            )}
            {(a.disparador === "privado" || a.disparador === "comentario") && (
              <>
                {" "}
                · espera {a.espera[0]}–{a.espera[1]} s
              </>
            )}
            {a.disparador === "comentario" && <> · hasta {a.topeDiario} respuestas por día</>}
          </p>
          {!esTexto && (
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              Últimos 7 días: {a.actividad.semana} {a.actividad.semana === 1 ? "vez" : "veces"} ({a.actividad.contestados} contestadas
              {a.actividad.sombra ? `, ${a.actividad.sombra} en sombra` : ""}) · hoy {a.actividad.hoy}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setAbierta((x) => !x)}>
            {abierta ? "Ocultar flujo" : "Ver flujo"}
          </Button>
          {puedeEditar && !esTexto && (
            <Button
              size="sm"
              variant={a.activa ? "ghost" : "primary"}
              disabled={cambiar.isPending}
              onClick={() => cambiar.mutate({ activa: !a.activa })}
            >
              {a.activa ? "Apagar" : "Prender"}
            </Button>
          )}
        </div>
      </div>
      {abierta && !editando && (
        <div className="mt-3 space-y-2">
          <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--color-bg-app)] p-3 font-sans text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
            {a.flujo}
          </pre>
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span>{a.actualizadoPor ? `Último cambio: ${a.actualizadoPor}, ${fecha(a.actualizadoEn)}` : "Sin cambios desde que se cargó"}</span>
            {puedeEditar && (
              <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
                <Pencil size={13} className="mr-1.5" /> Editar
              </Button>
            )}
          </div>
        </div>
      )}
      {editando && (
        <div className="mt-3 space-y-2">
          {a.disparador === "comentario" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-[var(--color-text-muted)]">
                Palabras clave (separadas por coma; vacío = todos los comentarios que no tome otra)
                <input className={INPUT} value={palabras} onChange={(e) => setPalabras(e.target.value)} />
              </label>
              <label className="text-[11px] text-[var(--color-text-muted)]">
                Link que se manda por privado (vacío = no manda privado)
                <input className={INPUT} value={link} onChange={(e) => setLink(e.target.value)} />
              </label>
            </div>
          )}
          <textarea className={`${INPUT} min-h-[320px] resize-y font-mono text-[12px]`} value={flujo} onChange={(e) => setFlujo(e.target.value)} />
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Lo que va entre llaves ({"{DATOS}"}, {"{FLUJO}"}, {"{LINK}"}, {"{DERIVAR_A}"}, {"{DERIVAR_WHATSAPP}"}) lo completa Voltia PM: no
            borrarlo. Las reglas de las respuestas son de Nicolás.
          </p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={cambiar.isPending || !flujo.trim()}
              onClick={() =>
                cambiar.mutate({
                  flujo,
                  ...(a.disparador === "comentario"
                    ? {
                        palabras: palabras
                          .split(",")
                          .map((p) => p.trim())
                          .filter(Boolean),
                        link: link.trim() || null,
                      }
                    : {}),
                })
              }
            >
              Guardar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Automatizaciones({ puedeEditar }: { puedeEditar: boolean }) {
  const { data = [], isLoading } = useQuery({ queryKey: ["marketing-automatizaciones"], queryFn: getAutomatizaciones, refetchInterval: 30_000 });
  const autos = data.filter((a) => a.disparador !== "texto");
  const textos = data.filter((a) => a.disparador === "texto");
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[var(--color-text-secondary)]">
        <Zap size={13} className="mr-1 inline text-[var(--color-accent)]" />
        Cada automatización es una rutina con su flujo escrito en palabras: el asistente lo sigue, y Voltia PM pone los límites (la
        ventana de Instagram, los topes, no contestar dos veces).
      </p>
      {isLoading && <p className="text-[12px] text-[var(--color-text-muted)]">Cargando…</p>}
      {autos.map((a) => (
        <Automatizacion key={a.id} a={a} puedeEditar={puedeEditar} />
      ))}
      {textos.length > 0 && (
        <>
          <h3 className="pt-2 text-[13px] font-medium text-[var(--color-text-primary)]">Textos que usan todas</h3>
          {textos.map((a) => (
            <Automatizacion key={a.id} a={a} puedeEditar={puedeEditar} />
          ))}
        </>
      )}
    </div>
  );
}

export function Contactos() {
  const [etiqueta, setEtiqueta] = useState("");
  const [texto, setTexto] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["instagram-contactos", etiqueta, texto],
    queryFn: () => getContactosInstagram({ etiqueta, texto }),
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setEtiqueta("")}
          className={`rounded-md px-2 py-1 text-[11px] ${!etiqueta ? "bg-[var(--color-accent)]/15 font-medium" : "hover:bg-[var(--color-bg-card)]"} text-[var(--color-text-primary)]`}
        >
          Todos <span className="opacity-60">{data?.total ?? ""}</span>
        </button>
        {data?.etiquetas.map((e) => (
          <button
            key={e.etiqueta}
            type="button"
            onClick={() => setEtiqueta(e.etiqueta)}
            className={`rounded-md px-2 py-1 text-[11px] ${
              etiqueta === e.etiqueta ? "bg-[var(--color-accent)]/15 font-medium" : "hover:bg-[var(--color-bg-card)]"
            } text-[var(--color-text-secondary)]`}
          >
            {e.etiqueta} <span className="opacity-60">{e.contactos}</span>
          </button>
        ))}
      </div>
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--color-text-muted)]" />
        <input className={`${INPUT} pl-8`} placeholder="Buscar por usuario o nombre" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Los marcados «historial» vienen de ManyChat (antes del 30-oct-2026): sirven para saber quién vuelve, pero no cuentan en las
        consultas. Se muestran hasta 200.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Contacto</th>
              <th className="px-3 py-2 font-medium">Etiquetas</th>
              <th className="px-3 py-2 font-medium">Última vez</th>
              <th className="px-3 py-2 font-medium">Lead</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-[var(--color-text-muted)]">
                  Cargando…
                </td>
              </tr>
            )}
            {data?.contactos.map((c) => (
              <tr key={c.id} className="border-t border-[var(--color-border)] align-top">
                <td className="px-3 py-2 text-[var(--color-text-primary)]">
                  {c.usuario ? (
                    <a href={`https://instagram.com/${c.usuario}`} target="_blank" rel="noreferrer" className="hover:underline">
                      @{c.usuario}
                    </a>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">sin usuario</span>
                  )}
                  {c.nombre && <span className="ml-1 text-[var(--color-text-muted)]">{c.nombre}</span>}
                  {c.importado && <span className="ml-1.5 rounded bg-zinc-500/20 px-1 text-[10px] text-zinc-400">historial</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {c.etiquetas.map((e) => (
                      <span
                        key={e.nombre}
                        className={`rounded px-1.5 py-0.5 text-[10px] ${e.importada ? "bg-zinc-500/15 text-zinc-400" : "bg-sky-500/15 text-sky-300"}`}
                        title={e.veces > 1 ? `${e.veces} veces` : undefined}
                      >
                        {e.nombre}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-[var(--color-text-muted)]">{fecha(c.ultimaVez)}</td>
                <td className="px-3 py-2">
                  {c.lead && (
                    <Link to={`/ventas?lead=${c.lead.id}`} className="text-[var(--color-accent)] hover:underline">
                      {c.lead.code}
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Consultas() {
  const { data = [], isLoading } = useQuery({ queryKey: ["instagram-consultas"], queryFn: () => getConsultasInstagram(14), refetchInterval: 60_000 });
  const total = data.reduce(
    (a, d) => ({
      personas: a.personas + d.personas,
      speech: a.speech + d.speech,
      derivadas: a.derivadas + d.derivadas,
      leads: a.leads + d.leads,
      leadMagnets: a.leadMagnets + d.leadMagnets,
    }),
    { personas: 0, speech: 0, derivadas: 0, leads: 0, leadMagnets: 0 },
  );
  const COL = ["Día", "Escribieron", "Nuevas", "Por anuncio", "Orgánico", "Speech", "Derivadas", "Leads", "Lead magnets", "Comentarios contestados"];
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-[var(--color-text-secondary)]">
        Últimos 14 días: {total.personas} personas escribieron, a {total.speech} se les contó el speech, {total.derivadas} se derivaron a
        Ventas ({total.leads} con factura o techo) y {total.leadMagnets} recibieron un lead magnet. Se cuenta desde que Voltia PM atiende
        Instagram; «Speech» es la cifra IG de la planilla.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--color-bg-card)] text-left text-[var(--color-text-muted)]">
            <tr>
              {COL.map((c) => (
                <th key={c} className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={COL.length} className="px-3 py-4 text-[var(--color-text-muted)]">
                  Cargando…
                </td>
              </tr>
            )}
            {[...data].reverse().map((d) => (
              <tr key={d.dia} className="border-t border-[var(--color-border)] text-[var(--color-text-primary)]">
                <td className="whitespace-nowrap px-3 py-1.5">
                  {new Date(`${d.dia}T12:00:00Z`).toLocaleDateString("es-UY", { weekday: "short", day: "2-digit", month: "2-digit" })}
                </td>
                {[d.personas, d.nuevas, d.anuncio, d.organico, d.speech, d.derivadas, d.leads, d.leadMagnets, d.comentariosContestados].map((n, i) => (
                  <td key={i} className={`px-3 py-1.5 ${n ? "" : "text-[var(--color-text-muted)]"}`}>
                    {n}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

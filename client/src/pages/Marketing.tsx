import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, AtSign, Bot, Hand, Megaphone, MessageCircle, Search, Send, UserPlus } from "lucide-react";
import toast from "react-hot-toast";

import {
  crearLeadInstagram,
  enviarInstagram,
  getInstagramConversacion,
  getInstagramConversaciones,
  tomarInstagram,
  type InstagramConversacion,
  type InstagramEvento,
  type InstagramMensaje,
} from "../api/marketing.api";
import { Automatizaciones, Consultas, Contactos, EstadoAsistente } from "../components/marketing/InstagramPanel";
import { Button } from "../components/ui/Button";
import { usePermission } from "../hooks/usePermission";

// Marketing. Por ahora, Instagram: la bandeja de privados (contestar a mano,
// tomar la conversación, crear el lead), las automatizaciones del asistente,
// los contactos y las consultas por día. Ver docs/manual/20-marketing.md.

function errorDe(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

function cuando(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) {
    return d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" });
}

function hora(iso: string) {
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function titulo(c: InstagramConversacion) {
  if (c.nombre && c.usuario) return c.nombre;
  if (c.usuario) return `@${c.usuario}`;
  return c.nombre ?? `Instagram ${c.persona.slice(-6)}`;
}

const ESTADO: Record<InstagramConversacion["estado"], { label: string; clase: string }> = {
  ASISTENTE: { label: "Asistente", clase: "bg-sky-500/15 text-sky-300" },
  DERIVADA: { label: "Derivada", clase: "bg-amber-500/15 text-amber-300" },
  TOMADA: { label: "Tomada", clase: "bg-emerald-500/15 text-emerald-300" },
};

const AUTOR_LABEL: Record<InstagramMensaje["autor"], string> = {
  CLIENTE: "",
  ASISTENTE: "Asistente",
  PERSONA: "",
  OTRO: "ManyChat o el celular",
};

const RAZON: Record<string, string> = {
  fuera_de_ventana: "pasó la ventana de Instagram",
  tomada: "la tomó una persona",
  contesto_otro: "escribió ManyChat o una persona hace poco",
  derivada: "ya se derivó",
  tope_de_gasto: "se llegó al tope de gasto",
};

/** Lo que decidió el asistente, entre los mensajes (en sombra, lo que habría contestado). */
function Decision({ e }: { e: InstagramEvento }) {
  const que =
    e.resultado === "no_contestado"
      ? `No contestó: ${RAZON[e.razon ?? ""] ?? e.razon}`
      : e.resultado === "sin_respuesta"
        ? "Decidió no contestar"
        : e.resultado === "derivado"
          ? "Derivó a Ventas"
          : e.resultado === "seguimiento"
            ? "Seguimiento del día siguiente"
            : "Contestó";
  return (
    <div className="mx-auto max-w-[85%] rounded-lg border border-dashed border-[var(--color-border)] px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">
      <p>
        {e.sombra && <span className="mr-1 font-semibold text-sky-300">SOMBRA ·</span>}
        {e.sombra && e.resultado !== "no_contestado" ? `Habría: ${que.toLowerCase()}` : que}
        {e.datos.motivo && ` · ${e.datos.motivo}`} · {hora(e.creadoEn)}
      </p>
      {e.sombra && e.datos.mensajes?.map((t, i) => (
        <p key={i} className="mt-1 whitespace-pre-wrap italic">
          «{t}»
        </p>
      ))}
    </div>
  );
}

function Burbuja({ m }: { m: InstagramMensaje }) {
  const nuestro = m.autor !== "CLIENTE";
  const color =
    m.autor === "ASISTENTE"
      ? "bg-sky-800/80 text-white"
      : m.autor === "PERSONA"
        ? "bg-emerald-700/80 text-white"
        : m.autor === "OTRO"
          ? "bg-zinc-600/80 text-white"
          : "bg-[var(--color-bg-card)] text-[var(--color-text-primary)]";
  const quien = m.autor === "PERSONA" ? m.enviadoPor ?? "Voltia" : AUTOR_LABEL[m.autor];
  return (
    <div className={`flex ${nuestro ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${color} ${
          nuestro ? "rounded-br-sm" : "rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{m.texto || "[sin texto]"}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75">
          {quien && <span>{quien} ·</span>}
          <span>{hora(m.enviadoEn)}</span>
        </div>
      </div>
    </div>
  );
}

function NuevoLead({ c, onListo }: { c: InstagramConversacion; onListo: () => void }) {
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(c.nombre ?? (c.usuario ? `@${c.usuario}` : ""));
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState(`Escribió por Instagram${c.usuario ? ` (@${c.usuario})` : ""}.`);
  const crear = useMutation({
    mutationFn: () => crearLeadInstagram(c.id, { clientName: nombre, clientPhone: telefono || null, notes: notas || null }),
    onSuccess: (r) => {
      toast.success(`Lead ${r.code} creado`);
      qc.invalidateQueries({ queryKey: ["instagram-conversaciones"] });
      qc.invalidateQueries({ queryKey: ["instagram-conversacion", c.id] });
      onListo();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo crear el lead"),
  });
  return (
    <div className="space-y-2 border-b border-[var(--color-border)] bg-[var(--color-bg-app)] p-3">
      <p className="text-[12px] text-[var(--color-text-secondary)]">
        El lead queda con el origen {c.desdeAnuncio ? "«Anuncio en Instagram o Facebook»" : "«Redes sociales (sin anuncio)»"}.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" />
        <input className={INPUT} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (si lo dio)" />
      </div>
      <textarea className={`${INPUT} min-h-[56px] resize-y`} value={notas} onChange={(e) => setNotas(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onListo}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => crear.mutate()} disabled={!nombre.trim() || crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear lead"}
        </Button>
      </div>
    </div>
  );
}

function Chat({ id, puedeEditar, onVolver }: { id: string; puedeEditar: boolean; onVolver: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["instagram-conversacion", id],
    queryFn: () => getInstagramConversacion(id),
    refetchInterval: 5000,
  });
  const [texto, setTexto] = useState("");
  const [creandoLead, setCreandoLead] = useState(false);
  const fin = useRef<HTMLDivElement>(null);
  const mensajes = data?.mensajes ?? [];
  const eventos = data?.eventos ?? [];
  const linea = useMemo(
    () =>
      [
        ...mensajes.map((m) => ({ t: m.enviadoEn, m, e: null as InstagramEvento | null })),
        // Lo que sí mandó ya está como mensaje: solo se muestran los "no" y la sombra.
        ...eventos
          .filter((e) => e.sombra || e.resultado === "no_contestado" || e.resultado === "sin_respuesta")
          .map((e) => ({ t: e.creadoEn, m: null as InstagramMensaje | null, e })),
      ].sort((a, b) => a.t.localeCompare(b.t)),
    [mensajes, eventos],
  );

  // Con llaves y sin devolver nada: scrollIntoView devuelve una promesa en los
  // Chrome nuevos y un efecto que devuelve algo que no es función rompe React.
  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  useEffect(() => {
    // Al abrirla queda leída: se refresca el contador de la lista.
    if (data) qc.invalidateQueries({ queryKey: ["instagram-conversaciones"] });
  }, [data?.conversacion.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["instagram-conversacion", id] });
    qc.invalidateQueries({ queryKey: ["instagram-conversaciones"] });
  };
  const enviar = useMutation({
    mutationFn: () => enviarInstagram(id, texto.trim()),
    onSuccess: () => {
      setTexto("");
      invalidar();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo mandar el mensaje"),
  });
  const tomar = useMutation({
    mutationFn: (tomada: boolean) => tomarInstagram(id, tomada),
    onSuccess: (_r, tomada) => {
      toast.success(tomada ? "Tomaste la conversación: el asistente no contesta más" : "El asistente vuelve a contestar");
      invalidar();
    },
    onError: (e) => toast.error(errorDe(e) ?? "No se pudo cambiar"),
  });

  if (!data) {
    return <p className="p-6 text-[13px] text-[var(--color-text-muted)]">Cargando…</p>;
  }
  const c = data.conversacion;
  const e = ESTADO[c.estado];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        <button type="button" onClick={onVolver} className="rounded-md p-1 text-[var(--color-text-muted)] md:hidden" aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--color-text-primary)]">
            {titulo(c)}
            {c.usuario && c.nombre && <span className="ml-1.5 text-[12px] font-normal text-[var(--color-text-muted)]">@{c.usuario}</span>}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            <span className={`mr-1.5 rounded px-1.5 py-0.5 ${e.clase}`}>{e.label}</span>
            {c.estado === "TOMADA" && c.tomadaPor && `${c.tomadaPor} · `}
            {c.estado === "DERIVADA" && c.derivadaMotivo && `${c.derivadaMotivo} · `}
            {c.desdeAnuncio && "Vino de un anuncio · "}
            {c.ventanaAbierta
              ? `Se le puede escribir hasta el ${hora(c.ventanaHasta!)}`
              : "Instagram no deja escribirle hasta que vuelva a escribir"}
          </p>
        </div>
        {c.lead ? (
          <Link to={`/ventas?lead=${c.lead.id}`} className="text-[12px] text-[var(--color-accent)] hover:underline">
            Lead {c.lead.code}
          </Link>
        ) : (
          puedeEditar &&
          !creandoLead && (
            <Button size="sm" variant="ghost" onClick={() => setCreandoLead(true)}>
              <UserPlus size={14} className="mr-1.5" /> Crear lead
            </Button>
          )
        )}
        {puedeEditar &&
          (c.estado === "TOMADA" ? (
            <Button size="sm" variant="ghost" onClick={() => tomar.mutate(false)} disabled={tomar.isPending}>
              <Bot size={14} className="mr-1.5" /> Devolver al asistente
            </Button>
          ) : (
            <Button size="sm" onClick={() => tomar.mutate(true)} disabled={tomar.isPending}>
              <Hand size={14} className="mr-1.5" /> Tomo yo
            </Button>
          ))}
      </div>

      {creandoLead && <NuevoLead c={c} onListo={() => setCreandoLead(false)} />}

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[var(--color-bg-app)] p-4">
        {mensajes.length === 0 && (
          <p className="py-10 text-center text-[12px] text-[var(--color-text-muted)]">Todavía no hay mensajes.</p>
        )}
        {linea.map((x) => (x.m ? <Burbuja key={x.m.id} m={x.m} /> : <Decision key={x.e!.id} e={x.e!} />))}
        <div ref={fin} />
      </div>

      {puedeEditar && (
        <div className="space-y-1.5 border-t border-[var(--color-border)] p-3">
          {c.estado !== "TOMADA" && c.ventanaAbierta && (
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Si contestás sin tomar la conversación, el asistente se calla 30 minutos y después puede volver a contestar.
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              className={`${INPUT} min-h-[44px] flex-1 resize-none`}
              placeholder={c.ventanaAbierta ? "Escribí el mensaje…" : "La ventana de Instagram está cerrada"}
              disabled={!c.ventanaAbierta}
              maxLength={1000}
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" && !ev.shiftKey && texto.trim() && !enviar.isPending) {
                  ev.preventDefault();
                  enviar.mutate();
                }
              }}
            />
            <Button size="sm" onClick={() => enviar.mutate()} disabled={!c.ventanaAbierta || !texto.trim() || enviar.isPending}>
              <Send size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type Filtro = "todas" | "sinLeer" | "derivadas" | "tomadas";

function BandejaInstagram() {
  const puedeEditar = usePermission("MARKETING", "EDIT");
  const { data: conversaciones = [], isLoading } = useQuery({
    queryKey: ["instagram-conversaciones"],
    queryFn: getInstagramConversaciones,
    refetchInterval: 10_000,
  });
  const [abierta, setAbierta] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [buscar, setBuscar] = useState("");

  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return conversaciones.filter((c) => {
      if (filtro === "sinLeer" && c.noLeidos === 0) return false;
      if (filtro === "derivadas" && c.estado !== "DERIVADA") return false;
      if (filtro === "tomadas" && c.estado !== "TOMADA") return false;
      if (!q) return true;
      return [c.nombre, c.usuario, c.ultimoTexto].some((x) => x?.toLowerCase().includes(q));
    });
  }, [conversaciones, filtro, buscar]);

  const cuenta = (f: Filtro) =>
    f === "sinLeer"
      ? conversaciones.filter((c) => c.noLeidos > 0).length
      : f === "derivadas"
        ? conversaciones.filter((c) => c.estado === "DERIVADA").length
        : f === "tomadas"
          ? conversaciones.filter((c) => c.estado === "TOMADA").length
          : conversaciones.length;

  return (
    <div className="space-y-2">
      <div className="flex h-[calc(100vh-230px)] min-h-[480px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <aside
          className={`w-full flex-col border-r border-[var(--color-border)] md:flex md:w-[340px] md:shrink-0 ${
            abierta ? "hidden" : "flex"
          }`}
        >
          <div className="space-y-2 border-b border-[var(--color-border)] p-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--color-text-muted)]" />
              <input className={`${INPUT} pl-8`} placeholder="Buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1 text-[11px]">
              {(
                [
                  ["todas", "Todas"],
                  ["sinLeer", "Sin leer"],
                  ["derivadas", "Derivadas"],
                  ["tomadas", "Tomadas"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFiltro(k)}
                  className={`rounded-md px-2 py-1 ${
                    filtro === k
                      ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
                  }`}
                >
                  {label} <span className="opacity-60">{cuenta(k)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && <p className="p-4 text-[12px] text-[var(--color-text-muted)]">Cargando…</p>}
            {!isLoading && visibles.length === 0 && (
              <p className="p-4 text-[12px] text-[var(--color-text-muted)]">No hay conversaciones.</p>
            )}
            {visibles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setAbierta(c.id)}
                className={`block w-full border-b border-[var(--color-border)] px-3 py-2.5 text-left hover:bg-[var(--color-bg-app)] ${
                  abierta === c.id ? "bg-[var(--color-bg-app)]" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-[13px] ${c.noLeidos > 0 ? "font-semibold" : ""} text-[var(--color-text-primary)]`}>
                    {titulo(c)}
                  </p>
                  <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">{cuando(c.ultimoMensajeEn)}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-text-muted)]">
                    {c.ultimoAutor && c.ultimoAutor !== "CLIENTE" && (c.ultimoAutor === "ASISTENTE" ? "Asistente: " : "Voltia: ")}
                    {c.ultimoTexto}
                  </p>
                  {c.desdeAnuncio && <Megaphone size={11} className="shrink-0 text-[var(--color-text-muted)]" aria-label="Vino de un anuncio" />}
                  {c.estado !== "ASISTENTE" && (
                    <span className={`shrink-0 rounded px-1 text-[10px] ${ESTADO[c.estado].clase}`}>{ESTADO[c.estado].label}</span>
                  )}
                  {c.noLeidos > 0 && (
                    <span className="shrink-0 rounded-full bg-[var(--color-accent)] px-1.5 text-[10px] font-semibold text-white">
                      {c.noLeidos}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </aside>
        <section className={`min-w-0 flex-1 flex-col md:flex ${abierta ? "flex" : "hidden"}`}>
          {abierta ? (
            <Chat key={abierta} id={abierta} puedeEditar={puedeEditar} onVolver={() => setAbierta(null)} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--color-text-muted)]">
              Elegí una conversación
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type Vista = "conversaciones" | "automatizaciones" | "contactos" | "consultas";

function Instagram() {
  const puedeEditar = usePermission("MARKETING", "EDIT");
  const [vista, setVista] = useState<Vista>("conversaciones");
  return (
    <div className="space-y-2">
      <EstadoAsistente />
      <div className="flex flex-wrap gap-1 text-[12px]">
        {(
          [
            ["conversaciones", "Conversaciones"],
            ["automatizaciones", "Automatizaciones"],
            ["contactos", "Contactos"],
            ["consultas", "Consultas por día"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setVista(k)}
            className={`rounded-md px-2.5 py-1 ${
              vista === k
                ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {vista === "conversaciones" && <BandejaInstagram />}
      {vista === "automatizaciones" && <Automatizaciones puedeEditar={puedeEditar} />}
      {vista === "contactos" && <Contactos />}
      {vista === "consultas" && <Consultas />}
    </div>
  );
}

export function Marketing() {
  const [canal, setCanal] = useState<"instagram" | "whatsapp">("instagram");
  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="flex items-center gap-2 font-display text-xl font-bold text-[var(--color-text-primary)]">
          <Megaphone className="h-5 w-5 text-[var(--color-accent)]" /> Marketing
        </h1>
        <div className="flex gap-1 text-[13px]">
          <button
            type="button"
            onClick={() => setCanal("instagram")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 ${
              canal === "instagram"
                ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
            }`}
          >
            <AtSign size={14} /> Instagram
          </button>
          <button
            type="button"
            disabled
            title="Próximamente: los WhatsApp que llegan por los anuncios"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-2.5 py-1 text-[var(--color-text-muted)] opacity-60"
          >
            <MessageCircle size={14} /> WhatsApp <span className="text-[10px]">(próximamente)</span>
          </button>
        </div>
      </div>
      {canal === "instagram" && <Instagram />}
    </div>
  );
}

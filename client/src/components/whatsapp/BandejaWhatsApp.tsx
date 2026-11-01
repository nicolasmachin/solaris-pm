import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { AlertTriangle, Check, CheckCheck, Clock, Link2, Plus, Search, Send, Smartphone, X } from "lucide-react";

import { getClientes } from "../../api/clientes.api";
import type {
  EnviarWhatsAppBody,
  WhatsAppBandeja,
  WhatsAppCliente,
  WhatsAppMensaje,
  WhatsAppPlantilla,
} from "../../api/whatsapp.api";
import { Button } from "../ui/Button";

/**
 * Bandeja de WhatsApp de un área: a la izquierda las conversaciones del número
 * (con los no leídos y los sin contestar), a la derecha el chat. Hoy la usa
 * Experiencia Solar con el número general; la misma pieza sirve para el número
 * de cada asesor en Ventas, cambiando las llamadas (`BandejaApi`).
 */
export type BandejaApi = {
  /** Prefijo de las claves de caché, distinto por bandeja. */
  clave: string;
  getBandeja: () => Promise<WhatsAppBandeja>;
  getConversacion: (telefono: string) => Promise<{ mensajes: WhatsAppMensaje[]; cliente: WhatsAppCliente | null }>;
  marcarLeida: (telefono: string) => Promise<void>;
  marcarResuelta: (telefono: string) => Promise<void>;
  asociarCliente: (telefono: string, projectId: string | null) => Promise<unknown>;
  enviar: (body: EnviarWhatsAppBody) => Promise<unknown>;
  getPlantillas: () => Promise<WhatsAppPlantilla[]>;
};

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const INPUT =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]";

function cantidadHuecos(texto: string | undefined): number {
  const nums = [...(texto ?? "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function cuerpoDe(p: WhatsAppPlantilla | undefined): string | undefined {
  return p?.components?.find((c) => c.type === "BODY")?.text;
}

function hora(iso: string) {
  return new Date(iso).toLocaleString("es-UY", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Normaliza lo que se escribe a mano: 098 123 456 → 59898123456. */
export function normalizarNumero(texto: string): string {
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("09")) d = `598${d.slice(1)}`;
  else if (d.length === 8 && d.startsWith("9")) d = `598${d}`;
  return d;
}

export function Tildes({ m }: { m: WhatsAppMensaje }) {
  if (m.direccion !== "SALIENTE") return null;
  const titulo: Record<string, string> = {
    accepted: "Aceptado por Meta",
    sent: "Enviado",
    delivered: "Entregado",
    read: "Leído",
    failed: "No se entregó",
  };
  const t = titulo[m.estado ?? ""] ?? m.estado ?? "";
  if (m.estado === "failed") return <X size={13} className="text-[var(--color-danger-text)]" aria-label={t} />;
  if (m.estado === "read") return <CheckCheck size={13} className="text-sky-400" aria-label={t} />;
  if (m.estado === "delivered") return <CheckCheck size={13} className="opacity-70" aria-label={t} />;
  if (m.estado === "sent") return <Check size={13} className="opacity-70" aria-label={t} />;
  return <Clock size={12} className="opacity-60" aria-label={t} />;
}

export function Burbuja({ m, chica = false }: { m: WhatsAppMensaje; chica?: boolean }) {
  const saliente = m.direccion === "SALIENTE";
  return (
    <div className={`flex ${saliente ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 leading-relaxed ${chica ? "text-[12px]" : "text-[13px]"} ${
          saliente
            ? "rounded-br-sm bg-emerald-700/80 text-white"
            : "rounded-bl-sm bg-[var(--color-bg-card)] text-[var(--color-text-primary)]"
        }`}
      >
        {m.plantilla && (
          <p className="mb-0.5 font-mono text-[10px] uppercase tracking-wide opacity-75">Plantilla · {m.plantilla}</p>
        )}
        <p className="whitespace-pre-wrap break-words">{m.texto ?? (m.plantilla ? "" : `[${m.tipo}]`)}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-75">
          {m.origen === "CELULAR" && (
            <span className="inline-flex items-center gap-0.5" title="Escrito desde el celular">
              <Smartphone size={10} /> ·
            </span>
          )}
          {m.enviadoPor && <span>{m.enviadoPor} ·</span>}
          <span>{hora(m.ocurridoEn)}</span>
          <Tildes m={m} />
        </div>
        {m.error && <p className="mt-1 text-[11px] text-red-200">{m.error}</p>}
      </div>
    </div>
  );
}

/** Buscador de clientes de Experiencia Solar para asociar una conversación. */
function AsociarCliente({ onElegir, onCancelar }: { onElegir: (projectId: string) => void; onCancelar: () => void }) {
  const [q, setQ] = useState("");
  const { data } = useQuery({ queryKey: ["clientes", {}, 1, 200], queryFn: () => getClientes({}, 1, 200) });
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const todos = data?.items ?? [];
    return (t ? todos.filter((c) => c.nombre.toLowerCase().includes(t) || (c.telefono ?? "").includes(t)) : todos).slice(0, 8);
  }, [data, q]);
  return (
    <div className="mt-2 space-y-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-2">
      <div className="flex items-center gap-1">
        <Search size={14} className="text-[var(--color-text-muted)]" />
        <input autoFocus className={INPUT} placeholder="Buscar cliente" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={onCancelar} className="p-1 text-[var(--color-text-muted)]" aria-label="Cancelar">
          <X size={14} />
        </button>
      </div>
      {items.map((c) => (
        <button
          key={c.projectId}
          type="button"
          onClick={() => onElegir(c.projectId)}
          className="block w-full rounded px-2 py-1 text-left text-[12px] hover:bg-[var(--color-bg-card-hover)]"
        >
          {c.nombre}
          {c.telefono && <span className="text-[var(--color-text-muted)]"> · {c.telefono}</span>}
        </button>
      ))}
    </div>
  );
}

function Conversacion({
  api,
  telefono,
  ventanaAbierta,
  sinContestar,
  plantillas,
}: {
  api: BandejaApi;
  telefono: string;
  ventanaAbierta: boolean;
  sinContestar: boolean;
  plantillas: WhatsAppPlantilla[];
}) {
  const qc = useQueryClient();
  const claveConv = [api.clave, "conversacion", telefono];
  const { data } = useQuery({
    queryKey: claveConv,
    queryFn: () => api.getConversacion(telefono),
    refetchInterval: 4000,
  });
  const mensajes = data?.mensajes ?? [];
  const cliente = data?.cliente ?? null;

  const aprobadas = plantillas.filter((p) => p.status === "APPROVED");
  const [modo, setModo] = useState<"plantilla" | "texto">(ventanaAbierta ? "texto" : "plantilla");
  // La ventana se conoce cuando llega la lista: si se abrió desde la ficha, al
  // principio no se sabe. Se acomoda sola mientras nadie haya elegido a mano.
  const [modoElegido, setModoElegido] = useState(false);
  useEffect(() => {
    if (!modoElegido) setModo(ventanaAbierta ? "texto" : "plantilla");
  }, [ventanaAbierta, modoElegido]);
  const [texto, setTexto] = useState("");
  const [plantillaId, setPlantillaId] = useState<string>("");
  const [variables, setVariables] = useState<string[]>([]);
  const [asociando, setAsociando] = useState(false);
  const plantilla = aprobadas.find((p) => p.id === plantillaId) ?? aprobadas[0];
  const huecos = cantidadHuecos(cuerpoDe(plantilla));

  useEffect(() => {
    setVariables((v) => Array.from({ length: huecos }, (_, i) => v[i] ?? ""));
  }, [huecos]);

  const fin = useRef<HTMLDivElement>(null);
  // Con llaves y sin devolver nada: en los Chrome nuevos scrollIntoView devuelve
  // una promesa, y un efecto que devuelve algo que no es una función rompe React.
  useEffect(() => {
    fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: claveConv });
    qc.invalidateQueries({ queryKey: [api.clave, "bandeja"] });
    qc.invalidateQueries({ queryKey: ["whatsapp-proyecto"] });
  };

  const enviar = useMutation({
    mutationFn: () =>
      api.enviar(
        modo === "texto"
          ? { tipo: "texto", telefono, texto }
          : { tipo: "plantilla", telefono, plantilla: plantilla!.name, idioma: plantilla!.language, variables },
      ),
    onSuccess: () => {
      setTexto("");
      toast.success("Mensaje enviado");
      refrescar();
      // El primer mensaje del día a un cliente queda como contacto en su historial.
      if (cliente) {
        qc.invalidateQueries({ queryKey: ["cliente", cliente.projectId] });
        qc.invalidateQueries({ queryKey: ["cliente-timeline", cliente.projectId] });
        qc.invalidateQueries({ queryKey: ["clientes"] });
      }
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo mandar el mensaje"),
  });

  const resolver = useMutation({
    mutationFn: () => api.marcarResuelta(telefono),
    onSuccess: refrescar,
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo marcar"),
  });

  const asociar = useMutation({
    mutationFn: (projectId: string | null) => api.asociarCliente(telefono, projectId),
    onSuccess: () => {
      setAsociando(false);
      refrescar();
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo asociar"),
  });

  const puedeEnviar =
    !enviar.isPending &&
    (modo === "texto" ? ventanaAbierta && texto.trim() !== "" : !!plantilla && variables.every((v) => v.trim() !== ""));

  return (
    <div className="flex min-h-[520px] flex-col">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {cliente ? (
              <p className="font-medium text-[var(--color-text-primary)]">
                <Link to={`/clientes/${cliente.projectId}`} className="hover:underline">
                  {cliente.nombre}
                </Link>{" "}
                <span className="text-[12px] font-normal text-[var(--color-text-muted)]">+{telefono}</span>
              </p>
            ) : (
              <p className="font-medium text-[var(--color-text-primary)]">+{telefono}</p>
            )}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {cliente?.aMano && (
                <>
                  Asociado a mano ·{" "}
                  <button type="button" className="underline" onClick={() => asociar.mutate(null)}>
                    quitar
                  </button>{" "}
                  ·{" "}
                </>
              )}
              {ventanaAbierta
                ? "Escribió en las últimas 24 horas: se le puede mandar texto libre."
                : "No escribió en las últimas 24 horas: solo se le puede mandar una plantilla aprobada."}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {!cliente && !asociando && (
              <Button size="sm" variant="secondary" onClick={() => setAsociando(true)}>
                <Link2 size={14} className="mr-1.5" /> Asociar a un cliente
              </Button>
            )}
            {sinContestar && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => resolver.mutate()}
                disabled={resolver.isPending}
                title="Apaga la alerta de sin contestar hasta que el cliente vuelva a escribir"
              >
                <Check size={14} className="mr-1.5" /> No hace falta contestar
              </Button>
            )}
          </div>
        </div>
        {asociando && <AsociarCliente onElegir={(id) => asociar.mutate(id)} onCancelar={() => setAsociando(false)} />}
      </div>

      <div className="max-h-[60vh] flex-1 space-y-2 overflow-y-auto bg-[var(--color-bg-app)] p-4">
        {mensajes.length === 0 && (
          <p className="py-10 text-center text-[12px] text-[var(--color-text-muted)]">Todavía no hay mensajes.</p>
        )}
        {mensajes.map((m) => (
          <Burbuja key={m.id} m={m} />
        ))}
        <div ref={fin} />
      </div>

      <div className="space-y-2 border-t border-[var(--color-border)] p-3">
        <div className="flex gap-1 text-[12px]">
          {(["texto", "plantilla"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setModo(k);
                setModoElegido(true);
              }}
              className={`rounded-md px-2.5 py-1 ${
                modo === k
                  ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
              }`}
            >
              {k === "plantilla" ? "Plantilla" : "Texto libre"}
            </button>
          ))}
        </div>

        {modo === "plantilla" ? (
          aprobadas.length === 0 ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">No hay plantillas aprobadas todavía.</p>
          ) : (
            <div className="space-y-2">
              <select className={INPUT} value={plantilla?.id ?? ""} onChange={(e) => setPlantillaId(e.target.value)}>
                {aprobadas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.language}
                  </option>
                ))}
              </select>
              {cuerpoDe(plantilla) && (
                <p className="rounded-lg bg-[var(--color-bg-card)] p-2 text-[12px] text-[var(--color-text-secondary)]">
                  {cuerpoDe(plantilla)}
                </p>
              )}
              {variables.map((v, i) => (
                <input
                  key={i}
                  className={INPUT}
                  placeholder={`Valor de {{${i + 1}}}`}
                  value={v}
                  onChange={(e) => setVariables((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
            </div>
          )
        ) : (
          <textarea
            className={`${INPUT} min-h-[64px] resize-none`}
            placeholder={ventanaAbierta ? "Escribí el mensaje…" : "Pasaron más de 24 horas desde su último mensaje: usá una plantilla"}
            disabled={!ventanaAbierta}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={() => enviar.mutate()} disabled={!puedeEnviar}>
            <Send size={14} className="mr-1.5" />
            {enviar.isPending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BandejaWhatsApp({
  api,
  telefonoInicial,
  sinNumero,
}: {
  api: BandejaApi;
  /** Para abrir directo la conversación de un cliente (desde su ficha). */
  telefonoInicial?: string | null;
  /** Qué decir si la bandeja no tiene número conectado. */
  sinNumero: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [api.clave, "bandeja"],
    queryFn: api.getBandeja,
    refetchInterval: 5000,
  });
  const hayNumero = !!data?.numero;
  const conversaciones = data?.conversaciones ?? [];
  const { data: plantillas = [] } = useQuery({
    queryKey: [api.clave, "plantillas"],
    queryFn: api.getPlantillas,
    enabled: hayNumero,
    retry: false,
  });

  const [seleccion, setSeleccion] = useState<string | null>(telefonoInicial ? normalizarNumero(telefonoInicial) : null);
  const [filtro, setFiltro] = useState<"todas" | "sinContestar">("todas");
  const [busqueda, setBusqueda] = useState("");
  const activa = useMemo(() => conversaciones.find((c) => c.telefono === seleccion) ?? null, [conversaciones, seleccion]);

  useEffect(() => {
    if (telefonoInicial) setSeleccion(normalizarNumero(telefonoInicial));
  }, [telefonoInicial]);

  // Abrirla la marca leída (para todos: la bandeja es compartida).
  const leida = useMutation({
    mutationFn: (tel: string) => api.marcarLeida(tel),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.clave, "bandeja"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-proyecto"] });
    },
  });
  useEffect(() => {
    if (activa?.noLeida && !leida.isPending) leida.mutate(activa.telefono);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activa?.telefono, activa?.noLeida]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return conversaciones.filter(
      (c) =>
        (filtro === "todas" || c.sinContestar) &&
        (!q || c.telefono.includes(q.replace(/\D/g, "") || "\u0000") || (c.cliente?.nombre ?? "").toLowerCase().includes(q)),
    );
  }, [conversaciones, filtro, busqueda]);
  const cuantasSinContestar = conversaciones.filter((c) => c.sinContestar).length;

  function abrirNuevo() {
    const d = normalizarNumero(busqueda);
    if (d.length < 10) {
      toast.error("Escribí el número con código de país o como celular uruguayo (098 123 456)");
      return;
    }
    setSeleccion(d);
    setBusqueda("");
  }

  if (!isLoading && !hayNumero) {
    return (
      <div className="flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-warning-bg)] p-3 text-[12px] text-[var(--color-warning-text)]">
        <AlertTriangle size={16} className="shrink-0" />
        <span>{sinNumero}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data?.numero?.telefono && (
        <p className="text-[12px] text-[var(--color-text-muted)]">
          Número: {data.numero.telefono}
          {data.numero.nombre ? ` · ${data.numero.nombre}` : ""}
        </p>
      )}
      <div className="grid overflow-hidden rounded-xl border border-[var(--color-border)] md:grid-cols-[280px_1fr]">
        <div className="border-b border-[var(--color-border)] md:border-b-0 md:border-r">
          <div className="space-y-1.5 border-b border-[var(--color-border)] p-2">
            <div className="flex gap-1">
              <input
                className={INPUT}
                placeholder="Buscar o escribir un número"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && visibles.length === 0 && abrirNuevo()}
              />
              <Button size="sm" variant="secondary" onClick={abrirNuevo} aria-label="Conversación nueva con ese número">
                <Plus size={14} />
              </Button>
            </div>
            <div className="flex gap-1 text-[11px]">
              {(
                [
                  ["todas", "Todas"],
                  ["sinContestar", `Sin contestar${cuantasSinContestar ? ` (${cuantasSinContestar})` : ""}`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFiltro(k)}
                  className={`rounded px-2 py-0.5 ${
                    filtro === k
                      ? "bg-[var(--color-accent)]/15 font-medium text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {visibles.length === 0 && (
              <li className="p-4 text-center text-[12px] text-[var(--color-text-muted)]">
                {isLoading ? "Cargando…" : "Sin conversaciones."}
              </li>
            )}
            {visibles.map((c) => (
              <li key={c.telefono}>
                <button
                  type="button"
                  onClick={() => setSeleccion(c.telefono)}
                  className={`w-full px-3 py-2.5 text-left ${
                    seleccion === c.telefono ? "bg-[var(--color-accent)]/15" : "hover:bg-[var(--color-bg-card)]"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`truncate text-[13px] text-[var(--color-text-primary)] ${c.noLeida ? "font-bold" : "font-medium"}`}
                    >
                      {c.cliente?.nombre ?? `+${c.telefono}`}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--color-text-muted)]">{hora(c.ultimoEn)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-text-secondary)]">
                      {c.ultimaDireccion === "SALIENTE" ? "Voltia: " : ""}
                      {c.ultimoTexto}
                    </p>
                    {c.noLeida && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="No leído" />}
                  </div>
                  {(c.sinContestar || !c.cliente) && (
                    <div className="mt-0.5 flex gap-1">
                      {c.sinContestar && (
                        <span className="rounded bg-[var(--color-danger-bg)] px-1.5 text-[10px] font-medium text-[var(--color-danger-text)]">
                          Sin contestar
                        </span>
                      )}
                      {!c.cliente && (
                        <span className="rounded bg-[var(--color-bg-card)] px-1.5 text-[10px] text-[var(--color-text-muted)]">
                          Sin cliente
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {seleccion ? (
          <Conversacion
            key={seleccion}
            api={api}
            telefono={seleccion}
            ventanaAbierta={activa?.ventanaAbierta ?? false}
            sinContestar={activa?.sinContestar ?? false}
            plantillas={plantillas}
          />
        ) : (
          <div className="flex min-h-[520px] items-center justify-center p-6 text-[13px] text-[var(--color-text-muted)]">
            Elegí una conversación, o escribí un número arriba para empezar una.
          </div>
        )}
      </div>
    </div>
  );
}

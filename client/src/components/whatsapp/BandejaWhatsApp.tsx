import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Link2,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Mic,
  Search,
  Send,
  Smartphone,
  Sticker,
  Video,
  X,
} from "lucide-react";

import { getClientes } from "../../api/clientes.api";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import type {
  EnviarWhatsAppBody,
  WhatsAppBandeja,
  WhatsAppCliente,
  WhatsAppConversacion,
  WhatsAppMensaje,
  WhatsAppPlantilla,
} from "../../api/whatsapp.api";
import "./whatsapp-web.css";

/**
 * Bandeja de WhatsApp de un área, con la apariencia de WhatsApp Web: a la
 * izquierda los chats del número (no leídos, sin contestar), a la derecha el
 * chat abierto. En el celular se ve una cosa por vez, como en WhatsApp. Hoy la
 * usa Experiencia Solar con el número general; la misma pieza sirve para el
 * número de cada asesor en Ventas, cambiando las llamadas (`BandejaApi`).
 *
 * Colores y fondo en `whatsapp-web.css` (variables `--wa-*`, claro y oscuro).
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

function cantidadHuecos(texto: string | undefined): number {
  const nums = [...(texto ?? "").matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function cuerpoDe(p: WhatsAppPlantilla | undefined): string | undefined {
  return p?.components?.find((c) => c.type === "BODY")?.text;
}

/** Normaliza lo que se escribe a mano: 098 123 456 → 59898123456. */
export function normalizarNumero(texto: string): string {
  let d = texto.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && d.startsWith("09")) d = `598${d.slice(1)}`;
  else if (d.length === 8 && d.startsWith("9")) d = `598${d}`;
  return d;
}

// ─── Formatos (como los muestra WhatsApp) ────────────────────────────────────

/** 59899123456 → +598 99 123 456 */
export function formatearTelefono(t: string): string {
  if (t.length === 11 && t.startsWith("598")) return `+598 ${t.slice(3, 5)} ${t.slice(5, 8)} ${t.slice(8)}`;
  return `+${t}`;
}

function horaCorta(iso: string) {
  return new Date(iso).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function inicioDelDia(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Días enteros entre la fecha y hoy (0 = hoy, 1 = ayer). */
function diasAtras(iso: string) {
  return Math.round((inicioDelDia(new Date()) - inicioDelDia(new Date(iso))) / 86_400_000);
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function diaDeSemana(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { weekday: "long" });
}

/** Lo de la derecha de cada chat en la lista: hora, "Ayer", el día o la fecha. */
function cuandoEnLista(iso: string) {
  const d = diasAtras(iso);
  if (d <= 0) return horaCorta(iso);
  if (d === 1) return "Ayer";
  if (d < 7) return diaDeSemana(iso);
  return fechaCorta(iso);
}

/** El separador de día dentro del chat: Hoy, Ayer, el día de la semana o la fecha. */
function etiquetaDia(iso: string) {
  const d = diasAtras(iso);
  if (d <= 0) return "Hoy";
  if (d === 1) return "Ayer";
  if (d < 7) {
    const s = diaDeSemana(iso);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return fechaCorta(iso);
}

function claveDia(iso: string) {
  return new Date(inicioDelDia(new Date(iso))).toISOString();
}

const TIPOS: Record<string, { icono: typeof Camera; texto: string }> = {
  image: { icono: Camera, texto: "Foto" },
  audio: { icono: Mic, texto: "Audio" },
  voice: { icono: Mic, texto: "Audio" },
  video: { icono: Video, texto: "Video" },
  document: { icono: FileText, texto: "Documento" },
  sticker: { icono: Sticker, texto: "Sticker" },
  location: { icono: MapPin, texto: "Ubicación" },
  template: { icono: FileText, texto: "Plantilla" },
};

/** "Foto", "Audio"… con su ícono, para mensajes sin texto. */
function TipoSinTexto({ tipo, tam = 15 }: { tipo: string; tam?: number }) {
  const t = TIPOS[tipo];
  if (!t) return <span>[{tipo}]</span>;
  const Icono = t.icono;
  return (
    <span className="inline-flex items-center gap-1 align-[-2px]">
      <Icono size={tam} strokeWidth={1.8} />
      {t.texto}
    </span>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

const COLORES_AVATAR = [
  ["#ffd279", "#6b4c00"],
  ["#a5e2d1", "#04594a"],
  ["#b7d4ff", "#173f7a"],
  ["#f6b6c4", "#7a1f35"],
  ["#d3c2f5", "#45287a"],
  ["#c4e59c", "#33561a"],
  ["#ffc59e", "#7a3a0e"],
] as const;

function iniciales(nombre: string) {
  const palabras = nombre
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p));
  return palabras
    .slice(0, 2)
    .map((p) => p.match(/\p{L}/u)![0].toUpperCase())
    .join("");
}

function Avatar({ nombre, semilla, tam = 49 }: { nombre: string | null; semilla: string; tam?: number }) {
  const estilo: CSSProperties = { width: tam, height: tam };
  if (!nombre) {
    // Contacto que no es cliente: la silueta gris, como WhatsApp sin foto.
    return (
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wa-avatar-vacio)] text-[var(--wa-avatar-silueta)]"
        style={estilo}
        aria-hidden
      >
        <svg viewBox="0 0 40 40" width={tam} height={tam} fill="currentColor">
          <circle cx="20" cy="15.5" r="7.5" />
          <path d="M5 40c0-8.8 6.7-14.5 15-14.5S35 31.2 35 40z" />
        </svg>
      </div>
    );
  }
  let h = 0;
  for (const ch of semilla) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [fondo, letra] = COLORES_AVATAR[h % COLORES_AVATAR.length];
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ ...estilo, background: fondo, color: letra, fontSize: tam * 0.36 }}
      aria-hidden
    >
      {iniciales(nombre) || "?"}
    </div>
  );
}

// ─── Tildes y burbujas ───────────────────────────────────────────────────────

const TITULO_ESTADO: Record<string, string> = {
  accepted: "Aceptado por Meta, todavía sin enviar",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "No se entregó",
};

function TildesEstado({ estado, tam = 16 }: { estado: string | null | undefined; tam?: number }) {
  const t = TITULO_ESTADO[estado ?? ""] ?? estado ?? "";
  const props = { size: tam, strokeWidth: 1.9, "aria-label": t, className: "shrink-0" };
  if (estado === "failed") return <AlertCircle {...props} size={tam - 2} className="shrink-0 text-[var(--wa-peligro)]" />;
  if (estado === "read") return <CheckCheck {...props} className="shrink-0 text-[var(--wa-leido)]" />;
  if (estado === "delivered") return <CheckCheck {...props} />;
  if (estado === "sent") return <Check {...props} />;
  return <Clock {...props} size={tam - 4} />;
}

export function Tildes({ m }: { m: WhatsAppMensaje }) {
  if (m.direccion !== "SALIENTE") return null;
  return (
    <span title={TITULO_ESTADO[m.estado ?? ""] ?? m.estado ?? ""} className="inline-flex">
      <TildesEstado estado={m.estado} />
    </span>
  );
}

/** La "colita" de la primera burbuja de una tanda. Dibujo propio. */
function Colita({ saliente }: { saliente: boolean }) {
  return (
    <svg
      viewBox="0 0 8 13"
      width="8"
      height="13"
      aria-hidden
      className={`absolute top-0 ${saliente ? "-right-2" : "-left-2 -scale-x-100"}`}
      style={{ color: saliente ? "var(--wa-burbuja-out)" : "var(--wa-burbuja-in)" }}
    >
      <path d="M0 0h6.2C7.6 0 8.3 1.6 7.4 2.7L0 12.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * Un mensaje como burbuja de WhatsApp: verde clara a la derecha lo que mandó
 * Voltia, blanca a la izquierda lo del cliente, con la hora y los tildes abajo a
 * la derecha. `cola` = primera de una tanda del mismo lado (lleva la colita y
 * quién la mandó). Afuera de la bandeja se usa dentro de un `.wa-web`.
 */
export function Burbuja({ m, chica = false, cola = true }: { m: WhatsAppMensaje; chica?: boolean; cola?: boolean }) {
  const saliente = m.direccion === "SALIENTE";
  const celular = m.origen === "CELULAR";
  // Lugar reservado al final del texto para que la hora no lo pise.
  const hueco = 2.9 + (saliente ? 1.15 : 0) + (celular ? 0.9 : 0);
  const conTexto = !!m.texto;
  return (
    <div className={`flex ${saliente ? "justify-end" : "justify-start"} ${cola ? "mt-3 first:mt-0" : "mt-0.5"}`}>
      <div
        className={`relative max-w-[88%] rounded-[7.5px] px-[9px] pb-[7px] pt-[6px] text-[var(--wa-texto)] md:max-w-[65%] ${
          chica ? "text-[12.5px] leading-[17px]" : "text-[14.2px] leading-[19px]"
        } ${cola ? (saliente ? "rounded-tr-none" : "rounded-tl-none") : ""}`}
        style={
          {
            background: saliente ? "var(--wa-burbuja-out)" : "var(--wa-burbuja-in)",
            boxShadow: "var(--wa-sombra)",
            "--wa-hueco": `${hueco}rem`,
          } as CSSProperties
        }
        title={m.enviadoPor ? `Lo mandó ${m.enviadoPor}` : undefined}
      >
        {cola && <Colita saliente={saliente} />}
        {cola && saliente && m.enviadoPor && (
          <p className="mb-0.5 text-[12.5px] font-medium leading-[18px] text-[var(--wa-acento-texto)]">{m.enviadoPor}</p>
        )}
        {m.plantilla && (
          <p
            className={`flex items-center gap-1 text-[12px] leading-[17px] text-[var(--wa-secundario)] ${
              conTexto ? "mb-0.5" : "wa-burbuja-texto"
            }`}
          >
            <FileText size={12} className="shrink-0" /> Plantilla · {m.plantilla}
          </p>
        )}
        {conTexto ? (
          <span className={`whitespace-pre-wrap break-words ${m.error ? "" : "wa-burbuja-texto"}`}>{m.texto}</span>
        ) : (
          !m.plantilla && (
            <span className={`italic text-[var(--wa-secundario)] ${m.error ? "" : "wa-burbuja-texto"}`}>
              <TipoSinTexto tipo={m.tipo} />
            </span>
          )
        )}
        {m.error && (
          <p className="wa-burbuja-texto mt-1 text-[12px] leading-[16px] text-[var(--wa-peligro)]">{m.error}</p>
        )}
        <span className="absolute bottom-[3px] right-[7px] flex items-center gap-[3px] text-[11px] leading-[15px] text-[var(--wa-meta)]">
          {celular && (
            <span title="Escrito desde el celular" className="inline-flex">
              <Smartphone size={11} />
            </span>
          )}
          <span>{horaCorta(m.ocurridoEn)}</span>
          <Tildes m={m} />
        </span>
      </div>
    </div>
  );
}

/** Los mensajes con separadores de día y colitas al empezar cada tanda. */
export function ListaMensajes({ mensajes, chica = false }: { mensajes: WhatsAppMensaje[]; chica?: boolean }) {
  return (
    <>
      {mensajes.map((m, i) => {
        const ant = mensajes[i - 1];
        const diaNuevo = !ant || claveDia(ant.ocurridoEn) !== claveDia(m.ocurridoEn);
        const cola = diaNuevo || ant.direccion !== m.direccion;
        return (
          <Fragment key={m.id}>
            {diaNuevo && (
              <div className={`flex justify-center ${chica ? "my-2" : "sticky top-1 z-10 my-3"}`}>
                <span
                  className="rounded-[7.5px] bg-[var(--wa-dia)] px-3 py-[5px] text-[12.5px] leading-[16px] text-[var(--wa-dia-texto)]"
                  style={{ boxShadow: "var(--wa-sombra)" }}
                >
                  {etiquetaDia(m.ocurridoEn)}
                </span>
              </div>
            )}
            <Burbuja m={m} chica={chica} cola={cola} />
          </Fragment>
        );
      })}
    </>
  );
}

// ─── Piezas chicas ───────────────────────────────────────────────────────────

function BotonIcono({
  titulo,
  onClick,
  children,
  activo = false,
}: {
  titulo: string;
  onClick: () => void;
  children: ReactNode;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--wa-icono)] transition-colors hover:bg-[var(--wa-hover-icono)] ${
        activo ? "bg-[var(--wa-hover-icono)]" : ""
      }`}
    >
      {children}
    </button>
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
    <div
      className="absolute right-3 top-[60px] z-30 w-[min(340px,calc(100%-1.5rem))] rounded-lg bg-[var(--wa-panel)] py-2"
      style={{ boxShadow: "0 2px 5px rgba(11,20,26,.26), 0 2px 10px rgba(11,20,26,.16)" }}
    >
      <div className="mx-3 mb-1 flex items-center gap-2 rounded-lg bg-[var(--wa-buscador)] px-3">
        <Search size={15} className="shrink-0 text-[var(--wa-icono)]" />
        <input
          autoFocus
          className="h-[35px] w-full bg-transparent text-[14px] text-[var(--wa-texto)] outline-none placeholder:text-[var(--wa-secundario)]"
          placeholder="Asociar a un cliente…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" onClick={onCancelar} className="text-[var(--wa-icono)]" aria-label="Cancelar">
          <X size={15} />
        </button>
      </div>
      {items.map((c) => (
        <button
          key={c.projectId}
          type="button"
          onClick={() => onElegir(c.projectId)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--wa-hover)]"
        >
          <Avatar nombre={c.nombre} semilla={c.projectId} tam={32} />
          <span className="min-w-0">
            <span className="block truncate text-[14px]">{c.nombre}</span>
            {c.telefono && <span className="block text-[12px] text-[var(--wa-secundario)]">{c.telefono}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Texto de la plantilla con los {{n}} reemplazados por lo que se va escribiendo. */
function rellenar(cuerpo: string, variables: string[]) {
  return cuerpo.replace(/\{\{(\d+)\}\}/g, (todo, n) => variables[Number(n) - 1]?.trim() || todo);
}

// ─── Chat abierto ────────────────────────────────────────────────────────────

function Conversacion({
  api,
  telefono,
  ventanaAbierta,
  sinContestar,
  plantillas,
  onVolver,
}: {
  api: BandejaApi;
  telefono: string;
  ventanaAbierta: boolean;
  sinContestar: boolean;
  plantillas: WhatsAppPlantilla[];
  onVolver: () => void;
}) {
  const qc = useQueryClient();
  const claveConv = [api.clave, "conversacion", telefono];
  const { data, isLoading } = useQuery({
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
  }, [mensajes.length, modo]);

  // La caja crece con el texto hasta unas 6 líneas, como en WhatsApp.
  const caja = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [texto]);

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
      if (modo === "plantilla" && ventanaAbierta) {
        setModo("texto");
      }
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

  const puedeTexto = !enviar.isPending && ventanaAbierta && texto.trim() !== "";
  const puedePlantilla = !enviar.isPending && !!plantilla && variables.every((v) => v.trim() !== "");

  function elegirModo(k: "texto" | "plantilla") {
    setModo(k);
    setModoElegido(true);
  }

  const nombre = cliente?.nombre ?? formatearTelefono(telefono);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Encabezado del chat */}
      <header className="flex h-[59px] shrink-0 items-center gap-3 border-l border-[var(--wa-borde)] bg-[var(--wa-barra)] px-2 md:px-4">
        <button
          type="button"
          onClick={onVolver}
          className="flex h-10 w-8 items-center justify-center text-[var(--wa-icono)] md:hidden"
          aria-label="Volver a los chats"
        >
          <ArrowLeft size={22} />
        </button>
        <Avatar nombre={cliente?.nombre ?? null} semilla={cliente?.projectId ?? telefono} tam={40} />
        <div className="min-w-0 flex-1">
          {cliente ? (
            <Link
              to={`/clientes/${cliente.projectId}`}
              className="block truncate text-[16px] leading-[21px] text-[var(--wa-texto)] hover:underline"
              title="Abrir la ficha del cliente"
            >
              {nombre}
            </Link>
          ) : (
            <p className="truncate text-[16px] leading-[21px] text-[var(--wa-texto)]">{nombre}</p>
          )}
          <p className="truncate text-[13px] leading-[20px] text-[var(--wa-secundario)]">
            {cliente ? `${formatearTelefono(telefono)} · ${cliente.codigo}` : "No está asociado a un cliente"}
            {cliente?.aMano && (
              <>
                {" · asociado a mano ("}
                <button type="button" className="underline" onClick={() => asociar.mutate(null)}>
                  quitar
                </button>
                {")"}
              </>
            )}
          </p>
        </div>
        {sinContestar && (
          <button
            type="button"
            onClick={() => resolver.mutate()}
            disabled={resolver.isPending}
            title="Apaga la alerta de sin contestar hasta que el cliente vuelva a escribir"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13.5px] text-[var(--wa-acento-texto)] hover:bg-[var(--wa-hover-icono)]"
          >
            <CheckCheck size={18} />
            <span className="hidden lg:inline">No hace falta contestar</span>
          </button>
        )}
        {!cliente && (
          <BotonIcono titulo="Asociar a un cliente" onClick={() => setAsociando((a) => !a)} activo={asociando}>
            <Link2 size={20} />
          </BotonIcono>
        )}
      </header>
      {asociando && <AsociarCliente onElegir={(id) => asociar.mutate(id)} onCancelar={() => setAsociando(false)} />}

      {/* Mensajes */}
      <div className="wa-fondo wa-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1 md:px-[6%]">
        {!isLoading && mensajes.length === 0 && (
          <div className="mt-6 flex justify-center">
            <span
              className="max-w-sm rounded-[7.5px] bg-[var(--wa-aviso)] px-3 py-1.5 text-center text-[12.5px] text-[var(--wa-aviso-texto)]"
              style={{ boxShadow: "var(--wa-sombra)" }}
            >
              Todavía no hay mensajes con {formatearTelefono(telefono)}. El primero tiene que ser una plantilla aprobada.
            </span>
          </div>
        )}
        <ListaMensajes mensajes={mensajes} />
        <div ref={fin} className="h-1" />
      </div>

      {/* Plantillas: se abren arriba de la caja, como un panel adjunto */}
      {modo === "plantilla" && (
        <div className="max-h-[55%] shrink-0 overflow-y-auto border-t border-[var(--wa-borde)] bg-[var(--wa-barra)] px-4 pb-3 pt-2 wa-scroll">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[14px] font-medium text-[var(--wa-texto)]">Mandar una plantilla</p>
            {ventanaAbierta && (
              <button
                type="button"
                onClick={() => elegirModo("texto")}
                className="text-[var(--wa-icono)]"
                aria-label="Cerrar plantillas"
              >
                <X size={18} />
              </button>
            )}
          </div>
          {aprobadas.length === 0 ? (
            <p className="text-[13px] text-[var(--wa-secundario)]">No hay plantillas aprobadas todavía.</p>
          ) : (
            <div className="space-y-2">
              <select
                className="h-[38px] w-full rounded-lg bg-[var(--wa-panel)] px-3 text-[14px] text-[var(--wa-texto)] outline-none"
                value={plantilla?.id ?? ""}
                onChange={(e) => setPlantillaId(e.target.value)}
              >
                {aprobadas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.language}
                  </option>
                ))}
              </select>
              {cuerpoDe(plantilla) && (
                <div className="wa-fondo rounded-lg px-3 py-2">
                  <div className="flex justify-end">
                    <p
                      className="max-w-[90%] whitespace-pre-wrap rounded-[7.5px] rounded-tr-none px-[9px] py-[6px] text-[14px] leading-[19px] text-[var(--wa-texto)]"
                      style={{ background: "var(--wa-burbuja-out)", boxShadow: "var(--wa-sombra)" }}
                    >
                      {rellenar(cuerpoDe(plantilla)!, variables)}
                    </p>
                  </div>
                </div>
              )}
              {variables.map((v, i) => (
                <input
                  key={i}
                  className="h-[38px] w-full rounded-lg bg-[var(--wa-panel)] px-3 text-[14px] text-[var(--wa-texto)] outline-none placeholder:text-[var(--wa-secundario)]"
                  placeholder={`Valor de {{${i + 1}}}`}
                  value={v}
                  onChange={(e) => setVariables((vs) => vs.map((x, j) => (j === i ? e.target.value : x)))}
                />
              ))}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => enviar.mutate()}
                  disabled={!puedePlantilla}
                  className="flex h-9 items-center gap-2 rounded-full bg-[var(--wa-acento)] px-4 text-[14px] font-medium text-white disabled:opacity-50"
                >
                  <Send size={16} />
                  {enviar.isPending ? "Enviando…" : "Enviar plantilla"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Caja para escribir */}
      {/* md:pr-[76px]: el botón flotante del asistente (abajo a la derecha, en todo
          Voltia PM) quedaba arriba del botón de enviar. */}
      <footer className="flex min-h-[62px] shrink-0 items-end gap-1 bg-[var(--wa-barra)] px-2 py-[10px] pb-[max(10px,env(safe-area-inset-bottom))] md:pl-4 md:pr-[76px]">
        <BotonIcono
          titulo="Plantillas"
          onClick={() => elegirModo(modo === "plantilla" && ventanaAbierta ? "texto" : "plantilla")}
          activo={modo === "plantilla"}
        >
          <FileText size={22} />
        </BotonIcono>
        {ventanaAbierta ? (
          <textarea
            ref={caja}
            rows={1}
            className="wa-scroll mx-1 min-h-[42px] flex-1 resize-none rounded-lg bg-[var(--wa-panel)] px-3 py-[10px] text-[15px] leading-[20px] text-[var(--wa-texto)] outline-none placeholder:text-[var(--wa-secundario)]"
            placeholder="Escribí un mensaje"
            value={texto}
            onFocus={() => modo === "plantilla" && !modoElegido && elegirModo("texto")}
            onChange={(e) => {
              setTexto(e.target.value);
              if (modo !== "texto") elegirModo("texto");
            }}
            onKeyDown={(e) => {
              // Enter manda y Shift+Enter baja de línea, como WhatsApp Web. En el
              // celular, Enter baja de línea y se manda con el botón.
              const tactil = window.matchMedia?.("(pointer: coarse)").matches;
              if (e.key === "Enter" && !e.shiftKey && !tactil && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (puedeTexto) enviar.mutate();
              }
            }}
          />
        ) : (
          <div className="mx-1 flex min-h-[42px] flex-1 items-center gap-2 rounded-lg bg-[var(--wa-aviso)] px-3 py-2 text-[13px] leading-[17px] text-[var(--wa-aviso-texto)]">
            <Clock size={16} className="shrink-0" />
            <span>
              Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp solo deja mandar una plantilla
              aprobada.
              {modo !== "plantilla" && (
                <>
                  {" "}
                  <button type="button" className="font-medium underline" onClick={() => elegirModo("plantilla")}>
                    Elegir plantilla
                  </button>
                </>
              )}
            </span>
          </div>
        )}
        {ventanaAbierta && (
          <button
            type="button"
            onClick={() => enviar.mutate()}
            disabled={!puedeTexto}
            aria-label="Enviar"
            title="Enviar"
            className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition-colors ${
              puedeTexto ? "bg-[var(--wa-acento)] text-white" : "text-[var(--wa-icono)]"
            }`}
          >
            <Send size={20} className="translate-x-[1px]" />
          </button>
        )}
      </footer>
    </div>
  );
}

// ─── Lista de chats ──────────────────────────────────────────────────────────

/** "Voltia:" no va: como en WhatsApp, lo propio se reconoce por los tildes. */
function VistaPrevia({ c }: { c: WhatsAppConversacion }) {
  const sinTexto = /^\[(\w+)\]$/.exec(c.ultimoTexto);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-[3px]">
      {c.ultimaDireccion === "SALIENTE" && <TildesEstado estado={c.ultimoEstado} tam={17} />}
      <span className="truncate">{sinTexto ? <TipoSinTexto tipo={sinTexto[1]} tam={14} /> : c.ultimoTexto}</span>
    </span>
  );
}

function FilaChat({ c, activa, onClick }: { c: WhatsAppConversacion; activa: boolean; onClick: () => void }) {
  const noLeidos = c.noLeida ? Math.max(c.noLeidos ?? 1, 1) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[72px] w-full items-center gap-3 pl-3 text-left transition-colors ${
        activa ? "bg-[var(--wa-activo)]" : "hover:bg-[var(--wa-hover)]"
      }`}
    >
      <Avatar nombre={c.cliente?.nombre ?? null} semilla={c.cliente?.projectId ?? c.telefono} />
      <div className="flex h-full min-w-0 flex-1 flex-col justify-center border-b border-[var(--wa-borde)] pr-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[17px] leading-[21px] text-[var(--wa-texto)]">
            {c.cliente?.nombre ?? formatearTelefono(c.telefono)}
          </span>
          <span
            className={`shrink-0 text-[12px] leading-[14px] ${
              noLeidos ? "font-medium text-[var(--wa-acento)]" : "text-[var(--wa-secundario)]"
            }`}
          >
            {cuandoEnLista(c.ultimoEn)}
          </span>
        </div>
        <div className="mt-[3px] flex items-center gap-1.5 text-[14px] leading-[20px] text-[var(--wa-secundario)]">
          <VistaPrevia c={c} />
          {c.sinContestar && (
            <span
              className="shrink-0 rounded-full border border-[var(--wa-peligro)] px-1.5 text-[10.5px] leading-[15px] text-[var(--wa-peligro)]"
              title="El último mensaje es del cliente y nadie le contestó"
            >
              Sin contestar
            </span>
          )}
          {noLeidos > 0 && (
            <span
              className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wa-acento)] px-[5px] text-[12px] font-semibold leading-none text-[var(--wa-badge-texto)]"
              aria-label={`${noLeidos} sin leer`}
            >
              {noLeidos}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

type Filtro = "todos" | "noLeidos" | "sinContestar";

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
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const buscador = useRef<HTMLInputElement>(null);
  const activa = useMemo(() => conversaciones.find((c) => c.telefono === seleccion) ?? null, [conversaciones, seleccion]);

  // En el celular, como WhatsApp: la lista ocupa la pantalla y el chat abierto la
  // tapa entera (con flecha para volver). Mientras está abierto no se mueve la página.
  const [esCelular, setEsCelular] = useState(() => window.matchMedia?.("(max-width: 767px)").matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 767px)");
    if (!mq) return;
    const cambio = () => setEsCelular(mq.matches);
    mq.addEventListener("change", cambio);
    return () => mq.removeEventListener("change", cambio);
  }, []);
  useLockBodyScroll(esCelular && !!seleccion);

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
        (filtro === "todos" || (filtro === "noLeidos" ? c.noLeida : c.sinContestar)) &&
        (!q || c.telefono.includes(q.replace(/\D/g, "") || "\u0000") || (c.cliente?.nombre ?? "").toLowerCase().includes(q)),
    );
  }, [conversaciones, filtro, busqueda]);
  const cuantasNoLeidas = conversaciones.filter((c) => c.noLeida).length;
  const cuantasSinContestar = conversaciones.filter((c) => c.sinContestar).length;

  // Si lo escrito es un número que no tiene chat, se ofrece empezar uno (como WhatsApp).
  const numeroNuevo = normalizarNumero(busqueda);
  const ofrecerNuevo = numeroNuevo.length >= 10 && !conversaciones.some((c) => c.telefono === numeroNuevo);

  function abrirNuevo() {
    if (numeroNuevo.length < 10) {
      toast.error("Escribí el número con código de país o como celular uruguayo (098 123 456)");
      return;
    }
    setSeleccion(numeroNuevo);
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

  const chips: Array<[Filtro, string]> = [
    ["todos", "Todos"],
    ["noLeidos", `No leídos${cuantasNoLeidas ? ` ${cuantasNoLeidas}` : ""}`],
    ["sinContestar", `Sin contestar${cuantasSinContestar ? ` ${cuantasSinContestar}` : ""}`],
  ];

  return (
    <div
      className="wa-web -mx-6 flex overflow-hidden border-y border-[var(--wa-borde)] bg-[var(--wa-panel)] md:mx-0 md:h-[calc(100dvh-13.5rem)] md:min-h-[560px] md:rounded-lg md:border"
      style={{ boxShadow: "0 1px 3px rgba(11,20,26,.12)" }}
    >
      {/* Columna izquierda: chats */}
      <aside
        className={`${seleccion ? "hidden md:flex" : "flex"} w-full min-w-0 flex-col bg-[var(--wa-panel)] md:w-[34%] md:min-w-[300px] md:max-w-[460px]`}
      >
        <header className="flex h-[59px] shrink-0 items-center justify-between gap-2 bg-[var(--wa-barra)] px-4">
          <div className="min-w-0">
            <p className="text-[19px] font-semibold leading-[23px] text-[var(--wa-texto)]">Chats</p>
            {data?.numero?.telefono && (
              <p className="truncate text-[12px] leading-[16px] text-[var(--wa-secundario)]">
                {data.numero.telefono}
                {data.numero.nombre ? ` · ${data.numero.nombre}` : ""}
              </p>
            )}
          </div>
          <BotonIcono titulo="Chat nuevo con un número" onClick={() => buscador.current?.focus()}>
            <MessageSquarePlus size={21} />
          </BotonIcono>
        </header>

        <div className="shrink-0 border-b border-[var(--wa-borde)] px-3 pb-2 pt-[7px]">
          <div className="flex h-[35px] items-center gap-3 rounded-lg bg-[var(--wa-buscador)] px-3">
            <Search size={16} className="shrink-0 text-[var(--wa-icono)]" />
            <input
              ref={buscador}
              className="w-full bg-transparent text-[14px] text-[var(--wa-texto)] outline-none placeholder:text-[var(--wa-secundario)]"
              placeholder="Buscar un chat o escribir un número"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && visibles.length === 0) abrirNuevo();
                if (e.key === "Escape") setBusqueda("");
              }}
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} className="text-[var(--wa-icono)]" aria-label="Borrar búsqueda">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {chips.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltro(k)}
                className={`shrink-0 rounded-full px-3 py-[5px] text-[14px] leading-[20px] transition-colors ${
                  filtro === k
                    ? "bg-[var(--wa-chip-activo)] text-[var(--wa-chip-activo-texto)]"
                    : "bg-[var(--wa-chip)] text-[var(--wa-secundario)] hover:brightness-95"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="wa-scroll min-h-0 flex-1 md:overflow-y-auto">
          {ofrecerNuevo && (
            <li>
              <button
                type="button"
                onClick={abrirNuevo}
                className="flex h-[72px] w-full items-center gap-3 pl-3 text-left hover:bg-[var(--wa-hover)]"
              >
                <div className="flex h-[49px] w-[49px] shrink-0 items-center justify-center rounded-full bg-[var(--wa-acento)] text-white">
                  <MessageSquarePlus size={22} />
                </div>
                <div className="flex h-full min-w-0 flex-1 flex-col justify-center border-b border-[var(--wa-borde)] pr-4">
                  <span className="text-[17px] leading-[21px] text-[var(--wa-texto)]">{formatearTelefono(numeroNuevo)}</span>
                  <span className="text-[14px] text-[var(--wa-secundario)]">Empezar un chat con este número</span>
                </div>
              </button>
            </li>
          )}
          {visibles.length === 0 && !ofrecerNuevo && (
            <li className="px-6 py-10 text-center text-[14px] text-[var(--wa-secundario)]">
              {isLoading
                ? "Cargando…"
                : busqueda
                  ? "No se encontró ningún chat."
                  : filtro === "noLeidos"
                    ? "No hay chats sin leer."
                    : filtro === "sinContestar"
                      ? "No hay chats sin contestar."
                      : "Todavía no hay chats."}
            </li>
          )}
          {visibles.map((c) => (
            <li key={c.telefono}>
              <FilaChat c={c} activa={seleccion === c.telefono} onClick={() => setSeleccion(c.telefono)} />
            </li>
          ))}
        </ul>
      </aside>

      {/* Columna derecha: chat abierto */}
      <section
        className={`${seleccion ? "fixed inset-0 z-[70] flex md:static md:z-auto" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-[var(--wa-panel)]`}
      >
        {seleccion ? (
          <Conversacion
            key={seleccion}
            api={api}
            telefono={seleccion}
            ventanaAbierta={activa?.ventanaAbierta ?? false}
            sinContestar={activa?.sinContestar ?? false}
            plantillas={plantillas}
            onVolver={() => setSeleccion(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center border-b-[6px] border-l border-b-[var(--wa-acento)] border-l-[var(--wa-borde)] bg-[var(--wa-barra)] px-10 text-center">
            <div className="mb-7 flex h-[120px] w-[120px] items-center justify-center rounded-full bg-[var(--wa-panel)] text-[var(--wa-acento)]">
              <MessageCircle size={60} strokeWidth={1.4} />
            </div>
            <p className="text-[30px] font-light leading-[38px] text-[var(--wa-texto)]">WhatsApp de Voltia</p>
            <p className="mt-4 max-w-md text-[14px] leading-[20px] text-[var(--wa-secundario)]">
              Elegí un chat de la izquierda, o escribí un número en el buscador para empezar uno.
              <br />
              Al abrir un chat queda leído para todo el equipo: la bandeja es compartida.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

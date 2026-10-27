import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  ArrowUp,
  Copy,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";

import {
  abrirAdjuntoAsistente,
  borrarConversacionAsistente,
  chatAsistente,
  getEstadoAsistente,
  leerConversacionAsistente,
  listarConversacionesAsistente,
  subirAdjuntoAsistente,
  transcribirAudioAsistente,
  type AdjuntoAsistente,
  type ContextoAsistente,
  type ModeloAsistente,
} from "../../api/asistente.api";

export type EntradaChat =
  | { tipo: "usuario"; texto: string; adjuntos: AdjuntoAsistente[] }
  | { tipo: "asistente"; texto: string; modeloNombre: string; herramientas: string[] }
  | { tipo: "error"; texto: string };

const MODELOS: Array<{ clave: ModeloAsistente; nombre: string; ayuda: string }> = [
  { clave: "auto", nombre: "Automático", ayuda: "Sonnet, y Opus para documentos, listados de preguntas o respuestas a clientes" },
  { clave: "sonnet", nombre: "Sonnet", ayuda: "El de todos los días" },
  { clave: "haiku", nombre: "Haiku", ayuda: "Rápido y barato, para preguntas simples" },
  { clave: "opus", nombre: "Opus", ayuda: "El más capaz, para lo más difícil" },
];

const ACEPTA = ".jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf,.xlsx,.docx,.txt,.csv,.md";
const MAX_ADJUNTOS = 5;
const LS_MODELO = "asistente-modelo";
const LS_GRANDE = "asistente-grande";

type Pendiente = { clave: string; nombre: string; estado: "subiendo" | "listo" | "error"; adjunto?: AdjuntoAsistente };

function errorDeApi(err: unknown) {
  return (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
    ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

function leerLS<T extends string>(clave: string, valido: (v: string) => boolean, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    if (v && valido(v)) return v as T;
  } catch {
    /* sin storage: queda el de por defecto */
  }
  return porDefecto;
}

function guardarLS(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* no pasa nada */
  }
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

function formatoAudio(): { mime: string; ext: string } {
  const opciones: Array<[string, string]> = [
    ["audio/webm;codecs=opus", ".webm"],
    ["audio/webm", ".webm"],
    ["audio/mp4", ".m4a"],
    ["audio/ogg;codecs=opus", ".ogg"],
  ];
  if (typeof MediaRecorder !== "undefined") {
    for (const [mime, ext] of opciones) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
      } catch {
        /* sigue */
      }
    }
  }
  return { mime: "", ext: ".webm" };
}

/** El texto de una respuesta sin los símbolos de Markdown, para leerlo en voz alta. */
function textoParaLeer(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, "")
    .replace(/\|/g, ", ")
    .replace(/[✅⚠️❓🔒👍]/gu, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

function vozEspanol(): SpeechSynthesisVoice | null {
  const voces = window.speechSynthesis?.getVoices() ?? [];
  for (const lang of ["es-UY", "es-AR", "es-419", "es-US", "es-MX", "es-ES"]) {
    const v = voces.find((x) => x.lang.replace("_", "-") === lang);
    if (v) return v;
  }
  return voces.find((x) => x.lang.toLowerCase().startsWith("es")) ?? null;
}

function ChipAdjunto({ nombre, mime, onClick, onQuitar, cargando, error }: {
  nombre: string;
  mime?: string;
  onClick?: () => void;
  onQuitar?: () => void;
  cargando?: boolean;
  error?: boolean;
}) {
  const esImagen = mime ? mime.startsWith("image/") : /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(nombre);
  return (
    <span
      className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
        error
          ? "border-red-400 text-red-500"
          : "border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]"
      }`}
    >
      {cargando ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : esImagen ? (
        <ImageIcon className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <FileText className="h-3.5 w-3.5 shrink-0" />
      )}
      <button type="button" onClick={onClick} disabled={!onClick} className="truncate text-left enabled:hover:underline">
        {nombre}
      </button>
      {onQuitar && (
        <button type="button" onClick={onQuitar} aria-label={`Quitar ${nombre}`} className="shrink-0 hover:text-red-500">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function AsistentePanel({
  entradas,
  setEntradas,
  conversacionId,
  setConversacionId,
  contexto,
  onClose,
}: {
  entradas: EntradaChat[];
  setEntradas: Dispatch<SetStateAction<EntradaChat[]>>;
  conversacionId: string | null;
  setConversacionId: (id: string | null) => void;
  contexto: ContextoAsistente;
  onClose: () => void;
}) {
  const [grande, setGrande] = useState(() => leerLS<string>(LS_GRANDE, (v) => v === "1" || v === "0", "0") === "1");
  const [verHistorial, setVerHistorial] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [modelo, setModelo] = useState<ModeloAsistente>(() =>
    leerLS(LS_MODELO, (v) => MODELOS.some((m) => m.clave === v), "auto" as ModeloAsistente),
  );
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [arrastrando, setArrastrando] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  const [leyendo, setLeyendo] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const grabadora = useRef<MediaRecorder | null>(null);
  const contadorArrastre = useRef(0);
  const qc = useQueryClient();

  const { data: estado } = useQuery({ queryKey: ["asistente-estado"], queryFn: getEstadoAsistente });
  const historialVisible = grande || verHistorial;
  const { data: conversaciones } = useQuery({
    queryKey: ["asistente-conversaciones"],
    queryFn: listarConversacionesAsistente,
    enabled: historialVisible,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entradas, enviando]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Al cerrar el panel: cortar la lectura y la grabación.
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      grabadora.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [texto]);

  // ─── Conversaciones ──────────────────────────────────────────────────────

  function nueva() {
    setConversacionId(null);
    setEntradas([]);
    setPendientes([]);
    setVerHistorial(false);
  }

  async function abrir(id: string) {
    try {
      const c = await leerConversacionAsistente(id);
      setConversacionId(c.id);
      setEntradas(
        c.mensajes.map((m): EntradaChat =>
          m.role === "user"
            ? { tipo: "usuario", texto: m.content, adjuntos: m.adjuntos }
            : { tipo: "asistente", texto: m.content, modeloNombre: m.modelo ?? "", herramientas: m.herramientas },
        ),
      );
      setVerHistorial(false);
    } catch {
      toast.error("No se pudo abrir la conversación");
    }
  }

  async function borrar(id: string) {
    try {
      await borrarConversacionAsistente(id);
      if (id === conversacionId) nueva();
      qc.invalidateQueries({ queryKey: ["asistente-conversaciones"] });
    } catch {
      toast.error("No se pudo borrar la conversación");
    }
  }

  // ─── Adjuntos ────────────────────────────────────────────────────────────

  function adjuntar(archivos: FileList | File[]) {
    const lista = Array.from(archivos);
    const lugar = MAX_ADJUNTOS - pendientes.length;
    if (lista.length > lugar) toast.error(`Hasta ${MAX_ADJUNTOS} archivos por mensaje`);
    for (const archivo of lista.slice(0, Math.max(0, lugar))) {
      const clave = `${Date.now()}-${Math.random()}`;
      const nombre = archivo.name || "captura.png";
      setPendientes((p) => [...p, { clave, nombre, estado: "subiendo" }]);
      const conNombre = archivo.name ? archivo : new File([archivo], nombre, { type: archivo.type });
      subirAdjuntoAsistente(conNombre)
        .then((adjunto) =>
          setPendientes((p) =>
            p.map((x) => (x.clave === clave ? { ...x, estado: "listo", adjunto, nombre: adjunto.nombre } : x)),
          ),
        )
        .catch((err) => {
          toast.error(errorDeApi(err) ?? `No se pudo adjuntar ${nombre}`);
          setPendientes((p) => p.map((x) => (x.clave === clave ? { ...x, estado: "error" } : x)));
        });
    }
  }

  // ─── Voz ─────────────────────────────────────────────────────────────────

  async function microfono() {
    if (grabando) {
      grabadora.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Este navegador no permite grabar audio");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mime, ext } = formatoAudio();
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const partes: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) partes.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGrabando(false);
        const audio = new Blob(partes, { type: rec.mimeType || mime || "audio/webm" });
        if (audio.size < 1000) return;
        setTranscribiendo(true);
        try {
          const r = await transcribirAudioAsistente(audio, `mensaje${ext}`);
          setTexto((t) => (t.trim() ? `${t.trim()} ${r.texto}` : r.texto));
          textareaRef.current?.focus();
        } catch (err) {
          toast.error(errorDeApi(err) ?? "No se pudo transcribir el audio");
        } finally {
          setTranscribiendo(false);
        }
      };
      grabadora.current = rec;
      rec.start();
      setGrabando(true);
    } catch {
      toast.error("No hay permiso para usar el micrófono");
    }
  }

  function escuchar(i: number, md: string) {
    const synth = window.speechSynthesis;
    if (!synth) {
      toast.error("Este navegador no puede leer en voz alta");
      return;
    }
    synth.cancel();
    if (leyendo === i) {
      setLeyendo(null);
      return;
    }
    // De a oraciones: algunos navegadores cortan las lecturas largas.
    const oraciones = textoParaLeer(md).match(/[^.!?]+[.!?]*/g) ?? [];
    const voz = vozEspanol();
    oraciones.forEach((o, n) => {
      const u = new SpeechSynthesisUtterance(o.trim());
      u.lang = voz?.lang ?? "es-UY";
      if (voz) u.voice = voz;
      if (n === oraciones.length - 1) u.onend = () => setLeyendo((x) => (x === i ? null : x));
      synth.speak(u);
    });
    setLeyendo(i);
  }

  // ─── Envío ───────────────────────────────────────────────────────────────

  const subiendo = pendientes.some((p) => p.estado === "subiendo");
  const listos = pendientes.filter((p) => p.estado === "listo" && p.adjunto).map((p) => p.adjunto!);

  async function enviar() {
    const q = texto.trim() || (listos.length ? "Analizá lo que te adjunto." : "");
    if (!q || enviando || subiendo) return;
    setTexto("");
    setPendientes([]);
    setEntradas((prev) => [...prev, { tipo: "usuario", texto: q, adjuntos: listos }]);
    setEnviando(true);
    try {
      // La conversación anterior la tiene el server: va solo el mensaje nuevo.
      const res = await chatAsistente({
        conversacionId,
        mensaje: q,
        adjuntoIds: listos.map((a) => a.id),
        modelo,
        contexto,
      });
      setConversacionId(res.conversacionId);
      qc.invalidateQueries({ queryKey: ["asistente-conversaciones"] });
      setEntradas((prev) => [
        ...prev,
        { tipo: "asistente", texto: res.texto, modeloNombre: res.modeloNombre, herramientas: res.herramientas },
      ]);
      qc.invalidateQueries({ queryKey: ["asistente-estado"] });
    } catch (err) {
      setEntradas((prev) => [...prev, { tipo: "error", texto: errorDeApi(err) ?? "No se pudo obtener la respuesta." }]);
    } finally {
      setEnviando(false);
    }
  }

  const etiquetaContexto = contexto.leadId
    ? "Con el lead abierto en pantalla"
    : contexto.projectId
      ? "Con el proyecto abierto en pantalla"
      : null;

  const botonIcono =
    "rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]";

  const listaConversaciones = (
    <div className="flex h-full flex-col">
      <button
        onClick={nueva}
        className="mx-2 mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-card-hover)]"
      >
        <Plus className="h-4 w-4" /> Nueva conversación
      </button>
      <p className="px-4 pb-1 pt-3 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Recientes</p>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {conversaciones?.length === 0 && (
          <p className="px-2 py-4 text-xs text-[var(--color-text-muted)]">Todavía no hay conversaciones.</p>
        )}
        {conversaciones?.map((c) => (
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 hover:bg-[var(--color-bg-card-hover)] ${
              c.id === conversacionId ? "bg-[var(--color-bg-card-hover)]" : ""
            }`}
          >
            <button onClick={() => void abrir(c.id)} className="min-w-0 flex-1 text-left" title={c.titulo}>
              <p className="truncate text-sm text-[var(--color-text-primary)]">{c.titulo}</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{fechaCorta(c.actualizada)}</p>
            </button>
            <button
              onClick={() => void borrar(c.id)}
              title="Borrar conversación"
              className="rounded p-1 text-[var(--color-text-muted)] hover:text-red-500 md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <p className="border-t border-[var(--color-border)] px-4 py-2 text-[10px] text-[var(--color-text-muted)]">
        Solo vos ves tus conversaciones.
      </p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[56] flex justify-end bg-black/30"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative flex h-full w-full bg-[var(--color-bg-app)] shadow-2xl ${
          grande ? "" : "max-w-2xl border-l border-[var(--color-border)]"
        }`}
        onDragEnter={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          contadorArrastre.current += 1;
          setArrastrando(true);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        }}
        onDragLeave={() => {
          contadorArrastre.current -= 1;
          if (contadorArrastre.current <= 0) setArrastrando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          contadorArrastre.current = 0;
          setArrastrando(false);
          if (e.dataTransfer.files.length) adjuntar(e.dataTransfer.files);
        }}
      >
        {/* Historial: fijo a la izquierda en pantalla completa, desplegable en el panel. */}
        {grande && (
          <aside className="hidden w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-bg-card)] md:block">
            {listaConversaciones}
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-1">
              {!grande && (
                <button
                  onClick={() => setVerHistorial((v) => !v)}
                  title="Conversaciones"
                  className={`${botonIcono} ${verHistorial ? "bg-[var(--color-bg-card-hover)] text-[var(--color-text-primary)]" : ""}`}
                >
                  <History className="h-4 w-4" />
                </button>
              )}
              <h2 className="flex items-center gap-2 truncate px-1 text-sm font-medium text-[var(--color-text-primary)]">
                <Sparkles className="h-4 w-4 shrink-0 text-violet-400" />
                Asistente Voltia
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button onClick={nueva} title="Nueva conversación" className={botonIcono}>
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  guardarLS(LS_GRANDE, grande ? "0" : "1");
                  setGrande(!grande);
                  setVerHistorial(false);
                }}
                title={grande ? "Achicar" : "Pantalla completa"}
                className={`${botonIcono} hidden md:block`}
              >
                {grande ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button onClick={onClose} aria-label="Cerrar" className={botonIcono}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          {estado && !estado.habilitado && (
            <p className="mx-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              El asistente no está configurado en este server.
            </p>
          )}

          {verHistorial && !grande ? (
            <div className="min-h-0 flex-1 border-t border-[var(--color-border)]">{listaConversaciones}</div>
          ) : (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
                {entradas.length === 0 && (
                  <div className="pt-[18vh] text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-violet-400" />
                    <p className="mt-3 text-xl font-medium text-[var(--color-text-primary)]">¿En qué te ayudo?</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Sabe cómo trabaja Voltia y consulta los datos reales de Voltia PM. Revisá lo que te dice antes de
                      mandárselo a un cliente.
                    </p>
                  </div>
                )}

                {entradas.map((e, i) => {
                  if (e.tipo === "usuario") {
                    return (
                      <div key={i} className="flex flex-col items-end gap-1.5">
                        {e.adjuntos.length > 0 && (
                          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
                            {e.adjuntos.map((a) => (
                              <ChipAdjunto
                                key={a.id}
                                nombre={a.nombre}
                                mime={a.mimeType}
                                onClick={() => void abrirAdjuntoAsistente(a.id).catch(() => toast.error("No se pudo abrir"))}
                              />
                            ))}
                          </div>
                        )}
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-[var(--color-bg-card)] px-4 py-2.5 text-sm text-[var(--color-text-primary)]">
                          {e.texto}
                        </div>
                      </div>
                    );
                  }
                  if (e.tipo === "error") {
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {e.texto}
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex gap-3">
                      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-violet-400" />
                      <div className="min-w-0 flex-1">
                        <div className="asistente-md text-[15px] leading-relaxed text-[var(--color-text-primary)]">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.texto}</ReactMarkdown>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-[var(--color-text-muted)]">
                          <button
                            onClick={() => void navigator.clipboard.writeText(e.texto).then(() => toast.success("Copiado"))}
                            title="Copiar"
                            className={botonIcono}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => escuchar(i, e.texto)}
                            title={leyendo === i ? "Dejar de leer" : "Escuchar"}
                            className={`${botonIcono} ${leyendo === i ? "text-violet-500" : ""}`}
                          >
                            {leyendo === i ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                          </button>
                          {e.modeloNombre && <span className="ml-1">{e.modeloNombre}</span>}
                          {e.herramientas.length > 0 && (
                            <span className="ml-1" title={e.herramientas.join(", ")}>
                              · Consultó Voltia PM ({e.herramientas.length})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {enviando && (
                  <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)]">
                    <Sparkles className="h-4 w-4 animate-pulse text-violet-400" />
                    Pensando y consultando Voltia PM…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Caja de mensaje */}
          <div className="px-4 pb-4 pt-1">
            <div className="mx-auto max-w-3xl">
              {etiquetaContexto && <p className="mb-1.5 px-1 text-[11px] text-violet-500">{etiquetaContexto}</p>}
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-sm focus-within:border-violet-400">
                {pendientes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 pt-3">
                    {pendientes.map((p) => (
                      <ChipAdjunto
                        key={p.clave}
                        nombre={p.nombre}
                        mime={p.adjunto?.mimeType}
                        cargando={p.estado === "subiendo"}
                        error={p.estado === "error"}
                        onQuitar={() => setPendientes((x) => x.filter((y) => y.clave !== p.clave))}
                      />
                    ))}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void enviar();
                    }
                  }}
                  onPaste={(e) => {
                    const archivos = Array.from(e.clipboardData.files);
                    if (archivos.length) {
                      e.preventDefault();
                      adjuntar(archivos);
                    }
                  }}
                  rows={1}
                  placeholder={
                    grabando
                      ? "Grabando… tocá el cuadrado para terminar"
                      : transcribiendo
                        ? "Pasando el audio a texto…"
                        : "Escribile al asistente…"
                  }
                  className="block max-h-60 w-full resize-none bg-transparent px-4 pt-3 text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                  <div className="flex items-center gap-0.5">
                    <input
                      ref={inputArchivo}
                      type="file"
                      multiple
                      accept={ACEPTA}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) adjuntar(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => inputArchivo.current?.click()}
                      title="Adjuntar fotos o documentos (también podés arrastrarlos o pegarlos)"
                      className={botonIcono}
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void microfono()}
                      disabled={transcribiendo}
                      title={grabando ? "Terminar de grabar" : "Mandar un audio"}
                      className={`${botonIcono} ${grabando ? "animate-pulse text-red-500" : ""}`}
                    >
                      {transcribiendo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : grabando ? (
                        <Square className="h-4 w-4 fill-current" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={modelo}
                      onChange={(e) => {
                        const m = e.target.value as ModeloAsistente;
                        setModelo(m);
                        guardarLS(LS_MODELO, m);
                      }}
                      title={MODELOS.find((m) => m.clave === modelo)?.ayuda}
                      className="rounded-md bg-transparent px-1 py-1 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] focus:outline-none"
                    >
                      {MODELOS.map((m) => (
                        <option key={m.clave} value={m.clave}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void enviar()}
                      disabled={enviando || subiendo || (!texto.trim() && listos.length === 0)}
                      aria-label="Enviar"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {arrastrando && (
          <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-violet-400 bg-violet-600/10 backdrop-blur-[1px]">
            <div className="text-center">
              <Paperclip className="mx-auto h-8 w-8 text-violet-400" />
              <p className="mt-2 text-sm font-medium text-[var(--color-text-primary)]">Soltá los archivos para adjuntarlos</p>
              <p className="text-xs text-[var(--color-text-muted)]">Fotos, PDF, Excel, Word · hasta {MAX_ADJUNTOS}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

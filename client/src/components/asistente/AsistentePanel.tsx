import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, ArrowLeft, Copy, History, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  borrarConversacionAsistente,
  chatAsistente,
  getEstadoAsistente,
  leerConversacionAsistente,
  listarConversacionesAsistente,
  type ContextoAsistente,
  type ModeloAsistente,
} from "../../api/asistente.api";

export type EntradaChat =
  | { tipo: "usuario"; texto: string }
  | { tipo: "asistente"; texto: string; modeloNombre: string; herramientas: string[] }
  | { tipo: "error"; texto: string };

const MODELOS: Array<{ clave: ModeloAsistente; nombre: string; ayuda: string }> = [
  { clave: "auto", nombre: "Automático", ayuda: "Sonnet, y Opus para listados de preguntas o respuestas a clientes" },
  { clave: "sonnet", nombre: "Sonnet", ayuda: "El de todos los días" },
  { clave: "haiku", nombre: "Haiku", ayuda: "Rápido y barato, para preguntas simples" },
  { clave: "opus", nombre: "Opus", ayuda: "El más capaz, para lo más difícil" },
];

function errorDeApi(err: unknown) {
  return (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
    ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const LS_MODELO = "asistente-modelo";

function modeloGuardado(): ModeloAsistente {
  try {
    const v = localStorage.getItem(LS_MODELO);
    if (v && MODELOS.some((m) => m.clave === v)) return v as ModeloAsistente;
  } catch {
    /* sin storage: queda el de por defecto */
  }
  return "auto";
}

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "numeric", month: "short" });
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
  const [verHistorial, setVerHistorial] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [modelo, setModelo] = useState<ModeloAsistente>(modeloGuardado);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: estado } = useQuery({ queryKey: ["asistente-estado"], queryFn: getEstadoAsistente });
  const { data: conversaciones } = useQuery({
    queryKey: ["asistente-conversaciones"],
    queryFn: listarConversacionesAsistente,
    enabled: verHistorial,
  });

  function nueva() {
    setConversacionId(null);
    setEntradas([]);
    setVerHistorial(false);
  }

  async function abrir(id: string) {
    try {
      const c = await leerConversacionAsistente(id);
      setConversacionId(c.id);
      setEntradas(
        c.mensajes.map((m): EntradaChat =>
          m.role === "user"
            ? { tipo: "usuario", texto: m.content }
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entradas, enviando]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function cambiarModelo(m: ModeloAsistente) {
    setModelo(m);
    try {
      localStorage.setItem(LS_MODELO, m);
    } catch {
      /* no pasa nada */
    }
  }

  async function enviar(pregunta?: string) {
    const q = (pregunta ?? texto).trim();
    if (!q || enviando) return;
    setTexto("");
    setEntradas((prev) => [...prev, { tipo: "usuario", texto: q }]);
    setEnviando(true);
    try {
      // La conversación anterior la tiene el server: va solo el mensaje nuevo.
      const res = await chatAsistente({ conversacionId, mensaje: q, modelo, contexto });
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
    ? "Usa el lead abierto en pantalla"
    : contexto.projectId
      ? "Usa el proyecto abierto en pantalla"
      : null;

  return (
    <div
      className="fixed inset-0 z-[56] flex justify-end bg-black/20"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-xl flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
              <Sparkles className="h-4 w-4 text-violet-400" />
              Asistente Voltia
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              Sabe cómo trabaja Voltia y consulta los datos reales de Voltia PM. Revisá lo que te dice antes de mandárselo a
              un cliente.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setVerHistorial((v) => !v)}
              title={verHistorial ? "Volver a la conversación" : "Conversaciones anteriores"}
              className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
            >
              {verHistorial ? <ArrowLeft className="h-4 w-4" /> : <History className="h-4 w-4" />}
            </button>
            <button
              onClick={nueva}
              title="Nueva conversación"
              className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {estado && !estado.habilitado && (
          <p className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            El asistente no está configurado en este server.
          </p>
        )}

        {verHistorial && (
          <div className="flex-1 overflow-y-auto px-2 py-3">
            <p className="px-2 pb-2 text-xs text-[var(--color-text-muted)]">Tus conversaciones anteriores. Solo las ves vos.</p>
            {conversaciones?.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-[var(--color-text-muted)]">Todavía no hay conversaciones.</p>
            )}
            {conversaciones?.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-[var(--color-bg-card-hover)] ${c.id === conversacionId ? "bg-violet-600/10" : ""}`}
              >
                <button onClick={() => void abrir(c.id)} className="min-w-0 flex-1 text-left">
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
        )}

        <div ref={scrollRef} className={`flex-1 space-y-4 overflow-y-auto px-4 py-4 ${verHistorial ? "hidden" : ""}`}>
          {entradas.map((e, i) => {
            if (e.tipo === "usuario") {
              return (
                <div key={i} className="ml-8 whitespace-pre-wrap rounded-lg bg-violet-600/10 px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  {e.texto}
                </div>
              );
            }
            if (e.tipo === "error") {
              return (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {e.texto}
                </div>
              );
            }
            return (
              <div key={i} className="group">
                <div className="asistente-md text-sm text-[var(--color-text-primary)]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.texto}</ReactMarkdown>
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                  <span>{e.modeloNombre}</span>
                  {e.herramientas.length > 0 && (
                    <span title={e.herramientas.join(", ")}>
                      Consultó Voltia PM ({e.herramientas.length})
                    </span>
                  )}
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(e.texto).then(() => toast.success("Copiado"));
                    }}
                    className="flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </button>
                </div>
              </div>
            );
          })}

          {enviando && (
            <p className="animate-pulse text-xs text-[var(--color-text-muted)]">
              Pensando y consultando Voltia PM… (puede tardar un poco)
            </p>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
            <label className="flex items-center gap-1">
              Modelo
              <select
                value={modelo}
                onChange={(e) => cambiarModelo(e.target.value as ModeloAsistente)}
                title={MODELOS.find((m) => m.clave === modelo)?.ayuda}
                className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-primary)]"
              >
                {MODELOS.map((m) => (
                  <option key={m.clave} value={m.clave}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>
            {etiquetaContexto && <span className="rounded bg-violet-600/10 px-1.5 py-0.5 text-violet-500">{etiquetaContexto}</span>}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              rows={Math.min(8, Math.max(2, texto.split("\n").length))}
              placeholder="Preguntá o pegá las preguntas de un cliente… (Shift+Enter para nueva línea)"
              className="flex-1 resize-none rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-violet-400 focus:outline-none"
            />
            <button
              onClick={() => void enviar()}
              disabled={enviando || !texto.trim()}
              aria-label="Enviar"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

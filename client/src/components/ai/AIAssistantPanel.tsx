import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, X, Send, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { askAI, getAIStatus } from '../../api/ai.api';

function klass(...p: (string | false | undefined)[]) { return p.filter(Boolean).join(' '); }
function getApiErr(err: unknown) {
  return (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error
    ?? (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

type Message =
  | { type: 'user'; content: string; ts: Date }
  | { type: 'ai'; content: string; sql: string; rowCount: number; costUSD: number; durationMs: number; ts: Date }
  | { type: 'error'; content: string; ts: Date };

const SUGGESTIONS = [
  '¿Cuánto cobré este mes?',
  'Listame los 5 proyectos con más saldo pendiente',
  '¿Qué facturas A_PAGAR vencen esta semana?',
  '¿Qué proveedor concentra la mayor deuda?',
  'Cuántos kWp instalamos en abril',
];

export function AIAssistantPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({
    queryKey: ['ai-status'],
    queryFn: getAIStatus,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { type: 'user', content: q, ts: new Date() }]);
    setLoading(true);
    try {
      const res = await askAI(q);
      setMessages(prev => [...prev, {
        type: 'ai',
        content: res.response,
        sql: res.sql,
        rowCount: res.rowCount,
        costUSD: res.costUSD,
        durationMs: res.durationMs,
        ts: new Date(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        type: 'error',
        content: getApiErr(err) ?? 'Error al procesar la pregunta',
        ts: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-[var(--color-bg-card)] border-l border-[var(--color-border)] h-full flex flex-col shadow-2xl">
        <header className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Asistente Voltia
            </h2>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              Hacé preguntas sobre tus datos en lenguaje natural.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </header>

        {status && !status.enabled && (
          <div className="m-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {status.message}
            </p>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="py-8 text-center text-[var(--color-text-muted)]">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-violet-400" />
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Hola, ¿qué querés saber?</p>
              <p className="text-[11px] mt-1">Probá una pregunta de ejemplo:</p>
              <div className="mt-3 space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="block w-full text-left text-[11px] px-3 py-2 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-secondary)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] px-2">
              <Spinner className="w-4 h-4" />
              <span className="text-xs">Pensando…</span>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
              placeholder="Preguntá algo…"
              disabled={loading || (status && !status.enabled)}
              className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim() || (status && !status.enabled)}
              aria-label="Enviar"
              className={klass(
                'px-3 py-2 rounded-lg text-white transition-colors',
                loading || !input.trim() || (status && !status.enabled)
                  ? 'bg-[var(--color-border)] cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-700',
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
            Las consultas son sólo lectura. El historial queda registrado.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.type === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-violet-600 text-white px-3 py-2 rounded-lg max-w-[85%] text-sm">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.type === 'error') {
    return (
      <div className="flex justify-start">
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-3 py-2 rounded-lg max-w-[85%] text-xs">
          <strong>Error:</strong> {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--color-bg-app)] border border-[var(--color-border)] rounded-lg max-w-[90%] w-full">
        <div className="px-3 py-2 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
          {message.content}
        </div>
        <SqlDetails sql={message.sql} rowCount={message.rowCount} costUSD={message.costUSD} durationMs={message.durationMs} />
      </div>
    </div>
  );
}

function SqlDetails({ sql, rowCount, costUSD, durationMs }: { sql: string; rowCount: number; costUSD: number; durationMs: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-[var(--color-border)]">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        <span className="flex items-center gap-1">
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          Ver SQL
        </span>
        <span>
          {rowCount} fila{rowCount === 1 ? '' : 's'} · USD {costUSD.toFixed(4)} · {durationMs}ms
        </span>
      </button>
      {open && (
        <pre className="px-3 pb-3 text-[10px] font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap overflow-x-auto bg-[var(--color-bg-app)]">
          {sql}
        </pre>
      )}
    </div>
  );
}

import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

import mdRaw from "../content/calculator-memory.md?raw";
import { proposalsV2BuilderApi } from "../api/proposals-v2-builder.api";
import { Spinner } from "../components/ui/Spinner";
import type { MemoriaSingletonValue } from "../types/proposals-v2";

// {{singleton:X}} → [X](singleton:X) para que react-markdown lo parsee como link
// y lo interceptemos en el componente `a` (chip con el valor en vivo).
function preprocess(md: string): string {
  // [\w.]+ y no \w+: las variables de subobjetos van con punto ("b2b.comisionBasePorcentaje").
  return md.replace(/\{\{singleton:([\w.]+)\}\}/g, "[$1](singleton:$1)");
}

function fmtValue(v: MemoriaSingletonValue): string {
  const n = (v.value as number).toLocaleString("es-UY", { maximumFractionDigits: 4 });
  switch (v.unidad) {
    case "%":
      return `${n} %`;
    case "USD":
      return `USD ${n}`;
    case "pesos":
      return `$ ${n}`;
    case "kWh":
      return `${n} kWh`;
    default:
      return n;
  }
}

// Chip visual del valor en vivo de una variable del singleton. Si falta (drift),
// se muestra en color de alerta.
function SingletonChip({ varKey, values }: { varKey: string; values: Record<string, MemoriaSingletonValue> }) {
  const v = values[varKey];
  const missing = !v || v.value == null;
  return (
    <span
      className={`mx-0.5 inline-flex items-center rounded px-1.5 py-0.5 text-[0.8em] font-medium tabular-nums ${
        missing
          ? "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]"
          : "bg-[var(--color-bg-card-hover)] text-[var(--color-text-primary)]"
      }`}
      title={v?.label ?? varKey}
    >
      {v ? `${v.label}: ${missing ? "??" : fmtValue(v)}` : `${varKey}: ??`}
    </span>
  );
}

export function CalculatorMemoryPage() {
  const q = useQuery({
    queryKey: ["proposals-memoria"],
    queryFn: proposalsV2BuilderApi.getCalculatorMemoria,
  });
  const processed = useMemo(() => preprocess(mdRaw), []);
  const values = q.data ?? {};

  const h = (cls: string) => ({ children }: { children?: ReactNode }) => <div className={cls}>{children}</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 py-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold text-[var(--color-text-primary)]">
          Memoria de cálculo
        </h1>
        <Link
          to="/admin"
          className="whitespace-nowrap text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ← Volver a administración
        </Link>
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-[var(--color-text-secondary)]">
          <Spinner size={18} /> Cargando valores…
        </div>
      ) : q.isError ? (
        <p className="text-sm text-[var(--color-danger-text)]">
          No se pudieron cargar los valores del singleton. Recargá la página.
        </p>
      ) : (
        <div className="text-[var(--color-text-secondary)]">
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="mt-6 text-xl font-bold text-[var(--color-text-primary)]">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-6 border-b border-[var(--color-border)] pb-1 text-lg font-semibold text-[var(--color-text-primary)]">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-4 font-semibold text-[var(--color-text-primary)]">{children}</h3>
              ),
              p: ({ children }) => <p className="my-2 text-sm leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-5 list-disc space-y-1 text-sm">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-5 list-decimal space-y-1 text-sm">{children}</ol>,
              strong: ({ children }) => (
                <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>
              ),
              code: ({ children }) => (
                <code className="rounded bg-[var(--color-bg-card-hover)] px-1 py-0.5 font-mono text-xs">
                  {children}
                </code>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-3 border-l-4 border-[var(--color-border)] pl-3 text-sm italic text-[var(--color-text-muted)]">
                  {children}
                </blockquote>
              ),
              hr: h("my-6 border-t border-[var(--color-border)]"),
              a: ({ href, children }) => {
                if (href?.startsWith("singleton:")) {
                  return <SingletonChip varKey={href.slice("singleton:".length)} values={values} />;
                }
                return (
                  <a href={href} target="_blank" rel="noreferrer" className="text-[var(--color-accent)] underline">
                    {children}
                  </a>
                );
              },
            }}
          >
            {processed}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

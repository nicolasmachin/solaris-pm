import { useEffect, useState, type ReactNode } from "react";
import { VERSION } from "../../version";

export function VersionFooter() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-2 right-3 z-30 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-0.5 font-mono text-[10px] tracking-wider text-[var(--color-text-muted)] shadow-sm hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors"
        title="Ver historial de versiones"
      >
        v{VERSION}
      </button>
      {open ? <VersionHistoryModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function VersionHistoryModal({ onClose }: { onClose: () => void }) {
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/CHANGELOG.md", { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setSource(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Historial de versiones
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--color-text-primary)]">
              Voltia PM · v{VERSION}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto px-6 py-4">
          {error ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              No se pudo cargar el historial de versiones.
            </p>
          ) : source == null ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">
              Cargando…
            </p>
          ) : (
            <MarkdownView source={source} />
          )}
        </div>
        <div className="flex items-center justify-end border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-app)]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Renderer markdown mínimo ───────────────────────────────────────────────
// Soporta los elementos que usa el CHANGELOG: h1, h2, h3, listas con "-",
// texto en negrita con **...** y párrafos. Suficiente para esta vista; si
// algún día queremos más fidelidad, meter react-markdown.

function MarkdownView({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];

  function flushBullets() {
    if (bullets.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${blocks.length}`}
        className="my-2 ml-5 list-disc space-y-1 text-sm text-[var(--color-text-secondary)]"
      >
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(
      <p
        key={`p-${blocks.length}`}
        className="my-2 text-sm text-[var(--color-text-secondary)]"
      >
        {renderInline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h1
          key={`h-${blocks.length}`}
          className="mt-1 mb-3 font-display text-lg font-bold text-[var(--color-text-primary)]"
        >
          {renderInline(line.slice(2))}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h2
          key={`h-${blocks.length}`}
          className="mt-5 mb-2 border-t border-[var(--color-border)] pt-3 text-base font-semibold text-[var(--color-text-primary)]"
        >
          {renderInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("#### ")) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h4
          key={`h-${blocks.length}`}
          className="mt-3 mb-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]"
        >
          {renderInline(line.slice(5))}
        </h4>,
      );
    } else if (line.startsWith("### ")) {
      flushBullets();
      flushParagraph();
      blocks.push(
        <h3
          key={`h-${blocks.length}`}
          className="mt-4 mb-2 text-sm font-semibold text-[var(--color-text-primary)]"
        >
          {renderInline(line.slice(4))}
        </h3>,
      );
    } else if (/^\s*-\s+/.test(line)) {
      flushParagraph();
      const indent = line.search(/\S/);
      const content = line.replace(/^\s*-\s+/, "");
      // Sub-bullets (indentados): los mostramos como ítems anidados inline.
      if (indent >= 2) {
        bullets.push(`· ${content}`);
      } else {
        bullets.push(content);
      }
    } else if (line.trim() === "") {
      flushBullets();
      flushParagraph();
    } else {
      paragraph.push(line);
    }
  }
  flushBullets();
  flushParagraph();

  return <div>{blocks}</div>;
}

// Renderiza **negrita** inline. Mantiene el resto como texto.
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[var(--color-text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

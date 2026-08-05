import { useEffect } from "react";
import { Download, X } from "lucide-react";

import {
  CHECKLIST_FOTOS_CIERRE,
  CHECKLIST_FOTOS_DATOS_CIERRE,
  CHECKLIST_FOTOS_INTRO,
  CHECKLIST_FOTOS_SECCIONES,
  CHECKLIST_FOTOS_TOTAL,
} from "./checklistFotosData";

interface Props {
  onClose: () => void;
}

/**
 * Renderiza el detalle resaltando lo que en el PDF va marcado (`**texto**`):
 * es el dato del que depende que la foto sirva.
 */
function Detalle({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("**").map((parte, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-[var(--color-accent)]">
            {parte}
          </strong>
        ) : (
          <span key={i}>{parte}</span>
        ),
      )}
    </>
  );
}

/**
 * Checklist de fotos, para consultar en la obra desde el celular.
 *
 * Se muestra dentro de la app en vez de abrir el PDF: con la app instalada en el
 * iPhone (PWA en modo standalone), abrir un PDF deja al operario sin barra de
 * navegación y sin forma de volver. El PDF sigue disponible para descargar e
 * imprimir, desde el pie de esta misma pantalla.
 */
export function ChecklistFotosModal({ onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full flex-col border-[var(--color-border)] bg-[var(--color-bg-card)] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-lg sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fijo: en el celular es la única salida visible mientras se hace scroll. */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">
              Checklist de fotos para entrega de obra
            </h3>
            <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
              {CHECKLIST_FOTOS_TOTAL} fotos obligatorias · microgeneración solar fotovoltaica
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="tap-target shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)]/30 hover:text-[var(--color-text-primary)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="rounded-lg border-l-2 border-[var(--color-accent)] bg-[var(--color-bg-app)] p-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            {CHECKLIST_FOTOS_INTRO}
          </p>

          {CHECKLIST_FOTOS_SECCIONES.map((seccion) => (
            <section key={seccion.titulo} className="mt-5">
              <h4 className="border-b border-[var(--color-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                {seccion.titulo}
              </h4>
              {seccion.nota && (
                <p className="mt-1 text-[10px] italic text-[var(--color-text-muted)]">
                  {seccion.nota}
                </p>
              )}
              <ul className="mt-2 space-y-2.5">
                {seccion.items.map((item) => (
                  <li key={item.n} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-bg-app)] font-mono text-[10px] text-[var(--color-text-muted)]">
                      {item.n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {item.titulo}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                        <Detalle texto={item.detalle} />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="mt-5">
            <h4 className="border-b border-[var(--color-border)] pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
              Datos para anotar al cerrar
            </h4>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {CHECKLIST_FOTOS_DATOS_CIERRE.map((dato) => (
                <li key={dato} className="text-[11px] text-[var(--color-text-secondary)]">
                  · {dato}
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-5 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
            {CHECKLIST_FOTOS_CIERRE}
          </p>
        </div>

        {/* El PDF sigue siendo el documento que se firma: acá queda para imprimirlo. */}
        <div className="border-t border-[var(--color-border)] p-3">
          <a
            href="/checklist-fotos-entrega-obra.pdf"
            download="Checklist de fotos - entrega de obra.pdf"
            className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]/30"
          >
            <Download size={14} />
            Descargar PDF para firmar
          </a>
        </div>
      </div>
    </div>
  );
}

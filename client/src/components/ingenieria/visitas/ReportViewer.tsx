import type { VisitReportDto } from "../../../api/visitas.api";

const SECTIONS: { key: string; title: string }[] = [
  { key: "datosGenerales", title: "1. Datos generales del sitio" },
  { key: "acometida", title: "2. Acometida y conexión eléctrica" },
  { key: "techo", title: "3. Techo / Superficie de instalación" },
  { key: "espacioInversor", title: "4. Espacio para inversor" },
  { key: "canalizaciones", title: "5. Recorrido de canalizaciones" },
  { key: "observaciones", title: "6. Observaciones especiales" },
  { key: "proximosPasos", title: "7. Próximos pasos sugeridos" },
];

export function ReportViewer({ report }: { report: VisitReportDto }) {
  const content = report.content ?? {};

  return (
    <div className="space-y-4">
      {report.summary && (
        <div className="rounded border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
            Resumen
          </p>
          <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap">
            {report.summary}
          </p>
        </div>
      )}

      {report.changesFromPrevious && (
        <div className="rounded border border-blue-500/30 bg-blue-500/10 p-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-blue-400 mb-1">
            Cambios respecto a la versión anterior
          </p>
          <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap">
            {report.changesFromPrevious}
          </p>
        </div>
      )}

      {report.projectSuggestions.length > 0 && (
        <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-yellow-400">
            Sugerencias para actualizar el proyecto
          </p>
          {report.projectSuggestions.map((s, i) => (
            <div key={i} className="text-xs">
              <p className="text-[var(--color-text-primary)]">
                <strong>{s.field}:</strong>{" "}
                <span className="text-[var(--color-text-muted)]">
                  {String(s.currentValue ?? "—")} → {String(s.suggestedValue ?? "—")}
                </span>{" "}
                <span
                  className={`text-[10px] font-mono uppercase ${
                    s.confidence === "alta"
                      ? "text-emerald-400"
                      : s.confidence === "media"
                        ? "text-yellow-400"
                        : "text-[var(--color-text-muted)]"
                  }`}
                >
                  ({s.confidence})
                </span>
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)]">{s.reason}</p>
            </div>
          ))}
        </div>
      )}

      {SECTIONS.map(({ key, title }) => (
        <Section key={key} title={title} content={content[key] ?? "Sin información relevada todavía"} />
      ))}

      {(report.modelUsed || report.tokensInput || report.tokensOutput || report.costUsd) && (
        <p className="text-[9px] text-[var(--color-text-muted)] font-mono pt-2 border-t border-[var(--color-border)]">
          {report.modelUsed ?? "—"} · {report.tokensInput ?? 0} input + {report.tokensOutput ?? 0} output ·
          USD {report.costUsd?.toFixed(4) ?? "—"}
        </p>
      )}
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <section>
      <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
        {content}
      </p>
    </section>
  );
}

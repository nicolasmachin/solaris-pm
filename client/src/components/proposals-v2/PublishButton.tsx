import { useState } from "react";

import { Button } from "../ui/Button";
import type { MissingField } from "../../lib/proposalDraft";

function scrollToSection(section: string) {
  document.getElementById(`seccion-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Botón "Publicar V{n+1}" con panel de faltantes al hover cuando está bloqueado.
export function PublishButton({
  label,
  missing,
  blocked,
  blockedReason,
  onPublish,
}: {
  label: string;
  missing: MissingField[];
  blocked: boolean;
  blockedReason?: string;
  onPublish: () => void;
}) {
  const [open, setOpen] = useState(false);

  // Agrupar faltantes por sección conservando el orden de aparición.
  const groups: { section: string; sectionLabel: string; items: MissingField[] }[] = [];
  for (const m of missing) {
    let g = groups.find((x) => x.section === m.section);
    if (!g) {
      g = { section: m.section, sectionLabel: m.sectionLabel, items: [] };
      groups.push(g);
    }
    g.items.push(m);
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => blocked && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Button
        size="sm"
        disabled={blocked}
        onClick={onPublish}
        title={blocked && !blockedReason ? `Faltan ${missing.length} campos obligatorios` : undefined}
      >
        {label}
      </Button>

      {blocked && open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 shadow-lg">
          {blockedReason ? (
            <p className="text-xs text-[var(--color-warning-text)]">{blockedReason}</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-primary)]">
                Faltan {missing.length} campo{missing.length === 1 ? "" : "s"} obligatorio{missing.length === 1 ? "" : "s"}
              </p>
              <div className="space-y-2">
                {groups.map((g) => (
                  <div key={g.section}>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      {g.sectionLabel}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {g.items.map((m) => (
                        <li key={m.path}>
                          <button
                            className="text-left text-xs text-[var(--color-accent)] hover:underline"
                            onClick={() => scrollToSection(m.section)}
                          >
                            {m.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

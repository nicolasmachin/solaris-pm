import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Search } from "lucide-react";

import { getAssignableUsers } from "../../../api/users.api";
import { ProjectPicker } from "../../../components/finance/ProjectPicker";
import { useInformeMutations } from "../../../hooks/useInformes";
import type { InformeDetail } from "../../../api/informes.api";

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

interface Props {
  // Si viene, el modal edita ese borrador; si no, crea uno nuevo.
  initial?: InformeDetail | null;
  currentUserId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function InformeCreateModal({ initial, currentUserId, onClose, onSaved }: Props) {
  const isEdit = !!initial;
  const { crear, editar, enviar } = useInformeMutations(initial?.id ?? null);

  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [cuerpo, setCuerpo] = useState(initial?.cuerpo ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [destinatarios, setDestinatarios] = useState<Set<string>>(
    () => new Set((initial?.destinatarios ?? []).map((d) => d.usuario.id)),
  );
  const [search, setSearch] = useState("");

  const { data: usuarios = [] } = useQuery({
    queryKey: ["assignable-users"],
    queryFn: getAssignableUsers,
  });

  // El autor no puede ser destinatario de su propio informe.
  const candidatos = useMemo(() => {
    const q = search.trim().toLowerCase();
    return usuarios
      .filter((u) => u.id !== currentUserId)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [usuarios, currentUserId, search]);

  const busy = crear.isPending || editar.isPending || enviar.isPending;

  function toggle(id: string) {
    setDestinatarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function validar(): string | null {
    if (!titulo.trim()) return "Ingresá un título";
    if (!cuerpo.trim()) return "Ingresá el contenido del informe";
    if (destinatarios.size === 0) return "Elegí al menos un destinatario";
    return null;
  }

  async function guardar(opts: { enviar: boolean }) {
    const err = validar();
    if (err) return;
    const body = {
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      projectId: projectId || null,
      destinatariosIds: [...destinatarios],
    };
    try {
      if (isEdit) {
        await editar.mutateAsync({ id: initial!.id, body });
        if (opts.enviar) await enviar.mutateAsync(initial!.id);
        onSaved(initial!.id);
      } else {
        const creado = await crear.mutateAsync(body);
        if (opts.enviar) await enviar.mutateAsync(creado.id);
        onSaved(creado.id);
      }
      onClose();
    } catch {
      // el toast de error lo maneja la mutación
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[6vh]" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {isEdit ? "Editar borrador" : "Nuevo informe"}
          </h3>
          <button onClick={onClose} className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)]/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className={lbl}>Título *</label>
            <input className={inp} value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </div>
          <div>
            <label className={lbl}>Contenido *</label>
            <textarea className={`${inp} resize-y`} rows={6} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Obra (opcional)</label>
            <ProjectPicker value={projectId} onChange={setProjectId} />
          </div>
          <div>
            <label className={lbl}>Destinatarios * ({destinatarios.size})</label>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="search"
                className={`${inp} pl-8`}
                placeholder="Buscar usuario…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-[var(--color-border)]">
              {candidatos.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-[var(--color-text-muted)]">Sin usuarios</p>
              ) : (
                candidatos.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-[var(--color-border)] px-3 py-1.5 last:border-0 hover:bg-[var(--color-bg-card-hover)]/40"
                  >
                    <input type="checkbox" checked={destinatarios.has(u.id)} onChange={() => toggle(u.id)} />
                    <span className="text-xs text-[var(--color-text-primary)]">{u.name}</span>
                    <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">{u.role}</span>
                  </label>
                ))
              )}
            </div>
            {!isEdit && (
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                Los adjuntos se agregan después, desde el informe (mientras esté en borrador).
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => guardar({ enviar: false })}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar borrador"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => guardar({ enviar: true })}
            className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
          >
            {isEdit ? "Guardar y enviar" : "Crear y enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

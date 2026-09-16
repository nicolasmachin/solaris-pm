import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  addVideosALista,
  bunnyThumbSrc,
  listBunnyColecciones,
  listBunnyVideos,
} from "../../api/capacitacion.api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import { fmtDuracion } from "./capacitacionUi";

// Selector de videos de la biblioteca de Bunny: busca, filtra por colección y
// permite elegir varios de una. Los que ya están en la lista se pueden marcar
// igual — el backend los omite avisando, así no hay duplicados.
export function SelectorBunnyModal({
  open,
  listaId,
  yaEnLista,
  onClose,
}: {
  open: boolean;
  listaId: string;
  yaEnLista: Set<string>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState("");
  const [texto, setTexto] = useState("");
  const [coleccion, setColeccion] = useState("");
  const [page, setPage] = useState(1);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  useLockBodyScroll(open);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["capacitacion", "bunny", { busqueda, coleccion, page }],
    queryFn: () => listBunnyVideos({ page, search: busqueda || undefined, collectionId: coleccion || undefined }),
    enabled: open,
  });
  const { data: colecciones } = useQuery({
    queryKey: ["capacitacion", "bunny", "colecciones"],
    queryFn: listBunnyColecciones,
    enabled: open,
  });

  const agregar = useMutation({
    mutationFn: () => addVideosALista(listaId, [...elegidos]),
    onSuccess: (r) => {
      if (r.agregados > 0) toast.success(`${r.agregados} video(s) agregado(s)`);
      for (const o of r.omitidos) toast.error(`${o.titulo ?? o.bunnyVideoId}: ${o.motivo}`);
      qc.invalidateQueries({ queryKey: ["capacitacion"] });
      setElegidos(new Set());
      onClose();
    },
    onError: () => toast.error("No se pudieron agregar los videos"),
  });

  if (!open) return null;

  const items = data?.items ?? [];
  const totalPaginas = data ? Math.max(1, Math.ceil(data.totalItems / data.itemsPerPage)) : 1;
  const mensajeError =
    (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data ?? null;

  function toggle(guid: string) {
    setElegidos((prev) => {
      const next = new Set(prev);
      if (next.has(guid)) next.delete(guid);
      else next.add(guid);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-app)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="font-display text-lg text-[var(--color-text-primary)]">Agregar videos de Bunny</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setBusqueda(texto.trim());
            }}
            className="flex flex-1 items-center gap-2"
          >
            <div className="relative flex-1">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--color-text-muted)]" />
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por título…"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] py-1.5 pl-8 pr-3 text-sm text-[var(--color-text-primary)]"
              />
            </div>
            <Button size="sm" variant="secondary" type="submit">
              Buscar
            </Button>
          </form>
          {colecciones && colecciones.length > 0 && (
            <select
              value={coleccion}
              onChange={(e) => {
                setPage(1);
                setColeccion(e.target.value);
              }}
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Todas las colecciones</option>
              {colecciones.map((c) => (
                <option key={c.guid} value={c.guid}>
                  {c.name} ({c.videoCount})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size={26} />
            </div>
          ) : isError ? (
            <EmptyState
              title={
                mensajeError?.code === "BUNNY_NO_CONFIGURADO"
                  ? "Falta configurar la conexión con Bunny"
                  : "No pudimos traer los videos de Bunny"
              }
              description={mensajeError?.message}
              icon="⚠"
            />
          ) : items.length === 0 ? (
            <EmptyState title="No hay videos que coincidan" icon="🎬" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((v) => {
                const elegido = elegidos.has(v.guid);
                const yaEsta = yaEnLista.has(v.guid);
                const src = bunnyThumbSrc(v.guid, v.thumbnailFileName, data?.mediaToken);
                const procesando = v.status !== 4;
                return (
                  <button
                    key={v.guid}
                    type="button"
                    disabled={procesando}
                    onClick={() => toggle(v.guid)}
                    className={`overflow-hidden rounded-lg border text-left transition-colors disabled:opacity-50 ${
                      elegido
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
                    }`}
                  >
                    <div className="relative aspect-video w-full bg-[var(--color-border)]">
                      {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      {fmtDuracion(v.length) && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-mono text-white">
                          {fmtDuracion(v.length)}
                        </span>
                      )}
                      {elegido && (
                        <span className="absolute left-1 top-1 rounded-full bg-[var(--color-accent)] p-1 text-gray-900">
                          <Check size={12} />
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5 p-2">
                      <p className="line-clamp-2 text-xs text-[var(--color-text-primary)]">{v.title}</p>
                      {procesando ? (
                        <p className="text-[10px] text-amber-500">Procesándose en Bunny</p>
                      ) : yaEsta ? (
                        <p className="text-[10px] text-[var(--color-text-muted)]">Ya está en esta lista</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            {totalPaginas > 1 && (
              <>
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <span>
                  {page} / {totalPaginas}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= totalPaginas}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={elegidos.size === 0}
              loading={agregar.isPending}
              onClick={() => agregar.mutate()}
            >
              Agregar {elegidos.size > 0 ? `(${elegidos.size})` : ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

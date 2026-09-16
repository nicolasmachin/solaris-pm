import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FolderDown, Plus, Trash2, Upload, Video } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  createLista,
  deleteDocumento,
  deleteLista,
  deleteVideo,
  getSeccion,
  importarColeccion,
  listBunnyColecciones,
  listSecciones,
  reordenarVideos,
  uploadDocumento,
  type ListaConVideos,
} from "../../api/capacitacion.api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { fmtDuracion, fmtPeso, IconoDocumento, Miniatura } from "./capacitacionUi";
import { SelectorBunnyModal } from "./SelectorBunnyModal";

const inputClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]";

// Contenido de un área: sus listas, los videos de cada una y los documentos.
export function GestionContenido() {
  const qc = useQueryClient();
  const [seccionId, setSeccionId] = useState("");
  const [tituloLista, setTituloLista] = useState("");
  const [listaParaVideos, setListaParaVideos] = useState<ListaConVideos | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: secciones } = useQuery({ queryKey: ["capacitacion", "secciones"], queryFn: listSecciones });
  const elegida = seccionId || secciones?.secciones[0]?.id || "";
  const { data, isLoading } = useQuery({
    queryKey: ["capacitacion", "seccion", elegida],
    queryFn: () => getSeccion(elegida),
    enabled: Boolean(elegida),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["capacitacion"] });

  const nuevaLista = useMutation({
    mutationFn: () => createLista(elegida, { titulo: tituloLista.trim() }),
    onSuccess: () => {
      toast.success("Lista creada");
      setTituloLista("");
      invalidar();
    },
    onError: () => toast.error("No se pudo crear la lista"),
  });

  const subir = useMutation({
    mutationFn: (file: File) => uploadDocumento(elegida, file, { titulo: undefined, listaId: null }),
    onSuccess: () => {
      toast.success("Documento subido");
      invalidar();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo subir el documento"),
  });

  const importar = useMutation({
    mutationFn: (body: { collectionId: string; titulo: string }) => importarColeccion(elegida, body),
    onSuccess: (r) => {
      toast.success(`Lista "${r.lista.titulo}" creada con ${r.agregados} video(s)`);
      invalidar();
    },
    onError: () => toast.error("No se pudo importar la colección"),
  });

  const { data: colecciones } = useQuery({
    queryKey: ["capacitacion", "bunny", "colecciones"],
    queryFn: listBunnyColecciones,
    retry: false,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={elegida}
          onChange={(e) => setSeccionId(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
        >
          {(secciones?.secciones ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
              {s.activa ? "" : " (oculta)"}
            </option>
          ))}
        </select>

        <input
          value={tituloLista}
          onChange={(e) => setTituloLista(e.target.value)}
          placeholder="Nueva lista de reproducción…"
          className={`${inputClass} max-w-xs flex-1`}
        />
        <Button
          size="sm"
          disabled={!tituloLista.trim() || !elegida}
          loading={nuevaLista.isPending}
          onClick={() => nuevaLista.mutate()}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Lista
          </span>
        </Button>

        {colecciones && colecciones.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const c = colecciones.find((x) => x.guid === e.target.value);
              if (c) importar.mutate({ collectionId: c.guid, titulo: c.name });
            }}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-muted)]"
          >
            <option value="">Importar colección de Bunny…</option>
            {colecciones.map((c) => (
              <option key={c.guid} value={c.guid}>
                {c.name} ({c.videoCount})
              </option>
            ))}
          </select>
        )}

        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) subir.mutate(f);
            e.target.value = "";
          }}
        />
        <Button size="sm" variant="secondary" loading={subir.isPending} onClick={() => fileRef.current?.click()}>
          <span className="flex items-center gap-1.5">
            <Upload size={14} /> Documento
          </span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={26} />
        </div>
      ) : !data ? (
        <EmptyState title="Elegí un área" />
      ) : (
        <div className="space-y-4">
          {data.listas.length === 0 ? (
            <EmptyState title="Esta área todavía no tiene listas" description="Creá una arriba." icon="🎬" />
          ) : (
            data.listas.map((lista) => (
              <ListaEditable key={lista.id} lista={lista} mediaToken={data.mediaToken} onAgregar={() => setListaParaVideos(lista)} />
            ))
          )}

          <div>
            <h3 className="mb-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
              Documentos del área ({data.documentos.length})
            </h3>
            {data.documentos.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">Sin documentos.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
                {data.documentos.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
                    <IconoDocumento mimeType={doc.mimeType} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--color-text-primary)]">{doc.titulo}</p>
                      <p className="truncate text-[11px] text-[var(--color-text-muted)]">
                        {doc.filename} · {fmtPeso(doc.sizeBytes)}
                      </p>
                    </div>
                    <BotonBorrar
                      confirmacion={`¿Borrar el documento "${doc.titulo}"?`}
                      onBorrar={() => deleteDocumento(doc.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {listaParaVideos && (
        <SelectorBunnyModal
          open
          listaId={listaParaVideos.id}
          yaEnLista={new Set(listaParaVideos.videos.map((v) => v.bunnyVideoId))}
          onClose={() => setListaParaVideos(null)}
        />
      )}
    </div>
  );
}

function ListaEditable({
  lista,
  mediaToken,
  onAgregar,
}: {
  lista: ListaConVideos;
  mediaToken: string;
  onAgregar: () => void;
}) {
  const qc = useQueryClient();
  const invalidar = () => qc.invalidateQueries({ queryKey: ["capacitacion"] });

  const mover = useMutation({
    mutationFn: (ids: string[]) => reordenarVideos(lista.id, ids),
    onSuccess: invalidar,
    onError: () => toast.error("No se pudo cambiar el orden"),
  });

  function moverVideo(i: number, delta: number) {
    const ids = lista.videos.map((v) => v.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    mover.mutate(ids);
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex-1 font-display text-base font-semibold text-[var(--color-text-primary)]">
          {lista.titulo}
        </h3>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {lista.videos.length} {lista.videos.length === 1 ? "video" : "videos"}
        </span>
        <Button size="sm" variant="secondary" onClick={onAgregar}>
          <span className="flex items-center gap-1.5">
            <Video size={14} /> Agregar videos
          </span>
        </Button>
        <BotonBorrar
          confirmacion={`¿Borrar la lista "${lista.titulo}"? Los videos se quitan de la app, no de Bunny.`}
          onBorrar={() => deleteLista(lista.id)}
        />
      </div>

      {lista.videos.length === 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <FolderDown size={13} /> Sin videos. Agregalos desde tu biblioteca de Bunny.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {lista.videos.map((v, i) => (
            <li
              key={v.id}
              className="flex items-center gap-2 rounded-md p-1.5 hover:bg-[var(--color-bg-card-hover)]"
            >
              <span className="w-5 text-center text-[11px] text-[var(--color-text-muted)]">{i + 1}</span>
              <div className="w-24 flex-shrink-0">
                <Miniatura thumbnailUrl={v.thumbnailUrl} mediaToken={mediaToken} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--color-text-primary)]">{v.titulo}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{fmtDuracion(v.duracionSeg) ?? "—"}</p>
              </div>
              <button
                disabled={i === 0}
                onClick={() => moverVideo(i, -1)}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] disabled:opacity-30"
              >
                <ChevronUp size={15} />
              </button>
              <button
                disabled={i === lista.videos.length - 1}
                onClick={() => moverVideo(i, 1)}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-border)] disabled:opacity-30"
              >
                <ChevronDown size={15} />
              </button>
              <BotonBorrar
                confirmacion={`¿Quitar "${v.titulo}" de la lista? No se borra de Bunny.`}
                onBorrar={() => deleteVideo(v.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BotonBorrar({ confirmacion, onBorrar }: { confirmacion: string; onBorrar: () => Promise<void> }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: onBorrar,
    onSuccess: () => {
      toast.success("Listo");
      qc.invalidateQueries({ queryKey: ["capacitacion"] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo borrar"),
  });
  return (
    <button
      disabled={m.isPending}
      onClick={() => {
        if (window.confirm(confirmacion)) m.mutate();
      }}
      className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-red-400 disabled:opacity-40"
    >
      <Trash2 size={15} />
    </button>
  );
}

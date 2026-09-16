import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Eye, PlayCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { docSrc, getSeccion, type DocumentoItem } from "../../api/capacitacion.api";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { AvanceBarra, fmtDuracionLarga, fmtPeso, IconoDocumento, Miniatura } from "./capacitacionUi";

type Tab = "videos" | "documentos";

// Un área por dentro: sus listas de reproducción y sus documentos.
export function CapacitacionSeccion() {
  const { seccionId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("videos");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["capacitacion", "seccion", seccionId],
    queryFn: () => getSeccion(seccionId),
    enabled: Boolean(seccionId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={28} />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        title="No encontramos esta capacitación"
        description="Puede que se haya quitado, o que no esté habilitada para tu rol."
      />
    );
  }

  // Los documentos sin lista son de toda el área; los de una lista se ven
  // también dentro de ella, junto al reproductor.
  const documentos = data.documentos;

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/capacitacion"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft size={14} /> Capacitación
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold text-[var(--color-text-primary)]">{data.nombre}</h1>
        {data.descripcion && <p className="text-sm text-[var(--color-text-muted)]">{data.descripcion}</p>}
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
        {([
          { id: "videos" as const, label: `Videos (${data.listas.length})` },
          { id: "documentos" as const, label: `Documentos (${documentos.length})` },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-[1px] border-b-2 px-4 py-2.5 text-sm transition-colors ${
              tab === t.id
                ? "border-[var(--color-accent)] font-medium text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "videos" &&
        (data.listas.length === 0 ? (
          <EmptyState title="Todavía no hay videos en esta área" icon="🎬" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.listas.map((lista) => {
              const primero = lista.videos[0];
              const duracion = fmtDuracionLarga(lista.duracionTotalSeg);
              return (
                <Link
                  key={lista.id}
                  to={`/capacitacion/lista/${lista.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 transition-colors hover:border-[var(--color-accent)]"
                >
                  <Miniatura
                    thumbnailUrl={primero?.thumbnailUrl ?? null}
                    mediaToken={data.mediaToken}
                    duracionSeg={null}
                  />
                  <div className="flex-1 space-y-1">
                    <h2 className="font-display text-base font-semibold text-[var(--color-text-primary)]">
                      {lista.titulo}
                    </h2>
                    {lista.descripcion && (
                      <p className="line-clamp-2 text-xs text-[var(--color-text-muted)]">{lista.descripcion}</p>
                    )}
                    <p className="flex items-center gap-1 pt-1 text-[11px] text-[var(--color-text-muted)]">
                      <PlayCircle size={12} /> {lista.videos.length}{" "}
                      {lista.videos.length === 1 ? "video" : "videos"}
                      {duracion && ` · ${duracion}`}
                    </p>
                  </div>
                  <AvanceBarra vistos={lista.videosVistos} total={lista.videos.length} />
                </Link>
              );
            })}
          </div>
        ))}

      {tab === "documentos" &&
        (documentos.length === 0 ? (
          <EmptyState title="Todavía no hay documentos en esta área" icon="📄" />
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
            {documentos.map((doc) => (
              <DocumentoFila key={doc.id} doc={doc} mediaToken={data.mediaToken} />
            ))}
          </ul>
        ))}
    </div>
  );
}

export function DocumentoFila({ doc, mediaToken }: { doc: DocumentoItem; mediaToken: string }) {
  // El navegador puede mostrar PDF e imágenes; el resto se baja directamente.
  const previsualizable = doc.mimeType.includes("pdf") || doc.mimeType.startsWith("image/");
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <IconoDocumento mimeType={doc.mimeType} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--color-text-primary)]">{doc.titulo}</p>
        <p className="truncate text-[11px] text-[var(--color-text-muted)]">
          {doc.filename} · {fmtPeso(doc.sizeBytes)}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {previsualizable && (
          <a
            href={docSrc(doc.previewUrl, mediaToken)}
            target="_blank"
            rel="noreferrer"
            title="Ver"
            className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
          >
            <Eye size={16} />
          </a>
        )}
        <a
          href={docSrc(doc.downloadUrl, mediaToken)}
          title="Descargar"
          className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-[var(--color-text-primary)]"
        >
          <Download size={16} />
        </a>
      </div>
    </li>
  );
}

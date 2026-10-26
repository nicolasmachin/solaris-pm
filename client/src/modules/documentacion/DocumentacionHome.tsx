import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Download, Eye, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";

import {
  createDocumento,
  fileSrc,
  getPendientesLectura,
  listDocumentos,
  type DocumentoItem,
} from "../../api/documentacion.api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Sheet } from "../../components/ui/Sheet";
import { Spinner } from "../../components/ui/Spinner";
import { usePermission } from "../../hooks/usePermission";
import { RolesCheckboxes, fmtFecha, inputClass, labelClass, mensajeError } from "./documentacionUi";

// Portada de Documentación: los documentos que el rol puede ver, agrupados por
// categoría, con la versión vigente de cada uno y si falta confirmar la lectura.
export function DocumentacionHome() {
  const puedeGestionar = usePermission("DOCUMENTACION", "EDIT");
  const [nuevo, setNuevo] = useState(false);
  const { data: docs = [], isLoading } = useQuery({ queryKey: ["documentacion", "lista"], queryFn: listDocumentos });
  const { data: pendientes = 0 } = useQuery({
    queryKey: ["documentacion", "pendientes"],
    queryFn: getPendientesLectura,
  });

  const porCategoria = useMemo(() => {
    const m = new Map<string, DocumentoItem[]>();
    for (const d of docs) m.set(d.categoria, [...(m.get(d.categoria) ?? []), d]);
    return [...m.entries()];
  }, [docs]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">Documentación</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Manuales, procedimientos y reglamentos de Voltia, siempre en su última versión.
          </p>
        </div>
        {puedeGestionar && (
          <Button size="sm" onClick={() => setNuevo(true)}>
            <span className="flex items-center gap-1.5">
              <Plus size={14} /> Nuevo documento
            </span>
          </Button>
        )}
      </div>

      {pendientes > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Tenés {pendientes} {pendientes === 1 ? "documento" : "documentos"} con una versión nueva para leer.
          Abrilo y confirmá la lectura al terminar.
        </div>
      )}

      {porCategoria.length === 0 ? (
        <EmptyState
          title="Todavía no hay documentos para tu rol"
          description="Cuando se publique un manual o procedimiento de tu área lo vas a ver acá."
          icon="📘"
        />
      ) : (
        porCategoria.map(([categoria, lista]) => (
          <section key={categoria} className="space-y-3">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {categoria}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((d) => (
                <TarjetaDocumento key={d.id} doc={d} />
              ))}
            </div>
          </section>
        ))
      )}

      {nuevo && (
        <NuevoDocumentoSheet categorias={porCategoria.map(([c]) => c)} onClose={() => setNuevo(false)} />
      )}
    </div>
  );
}

function TarjetaDocumento({ doc }: { doc: DocumentoItem }) {
  const pendiente = doc.requiereLectura && !doc.leida && doc.vigente;
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border bg-[var(--color-bg-card)] p-4 ${
        pendiente ? "border-amber-500/50" : "border-[var(--color-border)]"
      } ${doc.activo ? "" : "opacity-60"}`}
    >
      <div className="flex items-start gap-3">
        <BookOpen size={20} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/documentacion/${doc.id}`}
              className="font-display text-base font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
            >
              {doc.titulo}
            </Link>
            {!doc.activo && (
              <span className="rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]">
                Inactivo
              </span>
            )}
          </div>
          {doc.descripcion && <p className="line-clamp-3 text-xs text-[var(--color-text-muted)]">{doc.descripcion}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
        {doc.vigente ? (
          <>
            <span className="rounded bg-[var(--color-border)] px-1.5 py-0.5 font-mono text-[var(--color-text-secondary)]">
              v{doc.vigente.version}
            </span>
            <span>
              {doc.vigente.vigenteDesde
                ? `vigente desde ${fmtFecha(doc.vigente.vigenteDesde)}`
                : `publicado el ${fmtFecha(doc.vigente.createdAt)}`}
            </span>
          </>
        ) : (
          <span>Sin versiones publicadas</span>
        )}
        {pendiente && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-400">Pendiente de leer</span>
        )}
        {doc.requiereLectura && doc.leida && <span className="text-emerald-400">✓ Leído</span>}
      </div>

      <div className="mt-auto flex gap-2">
        <Link
          to={`/documentacion/${doc.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
        >
          <Eye size={14} /> Ver
        </Link>
        {doc.vigente && (
          <a
            href={fileSrc(doc.vigente.downloadUrl)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text-primary)]"
          >
            <Download size={14} /> Descargar
          </a>
        )}
      </div>
    </div>
  );
}

function NuevoDocumentoSheet({ categorias, onClose }: { categorias: string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [version, setVersion] = useState("1.0");
  const [vigenteDesde, setVigenteDesde] = useState("");
  const [notas, setNotas] = useState("");
  const [requiereLectura, setRequiereLectura] = useState(false);
  const [roleIds, setRoleIds] = useState<string[]>([]);

  const crear = useMutation({
    mutationFn: () =>
      createDocumento(archivo!, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        categoria: categoria.trim(),
        version: version.trim(),
        vigenteDesde,
        notas: notas.trim(),
        requiereLectura,
        roleIds,
      }),
    onSuccess: () => {
      toast.success("Documento publicado");
      qc.invalidateQueries({ queryKey: ["documentacion"] });
      onClose();
    },
    onError: (e) => toast.error(mensajeError(e, "No se pudo publicar el documento")),
  });

  const completo = archivo && titulo.trim() && categoria.trim() && version.trim();

  return (
    <Sheet
      open
      onClose={onClose}
      title="Nuevo documento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!completo} loading={crear.isPending} onClick={() => crear.mutate()}>
            Publicar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Archivo *</label>
          <input
            type="file"
            className="block w-full text-sm text-[var(--color-text-secondary)]"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivo(f);
              if (f && !titulo) setTitulo(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
        </div>
        <div>
          <label className={labelClass}>Título *</label>
          <input className={inputClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Descripción</label>
          <textarea className={inputClass} rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Categoría *</label>
          <input
            className={inputClass}
            list="documentacion-categorias"
            placeholder="Procedimientos, Manuales de trabajo, Reglamentos…"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
          <datalist id="documentacion-categorias">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Versión *</label>
            <input className={inputClass} value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Vigente desde</label>
            <input type="date" className={inputClass} value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Qué cambió (opcional)</label>
          <textarea className={inputClass} rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
          <input type="checkbox" className="mt-1" checked={requiereLectura} onChange={(e) => setRequiereLectura(e.target.checked)} />
          <span>
            Pedir confirmación de lectura
            <span className="block text-[11px] text-[var(--color-text-muted)]">
              Cada versión nueva le pide a la gente de estos roles que confirme que la leyó.
            </span>
          </span>
        </label>
        <div>
          <label className={labelClass}>Quién lo ve</label>
          <RolesCheckboxes value={roleIds} onChange={setRoleIds} />
        </div>
      </div>
    </Sheet>
  );
}

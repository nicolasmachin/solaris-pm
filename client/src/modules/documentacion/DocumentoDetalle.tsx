import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Download, ExternalLink, Pencil, Trash2, Upload } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";

import {
  confirmarLectura,
  deleteDocumento,
  fileSrc,
  getDocumento,
  updateDocumento,
  uploadVersion,
  type DocumentoDetalle as Detalle,
} from "../../api/documentacion.api";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Sheet } from "../../components/ui/Sheet";
import { Spinner } from "../../components/ui/Spinner";
import { usePermission } from "../../hooks/usePermission";
import { RolesCheckboxes, TextoRecortado, fmtFecha, fmtPeso, inputClass, labelClass, mensajeError } from "./documentacionUi";

// Un documento: la versión vigente para leer en pantalla, la confirmación de
// lectura, el historial de versiones y —para quien gestiona— quién leyó,
// subir una versión nueva y editar quién lo ve.
export function DocumentoDetalle() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const puedeGestionar = usePermission("DOCUMENTACION", "EDIT");
  const [subiendo, setSubiendo] = useState(false);
  const [editando, setEditando] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["documentacion", "detalle", id],
    queryFn: () => getDocumento(id),
    enabled: Boolean(id),
  });

  const leer = useMutation({
    mutationFn: () => confirmarLectura(id),
    onSuccess: (r) => {
      toast.success(`Lectura de la versión ${r.version} confirmada`);
      qc.invalidateQueries({ queryKey: ["documentacion"] });
    },
    onError: (e) => toast.error(mensajeError(e, "No se pudo confirmar la lectura")),
  });

  const borrar = useMutation({
    mutationFn: () => deleteDocumento(id),
    onSuccess: () => {
      toast.success("Documento borrado");
      qc.invalidateQueries({ queryKey: ["documentacion"] });
      navigate("/documentacion");
    },
    onError: (e) => toast.error(mensajeError(e, "No se pudo borrar el documento")),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={28} />
      </div>
    );
  }
  if (!doc) {
    return <EmptyState title="No encontramos este documento" description="Puede que no esté disponible para tu rol." icon="📘" />;
  }

  const vigente = doc.vigente;
  const esPdf = vigente?.mimeType.includes("pdf");

  return (
    <div className="space-y-5">
      <Link
        to="/documentacion"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      >
        <ArrowLeft size={14} /> Documentación
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{doc.categoria}</p>
          <h1 className="font-display text-2xl font-bold text-[var(--color-text-primary)]">
            {doc.titulo}
            {!doc.activo && (
              <span className="ml-2 rounded bg-[var(--color-border)] px-1.5 py-0.5 align-middle text-[10px] font-normal text-[var(--color-text-muted)]">
                Inactivo
              </span>
            )}
          </h1>
          {doc.descripcion && <p className="text-sm text-[var(--color-text-muted)]">{doc.descripcion}</p>}
        </div>
        {puedeGestionar && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSubiendo(true)}>
              <span className="flex items-center gap-1.5">
                <Upload size={14} /> Subir versión nueva
              </span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>
              <span className="flex items-center gap-1.5">
                <Pencil size={14} /> Editar
              </span>
            </Button>
            {doc.origen === "SUBIDO" && (
              <Button
                variant="danger"
                size="sm"
                loading={borrar.isPending}
                onClick={() => {
                  if (confirm(`¿Borrar «${doc.titulo}» con todas sus versiones?`)) borrar.mutate();
                }}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        )}
      </div>

      {puedeGestionar && doc.origen === "MANUAL_SINCRONIZADO" && (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          Este manual se publica solo con cada deploy de Voltia PM. Si no tiene que verse más, desactivalo desde Editar.
        </p>
      )}

      {vigente ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
            <div className="flex-1 space-y-1">
              <p className="text-sm text-[var(--color-text-primary)]">
                <span className="font-mono font-semibold">Versión {vigente.version}</span>
                <span className="text-[var(--color-text-muted)]">
                  {" "}
                  · {vigente.vigenteDesde ? `vigente desde ${fmtFecha(vigente.vigenteDesde)}` : `publicado el ${fmtFecha(vigente.createdAt)}`}
                </span>
              </p>
              {vigente.notas && (
                <div className="text-xs text-[var(--color-text-secondary)]">
                  <span className="font-medium">Qué cambió:</span>
                  <TextoRecortado texto={vigente.notas} lineas={4} />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={fileSrc(vigente.previewUrl)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
              >
                <ExternalLink size={14} /> Abrir
              </a>
              <a
                href={fileSrc(vigente.downloadUrl)}
                className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]"
              >
                <Download size={14} /> Descargar
              </a>
            </div>
          </div>

          {doc.requiereLectura &&
            (doc.leida ? (
              <p className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={16} /> Leíste esta versión
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <p className="flex-1 text-sm text-amber-300">
                  Este documento pide confirmar la lectura. Cuando termines de leerlo, confirmalo acá.
                </p>
                <Button size="sm" loading={leer.isPending} onClick={() => leer.mutate()}>
                  Confirmo que leí la versión {vigente.version}
                </Button>
              </div>
            ))}

          {/* En el celular un PDF embebido no se lee: ahí va el botón Abrir de arriba. */}
          {esPdf && (
            <iframe
              title={doc.titulo}
              src={fileSrc(vigente.previewUrl)}
              className="hidden h-[80vh] w-full rounded-xl border border-[var(--color-border)] bg-white md:block"
            />
          )}
        </div>
      ) : (
        <EmptyState title="Este documento todavía no tiene versiones" description="" icon="📄" />
      )}

      {puedeGestionar && doc.lecturas && <PanelLecturas doc={doc} />}

      <section className="space-y-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Historial de versiones
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="px-3 py-2">Versión</th>
                <th className="px-3 py-2">Vigente desde</th>
                <th className="px-3 py-2">Publicada</th>
                <th className="px-3 py-2">Qué cambió</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {doc.versiones.map((v, i) => (
                <tr key={v.id} className="border-b border-[var(--color-border)] last:border-0 align-top">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[var(--color-text-primary)]">
                    {v.version}
                    {i === 0 && <span className="ml-2 text-[10px] font-sans text-emerald-400">vigente</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--color-text-secondary)]">{fmtFecha(v.vigenteDesde)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--color-text-secondary)]">
                    {fmtFecha(v.createdAt)}
                    <span className="block text-[11px] text-[var(--color-text-muted)]">
                      {v.publicadoPor ?? "Publicación automática"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    {v.notas ? <TextoRecortado texto={v.notas} lineas={3} /> : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <a
                      href={fileSrc(v.downloadUrl)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                      title={`${v.filename} · ${fmtPeso(v.sizeBytes)}`}
                    >
                      <Download size={12} /> Descargar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {subiendo && <SubirVersionSheet doc={doc} onClose={() => setSubiendo(false)} />}
      {editando && <EditarSheet doc={doc} onClose={() => setEditando(false)} />}
    </div>
  );
}

function PanelLecturas({ doc }: { doc: Detalle }) {
  const lecturas = doc.lecturas ?? [];
  const leyeron = lecturas.filter((l) => l.leidoAt).length;
  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Quién leyó la versión vigente · {leyeron} de {lecturas.length}
      </h2>
      <div className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 sm:grid-cols-2 lg:grid-cols-3">
        {lecturas.map((l) => (
          <div key={l.userId} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate text-[var(--color-text-primary)]">
              {l.nombre}
              <span className="ml-1 text-[11px] text-[var(--color-text-muted)]">{l.rol}</span>
            </span>
            {l.leidoAt ? (
              <span className="shrink-0 text-[11px] text-emerald-400">✓ {fmtFecha(l.leidoAt)}</span>
            ) : (
              <span className="shrink-0 text-[11px] text-amber-400">Falta</span>
            )}
          </div>
        ))}
        {lecturas.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">Ningún rol tiene asignado este documento.</p>}
      </div>
    </section>
  );
}

function SubirVersionSheet({ doc, onClose }: { doc: Detalle; onClose: () => void }) {
  const qc = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [vigenteDesde, setVigenteDesde] = useState("");
  const [notas, setNotas] = useState("");

  const subir = useMutation({
    mutationFn: () => uploadVersion(doc.id, archivo!, { version: version.trim(), vigenteDesde, notas: notas.trim() }),
    onSuccess: () => {
      toast.success("Versión publicada");
      qc.invalidateQueries({ queryKey: ["documentacion"] });
      onClose();
    },
    onError: (e) => toast.error(mensajeError(e, "No se pudo subir la versión")),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title="Subir versión nueva"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!archivo || !version.trim()} loading={subir.isPending} onClick={() => subir.mutate()}>
            Publicar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {doc.origen === "MANUAL_SINCRONIZADO" && (
          <p className="text-xs text-amber-400">
            Este manual se publica solo con cada deploy. Subirlo a mano sirve para una corrección urgente: queda vigente
            hasta que se publique una versión nueva del manual.
          </p>
        )}
        <div>
          <label className={labelClass}>Archivo *</label>
          <input
            type="file"
            className="block w-full text-sm text-[var(--color-text-secondary)]"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Versión * {doc.vigente && `(hoy ${doc.vigente.version})`}</label>
            <input className={inputClass} value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Vigente desde</label>
            <input type="date" className={inputClass} value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Qué cambió</label>
          <textarea className={inputClass} rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        {doc.requiereLectura && (
          <p className="text-[11px] text-[var(--color-text-muted)]">
            Se le va a avisar a la gente de los roles del documento y le va a pedir confirmar la lectura de nuevo.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function EditarSheet({ doc, onClose }: { doc: Detalle; onClose: () => void }) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState(doc.titulo);
  const [descripcion, setDescripcion] = useState(doc.descripcion ?? "");
  const [categoria, setCategoria] = useState(doc.categoria);
  const [requiereLectura, setRequiereLectura] = useState(doc.requiereLectura);
  const [activo, setActivo] = useState(doc.activo);
  const [roleIds, setRoleIds] = useState<string[]>((doc.roles ?? []).map((r) => r.id));

  const guardar = useMutation({
    mutationFn: () =>
      updateDocumento(doc.id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        categoria: categoria.trim(),
        requiereLectura,
        activo,
        roleIds,
      }),
    onSuccess: () => {
      toast.success("Cambios guardados");
      qc.invalidateQueries({ queryKey: ["documentacion"] });
      onClose();
    },
    onError: (e) => toast.error(mensajeError(e, "No se pudieron guardar los cambios")),
  });

  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar documento"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!titulo.trim() || !categoria.trim()}
            loading={guardar.isPending}
            onClick={() => guardar.mutate()}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Título</label>
          <input className={inputClass} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Descripción</label>
          <textarea className={inputClass} rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Categoría</label>
          <input className={inputClass} value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={requiereLectura} onChange={(e) => setRequiereLectura(e.target.checked)} />
          Pedir confirmación de lectura
        </label>
        <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
          <input type="checkbox" className="mt-1" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span>
            Activo
            <span className="block text-[11px] text-[var(--color-text-muted)]">
              Inactivo: solo lo ve quien gestiona Documentación.
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

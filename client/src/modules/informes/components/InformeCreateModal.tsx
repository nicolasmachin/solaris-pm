import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { X, Search, Paperclip, Upload, FileText } from "lucide-react";

import { getAssignableUsers } from "../../../api/users.api";
import { ProjectPicker } from "../../../components/finance/ProjectPicker";
import { Sheet } from "../../../components/ui/Sheet";
import { useInformeMutations } from "../../../hooks/useInformes";
import {
  crearInforme,
  enviarInforme,
  subirAdjuntoInforme,
  type InformeDetail,
} from "../../../api/informes.api";

function apiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const inp =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]";
const lbl = "block text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1 font-mono";

// ESPEJO de la whitelist del server: server/src/services/file-storage.service.ts
// (allowedExtensions) y MAX_FILE_SIZE_MB=20. Si cambian allá, sincronizar acá:
// el server es la fuente de verdad y rechaza igual, esto es solo UX temprana.
const EXT_PERMITIDAS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".webm", ".mp4", ".m4a", ".aac", ".mp3", ".ogg", ".oga", ".wav",
  ".pdf", ".dwg", ".xlsx", ".docx", ".zip",
]);
const MAX_FILE_MB = 20;

function extDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i).toLowerCase() : "";
}

// Devuelve mensaje de error si el archivo no pasa, o null si es válido.
function validarArchivo(file: File): string | null {
  if (!EXT_PERMITIDAS.has(extDe(file.name))) return `"${file.name}": tipo de archivo no permitido`;
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `"${file.name}" supera el límite de ${MAX_FILE_MB} MB`;
  return null;
}

function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  // Si viene, el modal edita ese borrador; si no, crea uno nuevo.
  initial?: InformeDetail | null;
  currentUserId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function InformeCreateModal({ initial, currentUserId, onClose, onSaved }: Props) {
  const isEdit = !!initial;
  // Editando un informe ya enviado: solo se guardan cambios, no se re-envía.
  const editandoEnviado = isEdit && initial!.estado !== "BORRADOR";
  const qc = useQueryClient();
  // En edición seguimos usando las mutaciones (con sus toasts). La creación con
  // adjuntos se orquesta con llamadas de API directas para un único toast final.
  const { editar, enviar } = useInformeMutations(initial?.id ?? null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);

  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [cuerpo, setCuerpo] = useState(initial?.cuerpo ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [destinatarios, setDestinatarios] = useState<Set<string>>(
    () => new Set((initial?.destinatarios ?? []).map((d) => d.usuario.id)),
  );
  const [search, setSearch] = useState("");
  // Adjuntos acumulados localmente (solo en creación). No se suben hasta tener
  // informeId; eso pasa en la orquestación del submit (bloque 1.2).
  const [archivos, setArchivos] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const busy = procesando || editar.isPending || enviar.isPending;

  function toggle(id: string) {
    setDestinatarios((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    const validos: File[] = [];
    for (const f of elegidos) {
      const err = validarArchivo(f);
      if (err) toast.error(err);
      else validos.push(f);
    }
    if (validos.length > 0) {
      // Evita duplicados exactos (mismo nombre + tamaño) si re-eligen.
      setArchivos((prev) => {
        const clave = (f: File) => `${f.name}:${f.size}`;
        const vistos = new Set(prev.map(clave));
        return [...prev, ...validos.filter((f) => !vistos.has(clave(f)))];
      });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function quitarArchivo(idx: number) {
    setArchivos((prev) => prev.filter((_, i) => i !== idx));
  }

  function validar(): string | null {
    if (!titulo.trim()) return "Ingresá un título";
    if (!cuerpo.trim()) return "Ingresá el contenido del informe";
    if (destinatarios.size === 0) return "Elegí al menos un destinatario";
    return null;
  }

  function bodyActual() {
    return {
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      projectId: projectId || null,
      destinatariosIds: [...destinatarios],
    };
  }

  // Edición: flujo simple con las mutaciones (el toast lo manejan ellas).
  async function guardarEdicion(opts: { enviar: boolean }) {
    try {
      await editar.mutateAsync({ id: initial!.id, body: bodyActual() });
      if (opts.enviar) await enviar.mutateAsync(initial!.id);
      onSaved(initial!.id);
      onClose();
    } catch {
      // el toast de error lo maneja la mutación
    }
  }

  // Creación con adjuntos: crear → subir TODOS (secuencial) → recién ahí enviar.
  // El orden es irreversible: un informe enviado es inmutable, así que no se
  // puede enviar antes de terminar de subir. Red de seguridad: si algo falla
  // post-creación, el informe queda BORRADOR con lo que sí subió, no se envía,
  // y se deja seleccionado vía onSaved(id) para que el autor lo complete.
  async function guardarCreacion(opts: { enviar: boolean }) {
    setProcesando(true);
    try {
      // 1. Crear. Si falla acá no se creó nada → se puede reintentar.
      setProgreso("Creando…");
      let id: string;
      try {
        const creado = await crearInforme(bodyActual());
        id = creado.id;
      } catch (e) {
        toast.error(apiErr(e) ?? "No se pudo crear el informe");
        return;
      }

      // 2. Subir adjuntos en orden. Si uno falla, cortamos: queda borrador.
      for (let i = 0; i < archivos.length; i++) {
        setProgreso(`Subiendo ${i + 1} de ${archivos.length}…`);
        try {
          await subirAdjuntoInforme(id, archivos[i]);
        } catch (e) {
          qc.invalidateQueries({ queryKey: ["informes"] });
          toast.error(
            apiErr(e) ??
              `Se creó el borrador con ${i} de ${archivos.length} adjuntos. Falló "${archivos[i].name}"; completalo desde el informe.`,
          );
          onSaved(id);
          onClose();
          return;
        }
      }

      // 3. Enviar (solo si el usuario lo pidió). Si falla, queda borrador listo.
      if (opts.enviar) {
        setProgreso("Enviando…");
        try {
          await enviarInforme(id);
        } catch (e) {
          qc.invalidateQueries({ queryKey: ["informes"] });
          toast.error(
            apiErr(e) ?? "Se creó el borrador con los adjuntos, pero no se pudo enviar. Envialo desde el informe.",
          );
          onSaved(id);
          onClose();
          return;
        }
      }

      // Éxito: invalidamos una sola vez y mostramos un único toast.
      qc.invalidateQueries({ queryKey: ["informes"] });
      qc.invalidateQueries({ queryKey: ["informes-pendientes-count"] });
      toast.success(opts.enviar ? "Informe enviado" : "Borrador creado");
      onSaved(id);
      onClose();
    } finally {
      setProcesando(false);
      setProgreso(null);
    }
  }

  function guardar(opts: { enviar: boolean }) {
    const err = validar();
    if (err) {
      toast.error(err);
      return;
    }
    if (isEdit) void guardarEdicion(opts);
    else void guardarCreacion(opts);
  }

  const footer = (
    <>
      {progreso && <span className="mr-auto text-xs text-[var(--color-text-muted)]">{progreso}</span>}
      <button
        type="button"
        disabled={busy}
        onClick={onClose}
        className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/30 disabled:opacity-50"
      >
        Cancelar
      </button>
      {editandoEnviado ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => guardar({ enviar: false })}
          className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar cambios"}
        </button>
      ) : (
        <>
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
        </>
      )}
    </>
  );

  return (
    <Sheet open onClose={onClose} title={isEdit ? "Editar borrador" : "Nuevo informe"} footer={footer}>
      <div className="space-y-3">
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
          </div>

          {!isEdit && (
            <div>
              <label className={lbl}>Adjuntos (opcional)</label>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/20"
              >
                <Upload className="h-3.5 w-3.5" /> Elegir archivos
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={onPickFiles} />
              {archivos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {archivos.map((f, idx) => (
                    <li
                      key={`${f.name}:${f.size}:${idx}`}
                      className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/40 px-2.5 py-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />
                      <span className="flex-1 truncate text-xs text-[var(--color-text-primary)]">{f.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{tamano(f.size)}</span>
                      <button
                        type="button"
                        onClick={() => quitarArchivo(idx)}
                        className="rounded p-0.5 text-rose-500 hover:bg-rose-500/10"
                        title="Quitar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <Paperclip className="h-3 w-3" /> Hasta {MAX_FILE_MB} MB c/u. Imágenes, audio, PDF, DWG, XLSX, DOCX, ZIP.
              </p>
            </div>
          )}
        </div>
    </Sheet>
  );
}

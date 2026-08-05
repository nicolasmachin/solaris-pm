import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowRight,
  Calendar,
  Camera,
  FileText,
  StickyNote,
  Trash2,
  User,
  Video,
} from "lucide-react";
import {
  deleteVisita,
  getVisitas,
  uploadProjectVisitNote,
  uploadProjectVisitPhoto,
  type VisitListItem,
  type VisitType,
} from "../../../api/visitas.api";
import { uploadVisitVideo } from "../../../api/videos.api";
import { useAuthStore } from "../../../store/auth.store";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  INICIAL: "Inicial",
  REVISION: "Revisión",
  COMPLEMENTARIA: "Complementaria",
};

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

/**
 * Panel de Visita técnica en el StageDrawer del proyecto.
 *
 * Modelo: una visita = un operario en un proyecto. Cualquier input que el
 * usuario logueado agrega va a SU visita activa (creada automáticamente si no
 * existe o tiene >7 días). Los demás operarios tienen sus propias visitas.
 *
 * UI:
 *  - Botones directos (Foto / Video / Nota; el audio vive en el FAB global) —
 *    el backend resuelve a qué visita van.
 *  - El video no es un input de la visita: se guarda como video del proyecto
 *    (tipo "Visita técnica") y se ve en la sección Videos, ya comprimido.
 *  - Lista de TODAS las visitas del proyecto (de cualquier operario), con
 *    nombre del dueño y status.
 */
export function VisitasToolPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "ADMIN";

  const [mode, setMode] = useState<"none" | "photo" | "video" | "note">("none");
  const [noteText, setNoteText] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [photoDesc, setPhotoDesc] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoPercent, setVideoPercent] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const visitsQ = useQuery({
    queryKey: ["technical-visits", projectId],
    queryFn: () => getVisitas(projectId),
    refetchInterval: (q) => {
      const data = q.state.data ?? [];
      // Polling activo si hay visitas con status EN_CURSO (auto-regenerate
      // del informe corre en background tras input).
      return data.some((v) => v.status === "EN_CURSO") ? 5000 : false;
    },
  });

  const noteMut = useMutation({
    mutationFn: () =>
      uploadProjectVisitNote(projectId, {
        noteText: noteText.trim(),
        description: noteDesc.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Nota guardada · regenerando informe…");
      setNoteText("");
      setNoteDesc("");
      setMode("none");
      qc.invalidateQueries({ queryKey: ["technical-visits", projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo guardar la nota"),
  });

  const photoMut = useMutation({
    mutationFn: (file: File) => uploadProjectVisitPhoto(projectId, file, photoDesc.trim() || null),
    onSuccess: () => {
      toast.success("Foto guardada · regenerando informe…");
      setPhotoDesc("");
      setMode("none");
      qc.invalidateQueries({ queryKey: ["technical-visits", projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo subir la foto"),
  });

  // El video no genera un input de la visita (no se transcribe, así que no
  // alimenta el informe): se guarda como video del proyecto asociado a esta
  // visita y aparece en la sección Videos.
  const videoMut = useMutation({
    mutationFn: (file: File) =>
      uploadVisitVideo(projectId, {
        file,
        descripcion: videoDesc.trim() || undefined,
        onProgress: setVideoPercent,
      }),
    onSuccess: () => {
      toast.success("Video subido · se está preparando para ver");
      setVideoDesc("");
      setMode("none");
      qc.invalidateQueries({ queryKey: ["project-videos", projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo subir el video"),
    onSettled: () => setVideoPercent(null),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteVisita(id),
    onSuccess: () => {
      toast.success("Visita eliminada");
      qc.invalidateQueries({ queryKey: ["technical-visits", projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo eliminar"),
  });

  function handleDelete(id: string) {
    if (confirm("¿Eliminar esta visita y todos sus inputs e informes?")) {
      deleteMut.mutate(id);
    }
  }

  const visits = visitsQ.data ?? [];
  const myActiveVisit = visits.find(
    (v) => v.createdBy.id === currentUser?.id && v.status === "EN_CURSO",
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        Cargá fotos, videos o notas durante la visita. Para grabar audio usá el botón flotante
        amarillo.
        Cada operario tiene su propia visita en el proyecto (la IA arma un informe por operario,
        no se mezclan).
      </p>

      {/* Botones directos: Audio queda en el FAB global */}
      {mode === "none" && (
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => {
              setMode("photo");
              setTimeout(() => fileInputRef.current?.click(), 50);
            }}
            className="inline-flex flex-col items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
          >
            <Camera className="w-5 h-5 text-blue-400" />
            Foto
          </button>
          <button
            onClick={() => setMode("video")}
            className="inline-flex flex-col items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
          >
            <Video className="w-5 h-5 text-purple-400" />
            Video
          </button>
          <button
            onClick={() => setMode("note")}
            className="inline-flex flex-col items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
          >
            <StickyNote className="w-5 h-5 text-yellow-400" />
            Nota
          </button>
        </div>
      )}

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) videoMut.mutate(f);
          if (videoInputRef.current) videoInputRef.current.value = "";
        }}
      />
      {mode === "video" && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 space-y-2">
          <input
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs"
            placeholder="Descripción del video (opcional)"
            value={videoDesc}
            onChange={(e) => setVideoDesc(e.target.value)}
            maxLength={200}
            disabled={videoMut.isPending}
          />
          <p className="text-[10px] leading-snug text-[var(--color-text-muted)]">
            Se comprime al subirlo y queda en la sección Videos del proyecto.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMode("none")}
              disabled={videoMut.isPending}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={videoMut.isPending}
              className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {videoMut.isPending
                ? `Subiendo… ${videoPercent ?? 0}%`
                : "Elegir video"}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) photoMut.mutate(f);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />
      {mode === "photo" && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 space-y-2">
          <input
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs"
            placeholder="Descripción de la foto (opcional)"
            value={photoDesc}
            onChange={(e) => setPhotoDesc(e.target.value)}
            maxLength={200}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMode("none")}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              Cancelar
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90"
            >
              Elegir archivo
            </button>
          </div>
        </div>
      )}

      {mode === "note" && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 space-y-2">
          <textarea
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs min-h-[80px]"
            placeholder="Texto de la nota…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={5000}
          />
          <input
            className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs"
            placeholder="Descripción corta (opcional)"
            value={noteDesc}
            onChange={(e) => setNoteDesc(e.target.value)}
            maxLength={200}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setMode("none")}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              Cancelar
            </button>
            <button
              onClick={() => noteMut.mutate()}
              disabled={!noteText.trim() || noteMut.isPending}
              className="rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {noteMut.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Status de la visita activa del usuario actual */}
      {myActiveVisit && (
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">
          Tu visita activa en este proyecto: {VISIT_TYPE_LABEL[myActiveVisit.visitType]} ·
          {myActiveVisit.inputsCount} input{myActiveVisit.inputsCount === 1 ? "" : "s"} ·
          {myActiveVisit.reportsCount > 0 ? ` informe v${myActiveVisit.reportsCount}` : " sin informe"}
        </p>
      )}

      {/* Lista de visitas del proyecto */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-text-muted)] mb-1.5">
          Visitas del proyecto ({visits.length})
        </p>
        {visitsQ.isLoading ? (
          <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
        ) : visits.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-4 text-center text-xs text-[var(--color-text-muted)]">
            Sin visitas todavía. Cargá un audio/foto/nota para crear la tuya.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {visits.map((v) => (
              <VisitRow
                key={v.id}
                visit={v}
                isMine={v.createdBy.id === currentUser?.id}
                canDelete={isAdmin}
                onOpen={() => navigate(`/projects/${projectId}/visita/${v.id}`)}
                onDelete={() => handleDelete(v.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function VisitRow({
  visit,
  isMine,
  canDelete,
  onOpen,
  onDelete,
}: {
  visit: VisitListItem;
  isMine: boolean;
  canDelete: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded border px-3 py-2 ${
        isMine
          ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5"
          : "border-[var(--color-border)] bg-[var(--color-bg-app)]"
      }`}
    >
      <Calendar className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-primary)] flex items-center gap-1.5">
          <User className="w-3 h-3 text-[var(--color-text-muted)]" />
          <span className="font-medium">{visit.createdBy.name}</span>
          {isMine && (
            <span className="text-[9px] font-mono uppercase text-[var(--color-accent)]">(vos)</span>
          )}
          <span className="text-[var(--color-text-muted)]">·</span>
          <span className="text-[var(--color-text-muted)]">{fmtDate(visit.visitDate)}</span>
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">
          {VISIT_TYPE_LABEL[visit.visitType]} · {visit.status === "EN_CURSO" ? "En curso" : "Finalizada"} ·
          {" "}
          {visit.inputsCount} input{visit.inputsCount === 1 ? "" : "s"} ·
          <FileText className="inline w-3 h-3 mx-0.5" />
          {visit.reportsCount > 0 ? `v${visit.reportsCount}` : "sin informe"}
        </p>
      </div>
      <button
        onClick={onOpen}
        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:bg-[var(--color-bg-card-hover)]"
      >
        Abrir <ArrowRight className="w-3 h-3" />
      </button>
      {canDelete && (
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-500/20 text-red-400"
          title="Eliminar visita (admin)"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </li>
  );
}

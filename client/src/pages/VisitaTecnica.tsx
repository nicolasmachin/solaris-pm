import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  ArrowLeft,
  Camera,
  Download,
  Eye,
  FileText,
  HardHat,
  Layers,
  Loader2,
  Mic,
  RotateCcw,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  getVisita,
  resetVisitReports,
  uploadVisitNote,
  uploadVisitPhoto,
  visitAudioUrl,
  visitReportPdfUrl,
  type VisitInputDto,
} from "../api/visitas.api";
import { ReportPreviewModal } from "../components/ingenieria/visitas/ReportPreviewModal";
import { ReportViewer } from "../components/ingenieria/visitas/ReportViewer";
import { deleteVisitInput } from "../api/visitas.api";
import { useAuthStore } from "../store/auth.store";
import { VisitFloatingButton } from "../components/visitas/VisitFloatingButton";
import { ACCEPT_FOTOS } from "../utils/fileAccept";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("voltia-token");
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

export function VisitaTecnica() {
  const { projectId, visitId } = useParams<{ projectId: string; visitId: string }>();
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === "ADMIN";
  const [mode, setMode] = useState<"none" | "audio" | "photo" | "note">("none");
  const [noteText, setNoteText] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [photoDesc, setPhotoDesc] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visitQ = useQuery({
    queryKey: ["technical-visit", visitId],
    queryFn: () => getVisita(visitId!),
    enabled: !!visitId,
    refetchInterval: (q) => {
      const data = q.state.data;
      // Polling activo si hay audios PROCESSING/PENDING
      if (data?.inputs.some((i) => i.transcriptionStatus === "PROCESSING" || i.transcriptionStatus === "PENDING")) {
        return 4000;
      }
      return false;
    },
  });

  const visit = visitQ.data;

  // Auto-select latest report
  useEffect(() => {
    if (!visit) return;
    if (selectedReportId) return;
    if (visit.reports.length > 0) setSelectedReportId(visit.reports[0].id);
  }, [visit, selectedReportId]);

  const noteMut = useMutation({
    mutationFn: () =>
      uploadVisitNote(visitId!, {
        noteText: noteText.trim(),
        description: noteDesc.trim() || null,
      }),
    onSuccess: () => {
      setNoteText("");
      setNoteDesc("");
      setMode("none");
      qc.invalidateQueries({ queryKey: ["technical-visit", visitId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo guardar la nota"),
  });

  const photoMut = useMutation({
    mutationFn: (file: File) => uploadVisitPhoto(visitId!, file, photoDesc.trim() || null),
    onSuccess: () => {
      setPhotoDesc("");
      setMode("none");
      qc.invalidateQueries({ queryKey: ["technical-visit", visitId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo subir la foto"),
  });

  const deleteInputMut = useMutation({
    mutationFn: (inputId: string) => deleteVisitInput(visitId!, inputId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["technical-visit", visitId] }),
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo eliminar"),
  });

  const resetMut = useMutation({
    mutationFn: () => resetVisitReports(visitId!),
    onSuccess: () => {
      toast.success("Informe borrado — los inputs se mantuvieron");
      setSelectedReportId(null);
      qc.invalidateQueries({ queryKey: ["technical-visit", visitId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo borrar"),
  });

  if (!projectId || !visitId) return null;

  const inputs = visit?.inputs ?? [];
  const reports = visit?.reports ?? [];
  // El usuario puede agregar/borrar inputs sólo si es el dueño de la visita
  // (o admin). Los demás operarios ven la visita en read-only.
  const isOwner = visit ? visit.createdBy.id === currentUser?.id : false;
  const canEditInputs = isOwner || isAdmin;
  const selectedReport = reports.find((r) => r.id === selectedReportId) ?? reports[0] ?? null;
  const inputsCount = inputs.length;

  // Audios todavía transcribiendo: muestran indicador "actualizando informe…"
  const pendingAudiosCount = inputs.filter(
    (i) =>
      i.type === "AUDIO" &&
      (i.transcriptionStatus === "PENDING" || i.transcriptionStatus === "PROCESSING"),
  ).length;

  return (
    <div className="space-y-4">
      <header>
        <Link
          to={`/projects/${projectId}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          <ArrowLeft className="w-3 h-3" /> Volver al proyecto
        </Link>
        <div className="mt-2 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <HardHat className="w-5 h-5 text-[var(--color-accent)]" />
            Visita técnica
          </h1>
          {visit && (
            <p className="text-xs text-[var(--color-text-muted)] font-mono">
              {visit.visitType} · {fmtDate(visit.visitDate)} · {visit.createdBy.name} · {inputsCount} input{inputsCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {visit?.project && (
          <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-0.5">
            Proyecto: {visit.project.clientName}
          </p>
        )}
        {visit && !canEditInputs && (
          <p className="text-[11px] text-[var(--color-text-muted)] font-mono mt-1 italic">
            Estás viendo la visita de {visit.createdBy.name} en modo lectura. Para cargar tus
            propios inputs, volvé al proyecto y usá los botones del panel de visitas.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Columna izquierda: inputs */}
        <div className="lg:col-span-5 space-y-3">
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Insumos cargados ({inputsCount})
            </p>

            {mode === "none" && canEditInputs && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setMode("photo");
                    setTimeout(() => fileInputRef.current?.click(), 50);
                  }}
                  className="inline-flex flex-col items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-2 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
                >
                  <Camera className="w-4 h-4 text-blue-400" /> Foto
                </button>
                <button
                  onClick={() => setMode("note")}
                  className="inline-flex flex-col items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] p-2 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
                >
                  <StickyNote className="w-4 h-4 text-yellow-400" /> Nota
                </button>
              </div>
            )}
            {mode === "none" && canEditInputs && (
              <p className="text-[10px] text-[var(--color-text-muted)] italic">
                Para grabar audio usá el botón flotante amarillo abajo a la derecha.
              </p>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_FOTOS}
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

            <ul className="space-y-1.5">
              {inputs.map((input) => {
                // El usuario puede borrar sólo SUS inputs (createdById match) o admin.
                const canDeleteThisInput =
                  isAdmin || (currentUser && input.createdBy?.id === currentUser.id);
                return (
                  <InputRow
                    key={input.id}
                    input={input}
                    visitId={visitId}
                    onDelete={
                      canDeleteThisInput
                        ? () => deleteInputMut.mutate(input.id)
                        : null
                    }
                  />
                );
              })}
            </ul>

            {/* Indicador de estado: el informe se actualiza automáticamente
                con cada input. Si hay audios pendientes, esperamos a que
                terminen de transcribir. */}
            {pendingAudiosCount > 0 ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <Loader2 className="w-4 h-4 animate-spin" />
                Transcribiendo {pendingAudiosCount} audio{pendingAudiosCount === 1 ? "" : "s"} —
                el informe se actualizará al terminar.
              </div>
            ) : (
              <p className="text-[10px] text-[var(--color-text-muted)]">
                El informe se actualiza automáticamente con cada audio, foto o nota nuevos.
              </p>
            )}
          </section>
        </div>

        {/* Columna derecha: informe */}
        <div className="lg:col-span-7">
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                Informe técnico
              </p>
              <div className="flex items-center gap-2">
                {reports.length > 0 && canEditInputs && (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "¿Borrar todas las versiones del informe? Los inputs (audios, fotos, notas) se mantienen.",
                        )
                      ) {
                        resetMut.mutate();
                      }
                    }}
                    disabled={resetMut.isPending}
                    className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] text-[var(--color-text-muted)] hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                    title="Borrar todas las versiones del informe (inputs se mantienen)"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                )}
                {selectedReport && (
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                    v{selectedReport.version} · {fmtDate(selectedReport.generatedAt)}
                  </span>
                )}
                {selectedReport && (
                  <>
                    <button
                      onClick={() => setPreviewReportId(selectedReport.id)}
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
                      title="Ver PDF"
                    >
                      <Eye className="w-3 h-3" /> Ver PDF
                    </button>
                    <button
                      onClick={() =>
                        downloadWithAuth(
                          visitReportPdfUrl(visitId!, selectedReport.id),
                          `visita-v${selectedReport.version}.pdf`,
                        ).catch(() => toast.error("No se pudo descargar PDF"))
                      }
                      className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
                      title="Descargar PDF"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {!selectedReport ? (
              <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
                Aún no hay informe. Cargá audios, fotos o notas y la IA genera el informe automáticamente.
              </p>
            ) : (
              <ReportViewer report={selectedReport} />
            )}
          </section>
        </div>
      </div>

      {previewReportId && (
        <ReportPreviewModal
          visitId={visitId}
          reportId={previewReportId}
          onClose={() => setPreviewReportId(null)}
        />
      )}
      <VisitFloatingButton projectId={projectId} />
    </div>
  );
}

function InputRow({
  input,
  visitId,
  onDelete,
}: {
  input: VisitInputDto;
  visitId: string;
  onDelete: (() => void) | null;
}) {
  return (
    <li className="rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2.5 py-2">
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] uppercase mt-0.5 shrink-0">
          {input.type === "AUDIO" ? "🎤 audio" : input.type === "PHOTO" ? "📷 foto" : "📝 nota"}
        </span>
        <div className="flex-1 min-w-0">
          {input.description && (
            <p className="text-[11px] text-[var(--color-text-primary)] mb-0.5">
              {input.description}
            </p>
          )}
          {input.type === "NOTE" && (
            <p className="text-[11px] text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {input.noteText}
            </p>
          )}
          {input.type === "AUDIO" && (
            <>
              {input.transcriptionStatus === "COMPLETED" && input.transcription && (
                <p className="text-[11px] text-[var(--color-text-secondary)] italic whitespace-pre-wrap">
                  "{input.transcription.length > 150 ? `${input.transcription.slice(0, 150)}…` : input.transcription}"
                </p>
              )}
              {(input.transcriptionStatus === "PROCESSING" ||
                input.transcriptionStatus === "PENDING") && (
                <p className="text-[10px] text-[var(--color-text-muted)] italic">
                  Transcribiendo…
                </p>
              )}
              {input.transcriptionStatus === "FAILED" && (
                <p className="text-[10px] text-red-400 italic">
                  Transcripción falló: {input.transcription ?? "error"}
                </p>
              )}
              {input.fileUrl && (
                <audio
                  controls
                  preload="metadata"
                  playsInline
                  className="w-full mt-1"
                  src={visitAudioUrl(visitId, input.id)}
                />
              )}
            </>
          )}
          {input.type === "PHOTO" && input.fileUrl && (
            <p className="text-[10px] text-[var(--color-text-muted)]">
              Foto adjunta · {input.fileSize ? `${Math.round(input.fileSize / 1024)} KB` : ""}
            </p>
          )}
          <p className="text-[9px] text-[var(--color-text-muted)] font-mono mt-1">
            {input.createdBy?.name ?? "—"} · {fmtDate(input.createdAt)}
          </p>
        </div>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-500/20 text-red-400 shrink-0"
            title="Eliminar"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </li>
  );
}

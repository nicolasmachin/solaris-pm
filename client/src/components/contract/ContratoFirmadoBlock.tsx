import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { CheckCircle2, ExternalLink, FileSignature, Trash2, Upload } from "lucide-react";

import { apiClient } from "../../api/axios";
import {
  deleteContratoFirmado,
  getContratoFirmado,
  uploadContratoFirmado,
} from "../../api/contratoFirmado.api";
import { usePermission } from "../../hooks/usePermission";
import { ACCEPT_FOTOS_Y_PDF } from "../../utils/fileAccept";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${String(d.getDate()).padStart(2, "0")} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Bloque "Contrato firmado" de la ficha del proyecto. Un solo archivo vigente:
 * subir otro lo reemplaza. Se ve con OPERACIONES:VIEW (como Documentos); subir y
 * quitar piden ONBOARDING:EDIT u OPERACIONES:EDIT (mismo criterio que el backend).
 */
export function ContratoFirmadoBlock({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [abriendo, setAbriendo] = useState(false);
  const puedeEditarOnboarding = usePermission("ONBOARDING", "EDIT");
  const puedeEditarOperaciones = usePermission("OPERACIONES", "EDIT");
  const puedeEditar = puedeEditarOnboarding || puedeEditarOperaciones;

  const { data: contrato, isLoading } = useQuery({
    queryKey: ["contrato-firmado", projectId],
    queryFn: () => getContratoFirmado(projectId),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["contrato-firmado", projectId] });
    qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
  };

  const subir = useMutation({
    mutationFn: (file: File) => uploadContratoFirmado(projectId, file),
    onSuccess: () => {
      toast.success(contrato ? "Contrato firmado reemplazado" : "Contrato firmado cargado");
      invalidar();
    },
    onError: () => toast.error("No se pudo subir el contrato firmado"),
  });

  const quitar = useMutation({
    mutationFn: () => deleteContratoFirmado(projectId),
    onSuccess: () => {
      toast.success("Contrato firmado quitado");
      invalidar();
    },
    onError: () => toast.error("No se pudo quitar el contrato firmado"),
  });

  async function ver() {
    if (!contrato) return;
    // Se abre la pestaña antes del pedido para que el navegador no la bloquee.
    const ventana = window.open("", "_blank");
    setAbriendo(true);
    try {
      const res = await apiClient.get(contrato.previewUrl, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      if (ventana) ventana.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      ventana?.close();
      toast.error("No se pudo abrir el contrato firmado");
    } finally {
      setAbriendo(false);
    }
  }

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (contrato && !confirm(`Ya hay un contrato firmado cargado ("${contrato.filename}"). ¿Reemplazarlo?`)) return;
    subir.mutate(file);
  }

  return (
    <section className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileSignature className="h-4 w-4 shrink-0 text-[var(--color-accent)]" />
          <h3 className="font-display text-sm font-semibold text-[var(--color-text-primary)]">Contrato firmado</h3>
          {isLoading ? (
            <span className="text-xs text-[var(--color-text-muted)]">Cargando…</span>
          ) : contrato ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-semibold text-green-400">
              <CheckCircle2 className="h-3 w-3" /> Cargado
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
              Falta cargarlo
            </span>
          )}
        </div>

        {puedeEditar && (
          <>
            <input ref={inputRef} type="file" accept={ACCEPT_FOTOS_Y_PDF} className="hidden" onChange={elegirArchivo} />
            <button
              type="button"
              disabled={subir.isPending}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Upload size={14} />
              {subir.isPending ? "Subiendo…" : contrato ? "Reemplazar" : "Subir contrato firmado"}
            </button>
          </>
        )}
      </div>

      {contrato && (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => void ver()}
              disabled={abriendo}
              className="inline-flex max-w-full items-center gap-1 truncate text-left text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:underline disabled:opacity-50"
              title="Ver el contrato firmado"
            >
              <span className="truncate">{contrato.filename}</span>
              <ExternalLink className="h-3 w-3 shrink-0" />
            </button>
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
              Subido por {contrato.uploadedBy?.name ?? "—"} · {fmtDate(contrato.createdAt)}
            </p>
          </div>
          {puedeEditar && (
            <button
              type="button"
              onClick={() => {
                if (confirm("¿Quitar el contrato firmado cargado?")) quitar.mutate();
              }}
              disabled={quitar.isPending}
              aria-label="Quitar contrato firmado"
              className="shrink-0 rounded p-1.5 text-[var(--color-text-muted)] hover:bg-red-600/10 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Check, FileText, Loader2, Sparkles, Trash2, Upload } from "lucide-react";

import { useUteExtract } from "../../hooks/useUteExtract";
import { UteExtractModal } from "./UteExtractModal";
import { uteExtractDelete, type UteExtractTipo } from "../../api/uteExtract.api";

const ACCEPT_BY_TIPO: Record<UteExtractTipo, string> = {
  cedula: "image/jpeg,image/png,application/pdf",
  factura_ute: "application/pdf,image/jpeg,image/png",
};

const HINT_BY_TIPO: Record<UteExtractTipo, string> = {
  cedula: "Foto o escaneo de la cédula (jpg, png o pdf · máx 10MB)",
  factura_ute: "Factura UTE (pdf, jpg o png · máx 10MB)",
};

const TITLE_BY_TIPO: Record<UteExtractTipo, string> = {
  cedula: "Cédula de identidad",
  factura_ute: "Factura UTE",
};

export function ClienteDocsUpload({
  projectId,
  cedulaPath,
  facturaUtePath,
}: {
  projectId: string;
  cedulaPath?: string | null;
  facturaUtePath?: string | null;
}) {
  const qc = useQueryClient();
  const extractor = useUteExtract(projectId);
  const deleteMut = useMutation({
    mutationFn: (tipo: UteExtractTipo) => uteExtractDelete(projectId, tipo),
    onSuccess: (_, tipo) => {
      toast.success(`Archivo ${tipo === "cedula" ? "de cédula" : "de factura UTE"} eliminado`);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (err) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo borrar el archivo");
    },
  });

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <div className="flex items-start gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[var(--color-accent)] mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Documentos del cliente
          </h2>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Subí la cédula o factura UTE. Una IA extrae los datos y los precargás en el proyecto.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <DocSlot
          tipo="cedula"
          path={cedulaPath}
          isUploading={extractor.isExtracting}
          isDeleting={deleteMut.isPending && deleteMut.variables === "cedula"}
          onSelect={(f) => extractor.uploadAndExtract(f, "cedula")}
          onDelete={() => {
            if (confirm("¿Borrar el archivo de cédula? Los datos del cliente ya cargados se conservan.")) {
              deleteMut.mutate("cedula");
            }
          }}
        />
        <DocSlot
          tipo="factura_ute"
          path={facturaUtePath}
          isUploading={extractor.isExtracting}
          isDeleting={deleteMut.isPending && deleteMut.variables === "factura_ute"}
          onSelect={(f) => extractor.uploadAndExtract(f, "factura_ute")}
          onDelete={() => {
            if (confirm("¿Borrar el archivo de factura UTE? Los datos UTE ya cargados (cuenta, tarifa, etc.) se conservan.")) {
              deleteMut.mutate("factura_ute");
            }
          }}
        />
      </div>

      {extractor.modalOpen && extractor.extracted && extractor.tipoActual && (
        <UteExtractModal
          data={extractor.extracted}
          tipo={extractor.tipoActual}
          isSaving={extractor.isConfirming}
          alreadyFilled={extractor.alreadyFilled}
          onConfirm={(d) => extractor.confirmar(d)}
          onCancel={extractor.cancelar}
        />
      )}
    </section>
  );
}

function DocSlot({
  tipo,
  path,
  isUploading,
  isDeleting,
  onSelect,
  onDelete,
}: {
  tipo: UteExtractTipo;
  path?: string | null;
  isUploading: boolean;
  isDeleting: boolean;
  onSelect: (f: File) => void;
  onDelete: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFile = Boolean(path);
  const busy = isUploading || isDeleting;

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)]/30 p-3">
      <p className="text-xs font-medium text-[var(--color-text-primary)]">
        {TITLE_BY_TIPO[tipo]}
      </p>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{HINT_BY_TIPO[tipo]}</p>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {hasFile && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
            <Check className="w-3 h-3" /> archivo cargado
          </span>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Procesando con IA…
            </>
          ) : hasFile ? (
            <>
              <FileText className="w-3 h-3" /> Reemplazar
            </>
          ) : (
            <>
              <Upload className="w-3 h-3" /> Subir
            </>
          )}
        </button>
        {hasFile && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title="Borrar archivo (los datos del cliente ya cargados no se borran)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/40 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Borrando…
              </>
            ) : (
              <>
                <Trash2 className="w-3 h-3" /> Borrar archivo
              </>
            )}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_BY_TIPO[tipo]}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSelect(f);
            e.target.value = ""; // permite re-seleccionar el mismo archivo
          }}
        />
      </div>
    </div>
  );
}

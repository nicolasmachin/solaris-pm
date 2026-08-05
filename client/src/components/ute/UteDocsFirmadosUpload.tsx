import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Upload } from "lucide-react";

import { uploadUteDocFirmado } from "../../api/uteDocs.api";
import { ACCEPT_FOTOS } from "../../utils/fileAccept";

interface Props {
  projectId: string;
}

// Subida de documentos UTE firmados. Acepta PDF, imágenes y ZIP. Sin
// compresión (son documentos firmados, se preserva calidad). El backend acepta
// 1 archivo por request (multipart files:1) → loop secuencial con progreso.
export function UteDocsFirmadosUpload({ projectId }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleFiles(files: FileList) {
    const list = Array.from(files);
    if (list.length === 0) return;

    setBusy(true);
    setProgress({ done: 0, total: list.length });

    let ok = 0;
    let failed = 0;

    for (let i = 0; i < list.length; i++) {
      try {
        await uploadUteDocFirmado(projectId, list[i]);
        ok++;
      } catch (err) {
        failed++;
        console.error("Error subiendo documento firmado:", list[i].name, err);
      }
      setProgress({ done: i + 1, total: list.length });
    }

    setBusy(false);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";

    await qc.invalidateQueries({ queryKey: ["ute-docs-firmados", projectId] });

    if (ok > 0 && failed === 0) {
      toast.success(ok === 1 ? "Documento subido" : `${ok} documentos subidos`);
    } else if (ok > 0 && failed > 0) {
      toast.success(`${ok} subido${ok === 1 ? "" : "s"}, ${failed} con error`);
    } else {
      toast.error("No se pudo subir ningún documento");
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={`.pdf,image/*,.zip,${ACCEPT_FOTOS}`}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Upload size={14} />
        {busy && progress ? `Subiendo ${progress.done} de ${progress.total}…` : "Subir"}
      </button>
    </>
  );
}

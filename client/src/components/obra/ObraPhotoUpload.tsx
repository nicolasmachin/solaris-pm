import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Camera } from "lucide-react";

import { compressImage } from "../../utils/compressImage";
import { ACCEPT_FOTOS } from "../../utils/fileAccept";
import { uploadObraPhoto } from "../../api/obra.api";

interface Props {
  projectId: string;
}

// Subida de fotos de obra. El usuario puede elegir varias a la vez; las
// comprimimos y subimos de a UNA por request (el backend acepta 1 file por
// multipart), con un contador de progreso "Subiendo X de N".
export function ObraPhotoUpload({ projectId }: Props) {
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
      const file = list[i];
      try {
        const { blob, filename } = await compressImage(file);
        await uploadObraPhoto(projectId, blob, filename);
        ok++;
      } catch (err) {
        failed++;
        console.error("Error subiendo foto de obra:", file.name, err);
      }
      setProgress({ done: i + 1, total: list.length });
    }

    setBusy(false);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";

    await qc.invalidateQueries({ queryKey: ["obra-photos", projectId] });

    if (ok > 0 && failed === 0) {
      toast.success(ok === 1 ? "Foto subida" : `${ok} fotos subidas`);
    } else if (ok > 0 && failed > 0) {
      toast.success(`${ok} subida${ok === 1 ? "" : "s"}, ${failed} con error`);
    } else {
      toast.error("No se pudo subir ninguna foto");
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_FOTOS}
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
        className="tap-target inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        <Camera size={14} />
        {busy && progress
          ? `Subiendo ${progress.done} de ${progress.total}…`
          : "Subir fotos"}
      </button>
    </>
  );
}

import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import { proposalsV2DefaultsApi } from "../../../api/proposals-v2.api";
import type { CoverOverlay, CoverOverlayText } from "../../../types/proposals-v2";
import { Button } from "../../ui/Button";

const FIELDS: { key: keyof CoverOverlay; label: string }[] = [
  { key: "clientName", label: "Nombre del cliente" },
  { key: "city", label: "Ciudad" },
  { key: "date", label: "Fecha" },
];

const inputCls =
  "w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-xs text-[var(--color-text-primary)]";
const labelCls = "text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]";

export function CoverSection({
  coverOverlay,
  coverPdfAttachmentId,
  updatedAt,
  isAdmin,
  onChangeOverlay,
  onSaveConfig,
  savingConfig,
}: {
  coverOverlay: CoverOverlay | null;
  coverPdfAttachmentId: string | null;
  updatedAt: string | null;
  isAdmin: boolean;
  onChangeOverlay: (next: CoverOverlay) => void;
  onSaveConfig: () => void;
  savingConfig: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Baja la tapa actual como blob (con el token) y arma un object URL para el
  // iframe. Se rehace cuando cambia el attachment (tras un upload/reemplazo).
  useEffect(() => {
    if (!coverPdfAttachmentId) {
      setCoverUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    proposalsV2DefaultsApi
      .getCoverBlob()
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCoverUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setCoverUrl(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [coverPdfAttachmentId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await proposalsV2DefaultsApi.uploadCover(file);
      toast.success("Tapa subida");
      await qc.invalidateQueries({ queryKey: ["proposal-defaults"] });
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "No se pudo subir la tapa");
    } finally {
      setUploading(false);
    }
  }

  async function handleExamplePreview() {
    if (!coverOverlay) return;
    setPreviewing(true);
    try {
      const blob = await proposalsV2DefaultsApi.previewCover(coverOverlay);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // El tab nuevo retiene el blob; lo revocamos diferido para no cortarlo.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error("No se pudo generar la vista previa");
    } finally {
      setPreviewing(false);
    }
  }

  function updateField(key: keyof CoverOverlay, patch: Partial<CoverOverlayText>) {
    if (!coverOverlay) return;
    onChangeOverlay({ ...coverOverlay, [key]: { ...coverOverlay[key], ...patch } });
  }

  const hasCover = Boolean(coverPdfAttachmentId);

  return (
    <details
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
      open
    >
      <summary className="cursor-pointer text-sm font-semibold text-[var(--color-text-primary)]">
        Tapa
      </summary>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />

      {!hasCover ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            No hay tapa configurada. Subí un PDF de tapa diseñado en Canva (A4 vertical, 1 página).
          </p>
          {isAdmin && (
            <Button onClick={() => fileRef.current?.click()} loading={uploading}>
              Subir tapa PDF
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-text-muted)]">
              {updatedAt
                ? `Tapa configurada (últ. actualización ${new Date(updatedAt).toLocaleDateString("es-UY")}).`
                : "Tapa configurada."}
            </p>
            {isAdmin && (
              <Button variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}>
                Reemplazar tapa
              </Button>
            )}
          </div>

          {coverUrl ? (
            <iframe
              title="Vista previa de la tapa"
              src={coverUrl}
              className="h-[420px] w-full rounded border border-[var(--color-border)] bg-white"
            />
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">Cargando vista previa…</p>
          )}

          {coverOverlay && (
            <>
              <p className="text-xs text-[var(--color-text-muted)]">
                Coordenadas del overlay (px desde la esquina superior izquierda):
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {FIELDS.map(({ key, label }) => {
                  const field = coverOverlay[key];
                  return (
                    <div
                      key={key}
                      className="space-y-2 rounded-lg border border-[var(--color-border)] p-3"
                    >
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">{label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="space-y-0.5">
                          <span className={labelCls}>X (izq.)</span>
                          <input
                            type="number"
                            className={inputCls}
                            value={field.x}
                            disabled={!isAdmin}
                            onChange={(e) => updateField(key, { x: Number(e.target.value) })}
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className={labelCls}>Y (arriba)</span>
                          <input
                            type="number"
                            className={inputCls}
                            value={field.y}
                            disabled={!isAdmin}
                            onChange={(e) => updateField(key, { y: Number(e.target.value) })}
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className={labelCls}>Tamaño</span>
                          <input
                            type="number"
                            className={inputCls}
                            value={field.fontSize}
                            disabled={!isAdmin}
                            onChange={(e) => updateField(key, { fontSize: Number(e.target.value) })}
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className={labelCls}>Peso</span>
                          <select
                            className={inputCls}
                            value={field.fontWeight}
                            disabled={!isAdmin}
                            onChange={(e) =>
                              updateField(key, {
                                fontWeight: e.target.value as CoverOverlayText["fontWeight"],
                              })
                            }
                          >
                            <option value="regular">Regular</option>
                            <option value="bold">Bold</option>
                          </select>
                        </label>
                        <label className="col-span-2 flex items-center gap-2">
                          <span className={labelCls}>Color</span>
                          <input
                            type="color"
                            className="h-7 w-12 rounded border border-[var(--color-border)] bg-transparent"
                            value={field.color}
                            disabled={!isAdmin}
                            onChange={(e) => updateField(key, { color: e.target.value })}
                          />
                          <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                            {field.color}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={handleExamplePreview} loading={previewing}>
                    Vista previa con datos de ejemplo
                  </Button>
                  <Button onClick={onSaveConfig} loading={savingConfig}>
                    Guardar configuración
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </details>
  );
}

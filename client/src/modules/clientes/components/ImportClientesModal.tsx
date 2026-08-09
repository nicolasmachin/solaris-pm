import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import {
  importConfirm,
  importPreview,
  type ImportPreviewResponse,
  type ImportRowData,
} from "../../../api/clientes.api";
import { LargeModal } from "../../../components/ui/LargeModal";
import { Button } from "../../../components/ui/Button";

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const EXPECTED = [
  "Nombre",
  "Estado",
  "Recorrido",
  "Etapa",
  "Asesor",
  "Departamento",
  "Potencia kWp",
  "Fecha entrega",
  "Teléfono",
  "Mail",
];

function descargarPlantilla() {
  const csv = "﻿" + EXPECTED.join(",") + "\r\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "plantilla_generadores.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportClientesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    setSelected(new Set());
    setLoading(false);
    setSubmitting(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function analizar() {
    if (!file) return;
    setLoading(true);
    try {
      const res = await importPreview(file);
      setPreview(res);
      // Preseleccionar todas las importables (con nombre), incluidos duplicados.
      const pre = new Set<number>();
      res.rows.forEach((r, i) => {
        if (r.nombre) pre.add(i);
      });
      setSelected(pre);
    } catch (err) {
      toast.error(getApiErr(err) ?? "No se pudo analizar el CSV");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  const seleccionadas = useMemo(
    () => (preview ? preview.rows.filter((_, i) => selected.has(i)) : []),
    [preview, selected],
  );

  async function confirmar() {
    if (seleccionadas.length === 0) return;
    setSubmitting(true);
    try {
      const res = await importConfirm(
        seleccionadas.map((r: ImportRowData) => ({
          nombre: r.nombre,
          mail: r.mail,
          telefono: r.telefono,
          departamento: r.departamento,
          potenciaKwp: r.potenciaKwp,
          status: r.status,
          fechaEntrega: r.fechaEntrega,
          asesorId: r.asesorId,
        })),
      );
      toast.success(`${res.creados} Generador${res.creados !== 1 ? "es" : ""} importado${res.creados !== 1 ? "s" : ""}`);
      if (res.errores.length) toast.error(`${res.errores.length} fila(s) con error`);
      qc.invalidateQueries({ queryKey: ["clientes"] });
      close();
    } catch (err) {
      toast.error(getApiErr(err) ?? "No se pudo importar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <LargeModal open={open} onClose={close} ariaLabel="Importar Generadores" size="wide">
      <div className="flex flex-col gap-4 overflow-y-auto p-5">
        <h2 className="font-display text-xl font-bold text-[var(--color-text-primary)]">Importar Generadores desde CSV</h2>

        {!preview ? (
          // ─── Paso 1: estructura + archivo ───
          <>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-sm">
              <p className="mb-2 font-medium text-[var(--color-text-primary)]">Estructura esperada (una columna por cada uno):</p>
              <div className="flex flex-wrap gap-1.5">
                {EXPECTED.map((h) => {
                  const ignored = h === "Recorrido" || h === "Etapa";
                  return (
                    <span
                      key={h}
                      className={`rounded px-2 py-0.5 font-mono text-[11px] ${
                        ignored
                          ? "bg-[var(--color-bg-app)] text-[var(--color-text-muted)] line-through"
                          : "bg-[var(--color-bg-app)] text-[var(--color-text-secondary)]"
                      }`}
                      title={ignored ? "Se ignora (derivado del pipeline)" : undefined}
                    >
                      {h}
                      {h === "Nombre" && " *"}
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">
                <b>Nombre</b> es obligatorio. Las columnas faltantes se cargan en blanco. <span className="line-through">Recorrido</span> y{" "}
                <span className="line-through">Etapa</span> se ignoran (se derivan del pipeline). Los Generadores se crean sin
                proyecto/pipeline.
              </p>
              <button onClick={descargarPlantilla} className="mt-2 text-[12px] text-[var(--color-accent)] hover:underline">
                ↓ Descargar plantilla CSV
              </button>
            </div>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-[var(--color-text-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-1.5 file:text-sm file:text-gray-900"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={close}>
                Cancelar
              </Button>
              <Button size="sm" loading={loading} disabled={!file} onClick={analizar}>
                Analizar
              </Button>
            </div>
          </>
        ) : (
          // ─── Paso 2: preview ───
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-[var(--color-text-secondary)]">
                {preview.resumen.total} filas · {preview.resumen.importables} importables ·{" "}
                <span className="text-[var(--color-warning-text)]">{preview.resumen.duplicados} duplicados</span>
                {preview.resumen.sinNombre > 0 && ` · ${preview.resumen.sinNombre} sin nombre`}
              </span>
              {preview.headersFaltantes.length > 0 && (
                <span className="rounded bg-[var(--color-warning-bg)] px-2 py-0.5 text-[12px] text-[var(--color-warning-text)]">
                  Columnas faltantes (en blanco): {preview.headersFaltantes.join(", ")}
                </span>
              )}
            </div>

            <div className="max-h-[55vh] overflow-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-[var(--color-bg-card)] text-[var(--color-text-muted)]">
                  <tr className="text-left">
                    <th className="p-2"> </th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Mail</th>
                    <th className="p-2">Teléfono</th>
                    <th className="p-2">Departamento</th>
                    <th className="p-2">Potencia</th>
                    <th className="p-2">Asesor</th>
                    <th className="p-2">Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-t border-[var(--color-border)] ${
                        r.duplicado ? "bg-[var(--color-warning-bg)]/40" : ""
                      } ${!r.nombre ? "opacity-50" : ""}`}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          disabled={!r.nombre}
                          onChange={() => toggle(i)}
                        />
                      </td>
                      <td className="p-2 text-[var(--color-text-primary)]">{r.nombre || "—"}</td>
                      <td className="p-2 text-[var(--color-text-muted)]">{r.mail || "—"}</td>
                      <td className="p-2 text-[var(--color-text-muted)]">{r.telefono || "—"}</td>
                      <td className="p-2 text-[var(--color-text-muted)]">{r.departamento || "—"}</td>
                      <td className="p-2 text-[var(--color-text-muted)]">{r.potenciaKwp ?? "—"}</td>
                      <td className="p-2 text-[var(--color-text-muted)]">{r.asesorNombre || "—"}</td>
                      <td className="p-2 text-[11px]">
                        {r.duplicado && <span className="mr-1 text-[var(--color-warning-text)]">⚠ ya existe</span>}
                        {r.warnings.map((w, wi) => (
                          <span key={wi} className="mr-1 text-[var(--color-text-muted)]">
                            {w}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setPreview(null); setSelected(new Set()); }}>
                ← Volver
              </Button>
              <Button size="sm" loading={submitting} disabled={seleccionadas.length === 0} onClick={confirmar}>
                Importar {seleccionadas.length} seleccionado{seleccionadas.length !== 1 ? "s" : ""}
              </Button>
            </div>
          </>
        )}
      </div>
    </LargeModal>
  );
}

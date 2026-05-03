import { toast } from "react-hot-toast";
import { Download, FileText, Trash2 } from "lucide-react";
import {
  unifilarPdfUrl,
  unifilarSvgUrl,
  type UnifilarVersionListItem,
} from "../../../api/unifilar.api";
import { downloadWithAuth } from "./shared";

/**
 * Tabla de versiones de unifilar — usada tanto en el panel inline (3 últimas)
 * como en el modal de historial completo.
 */
export function UnifilarVersionsTable({
  versions,
  onPreview,
  onDuplicate,
  onDelete,
}: {
  versions: UnifilarVersionListItem[];
  onPreview: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded border border-[var(--color-border)] overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-[var(--color-bg-app)] text-[var(--color-text-muted)]">
          <tr className="text-left text-[10px] uppercase tracking-wider font-mono">
            <th className="px-2 py-1.5 w-12">#</th>
            <th className="px-2 py-1.5">Etiqueta</th>
            <th className="px-2 py-1.5">Red</th>
            <th className="px-2 py-1.5">Inv (kW)</th>
            <th className="px-2 py-1.5">Paneles</th>
            <th className="px-2 py-1.5">Creada</th>
            <th className="px-2 py-1.5 w-px">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {versions.map((v) => (
            <tr key={v.id} className="hover:bg-[var(--color-bg-card-hover)]">
              <td className="px-2 py-1.5 font-mono">v{v.versionNumber}</td>
              <td className="px-2 py-1.5 text-[var(--color-text-primary)]">
                {v.label || <span className="text-[var(--color-text-muted)] italic">—</span>}
              </td>
              <td className="px-2 py-1.5 font-mono text-[10px]">{v.tipoRed}</td>
              <td className="px-2 py-1.5 tabular-nums">{v.potenciaInversorKw}</td>
              <td className="px-2 py-1.5 tabular-nums">{v.cantidadPaneles}</td>
              <td className="px-2 py-1.5 text-[10px] text-[var(--color-text-muted)]">
                {new Date(v.createdAt).toLocaleDateString("es-UY", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                })}
              </td>
              <td className="px-2 py-1.5 text-right">
                <div className="flex items-center gap-1 justify-end">
                  <button
                    onClick={() => onPreview(v.id)}
                    className="px-2 py-0.5 rounded text-[10px] border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
                  >
                    Ver
                  </button>
                  <button
                    onClick={() =>
                      downloadWithAuth(unifilarSvgUrl(v.id), `unifilar_v${v.versionNumber}.svg`).catch(
                        () => toast.error("No se pudo descargar SVG"),
                      )
                    }
                    className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                    title="Descargar SVG"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() =>
                      downloadWithAuth(unifilarPdfUrl(v.id), `unifilar_v${v.versionNumber}.pdf`).catch(
                        () => toast.error("No se pudo descargar PDF"),
                      )
                    }
                    className="p-1 rounded hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-muted)]"
                    title="Descargar PDF"
                  >
                    <FileText className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onDuplicate(v.id)}
                    className="px-2 py-0.5 rounded text-[10px] border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
                    title="Duplicar como versión nueva"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => onDelete(v.id)}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";

import { getSeguimiento, listSecciones } from "../../api/capacitacion.api";
import { EmptyState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";

function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-UY", { day: "2-digit", month: "short", year: "numeric" });
}

// Quién vio qué. Se listan los usuarios activos de los roles del área, más
// cualquiera con progreso (por ejemplo si después se le sacó el rol).
export function GestionSeguimiento() {
  const [seccionId, setSeccionId] = useState("");
  const { data: secciones } = useQuery({ queryKey: ["capacitacion", "secciones"], queryFn: listSecciones });
  const elegida = seccionId || secciones?.secciones[0]?.id || "";
  const { data, isLoading } = useQuery({
    queryKey: ["capacitacion", "seguimiento", elegida],
    queryFn: () => getSeguimiento(elegida),
    enabled: Boolean(elegida),
  });

  const seccion = data?.[0];

  return (
    <div className="space-y-4">
      <select
        value={elegida}
        onChange={(e) => setSeccionId(e.target.value)}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
      >
        {(secciones?.secciones ?? []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size={26} />
        </div>
      ) : !seccion ? (
        <EmptyState title="Elegí un área" />
      ) : seccion.usuarios.length === 0 ? (
        <EmptyState
          title="Nadie tiene asignada esta área"
          description="Asigná roles desde la pestaña Áreas y roles."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[var(--color-bg-card)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-mono">Persona</th>
                <th className="px-3 py-2 text-left font-mono">Rol</th>
                {seccion.listas.map((l) => (
                  <th key={l.id} className="px-3 py-2 text-center font-mono">
                    {l.titulo}
                  </th>
                ))}
                <th className="px-3 py-2 text-center font-mono">Total</th>
                <th className="px-3 py-2 text-left font-mono">Última vez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {seccion.usuarios.map((u) => {
                const completo = u.totalVideos > 0 && u.completados === u.totalVideos;
                return (
                  <tr key={u.userId} className="bg-[var(--color-bg-card)]">
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      {u.nombre}
                      {u.fueraDeRoles && (
                        <span className="ml-1.5 text-[10px] text-[var(--color-text-muted)]">(otro rol)</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{u.rol}</td>
                    {seccion.listas.map((l) => {
                      const hechos = u.porLista[l.id] ?? 0;
                      return (
                        <td key={l.id} className="px-3 py-2 text-center text-[var(--color-text-secondary)]">
                          {l.totalVideos > 0 && hechos === l.totalVideos ? (
                            <Check size={14} className="mx-auto text-emerald-500" />
                          ) : (
                            <span className={hechos === 0 ? "text-[var(--color-text-muted)]" : ""}>
                              {hechos}/{l.totalVideos}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td
                      className={`px-3 py-2 text-center font-medium ${
                        completo ? "text-emerald-500" : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {u.completados}/{u.totalVideos}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-muted)]">{fmtFecha(u.ultimaActividad)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

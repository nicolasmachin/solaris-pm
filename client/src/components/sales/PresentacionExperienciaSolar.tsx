import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { Copy, Handshake } from "lucide-react";

import { getAssignableUsers } from "../../api/users.api";

/**
 * Plantilla con la que el asesor, al cerrar la venta, le presenta al cliente el
 * responsable de Experiencia Solar, que desde ahí es su contacto.
 *
 * `{nombre}` se completa con el nombre del cliente del lead y `{responsable}`
 * con el nombre de pila del usuario con rol EXPERIENCIA_SOLAR. Si hay varios se
 * elige de una lista; si no hay ninguno, el marcador queda a la vista para
 * completarlo a mano (un hueco que se ve es mejor que un nombre inventado).
 */
export const PLANTILLA_PRESENTACION_ES =
  "{nombre}, te presento a {responsable}, de Experiencia Solar. Desde ahora es tu contacto para todo lo que sigue: la fecha de obra, la instalación y el trámite con UTE. Te comparto su contacto; en estos días te va a escribir. Cualquier cosa, seguí con ella.";

function nombreDePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

export function PresentacionExperienciaSolar({ clientName }: { clientName: string }) {
  const usersQ = useQuery({
    queryKey: ["users-assignable"],
    queryFn: getAssignableUsers,
    staleTime: 5 * 60_000,
  });
  const responsables = useMemo(
    () => (usersQ.data ?? []).filter((u) => u.role === "EXPERIENCIA_SOLAR"),
    [usersQ.data],
  );
  const [responsableId, setResponsableId] = useState<string>("");
  useEffect(() => {
    if (!responsableId && responsables.length > 0) setResponsableId(responsables[0].id);
  }, [responsables, responsableId]);

  const responsable = responsables.find((u) => u.id === responsableId);
  const generado = PLANTILLA_PRESENTACION_ES.replaceAll("{nombre}", clientName.trim() || "{nombre}").replaceAll(
    "{responsable}",
    responsable ? nombreDePila(responsable.name) : "{responsable}",
  );

  const [texto, setTexto] = useState(generado);
  useEffect(() => setTexto(generado), [generado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Mensaje copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  return (
    <section className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-app)] p-3 text-left">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
          <Handshake className="h-3 w-3" />
          Presentación de Experiencia Solar
        </p>
        {responsables.length > 1 && (
          <select
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
            aria-label="Responsable de Experiencia Solar"
          >
            {responsables.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="mb-2 text-[11px] text-[var(--color-text-muted)]">
        Al cerrar la venta, para pasarle el cliente a Experiencia Solar. Se puede retocar antes de copiar.
      </p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
        >
          <Copy size={14} /> Copiar mensaje
        </button>
      </div>
    </section>
  );
}

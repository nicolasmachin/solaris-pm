import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

import {
  createSeccion,
  deleteSeccion,
  listRolesAsignables,
  listSecciones,
  reordenarSecciones,
  setRolesSeccion,
  updateSeccion,
  type SeccionResumen,
} from "../../api/capacitacion.api";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";

const inputClass =
  "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]";

// Alta y edición de áreas, y —lo importante— qué roles ven cada una. Un área sin
// roles no la ve nadie salvo quien gestiona.
export function GestionSecciones() {
  const qc = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["capacitacion", "secciones"], queryFn: listSecciones });
  const { data: roles } = useQuery({ queryKey: ["capacitacion", "roles"], queryFn: listRolesAsignables });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["capacitacion"] });

  const crear = useMutation({
    mutationFn: () => createSeccion({ nombre: nombre.trim(), roleIds: [] }),
    onSuccess: () => {
      toast.success("Área creada. Elegí qué roles la ven.");
      setNombre("");
      setCreando(false);
      invalidar();
    },
    onError: () => toast.error("No se pudo crear el área"),
  });

  const mover = useMutation({
    mutationFn: (ids: string[]) => reordenarSecciones(ids),
    onSuccess: invalidar,
    onError: () => toast.error("No se pudo cambiar el orden"),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => deleteSeccion(id),
    onSuccess: () => {
      toast.success("Área borrada");
      invalidar();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? "No se pudo borrar el área"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size={26} />
      </div>
    );
  }

  const secciones = data?.secciones ?? [];

  function moverSeccion(i: number, delta: number) {
    const ids = secciones.map((s) => s.id);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    mover.mutate(ids);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          Cada área se muestra a los roles que tildes. Las áreas ocultas solo las ves vos.
        </p>
        <Button size="sm" onClick={() => setCreando((v) => !v)}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Nueva área
          </span>
        </Button>
      </div>

      {creando && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (nombre.trim()) crear.mutate();
          }}
          className="flex gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"
        >
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre del área (ej. Posventa)"
            className={inputClass}
          />
          <Button size="sm" type="submit" loading={crear.isPending} disabled={!nombre.trim()}>
            Crear
          </Button>
        </form>
      )}

      <div className="space-y-3">
        {secciones.map((s, i) => (
          <FilaSeccion
            key={s.id}
            seccion={s}
            roles={roles ?? []}
            puedeSubir={i > 0}
            puedeBajar={i < secciones.length - 1}
            onMover={(d) => moverSeccion(i, d)}
            onBorrar={() => borrar.mutate(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FilaSeccion({
  seccion,
  roles,
  puedeSubir,
  puedeBajar,
  onMover,
  onBorrar,
}: {
  seccion: SeccionResumen;
  roles: Array<{ id: string; name: string; label: string }>;
  puedeSubir: boolean;
  puedeBajar: boolean;
  onMover: (delta: number) => void;
  onBorrar: () => void;
}) {
  const qc = useQueryClient();
  const asignados = seccion.roles?.map((r) => r.id) ?? [];
  const [seleccion, setSeleccion] = useState<string[]>(asignados);
  const [nombre, setNombre] = useState(seccion.nombre);

  // Si el área cambia desde otro lado (reorden, refetch), re-sincronizar.
  useEffect(() => {
    setSeleccion(seccion.roles?.map((r) => r.id) ?? []);
    setNombre(seccion.nombre);
  }, [seccion]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["capacitacion"] });

  const guardarRoles = useMutation({
    mutationFn: (ids: string[]) => setRolesSeccion(seccion.id, ids),
    onSuccess: () => {
      toast.success("Roles actualizados");
      invalidar();
    },
    onError: () => toast.error("No se pudieron guardar los roles"),
  });

  const guardarSeccion = useMutation({
    mutationFn: (body: { nombre?: string; activa?: boolean }) => updateSeccion(seccion.id, body),
    onSuccess: invalidar,
    onError: () => toast.error("No se pudo guardar"),
  });

  const sinCambios = JSON.stringify([...seleccion].sort()) === JSON.stringify([...asignados].sort());

  function toggleRol(id: string) {
    setSeleccion((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => {
            if (nombre.trim() && nombre !== seccion.nombre) guardarSeccion.mutate({ nombre: nombre.trim() });
          }}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-base font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-border)] focus:border-[var(--color-border)]"
        />
        <span className="text-[11px] text-[var(--color-text-muted)]">
          {seccion.totalVideos} videos · {seccion.totalDocumentos} documentos
        </span>
        <button
          title={seccion.activa ? "Ocultar a todos" : "Mostrar"}
          onClick={() => guardarSeccion.mutate({ activa: !seccion.activa })}
          className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)]"
        >
          {seccion.activa ? <Eye size={16} /> : <EyeOff size={16} className="text-amber-500" />}
        </button>
        <button
          disabled={!puedeSubir}
          onClick={() => onMover(-1)}
          className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30"
        >
          <ChevronUp size={16} />
        </button>
        <button
          disabled={!puedeBajar}
          onClick={() => onMover(1)}
          className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] disabled:opacity-30"
        >
          <ChevronDown size={16} />
        </button>
        <button
          title="Borrar (solo si está vacía)"
          onClick={() => {
            if (window.confirm(`¿Borrar el área "${seccion.nombre}"?`)) onBorrar();
          }}
          className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card-hover)] hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {roles.map((r) => {
          const activo = seleccion.includes(r.id);
          return (
            <button
              key={r.id}
              onClick={() => toggleRol(r.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                activo
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-[var(--color-text-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {r.label}
            </button>
          );
        })}
        {!sinCambios && (
          <Button size="sm" loading={guardarRoles.isPending} onClick={() => guardarRoles.mutate(seleccion)}>
            Guardar roles
          </Button>
        )}
      </div>
      {seleccion.length === 0 && (
        <p className="mt-2 text-[11px] text-amber-500">Sin roles: esta área no la ve nadie más que vos.</p>
      )}
    </div>
  );
}

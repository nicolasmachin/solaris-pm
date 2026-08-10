import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { getStageSlas, putStageSla, type StageSlaRow } from "../../api/stageSla.api";
import { stageLabel } from "../../constants/stages";

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

// Fila editable: mantiene su propio borrador (días + activo) hasta guardar.
function SlaRow({ row }: { row: StageSlaRow }) {
  const qc = useQueryClient();
  const [dias, setDias] = useState<string>(row.diasHabiles?.toString() ?? "");
  const [activo, setActivo] = useState<boolean>(row.activo);

  // Re-sincroniza si cambia el dato del server (invalidación).
  useEffect(() => {
    setDias(row.diasHabiles?.toString() ?? "");
    setActivo(row.activo);
  }, [row.diasHabiles, row.activo]);

  const saveMut = useMutation({
    mutationFn: () => {
      const n = Number.parseInt(dias, 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Ingresá un número de días hábiles mayor a 0");
      return putStageSla(row.stageType, { diasHabiles: n, activo });
    },
    onSuccess: () => {
      toast.success(`Plazo de ${stageLabel(row.stageType)} guardado`);
      qc.invalidateQueries({ queryKey: ["stage-slas"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? (err as Error).message ?? "Error al guardar"),
  });

  const dirty = (row.diasHabiles?.toString() ?? "") !== dias || row.activo !== activo;

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-3 py-2 text-[var(--color-text-primary)] font-medium">{stageLabel(row.stageType)}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={1}
          step={1}
          value={dias}
          onChange={(e) => setDias(e.target.value)}
          placeholder="—"
          className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        />
        <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">días hábiles</span>
      </td>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
      </td>
      <td className="px-3 py-2 text-right">
        <button
          onClick={() => saveMut.mutate()}
          disabled={!dirty || saveMut.isPending}
          className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-[var(--color-bg-app)] hover:opacity-90 disabled:opacity-40"
        >
          {saveMut.isPending ? "Guardando…" : "Guardar"}
        </button>
      </td>
    </tr>
  );
}

export function TabStageSlas() {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["stage-slas"], queryFn: getStageSlas });

  return (
    <div>
      <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-xs text-[var(--color-text-secondary)]">
        <p className="font-semibold mb-1">Plazo objetivo de cada etapa</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Definí cuántos <strong>días hábiles</strong> (lunes a viernes) debería durar cada etapa. La cuenta
          regresiva del proyecto y del listado arranca cuando la etapa empieza de verdad y se pone en amarillo
          cuando falta poco y en rojo cuando se pasa del plazo. Si dejás una etapa inactiva, no muestra cuenta
          regresiva. No contempla feriados.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-app)] text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-mono">
              <th className="px-3 py-2 text-left">Etapa</th>
              <th className="px-3 py-2 text-left">Plazo</th>
              <th className="px-3 py-2 text-center">Activo</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-[var(--color-text-muted)]">Cargando…</td></tr>
            ) : (
              rows.map((row) => <SlaRow key={row.stageType} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

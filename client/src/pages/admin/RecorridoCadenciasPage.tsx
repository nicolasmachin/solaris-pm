import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { getRecorridoCadencias, putRecorridoCadencia, type RecorridoCadenciaRow } from "../../api/recorridoCadencia.api";

function getApiErr(err: unknown) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

const RECORRIDO_LABEL: Record<string, string> = {
  E1: "E1 · De la venta a la obra",
  E2: "E2 · De la obra a la habilitación",
  E3: "E3 · Post-Habilitación",
};

function CadenciaRow({ row }: { row: RecorridoCadenciaRow }) {
  const qc = useQueryClient();
  const [dias, setDias] = useState<string>(row.diasObjetivo?.toString() ?? "");
  const [activo, setActivo] = useState<boolean>(row.activo);

  useEffect(() => {
    setDias(row.diasObjetivo?.toString() ?? "");
    setActivo(row.activo);
  }, [row.diasObjetivo, row.activo]);

  const saveMut = useMutation({
    mutationFn: () => {
      const n = Number.parseInt(dias, 10);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Ingresá un número de días mayor a 0");
      return putRecorridoCadencia(row.recorrido, { diasObjetivo: n, activo });
    },
    onSuccess: () => {
      toast.success(`Cadencia de ${row.recorrido} guardada`);
      qc.invalidateQueries({ queryKey: ["recorrido-cadencias"] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? (err as Error).message ?? "Error al guardar"),
  });

  const dirty = (row.diasObjetivo?.toString() ?? "") !== dias || row.activo !== activo;

  return (
    <tr className="border-t border-[var(--color-border)]">
      <td className="px-3 py-2 text-[var(--color-text-primary)] font-medium">{RECORRIDO_LABEL[row.recorrido] ?? row.recorrido}</td>
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
        <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">días</span>
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

export function TabCadenciaRecorrido() {
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["recorrido-cadencias"], queryFn: getRecorridoCadencias });

  return (
    <div>
      <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 text-xs text-[var(--color-text-secondary)]">
        <p className="font-semibold mb-1">Cadencia de contacto (E1/E2/E3)</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          Definí cada cuántos <strong>días</strong> como máximo debería registrarse una interacción con el cliente en
          cada etapa de su recorrido. Cuando pasa ese objetivo sin una interacción registrada, el cliente aparece en la
          tarjeta <strong>“Sin comunicación”</strong> del Panel de operaciones. Cuenta la última interacción registrada
          en Experiencia Solar; si nunca se registró ninguna, se muestra como “Sin contacto”.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-app)] text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider font-mono">
              <th className="px-3 py-2 text-left">Recorrido</th>
              <th className="px-3 py-2 text-left">Objetivo</th>
              <th className="px-3 py-2 text-center">Activo</th>
              <th className="px-3 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-[var(--color-text-muted)]">Cargando…</td></tr>
            ) : (
              rows.map((row) => <CadenciaRow key={row.recorrido} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

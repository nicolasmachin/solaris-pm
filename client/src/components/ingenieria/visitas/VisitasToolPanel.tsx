import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { ArrowRight, Calendar, FileText, Plus, Trash2, User } from "lucide-react";
import {
  createVisita,
  deleteVisita,
  getVisitas,
  type VisitListItem,
  type VisitType,
} from "../../../api/visitas.api";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_ES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
}

const VISIT_TYPE_LABEL: Record<VisitType, string> = {
  INICIAL: "Inicial",
  REVISION: "Revisión",
  COMPLEMENTARIA: "Complementaria",
};

function getApiErr(err: unknown): string | undefined {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
}

export function VisitasToolPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<VisitType>("INICIAL");
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [newNotes, setNewNotes] = useState("");

  const visitsQ = useQuery({
    queryKey: ["technical-visits", projectId],
    queryFn: () => getVisitas(projectId),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createVisita(projectId, {
        visitDate: new Date(newDate).toISOString(),
        visitType: newType,
        notes: newNotes.trim() || null,
      }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["technical-visits", projectId] });
      navigate(`/ingenieria/proyecto/${projectId}/visita/${created.id}`);
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo crear la visita"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteVisita(id),
    onSuccess: () => {
      toast.success("Visita eliminada");
      qc.invalidateQueries({ queryKey: ["technical-visits", projectId] });
    },
    onError: (err) => toast.error(getApiErr(err) ?? "No se pudo eliminar"),
  });

  function handleDelete(id: string) {
    if (confirm("¿Eliminar esta visita y todos sus inputs e informes?")) {
      deleteMut.mutate(id);
    }
  }

  const visits = visitsQ.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-muted)]">
          Cargá audios, fotos y notas durante la visita técnica. La IA genera un informe
          estructurado en 7 secciones que se actualiza con cada input nuevo.
        </p>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 shrink-0"
        >
          <Plus className="w-3 h-3" /> Nueva visita
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 p-3 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-mono text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
                Tipo
              </label>
              <select
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs"
                value={newType}
                onChange={(e) => setNewType(e.target.value as VisitType)}
              >
                <option value="INICIAL">Inicial</option>
                <option value="REVISION">Revisión</option>
                <option value="COMPLEMENTARIA">Complementaria</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
                Fecha
              </label>
              <input
                type="date"
                className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wider">
              Notas generales (opcional)
            </label>
            <textarea
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-2 py-1.5 text-xs min-h-[50px]"
              placeholder="Ej: relevamiento general, cliente disponible 14-16h"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setCreating(false)}
              className="rounded border border-[var(--color-border)] px-2.5 py-1 text-[11px] hover:bg-[var(--color-bg-card-hover)]"
            >
              Cancelar
            </button>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {createMut.isPending ? "Creando…" : "Crear y abrir"}
            </button>
          </div>
        </div>
      )}

      {visitsQ.isLoading ? (
        <p className="text-xs text-[var(--color-text-muted)]">Cargando…</p>
      ) : visits.length === 0 && !creating ? (
        <p className="rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg-app)] p-6 text-center text-xs text-[var(--color-text-muted)]">
          Sin visitas registradas todavía.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visits.map((v) => (
            <VisitRow
              key={v.id}
              visit={v}
              onOpen={() => navigate(`/ingenieria/proyecto/${projectId}/visita/${v.id}`)}
              onDelete={() => handleDelete(v.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function VisitRow({
  visit,
  onOpen,
  onDelete,
}: {
  visit: VisitListItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-bg-app)] px-3 py-2">
      <Calendar className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-primary)]">
          <span className="font-mono">{VISIT_TYPE_LABEL[visit.visitType]}</span>
          <span className="text-[var(--color-text-muted)]"> · {fmtDate(visit.visitDate)}</span>
        </p>
        <p className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5 flex items-center gap-2">
          <User className="w-3 h-3" /> {visit.createdBy.name}
          <span>·</span>
          <span>
            {visit.inputsCount} input{visit.inputsCount === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <FileText className="w-3 h-3" />
          <span>
            {visit.reportsCount} informe{visit.reportsCount === 1 ? "" : "s"}
          </span>
        </p>
      </div>
      <button
        onClick={onOpen}
        className="inline-flex items-center gap-1 rounded border border-[var(--color-border)] px-2 py-1 text-[10px] hover:bg-[var(--color-bg-card-hover)]"
      >
        Abrir <ArrowRight className="w-3 h-3" />
      </button>
      <button
        onClick={onDelete}
        className="p-1 rounded hover:bg-red-500/20 text-red-400"
        title="Eliminar"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  );
}
